const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');

// Simple in-memory rate limiter
const rateLimit = {};
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW = 60000;

function checkRateLimit(ip) {
  const now = Date.now();
  if (!rateLimit[ip]) rateLimit[ip] = [];
  rateLimit[ip] = rateLimit[ip].filter(t => now - t < RATE_LIMIT_WINDOW);
  if (rateLimit[ip].length >= RATE_LIMIT_MAX) return false;
  rateLimit[ip].push(now);
  return true;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: 'Please wait a moment before generating another tutorial.' });
  }

  const { url } = req.body || {};

  if (!url || (!/^https?:\/\//i.test(url))) {
    return res.status(400).json({ error: 'Please provide a valid URL starting with http:// or https://' });
  }

  let browser;
  try {
    browser = await puppeteer.launch({
      args: [...chromium.args, '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--single-process'],
      defaultViewport: { width: 1280, height: 800 },
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
      ignoreHTTPSErrors: true,
    });

    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    try {
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 10000 });
    } catch (e) {
      return res.status(400).json({ error: 'Could not load URL. The site may be unreachable or took too long to respond.' });
    }

    // Viewport screenshot
    const screenshot = await page.screenshot({
      encoding: 'base64',
      fullPage: false,
      type: 'png'
    });

    // Full-page screenshot for Claude context
    let fullScreenshot;
    try {
      fullScreenshot = await page.screenshot({
        encoding: 'base64',
        fullPage: true,
        type: 'png'
      });
    } catch (e) {
      fullScreenshot = screenshot;
    }

    // Extract interactive elements
    const elements = await page.evaluate(() => {
      const interactiveSelectors = [
        'a[href]', 'button', 'input', 'textarea', 'select',
        '[role="button"]', '[onclick]', 'nav a', '.btn', '[type="submit"]'
      ];
      const results = [];
      const seen = new Set();

      interactiveSelectors.forEach(selector => {
        document.querySelectorAll(selector).forEach(el => {
          if (seen.has(el)) return;
          seen.add(el);
          const rect = el.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) return;
          if (rect.top > window.innerHeight * 2) return;

          results.push({
            tagName: el.tagName.toLowerCase(),
            type: el.getAttribute('type') || '',
            text: (el.textContent || '').trim().substring(0, 100),
            placeholder: el.getAttribute('placeholder') || '',
            ariaLabel: el.getAttribute('aria-label') || '',
            href: el.getAttribute('href') || '',
            role: el.getAttribute('role') || '',
            rect: {
              x: Math.round(rect.x),
              y: Math.round(rect.y),
              width: Math.round(rect.width),
              height: Math.round(rect.height),
            }
          });
        });
      });
      return results;
    });

    // Extract page info
    const pageInfo = await page.evaluate(() => ({
      title: document.title,
      description: document.querySelector('meta[name="description"]')?.content || '',
      h1: document.querySelector('h1')?.textContent?.trim() || '',
    }));

    res.status(200).json({
      screenshot,
      fullScreenshot,
      elements,
      pageInfo,
      viewport: { width: 1280, height: 800 }
    });
  } catch (err) {
    res.status(500).json({ error: 'Internal error: ' + (err.message || 'Unknown') });
  } finally {
    if (browser) {
      try { await browser.close(); } catch (e) {}
    }
  }
};
