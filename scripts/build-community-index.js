#!/usr/bin/env node
// Scans community-skins dirs and generates community-skins/index.json
// Run: node scripts/build-community-index.js

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const COMMUNITY_DIR = path.join(ROOT, 'community-skins');
const OFFICIAL_DIR = path.join(ROOT, 'skins');
const OUTPUT = path.join(COMMUNITY_DIR, 'index.json');

// Get official skin IDs to prevent collisions
const officialIds = fs.existsSync(OFFICIAL_DIR)
  ? fs.readdirSync(OFFICIAL_DIR).filter(d =>
      fs.statSync(path.join(OFFICIAL_DIR, d)).isDirectory()
    )
  : [];

// Scan community skins
const entries = fs.readdirSync(COMMUNITY_DIR).filter(d => {
  if (d.startsWith('_') || d.startsWith('.') || d === 'index.json') return false;
  const dirPath = path.join(COMMUNITY_DIR, d);
  return fs.statSync(dirPath).isDirectory() &&
         fs.existsSync(path.join(dirPath, 'manifest.json'));
});

const skins = entries.map(id => {
  const manifestPath = path.join(COMMUNITY_DIR, id, 'manifest.json');
  const svgPath = path.join(COMMUNITY_DIR, id, 'mascot.svg');

  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  } catch (e) {
    console.warn(`WARN: community-skins/${id}/manifest.json is invalid JSON, skipping`);
    return null;
  }

  // Validate required fields
  if (!manifest.name || !manifest.author) {
    console.warn(`WARN: community-skins/${id} missing name or author, skipping`);
    return null;
  }
  if (!manifest.colors || !manifest.colors.primary || !manifest.colors.accent) {
    console.warn(`WARN: community-skins/${id} missing colors.primary or colors.accent, skipping`);
    return null;
  }
  if (!fs.existsSync(svgPath)) {
    console.warn(`WARN: community-skins/${id}/mascot.svg not found, skipping`);
    return null;
  }

  // Check for name collision with official skins
  if (officialIds.includes(id)) {
    console.warn(`WARN: community-skins/${id} conflicts with official skin name, skipping`);
    return null;
  }

  return {
    id,
    name: manifest.name,
    author: manifest.author,
    author_url: manifest.author_url || `https://github.com/${manifest.author}`,
    description: manifest.description || '',
    colors: {
      primary: manifest.colors.primary,
      accent: manifest.colors.accent,
      ...(manifest.colors.outline ? { outline: manifest.colors.outline } : {})
    }
  };
}).filter(Boolean);

// Sort alphabetically
skins.sort((a, b) => a.name.localeCompare(b.name));

fs.writeFileSync(OUTPUT, JSON.stringify({ count: skins.length, skins }, null, 2));
console.log(`Built community-skins/index.json with ${skins.length} skin(s)`);
