/**
 * GET /api/supply
 * Returns remaining supply for all numbered-edition (Legendary) skins.
 *
 * Uses Upstash Redis REST API via KV_REST_API_URL / KV_REST_API_TOKEN env vars.
 * If KV is not configured, returns max_supply as remaining (fully stocked fallback).
 */

const NUMBERED_SKINS = {
  genesis:  { max_supply: 500 },
  obsidian: { max_supply: 200 },
};

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

async function kvSet(key, value) {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return false;

  const res = await fetch(`${url}/set/${key}/${value}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.ok;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 's-maxage=5, stale-while-revalidate=10');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const kvConfigured = !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
  const result = {};

  for (const [skinId, meta] of Object.entries(NUMBERED_SKINS)) {
    let remaining = meta.max_supply;

    if (kvConfigured) {
      const stored = await kvGet(`supply:${skinId}`);
      if (stored === null) {
        // First access — initialize supply in KV
        await kvSet(`supply:${skinId}`, meta.max_supply);
      } else {
        remaining = parseInt(stored, 10);
      }
    }

    result[skinId] = {
      max: meta.max_supply,
      remaining: Math.max(0, remaining),
      claimed: meta.max_supply - Math.max(0, remaining),
    };
  }

  return res.status(200).json(result);
};
