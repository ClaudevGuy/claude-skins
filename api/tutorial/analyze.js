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

function generateFallbackTutorial(pageInfo) {
  return {
    title: 'Getting Started with ' + ((pageInfo && pageInfo.title) || 'This Page'),
    steps: [
      { x: 640, y: 80, action: 'hover', zoom: 1.0, duration: 2000,
        title: 'Page Header', callout: 'Welcome! Let\'s take a quick tour of this page and discover its key features' },
      { x: 200, y: 60, action: 'hover', zoom: 1.4, duration: 2000,
        title: 'Navigation', callout: 'Use the navigation menu to explore different sections and find what you need' },
      { x: 640, y: 350, action: 'click', zoom: 1.6, duration: 2500,
        title: 'Main Content', callout: 'The main content area contains the core information and primary actions' },
      { x: 640, y: 600, action: 'hover', zoom: 1.3, duration: 2000,
        title: 'More Features', callout: 'Scroll down to discover additional features and detailed information below' },
      { x: 900, y: 350, action: 'click', zoom: 1.5, duration: 2500,
        title: 'Call to Action', callout: 'Click the primary button to get started with the main workflow' },
    ]
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: 'Please wait a moment before generating another tutorial.' });
  }

  const { screenshot, elements, pageInfo, viewport } = req.body || {};

  if (!screenshot) {
    return res.status(400).json({ error: 'Missing screenshot data' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'ANTHROPIC_API_KEY not configured',
      setup: true
    });
  }

  const hasElements = elements && Array.isArray(elements) && elements.length > 0;
  const imgWidth = (viewport && viewport.width) || 1280;
  const imgHeight = (viewport && viewport.height) || 1600;

  const elementContext = hasElements
    ? `\n\nInteractive elements with pixel coordinates:\n${JSON.stringify(elements, null, 2)}`
    : `\n\nNo pre-extracted element data. Visually identify all interactive elements from the screenshot and estimate their pixel coordinates. The screenshot is ${imgWidth}x${imgHeight} pixels.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/png',
                data: screenshot
              }
            },
            {
              type: 'text',
              text: `You are creating a professional, engaging tutorial walkthrough for this webpage — like an interactive onboarding guide.

Page: ${(pageInfo && pageInfo.title) || 'Unknown'}
Description: ${(pageInfo && pageInfo.description) || ''}
Screenshot: exactly 1280x800 pixels. This is the ENTIRE visible area.
${elementContext}

Create 6-10 steps that guide a new user through the VISIBLE elements on this page.

For each step provide:
- x, y: EXACT pixel coordinates of the element's CENTER in the 1280x800 image. Look carefully at where elements actually are. x must be 20-1260, y must be 20-780.
- action: "click", "hover", or "type"
- title: short element name (2-4 words, e.g. "Search Bar", "Sign Up Button")
- callout: descriptive text explaining what this does and WHY the user should care (12-25 words). Write like a friendly guide.
- zoom: 1.0 (full view), 1.3 (slight focus), 1.5 (close-up), 1.8 (detail)
- duration: time in ms (1800-2500 for a brisk pace)

Respond ONLY with this JSON:
{
  "title": "Getting Started with [Page Name]",
  "steps": [
    {
      "x": 640, "y": 100,
      "action": "hover",
      "title": "Page Header",
      "callout": "Welcome! This is the main dashboard where you can manage everything in one place",
      "zoom": 1.0,
      "duration": 2000
    }
  ]
}

CRITICAL RULES:
- ALL coordinates must point to VISIBLE elements in the 1280x800 screenshot
- Look VERY carefully at the actual pixel positions of buttons, links, text, and UI elements
- x and y must be the CENTER of the element, not a corner
- Do NOT reference elements you cannot see in the screenshot
- START with a wide overview (zoom 1.0) of the header area to orient the user
- Then move through: navigation, main CTA/buttons, key features, input fields
- VARY zoom levels: alternate overview (1.0-1.3) with close-ups (1.5-1.8) for visual interest
- VARY actions: mix clicks and hovers so it doesn't feel repetitive
- Write callouts that explain benefits and purpose, not just labels
- For "type" actions, include a "typeText" field with example text
- Keep all y values between 20 and 780 — nothing outside the visible screenshot`
            }
          ]
        }]
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      if (response.status === 401) {
        return res.status(401).json({ error: 'Invalid API key', setup: true });
      }
      throw new Error('Anthropic API error: ' + response.status + ' ' + errText);
    }

    const data = await response.json();
    const textContent = data.content && data.content[0] && data.content[0].text;

    if (!textContent) {
      throw new Error('Empty response from Claude');
    }

    let tutorial;
    try {
      tutorial = JSON.parse(textContent);
    } catch (e) {
      const jsonMatch = textContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        try { tutorial = JSON.parse(jsonMatch[1]); } catch (e2) {
          const objMatch = textContent.match(/\{[\s\S]*\}/);
          if (objMatch) tutorial = JSON.parse(objMatch[0]);
        }
      }
    }

    if (!tutorial || !tutorial.steps || !Array.isArray(tutorial.steps)) {
      tutorial = generateFallbackTutorial(pageInfo);
    }

    // Validate and clean up steps
    tutorial.steps = tutorial.steps.filter(s => (
      typeof s.x === 'number' && typeof s.y === 'number' && (s.callout || s.title)
    )).map(s => ({
      x: Math.round(Math.min(Math.max(s.x, 20), 1260)),
      y: Math.round(Math.min(Math.max(s.y, 20), 780)),
      action: s.action || 'click',
      title: String(s.title || s.elementText || '').substring(0, 40),
      callout: String(s.callout || '').substring(0, 120),
      zoom: Math.max(1.0, Math.min(2.5, s.zoom || 1.5)),
      duration: Math.max(1500, Math.min(3000, s.duration || 2000)),
      typeText: s.typeText || undefined
    }));

    if (tutorial.steps.length === 0) {
      tutorial = generateFallbackTutorial(pageInfo);
    }

    // Pass image dimensions for scroll calculation
    tutorial.imageHeight = imgHeight;

    res.status(200).json(tutorial);
  } catch (err) {
    try {
      const fallback = generateFallbackTutorial(pageInfo || {});
      return res.status(200).json(fallback);
    } catch (e) {
      return res.status(500).json({ error: 'Failed to generate tutorial: ' + (err.message || 'Unknown error') });
    }
  }
};
