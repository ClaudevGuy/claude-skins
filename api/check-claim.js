/**
 * GET /api/check-claim
 * Returns whether the current user (by IP) has already claimed a legendary skin.
 * { claimed: false } or { claimed: true, skin: "genesis", serial: 42 }
 */

async function kvGet(key) {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;

  const res = await fetch(`${url}/get/${key}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  return data.result;
}

function getClientIP(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown';
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    return res.status(200).json({ claimed: false });
  }

  const ip = getClientIP(req);
  const existing = await kvGet(`claimed:legendary:${ip}`);

  if (!existing) {
    return res.status(200).json({ claimed: false });
  }

  // Value is stored as "skinId:serial"
  const [skin, serial] = existing.split(':');
  return res.status(200).json({
    claimed: true,
    skin: skin,
    serial: parseInt(serial, 10),
  });
};
