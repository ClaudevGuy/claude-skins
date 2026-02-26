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

function generateFallbackTutorial(elements, pageInfo) {
  const steps = [];
  const visibleElements = elements.filter(e => e.rect.y < 800 && e.rect.width > 20);

  // Step 1: main heading / overview
  steps.push({
    x: 640, y: 300, action: 'hover', zoom: 1.0, duration: 3000,
    callout: pageInfo.title ? 'Welcome to ' + pageInfo.title.substring(0, 30) : 'Overview of the page',
    elementText: pageInfo.h1 || pageInfo.title || 'Page'
  });

  // Step 2: largest button or link
  const buttons = visibleElements.filter(e => e.tagName === 'button' || e.role === 'button' || e.tagName === 'a');
  if (buttons.length > 0) {
    const largest = buttons.sort((a, b) => (b.rect.width * b.rect.height) - (a.rect.width * a.rect.height))[0];
    steps.push({
      x: largest.rect.x + largest.rect.width / 2,
      y: largest.rect.y + largest.rect.height / 2,
      action: 'click', zoom: 1.5, duration: 3000,
      callout: 'Click "' + (largest.text || 'this button').substring(0, 20) + '"',
      elementText: largest.text || 'Button'
    });
  }

  // Step 3: nav area
  const navLinks = visibleElements.filter(e => e.tagName === 'a' && e.rect.y < 100);
  if (navLinks.length > 0) {
    steps.push({
      x: navLinks[0].rect.x + navLinks[0].rect.width / 2,
      y: navLinks[0].rect.y + navLinks[0].rect.height / 2,
      action: 'hover', zoom: 1.5, duration: 3000,
      callout: 'Use the navigation to explore more',
      elementText: 'Navigation'
    });
  }

  return { title: 'Tutorial: ' + (pageInfo.title || 'This Page'), steps };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown';
  if (!checkRateLimit(ip)) {
    return res.status(429).json({ error: 'Please wait a moment before generating another tutorial.' });
  }

  const { screenshot, elements, pageInfo } = req.body || {};

  if (!screenshot || !elements) {
    return res.status(400).json({ error: 'Missing screenshot or elements data' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'ANTHROPIC_API_KEY not configured',
      setup: true
    });
  }

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
              text: `You are analyzing a webpage to create a tutorial walkthrough.

Page title: ${(pageInfo && pageInfo.title) || ''}
Page description: ${(pageInfo && pageInfo.description) || ''}
Main heading: ${(pageInfo && pageInfo.h1) || ''}

Here are all the interactive elements on the page with their pixel coordinates:
${JSON.stringify(elements, null, 2)}

Create a tutorial that walks a new user through this page. Generate 4-8 steps.

For each step, choose the most important interactive element to highlight and provide:
1. The exact pixel coordinates to move the cursor to (center of the element)
2. The action type: "click", "hover", "scroll", "type"
3. A short callout text explaining what this element does (max 15 words)
4. A zoom level (1.0 = no zoom, 1.5 = moderate zoom, 2.0 = close zoom)

Respond ONLY in this exact JSON format, no other text:
{
  "title": "Tutorial title based on the page",
  "steps": [
    {
      "x": 640,
      "y": 300,
      "action": "click",
      "callout": "Click here to sign up for a new account",
      "zoom": 1.5,
      "elementText": "Sign Up",
      "duration": 3000
    }
  ]
}

Important:
- Order steps in a logical user flow (what would a new user do first?)
- Start with the most prominent/important element
- x and y coordinates must match actual element positions from the data provided
- Keep callout text concise and helpful
- Set duration between 2000-4000ms per step (time to display each step)
- For "type" actions, include a "typeText" field with example text to type
- Don't include steps for elements that are off-screen (y > 800)`
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

    // Try to parse JSON from Claude's response
    let tutorial;
    try {
      tutorial = JSON.parse(textContent);
    } catch (e) {
      // Try extracting from markdown code blocks
      const jsonMatch = textContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        try {
          tutorial = JSON.parse(jsonMatch[1]);
        } catch (e2) {
          // Last resort: try to find JSON object in text
          const objMatch = textContent.match(/\{[\s\S]*\}/);
          if (objMatch) {
            tutorial = JSON.parse(objMatch[0]);
          }
        }
      }
    }

    if (!tutorial || !tutorial.steps || !Array.isArray(tutorial.steps)) {
      // Fallback tutorial
      tutorial = generateFallbackTutorial(elements, pageInfo);
    }

    // Validate and clean up steps
    tutorial.steps = tutorial.steps.filter(s => (
      typeof s.x === 'number' && typeof s.y === 'number' && s.callout
    )).map(s => ({
      x: Math.round(s.x),
      y: Math.round(s.y),
      action: s.action || 'click',
      callout: String(s.callout).substring(0, 80),
      zoom: Math.max(1.0, Math.min(2.5, s.zoom || 1.5)),
      elementText: s.elementText || '',
      duration: Math.max(2000, Math.min(5000, s.duration || 3000)),
      typeText: s.typeText || undefined
    }));

    if (tutorial.steps.length === 0) {
      tutorial = generateFallbackTutorial(elements, pageInfo);
    }

    res.status(200).json(tutorial);
  } catch (err) {
    // On any error, try fallback
    try {
      const fallback = generateFallbackTutorial(elements || [], pageInfo || {});
      return res.status(200).json(fallback);
    } catch (e) {
      return res.status(500).json({ error: 'Failed to generate tutorial: ' + (err.message || 'Unknown error') });
    }
  }
};
