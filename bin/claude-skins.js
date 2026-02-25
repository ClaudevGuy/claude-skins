#!/usr/bin/env node

/**
 * claude-skins CLI
 * Usage:
 *   claude-skins scan      — Find all Claude Code installations & patchable assets
 *   claude-skins list      — Show available skins
 *   claude-skins apply <skin-name>  — Apply a skin
 *   claude-skins restore   — Restore original assets
 *   claude-skins watch     — Watch for updates & re-apply current skin
 *   claude-skins status    — Show current skin status
 */

const path = require('path');
const fs = require('fs');
const readline = require('readline');
const { findExtension, findCLI, findVSIX, scanExtensionAssets, scanCLIAssets } = require('../src/finder');
const { applySkin, restoreAll } = require('../src/patcher');
const { startWatching, getActiveSkin, setActiveSkin, clearActiveSkin } = require('../src/watcher');

// ═══════════════════════════════════════════════════
// COLORS (no dependencies needed)
// ═══════════════════════════════════════════════════
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  orange: '\x1b[38;5;208m',
  gray: '\x1b[90m',
  bg: {
    green: '\x1b[42m',
    red: '\x1b[41m',
    yellow: '\x1b[43m',
  }
};

const SKINS_DIR = path.join(__dirname, '..', 'skins');

// ═══════════════════════════════════════════════════
// BANNER
// ═══════════════════════════════════════════════════
function banner() {
  console.log(`
${c.orange}${c.bold}   ╔═══════════════════════════════════╗
   ║     🎨  CLAUDE SKINS  v1.0.0     ║
   ║   Customize your Claude mascot    ║
   ╚═══════════════════════════════════╝${c.reset}
`);
}

// ═══════════════════════════════════════════════════
// SCAN — Find all installations
// ═══════════════════════════════════════════════════
function cmdScan() {
  banner();
  console.log(`${c.bold}${c.cyan}🔍 Scanning for Claude Code installations...${c.reset}\n`);

  // VS Code Extensions
  const extensions = findExtension();
  if (extensions.length > 0) {
    console.log(`${c.green}✓${c.reset} ${c.bold}VS Code Extensions found: ${extensions.length}${c.reset}`);
    for (const ext of extensions) {
      console.log(`  ${c.dim}├─${c.reset} ${c.yellow}${ext.type}${c.reset} v${ext.version}`);
      console.log(`  ${c.dim}│  ${c.gray}${ext.path}${c.reset}`);

      // Deep scan assets
      const assets = scanExtensionAssets(ext.path);
      console.log(`  ${c.dim}│  ${c.reset}📁 Media files: ${c.bold}${assets.mediaFiles.length}${c.reset}`);
      console.log(`  ${c.dim}│  ${c.reset}📦 Webview bundles: ${c.bold}${assets.webviewBundles.length}${c.reset}`);

      const mascot = assets.mediaFiles.find(f => f.isMascot);
      if (mascot) {
        console.log(`  ${c.dim}│${c.reset}`);
        console.log(`  ${c.dim}│  ${c.green}${c.bold}✓ MASCOT FOUND!${c.reset} ${mascot.name} (${mascot.size}B)`);
        console.log(`  ${c.dim}│  ${c.gray}${mascot.path}${c.reset}`);
      }

      const logos = assets.mediaFiles.filter(f => f.isLogo);
      if (logos.length > 0) {
        console.log(`  ${c.dim}│${c.reset}`);
        console.log(`  ${c.dim}│  ${c.reset}Logo files that can be swapped:`);
        for (const logo of logos) {
          console.log(`  ${c.dim}│  ${c.reset}  • ${logo.name} (${logo.size}B)`);
        }
      }

      const otherMedia = assets.mediaFiles.filter(f => !f.isMascot && !f.isLogo);
      if (otherMedia.length > 0) {
        console.log(`  ${c.dim}│${c.reset}`);
        console.log(`  ${c.dim}│  ${c.reset}Other media files:`);
        for (const file of otherMedia) {
          console.log(`  ${c.dim}│  ${c.reset}  • ${file.relativePath} (${file.size}B)`);
        }
      }
      console.log(`  ${c.dim}│${c.reset}`);
    }
  } else {
    console.log(`${c.red}✗${c.reset} No VS Code Claude Code extension found`);
    console.log(`  ${c.gray}Looked in: ~/.vscode/extensions/, ~/.cursor/extensions/, etc.${c.reset}`);
  }

  console.log('');

  // CLI Installations
  const cliInstalls = findCLI();
  if (cliInstalls.length > 0) {
    console.log(`${c.green}✓${c.reset} ${c.bold}CLI installations found: ${cliInstalls.length}${c.reset}`);
    for (const cli of cliInstalls) {
      console.log(`  ${c.dim}├─${c.reset} ${cli.path}`);
      const cliAssets = scanCLIAssets(cli.path);
      if (cliAssets.asciiArt.length > 0) {
        console.log(`  ${c.dim}│  ${c.green}${c.bold}✓ ASCII ART FOUND!${c.reset} in ${cliAssets.bundles.length} bundle(s)`);
        for (const art of cliAssets.asciiArt.slice(0, 3)) {
          console.log(`  ${c.dim}│  ${c.reset}  • Pattern: ${art.pattern} in ${path.basename(art.file)}`);
        }
      } else {
        console.log(`  ${c.dim}│  ${c.yellow}⚠${c.reset} No ASCII art patterns found (may use different rendering)`);
      }
      console.log(`  ${c.dim}│${c.reset}`);
    }
  } else {
    console.log(`${c.red}✗${c.reset} No CLI installation found`);
    console.log(`  ${c.gray}Looked in: ~/.claude/local/, npm global, etc.${c.reset}`);
  }

  console.log('');

  // VSIX
  const vsix = findVSIX();
  if (vsix.length > 0) {
    console.log(`${c.green}✓${c.reset} ${c.bold}VSIX packages found: ${vsix.length}${c.reset}`);
    for (const v of vsix) {
      console.log(`  ${c.dim}├─${c.reset} ${v.path}`);
      console.log(`  ${c.dim}│  ${c.reset}Size: ${Math.round(v.size / 1024 / 1024)}MB, Modified: ${v.modified.toLocaleDateString()}`);
    }
  }

  console.log(`\n${c.dim}─────────────────────────────────────${c.reset}`);
  const total = extensions.length + cliInstalls.length;
  if (total > 0) {
    console.log(`\n${c.green}${c.bold}Ready to skin!${c.reset} Run ${c.cyan}claude-skins list${c.reset} to see available skins.`);
  } else {
    console.log(`\n${c.yellow}No Claude Code found.${c.reset} Install it first: ${c.cyan}npm install -g @anthropic-ai/claude-code${c.reset}`);
  }
  console.log('');
}

// ═══════════════════════════════════════════════════
// LIST — Show available skins
// ═══════════════════════════════════════════════════
function cmdList() {
  banner();
  console.log(`${c.bold}${c.cyan}🎨 Available Skins${c.reset}\n`);

  const state = getActiveSkin();

  try {
    const skinDirs = fs.readdirSync(SKINS_DIR).filter(d => {
      const manifestPath = path.join(SKINS_DIR, d, 'manifest.json');
      return fs.existsSync(manifestPath);
    });

    if (skinDirs.length === 0) {
      console.log(`${c.yellow}No skins found in ${SKINS_DIR}${c.reset}`);
      return;
    }

    for (const dir of skinDirs) {
      const manifest = JSON.parse(fs.readFileSync(path.join(SKINS_DIR, dir, 'manifest.json'), 'utf8'));
      const isActive = state.activeSkin === dir;
      const badge = isActive ? ` ${c.green}${c.bold}◀ ACTIVE${c.reset}` : '';

      const rarityColors = {
        Common: c.gray, Uncommon: c.green, Rare: c.cyan, Epic: c.magenta, Legendary: c.yellow
      };
      const rarityBadges = {
        Common: '⚪', Uncommon: '🟢', Rare: '🔵', Epic: '🟣', Legendary: '🟡'
      };
      const rc = rarityColors[manifest.rarity] || c.gray;
      const rb = rarityBadges[manifest.rarity] || '⚪';

      console.log(`  ${isActive ? c.green : c.orange}●${c.reset} ${c.bold}${manifest.name}${c.reset} ${rc}[${manifest.rarity}]${c.reset} ${c.dim}v${manifest.version}${c.reset}${badge}`);
      console.log(`    ${c.gray}${manifest.description}${c.reset}`);
      console.log(`    ${c.dim}Colors: ${c.reset}${manifest.colors?.primary || 'default'} / ${manifest.colors?.accent || 'default'}`);
      console.log(`    ${c.dim}ID: ${c.cyan}${dir}${c.reset}`);

      // Show ASCII art preview
      const asciiPath = path.join(SKINS_DIR, dir, manifest.targets?.terminal_ascii || 'ascii-art.txt');
      if (fs.existsSync(asciiPath)) {
        const art = fs.readFileSync(asciiPath, 'utf8');
        console.log(`    ${c.dim}Preview:${c.reset}`);
        for (const line of art.split('\n')) {
          console.log(`    ${c.orange}${line}${c.reset}`);
        }
      }
      console.log('');
    }

    console.log(`${c.dim}─────────────────────────────────────${c.reset}`);
    console.log(`\nApply a skin: ${c.cyan}claude-skins apply <skin-id>${c.reset}`);
    console.log(`Example:      ${c.cyan}claude-skins apply crown-royal${c.reset}\n`);
  } catch (e) {
    console.log(`${c.red}Error reading skins: ${e.message}${c.reset}`);
  }
}

// ═══════════════════════════════════════════════════
// APPLY — Apply a skin
// ═══════════════════════════════════════════════════
function cmdApply(skinName) {
  banner();

  if (!skinName) {
    // Interactive mode — prompt user to pick
    cmdList();
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(`${c.cyan}Enter skin ID to apply: ${c.reset}`, (answer) => {
      rl.close();
      if (answer.trim()) {
        doApply(answer.trim());
      }
    });
    return;
  }

  doApply(skinName);
}

function doApply(skinName) {
  const skinPath = path.join(SKINS_DIR, skinName);
  const manifestPath = path.join(skinPath, 'manifest.json');

  if (!fs.existsSync(manifestPath)) {
    console.log(`${c.red}✗${c.reset} Skin "${skinName}" not found.`);
    console.log(`  Run ${c.cyan}claude-skins list${c.reset} to see available skins.\n`);
    return;
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  console.log(`${c.bold}Applying skin: ${c.orange}${manifest.name}${c.reset}\n`);

  const result = applySkin(skinPath);

  // Report results
  if (result.media) {
    const m = result.media;
    if (m.patched.length > 0) {
      console.log(`  ${c.green}✓${c.reset} Media files patched (${m.patched.length} file(s))`);
      for (const p of m.patched) {
        console.log(`    ${c.dim}${p.target} ← ${p.skinSource} (${p.size}B)${c.reset}`);
      }
    }
    if (m.skipped.length > 0) {
      for (const s of m.skipped) {
        console.log(`  ${c.yellow}⚠${c.reset} Skipped ${s.target}: ${s.reason}`);
      }
    }
    if (m.errors.length > 0) {
      for (const e of m.errors) {
        console.log(`  ${c.red}✗${c.reset} ${e}`);
      }
    }
  }

  if (result.welcomeArt) {
    const w = result.welcomeArt;
    if (w.patched.length > 0) {
      console.log(`  ${c.green}✓${c.reset} Welcome art mascot re-colored (${w.patched.length} file(s))`);
      for (const p of w.patched) {
        console.log(`    ${c.dim}${p.target} → fill=${p.fill}${c.reset}`);
      }
    }
    if (w.skipped.length > 0) {
      for (const s of w.skipped) {
        console.log(`  ${c.yellow}⚠${c.reset} Skipped ${s.target}: ${s.reason}`);
      }
    }
    if (w.errors.length > 0) {
      for (const e of w.errors) {
        console.log(`  ${c.red}✗${c.reset} ${e}`);
      }
    }
  }

  if (result.webviewMascot) {
    if (result.webviewMascot.patched) {
      console.log(`  ${c.green}✓${c.reset} Webview inline mascot patched`);
      for (const d of result.webviewMascot.details || []) {
        console.log(`    ${c.dim}${d}${c.reset}`);
      }
    }
    if (result.webviewMascot.error) {
      console.log(`  ${c.red}✗${c.reset} ${result.webviewMascot.error}`);
    }
  }

  if (result.terminal) {
    if (result.terminal.patched?.length > 0) {
      console.log(`  ${c.green}✓${c.reset} Terminal ASCII art patched`);
    }
    if (result.terminal.errors?.length > 0) {
      for (const e of result.terminal.errors) {
        console.log(`  ${c.yellow}⚠${c.reset} Terminal: ${e}`);
      }
    }
  }

  if (result.errors?.length > 0) {
    for (const e of result.errors) {
      console.log(`  ${c.red}✗${c.reset} ${e}`);
    }
  }

  // Save active skin
  setActiveSkin(skinPath);

  console.log(`\n${c.dim}─────────────────────────────────────${c.reset}`);
  if (result.success) {
    console.log(`\n${c.green}${c.bold}✓ Skin applied!${c.reset} Restart VS Code to see changes.`);
    console.log(`  ${c.dim}Run ${c.cyan}claude-skins watch${c.reset}${c.dim} to auto-reapply after updates.${c.reset}\n`);
  } else {
    console.log(`\n${c.yellow}Skin partially applied.${c.reset} Some targets may not have been found.`);
    console.log(`  Run ${c.cyan}claude-skins scan${c.reset} to see what's available to patch.\n`);
  }
}

// ═══════════════════════════════════════════════════
// RESTORE — Restore original assets
// ═══════════════════════════════════════════════════
function cmdRestore() {
  banner();
  console.log(`${c.bold}${c.cyan}🔄 Restoring original assets...${c.reset}\n`);

  const result = restoreAll();

  if (result.restored.length > 0) {
    console.log(`${c.green}✓${c.reset} Restored ${result.restored.length} file(s):`);
    for (const f of result.restored) {
      console.log(`  ${c.dim}• ${f}${c.reset}`);
    }
  } else {
    console.log(`${c.yellow}No backups found${c.reset} — nothing to restore.`);
  }

  if (result.errors.length > 0) {
    for (const e of result.errors) {
      console.log(`${c.red}✗${c.reset} ${e}`);
    }
  }

  clearActiveSkin();
  console.log(`\n${c.green}Done!${c.reset} Restart VS Code to see original mascot.\n`);
}

// ═══════════════════════════════════════════════════
// WATCH — Watch for updates
// ═══════════════════════════════════════════════════
function cmdWatch() {
  banner();
  const state = getActiveSkin();

  if (!state.skinPath || !fs.existsSync(state.skinPath)) {
    console.log(`${c.yellow}No active skin.${c.reset} Apply a skin first: ${c.cyan}claude-skins apply <skin-id>${c.reset}\n`);
    return;
  }

  console.log(`${c.bold}${c.cyan}👁  Starting watcher...${c.reset}`);
  console.log(`Active skin: ${c.orange}${state.activeSkin}${c.reset}\n`);
  startWatching(state.skinPath);
}

// ═══════════════════════════════════════════════════
// STATUS — Show current status
// ═══════════════════════════════════════════════════
function cmdStatus() {
  banner();
  const state = getActiveSkin();

  console.log(`${c.bold}Status${c.reset}`);
  console.log(`  Active skin:  ${state.activeSkin ? c.orange + state.activeSkin + c.reset : c.dim + 'none' + c.reset}`);
  console.log(`  Skin path:    ${state.skinPath ? c.gray + state.skinPath + c.reset : c.dim + '-' + c.reset}`);
  console.log(`  Watching:     ${state.watching ? c.green + 'yes' + c.reset : c.dim + 'no' + c.reset}`);

  const extensions = findExtension();
  const clis = findCLI();
  console.log(`  Extensions:   ${extensions.length > 0 ? c.green + extensions.length + ' found' : c.red + 'none'}${c.reset}`);
  console.log(`  CLI installs: ${clis.length > 0 ? c.green + clis.length + ' found' : c.red + 'none'}${c.reset}`);
  console.log('');
}

// ═══════════════════════════════════════════════════
// HELP
// ═══════════════════════════════════════════════════
function cmdHelp() {
  banner();
  console.log(`${c.bold}Commands:${c.reset}

  ${c.cyan}scan${c.reset}              Find Claude Code installations & patchable assets
  ${c.cyan}list${c.reset}              Show available skins
  ${c.cyan}apply${c.reset} <skin-id>   Apply a skin (e.g. ${c.dim}neon-crab${c.reset})
  ${c.cyan}restore${c.reset}           Restore original Claude mascot
  ${c.cyan}watch${c.reset}             Auto-reapply skin after Claude Code updates
  ${c.cyan}status${c.reset}            Show current skin status
  ${c.cyan}help${c.reset}              Show this help

${c.bold}Examples:${c.reset}
  ${c.gray}$ claude-skins scan${c.reset}
  ${c.gray}$ claude-skins apply crown-royal${c.reset}
  ${c.gray}$ claude-skins apply fire${c.reset}
  ${c.gray}$ claude-skins restore${c.reset}

${c.bold}Adding custom skins:${c.reset}
  Drop a folder with ${c.cyan}manifest.json${c.reset} + assets into:
  ${c.gray}${SKINS_DIR}/${c.reset}
`);
}

// ═══════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════
const [,, command, ...args] = process.argv;

switch (command) {
  case 'scan':    cmdScan(); break;
  case 'list':    cmdList(); break;
  case 'apply':   cmdApply(args[0]); break;
  case 'restore': cmdRestore(); break;
  case 'watch':   cmdWatch(); break;
  case 'status':  cmdStatus(); break;
  case 'help':
  case '--help':
  case '-h':      cmdHelp(); break;
  default:
    if (command) {
      console.log(`${c.red}Unknown command: ${command}${c.reset}\n`);
    }
    cmdHelp();
}
