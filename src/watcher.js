/**
 * watcher.js — Watches for Claude Code extension updates and re-applies skin
 */

const fs = require('fs');
const path = require('path');
const { getVSCodeExtensionDirs } = require('./finder');
const { applySkin } = require('./patcher');

const STATE_FILE = path.join(require('os').homedir(), '.claude-skins-state.json');

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    }
  } catch { /* corrupt state */ }
  return { activeSkin: null, skinPath: null, watching: false };
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
}

function setActiveSkin(skinPath) {
  const state = loadState();
  state.activeSkin = path.basename(skinPath);
  state.skinPath = skinPath;
  saveState(state);
}

function clearActiveSkin() {
  const state = loadState();
  state.activeSkin = null;
  state.skinPath = null;
  saveState(state);
}

function getActiveSkin() {
  return loadState();
}

// Watch extension directories for changes (new installs / updates)
function startWatching(skinPath) {
  const extDirs = getVSCodeExtensionDirs();
  const watchers = [];

  console.log('👁  Watching for Claude Code updates...');
  console.log(`   Will re-apply skin: ${path.basename(skinPath)}`);
  console.log('   Press Ctrl+C to stop\n');

  for (const dir of extDirs) {
    try {
      const watcher = fs.watch(dir, { persistent: true }, (eventType, filename) => {
        if (filename && filename.toLowerCase().includes('anthropic.claude-code')) {
          console.log(`\n🔄 Extension change detected: ${filename}`);
          console.log('   Re-applying skin...');

          // Small delay to let VS Code finish writing
          setTimeout(() => {
            try {
              const result = applySkin(skinPath);
              if (result.success) {
                console.log('   ✅ Skin re-applied successfully!');
              } else {
                console.log(`   ⚠️  Partial re-apply: ${result.errors.join(', ')}`);
              }
            } catch (e) {
              console.log(`   ❌ Re-apply failed: ${e.message}`);
            }
          }, 2000);
        }
      });

      watchers.push(watcher);
      console.log(`   Monitoring: ${dir}`);
    } catch (e) {
      console.log(`   ⚠️  Can't watch ${dir}: ${e.message}`);
    }
  }

  // Save state
  const state = loadState();
  state.watching = true;
  state.skinPath = skinPath;
  state.activeSkin = path.basename(skinPath);
  saveState(state);

  // Handle shutdown
  process.on('SIGINT', () => {
    console.log('\n\n👋 Stopping watcher...');
    watchers.forEach(w => w.close());
    const state = loadState();
    state.watching = false;
    saveState(state);
    process.exit(0);
  });

  return watchers;
}

module.exports = {
  startWatching,
  setActiveSkin,
  clearActiveSkin,
  getActiveSkin,
  loadState,
  saveState
};
