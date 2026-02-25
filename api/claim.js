/**
 * POST /api/claim
 * Body: { "skin": "genesis" }
 *
 * Atomically claims a serial number for a numbered-edition skin.
 * Returns { success, serial, remaining, max } or { success: false, reason }.
 *
 * Uses Upstash Redis REST API via KV_REST_API_URL / KV_REST_API_TOKEN env vars.
 * Requires KV to be configured — returns 503 if not.
 */

const NUMBERED_SKINS = {
  genesis:  { max_supply: 500 },
  obsidian: { max_supply: 200 },
};

async function kvGet(key) {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  const res = await fetch(`${url}/get/${key}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  return data.result;
}

async function kvSet(key, value) {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  await fetch(`${url}/set/${key}/${value}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

async function kvDecr(key) {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  const res = await fetch(`${url}/decrby/${key}/1`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  return data.result;
}

async function kvIncr(key) {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  const res = await fetch(`${url}/incrby/${key}/1`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  return data.result;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Require KV
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    return res.status(503).json({
      success: false,
      reason: 'not_configured',
      hint: 'Connect Vercel KV (Upstash Redis) and set KV_REST_API_URL + KV_REST_API_TOKEN',
    });
  }

  const { skin } = req.body || {};
  if (!skin || !NUMBERED_SKINS[skin]) {
    return res.status(400).json({
      success: false,
      reason: 'invalid_skin',
      valid: Object.keys(NUMBERED_SKINS),
    });
  }

  const meta = NUMBERED_SKINS[skin];
  const supplyKey = `supply:${skin}`;

  // Initialize supply if this is the first claim ever
  const current = await kvGet(supplyKey);
  if (current === null) {
    await kvSet(supplyKey, meta.max_supply);
  }

  // Check stock before attempting claim
  const stock = current === null ? meta.max_supply : parseInt(current, 10);
  if (stock <= 0) {
    return res.status(409).json({
      success: false,
      reason: 'sold_out',
      remaining: 0,
      max: meta.max_supply,
    });
  }

  // Atomically decrement — Redis DECRBY is atomic
  const newRemaining = await kvDecr(supplyKey);

  // Race condition guard: if we went below 0, undo and reject
  if (newRemaining < 0) {
    await kvIncr(supplyKey);
    return res.status(409).json({
      success: false,
      reason: 'sold_out',
      remaining: 0,
      max: meta.max_supply,
    });
  }

  const serial = meta.max_supply - newRemaining;

  return res.status(200).json({
    success: true,
    skin: skin,
    serial: serial,
    remaining: newRemaining,
    max: meta.max_supply,
  });
};
