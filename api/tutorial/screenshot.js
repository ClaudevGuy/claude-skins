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

  try {
    // Use tall viewport (1280x1600) to capture more of the page for scrolling
    const apiUrl = `https://api.microlink.io/?url=${encodeURIComponent(url)}&screenshot=true&meta=true&viewport.width=1280&viewport.height=1600&screenshot.type=png&waitForTimeout=5000`;

    const response = await fetch(apiUrl, {
      headers: { 'User-Agent': 'Claude-Skins-Tutorial/1.0' }
    });
    const data = await response.json();

    if (data.status !== 'success' || !data.data?.screenshot?.url) {
      return res.status(400).json({
        error: 'Could not load URL. The site may be unreachable or took too long to respond.'
      });
    }

    // Fetch the screenshot image and convert to base64
    const imgResponse = await fetch(data.data.screenshot.url);
    const buffer = Buffer.from(await imgResponse.arrayBuffer());
    const screenshot = buffer.toString('base64');

    // Extract page info from Microlink metadata
    const pageInfo = {
      title: data.data.title || '',
      description: data.data.description || '',
      h1: data.data.title || '',
    };

    res.status(200).json({
      screenshot,
      fullScreenshot: screenshot,
      elements: [],
      pageInfo,
      viewport: { width: 1280, height: 1600 }
    });
  } catch (err) {
    res.status(500).json({ error: 'Internal error: ' + (err.message || 'Unknown') });
  }
};
