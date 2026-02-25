/**
 * theme-generator.js — VS Code color theme generator from skin palettes
 * Generates workbench.colorCustomizations from primary + accent colors.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const BACKUP_SUFFIX = '.claudeskins-backup';

// ═══════════════════════════════════════════════════
// COLOR MATH (pure hex, no dependencies)
// ═══════════════════════════════════════════════════

function hexToRgb(hex) {
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
  return {
    r: parseInt(hex.substring(0, 2), 16),
    g: parseInt(hex.substring(2, 4), 16),
    b: parseInt(hex.substring(4, 6), 16),
  };
}

function rgbToHex(r, g, b) {
  r = Math.max(0, Math.min(255, Math.round(r)));
  g = Math.max(0, Math.min(255, Math.round(g)));
  b = Math.max(0, Math.min(255, Math.round(b)));
  return '#' + [r, g, b].map(c => c.toString(16).padStart(2, '0')).join('');
}

/** Darken a hex color. amount=0 → same, amount=1 → black */
function darken(hex, amount) {
  const { r, g, b } = hexToRgb(hex);
  const f = 1 - amount;
  return rgbToHex(r * f, g * f, b * f);
}

/** Lighten a hex color toward white. amount=0 → same, amount=1 → white */
function lighten(hex, amount) {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex(r + (255 - r) * amount, g + (255 - g) * amount, b + (255 - b) * amount);
}

/** Mix two hex colors. ratio=0 → color1, ratio=1 → color2 */
function mix(hex1, hex2, ratio) {
  const c1 = hexToRgb(hex1), c2 = hexToRgb(hex2);
  return rgbToHex(
    c1.r + (c2.r - c1.r) * ratio,
    c1.g + (c2.g - c1.g) * ratio,
    c1.b + (c2.b - c1.b) * ratio,
  );
}

/** Add alpha channel to hex color (returns #rrggbbaa) */
function withAlpha(hex, alpha) {
  const a = Math.max(0, Math.min(255, Math.round(alpha * 255)));
  return hex.substring(0, 7) + a.toString(16).padStart(2, '0');
}

/** Relative luminance (0-1) for WCAG contrast calculation */
function luminance(hex) {
  const { r, g, b } = hexToRgb(hex);
  const [rs, gs, bs] = [r / 255, g / 255, b / 255].map(c =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  );
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/** Auto foreground: white or black based on background luminance */
function autoFg(bgHex) {
  return luminance(bgHex) > 0.35 ? '#000000' : '#ffffff';
}

// ═══════════════════════════════════════════════════
// PALETTE DERIVATION
// ═══════════════════════════════════════════════════

function derivePalette(primary, accent) {
  return {
    darkest:  darken(primary, 0.85),   // activity bar bg
    darker:   darken(primary, 0.7),    // sidebar bg
    dark:     darken(primary, 0.6),    // editor bg
    mid:      primary,                  // cursors, badges, buttons
    light:    lighten(primary, 0.3),   // selection highlights
    accent:   accent,                   // secondary accents
  };
}

// ═══════════════════════════════════════════════════
// ANSI TERMINAL COLOR DERIVATION
// ═══════════════════════════════════════════════════

function deriveAnsiColors(primary, accent) {
  return {
    'terminal.ansiBlack':         darken(primary, 0.9),
    'terminal.ansiRed':           mix('#ef5350', primary, 0.2),
    'terminal.ansiGreen':         mix('#66bb6a', primary, 0.2),
    'terminal.ansiYellow':        mix('#fdd835', primary, 0.15),
    'terminal.ansiBlue':          mix('#42a5f5', accent, 0.3),
    'terminal.ansiMagenta':       mix('#ab47bc', primary, 0.25),
    'terminal.ansiCyan':          mix('#26c6da', accent, 0.2),
    'terminal.ansiWhite':         '#d4d4d4',
    'terminal.ansiBrightBlack':   darken(primary, 0.6),
    'terminal.ansiBrightRed':     mix('#ff8a80', primary, 0.15),
    'terminal.ansiBrightGreen':   mix('#b9f6ca', primary, 0.15),
    'terminal.ansiBrightYellow':  mix('#ffff8d', primary, 0.1),
    'terminal.ansiBrightBlue':    mix('#82b1ff', accent, 0.2),
    'terminal.ansiBrightMagenta': mix('#ea80fc', primary, 0.2),
    'terminal.ansiBrightCyan':    mix('#84ffff', accent, 0.15),
    'terminal.ansiBrightWhite':   '#ffffff',
  };
}

// ═══════════════════════════════════════════════════
// BRACKET COLORS
// ═══════════════════════════════════════════════════

function deriveBracketColors(primary, accent) {
  return [
    primary,
    mix(primary, accent, 0.2),
    mix(primary, accent, 0.4),
    mix(primary, accent, 0.6),
    mix(primary, accent, 0.8),
    accent,
  ];
}

// ═══════════════════════════════════════════════════
// MAIN THEME GENERATOR
// ═══════════════════════════════════════════════════

function generateColorCustomizations(primary, accent, skinId) {
  const p = derivePalette(primary, accent);
  const statusFg = autoFg(primary);
  const brackets = deriveBracketColors(primary, accent);

  const theme = {
    // Editor
    'editor.background':                p.dark,
    'editor.foreground':                '#d4d4d4',
    'editorCursor.foreground':          p.mid,
    'editor.selectionBackground':       withAlpha(p.mid, 0.3),
    'editor.selectionHighlightBackground': withAlpha(p.light, 0.15),
    'editor.lineHighlightBackground':   withAlpha(p.accent, 0.08),
    'editor.wordHighlightBackground':   withAlpha(p.mid, 0.2),
    'editor.findMatchBackground':       withAlpha(p.mid, 0.35),
    'editor.findMatchHighlightBackground': withAlpha(p.mid, 0.2),

    // Sidebar & Activity Bar
    'sideBar.background':               p.darker,
    'sideBar.foreground':               '#cccccc',
    'sideBarTitle.foreground':          '#cccccc',
    'sideBarSectionHeader.background':  darken(p.darker, 0.15),
    'activityBar.background':           p.darkest,
    'activityBar.foreground':           p.mid,
    'activityBar.inactiveForeground':   withAlpha(p.mid, 0.45),
    'activityBarBadge.background':      p.mid,
    'activityBarBadge.foreground':      statusFg,

    // Title Bar
    'titleBar.activeBackground':        p.darkest,
    'titleBar.activeForeground':        '#cccccc',
    'titleBar.inactiveBackground':      darken(p.darkest, 0.15),
    'titleBar.inactiveForeground':      '#999999',

    // Tabs
    'tab.activeBackground':             p.dark,
    'tab.inactiveBackground':           p.darker,
    'tab.activeBorderTop':              p.mid,
    'tab.border':                       darken(p.darker, 0.2),
    'tab.activeForeground':             '#ffffff',
    'tab.inactiveForeground':           '#999999',
    'editorGroupHeader.tabsBackground': p.darker,

    // Terminal
    'terminal.foreground':              '#d4d4d4',
    'terminalCursor.foreground':        p.mid,
    'terminal.background':              p.dark,
    ...deriveAnsiColors(primary, accent),

    // Status Bar
    'statusBar.background':             p.mid,
    'statusBar.foreground':             statusFg,
    'statusBar.debuggingBackground':    lighten(p.mid, 0.15),
    'statusBar.debuggingForeground':    statusFg,
    'statusBar.noFolderBackground':     p.darker,
    'statusBarItem.hoverBackground':    withAlpha('#ffffff', 0.12),
    'statusBarItem.remoteBackground':   p.accent,
    'statusBarItem.remoteForeground':   autoFg(accent),

    // Buttons & Badges
    'button.background':                p.mid,
    'button.foreground':                statusFg,
    'button.hoverBackground':           lighten(p.mid, 0.1),
    'badge.background':                 p.mid,
    'badge.foreground':                 statusFg,
    'progressBar.background':           p.mid,

    // Input
    'input.background':                 darken(p.dark, 0.15),
    'input.border':                     withAlpha(p.mid, 0.4),
    'input.foreground':                 '#d4d4d4',
    'inputOption.activeBorder':         p.mid,
    'inputOption.activeBackground':     withAlpha(p.mid, 0.3),
    'focusBorder':                      withAlpha(p.mid, 0.6),

    // Lists
    'list.activeSelectionBackground':   withAlpha(p.mid, 0.25),
    'list.activeSelectionForeground':   '#ffffff',
    'list.hoverBackground':             withAlpha(p.mid, 0.1),
    'list.focusOutline':                withAlpha(p.mid, 0.5),
    'list.highlightForeground':         p.light,

    // Bracket pair colorization
    'editorBracketHighlight.foreground1': brackets[0],
    'editorBracketHighlight.foreground2': brackets[1],
    'editorBracketHighlight.foreground3': brackets[2],
    'editorBracketHighlight.foreground4': brackets[3],
    'editorBracketHighlight.foreground5': brackets[4],
    'editorBracketHighlight.foreground6': brackets[5],

    // Scrollbar
    'scrollbarSlider.background':       withAlpha(p.mid, 0.2),
    'scrollbarSlider.hoverBackground':  withAlpha(p.mid, 0.35),
    'scrollbarSlider.activeBackground': withAlpha(p.mid, 0.5),

    // Panel (bottom panel with terminal, problems, etc.)
    'panel.background':                 p.darker,
    'panel.border':                     darken(p.darker, 0.2),
    'panelTitle.activeBorder':          p.mid,
    'panelTitle.activeForeground':      '#ffffff',
    'panelTitle.inactiveForeground':    '#999999',

    // Peek view
    'peekView.border':                  p.mid,
    'peekViewTitle.background':         p.darkest,
    'peekViewEditor.background':        darken(p.dark, 0.1),

    // Git decoration
    'gitDecoration.modifiedResourceForeground':  mix(p.mid, '#e2c08d', 0.5),
    'gitDecoration.untrackedResourceForeground': mix(p.mid, '#73c991', 0.5),
    'gitDecoration.deletedResourceForeground':   mix(p.mid, '#c74e39', 0.5),

    // Minimap
    'minimap.selectionHighlight':       withAlpha(p.mid, 0.4),
    'minimapSlider.background':         withAlpha(p.mid, 0.15),
    'minimapSlider.hoverBackground':    withAlpha(p.mid, 0.25),

    // Notifications
    'notificationCenterHeader.background': p.darkest,
    'notifications.background':            p.darker,
    'notifications.border':                darken(p.darker, 0.2),
  };

  // Apply per-skin overrides
  const overrides = SKIN_OVERRIDES[skinId];
  if (overrides) {
    Object.assign(theme, overrides);
  }

  return theme;
}

// ═══════════════════════════════════════════════════
// PER-SKIN SPECIAL OVERRIDES
// ═══════════════════════════════════════════════════

const SKIN_OVERRIDES = {
  'fire': {
    'editor.background':        '#1a0a00',
    'sideBar.background':       '#140800',
    'activityBar.background':   '#0f0500',
    'titleBar.activeBackground':'#0f0500',
    'terminal.ansiRed':         '#ff5722',
    'terminal.ansiYellow':      '#ff9800',
    'terminal.ansiBrightRed':   '#ff8a65',
    'terminal.ansiBrightYellow':'#ffcc80',
  },
  'shadow': {
    'editor.background':        '#0a0a0f',
    'sideBar.background':       '#070710',
    'activityBar.background':   '#050508',
    'titleBar.activeBackground':'#050508',
    'editor.foreground':        '#a0a0b0',
    'statusBar.background':     '#1a1a2e',
    'statusBar.foreground':     '#ff0044',
    'terminal.ansiRed':         '#ff0044',
    'terminal.ansiBrightRed':   '#ff3366',
  },
  'holographic': {
    'editor.background':        '#12001f',
    'sideBar.background':       '#0d0018',
    'activityBar.background':   '#080010',
    'titleBar.activeBackground':'#080010',
    'editorBracketHighlight.foreground1': '#ff4081',
    'editorBracketHighlight.foreground2': '#e040fb',
    'editorBracketHighlight.foreground3': '#7c4dff',
    'editorBracketHighlight.foreground4': '#00e5ff',
    'editorBracketHighlight.foreground5': '#69f0ae',
    'editorBracketHighlight.foreground6': '#ffeb3b',
  },
  'diamond': {
    'editor.background':        '#0a1a20',
    'sideBar.background':       '#071318',
    'activityBar.background':   '#040d10',
    'titleBar.activeBackground':'#040d10',
    'statusBar.background':     '#4fc3f7',
    'statusBar.foreground':     '#000000',
  },
  'solana-degen': {
    'editor.background':        '#0a0520',
    'sideBar.background':       '#070418',
    'activityBar.background':   '#040210',
    'titleBar.activeBackground':'#040210',
    'statusBar.background':     '#14f195',
    'statusBar.foreground':     '#000000',
    'activityBar.foreground':   '#14f195',
    'terminal.ansiGreen':       '#14f195',
    'terminal.ansiMagenta':     '#9945ff',
  },
  'bitcoin-og': {
    'editor.background':        '#1a0e00',
    'sideBar.background':       '#140a00',
    'activityBar.background':   '#0f0700',
    'titleBar.activeBackground':'#0f0700',
    'terminal.ansiYellow':      '#f7931a',
    'terminal.ansiBrightYellow':'#ffc107',
  },
  'crown-royal': {
    'editor.background':        '#10051a',
    'sideBar.background':       '#0c0314',
    'activityBar.background':   '#08020e',
    'titleBar.activeBackground':'#08020e',
    'statusBar.background':     '#7b1fa2',
    'statusBar.foreground':     '#ffd700',
    'activityBar.foreground':   '#ffd700',
    'activityBarBadge.background': '#ffd700',
    'activityBarBadge.foreground': '#000000',
  },
  'gold-edition': {
    'editor.background':        '#1a1400',
    'sideBar.background':       '#140f00',
    'activityBar.background':   '#0f0b00',
    'titleBar.activeBackground':'#0f0b00',
    'statusBar.foreground':     '#000000',
    'terminal.ansiYellow':      '#ffd700',
    'terminal.ansiBrightYellow':'#ffecb3',
  },
  'obsidian': {
    'editor.background':        '#0a0010',
    'sideBar.background':       '#07000c',
    'activityBar.background':   '#040008',
    'titleBar.activeBackground':'#040008',
    'statusBar.background':     '#4a148c',
    'statusBar.foreground':     '#e040fb',
    'activityBar.foreground':   '#e040fb',
    'terminal.ansiMagenta':     '#e040fb',
    'terminal.ansiBrightMagenta': '#f48fb1',
  },
  'genesis': {
    'editor.background':        '#1a1000',
    'sideBar.background':       '#140c00',
    'activityBar.background':   '#0f0800',
    'titleBar.activeBackground':'#0f0800',
    'statusBar.foreground':     '#000000',
    'activityBarBadge.foreground': '#000000',
  },
  'void-walker': {
    'editor.background':        '#06001a',
    'sideBar.background':       '#040014',
    'activityBar.background':   '#02000e',
    'titleBar.activeBackground':'#02000e',
    'statusBar.background':     '#7c4dff',
    'statusBar.foreground':     '#ffffff',
    'terminal.ansiMagenta':     '#b388ff',
  },
  'aurora': {
    'editor.background':        '#001a0f',
    'sideBar.background':       '#00140c',
    'activityBar.background':   '#000e08',
    'titleBar.activeBackground':'#000e08',
    'editorBracketHighlight.foreground1': '#00e676',
    'editorBracketHighlight.foreground2': '#00bcd4',
    'editorBracketHighlight.foreground3': '#7c4dff',
    'editorBracketHighlight.foreground4': '#e040fb',
    'editorBracketHighlight.foreground5': '#69f0ae',
    'editorBracketHighlight.foreground6': '#84ffff',
  },
  'neon-pink': {
    'editor.background':        '#1a050f',
    'sideBar.background':       '#14040c',
    'activityBar.background':   '#0f0208',
    'titleBar.activeBackground':'#0f0208',
  },
  'demon': {
    'editor.background':        '#1a0505',
    'sideBar.background':       '#140404',
    'activityBar.background':   '#0f0202',
    'titleBar.activeBackground':'#0f0202',
    'terminal.ansiRed':         '#ff4444',
    'terminal.ansiBrightRed':   '#ff6666',
  },
  'ice-blue': {
    'editor.background':        '#051a20',
    'sideBar.background':       '#041418',
    'activityBar.background':   '#020e10',
    'titleBar.activeBackground':'#020e10',
  },
  'midnight-purple': {
    'editor.background':        '#10051a',
    'sideBar.background':       '#0c0314',
    'activityBar.background':   '#08020e',
    'titleBar.activeBackground':'#08020e',
  },
  'electric-cyan': {
    'editor.background':        '#001a1f',
    'sideBar.background':       '#001418',
    'activityBar.background':   '#000e10',
    'titleBar.activeBackground':'#000e10',
    'statusBar.foreground':     '#000000',
  },
  'winter-frost': {
    'editor.background':        '#0a1520',
    'sideBar.background':       '#071018',
    'activityBar.background':   '#040b10',
    'titleBar.activeBackground':'#040b10',
  },
  'halloween-haunt': {
    'editor.background':        '#1a0a00',
    'sideBar.background':       '#140800',
    'activityBar.background':   '#0f0500',
    'titleBar.activeBackground':'#0f0500',
    'terminal.ansiGreen':       '#76ff03',
    'terminal.ansiYellow':      '#ff6f00',
  },
};

// ═══════════════════════════════════════════════════
// SETTINGS.JSON PATH
// ═══════════════════════════════════════════════════

function getSettingsPath() {
  const platform = process.platform;
  if (platform === 'win32') {
    return path.join(process.env.APPDATA || '', 'Code', 'User', 'settings.json');
  } else if (platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', 'Code', 'User', 'settings.json');
  } else {
    return path.join(os.homedir(), '.config', 'Code', 'User', 'settings.json');
  }
}

// ═══════════════════════════════════════════════════
// APPLY / RESTORE COLOR THEME
// ═══════════════════════════════════════════════════

function applyColorTheme(skinDir, manifest) {
  const result = { applied: false, error: null, settingsPath: null };
  const primary = manifest.colors?.primary;
  const accent = manifest.colors?.accent;

  if (!primary || !accent) {
    result.error = 'Skin missing primary/accent colors';
    return result;
  }

  const skinId = path.basename(skinDir);
  const settingsPath = getSettingsPath();
  result.settingsPath = settingsPath;

  // Ensure directory exists
  const settingsDir = path.dirname(settingsPath);
  if (!fs.existsSync(settingsDir)) {
    fs.mkdirSync(settingsDir, { recursive: true });
  }

  // Read existing settings
  let settings = {};
  if (fs.existsSync(settingsPath)) {
    try {
      const raw = fs.readFileSync(settingsPath, 'utf8');
      // Strip BOM and trailing commas for lenient JSON parse
      const cleaned = raw.replace(/^\uFEFF/, '').replace(/,\s*([\]}])/g, '$1');
      settings = JSON.parse(cleaned);
    } catch (e) {
      // Try JSONC (strip comments)
      try {
        const raw = fs.readFileSync(settingsPath, 'utf8');
        const stripped = raw
          .replace(/^\uFEFF/, '')
          .replace(/\/\/.*$/gm, '')
          .replace(/\/\*[\s\S]*?\*\//g, '')
          .replace(/,\s*([\]}])/g, '$1');
        settings = JSON.parse(stripped);
      } catch {
        result.error = `Could not parse settings.json: ${e.message}`;
        return result;
      }
    }
  }

  // Backup original if no backup exists
  const backupPath = settingsPath + BACKUP_SUFFIX;
  if (!fs.existsSync(backupPath) && fs.existsSync(settingsPath)) {
    fs.copyFileSync(settingsPath, backupPath);
  }

  // Generate theme
  const colors = generateColorCustomizations(primary, accent, skinId);

  // Merge into settings (preserve all other user settings)
  settings['workbench.colorCustomizations'] = colors;

  // Write back
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
  result.applied = true;
  return result;
}

function restoreColorTheme() {
  const result = { restored: false, error: null };
  const settingsPath = getSettingsPath();
  const backupPath = settingsPath + BACKUP_SUFFIX;

  if (fs.existsSync(backupPath)) {
    fs.copyFileSync(backupPath, settingsPath);
    fs.unlinkSync(backupPath);
    result.restored = true;
  } else if (fs.existsSync(settingsPath)) {
    // No backup — just remove the colorCustomizations key
    try {
      const raw = fs.readFileSync(settingsPath, 'utf8');
      const cleaned = raw.replace(/^\uFEFF/, '').replace(/,\s*([\]}])/g, '$1');
      const settings = JSON.parse(cleaned);
      if (settings['workbench.colorCustomizations']) {
        delete settings['workbench.colorCustomizations'];
        fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
        result.restored = true;
      }
    } catch {
      result.error = 'Could not parse settings.json to remove color overrides';
    }
  }

  return result;
}

module.exports = {
  generateColorCustomizations,
  applyColorTheme,
  restoreColorTheme,
  derivePalette,
  darken,
  lighten,
  mix,
  withAlpha,
  luminance,
  autoFg,
};
