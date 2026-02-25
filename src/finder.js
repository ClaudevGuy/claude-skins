/**
 * finder.js — Locates all Claude Code assets across the system
 * Finds: VS Code extension dir, CLI bundle, VSIX package
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const HOME = os.homedir();

// All possible VS Code extension directories by OS
function getVSCodeExtensionDirs() {
  const platform = os.platform();
  const dirs = [];

  // Standard VS Code
  dirs.push(path.join(HOME, '.vscode', 'extensions'));
  // VS Code Insiders
  dirs.push(path.join(HOME, '.vscode-insiders', 'extensions'));
  // VSCodium
  dirs.push(path.join(HOME, '.vscode-oss', 'extensions'));
  // Cursor
  dirs.push(path.join(HOME, '.cursor', 'extensions'));

  if (platform === 'darwin') {
    // macOS additional paths
    dirs.push(path.join(HOME, 'Library', 'Application Support', 'Code', 'User', 'globalStorage'));
  } else if (platform === 'win32') {
    const appData = process.env.APPDATA || path.join(HOME, 'AppData', 'Roaming');
    dirs.push(path.join(appData, 'Code', 'User', 'globalStorage'));
  }

  return dirs.filter(d => {
    try { return fs.existsSync(d); } catch { return false; }
  });
}

// Find the Claude Code extension directory
function findExtension() {
  const results = [];
  const extDirs = getVSCodeExtensionDirs();

  for (const extDir of extDirs) {
    try {
      const entries = fs.readdirSync(extDir);
      for (const entry of entries) {
        if (entry.toLowerCase().startsWith('anthropic.claude-code')) {
          const fullPath = path.join(extDir, entry);
          const stat = fs.statSync(fullPath);
          if (stat.isDirectory()) {
            results.push({
              path: fullPath,
              version: entry.replace('anthropic.claude-code-', ''),
              parent: extDir,
              type: extDir.includes('.cursor') ? 'cursor' :
                    extDir.includes('insiders') ? 'vscode-insiders' :
                    extDir.includes('vscode-oss') ? 'vscodium' : 'vscode'
            });
          }
        }
      }
    } catch (e) { /* skip inaccessible dirs */ }
  }

  return results;
}

// Find the CLI installation
function findCLI() {
  const results = [];
  const possiblePaths = [
    // Local install (most common)
    path.join(HOME, '.claude', 'local', 'node_modules', '@anthropic-ai', 'claude-code'),
    // Global npm
    path.join(HOME, '.npm-global', 'lib', 'node_modules', '@anthropic-ai', 'claude-code'),
    // Global npm (default location)
    path.join('/usr', 'local', 'lib', 'node_modules', '@anthropic-ai', 'claude-code'),
    path.join('/usr', 'lib', 'node_modules', '@anthropic-ai', 'claude-code'),
    // pnpm global
    path.join(HOME, '.local', 'share', 'pnpm', 'global', '5', 'node_modules', '@anthropic-ai', 'claude-code'),
  ];

  // Also check npm root -g output path
  try {
    const { execSync } = require('child_process');
    const npmRoot = execSync('npm root -g', { encoding: 'utf8' }).trim();
    possiblePaths.push(path.join(npmRoot, '@anthropic-ai', 'claude-code'));
  } catch (e) { /* npm not available */ }

  for (const p of possiblePaths) {
    try {
      if (fs.existsSync(p) && fs.statSync(p).isDirectory()) {
        results.push({ path: p, type: 'cli' });
      }
    } catch { /* skip */ }
  }

  return results;
}

// Find the VSIX package
function findVSIX() {
  const cliInstalls = findCLI();
  const results = [];

  for (const cli of cliInstalls) {
    const vsixPath = path.join(cli.path, 'vendor', 'claude-code.vsix');
    try {
      if (fs.existsSync(vsixPath)) {
        const stat = fs.statSync(vsixPath);
        results.push({
          path: vsixPath,
          size: stat.size,
          modified: stat.mtime
        });
      }
    } catch { /* skip */ }
  }

  return results;
}

// Deep scan: find all patchable assets within an extension directory
function scanExtensionAssets(extPath) {
  const assets = {
    mediaFiles: [],      // Images in resources/ (mascot, logos, etc.)
    webviewBundles: [],  // JS/CSS files in webview/
    cliBundles: [],      // CLI JS bundles with ASCII art
  };

  // Scan resources/ for media files (the actual mascot + logo images)
  const resourcesDir = path.join(extPath, 'resources');
  if (fs.existsSync(resourcesDir)) {
    function walkResources(dir, depth = 0) {
      if (depth > 3) return;
      try {
        const entries = fs.readdirSync(dir);
        for (const entry of entries) {
          if (entry.startsWith('.')) continue;
          const fullPath = path.join(dir, entry);
          const stat = fs.statSync(fullPath);
          if (stat.isDirectory()) {
            walkResources(fullPath, depth + 1);
            continue;
          }
          if (/\.(png|svg|ico|webp|jpg|jpeg)$/i.test(entry)) {
            const relPath = path.relative(resourcesDir, fullPath);
            assets.mediaFiles.push({
              path: fullPath,
              name: entry,
              relativePath: relPath,
              size: stat.size,
              isMascot: entry === 'clawd.svg',
              isLogo: entry.startsWith('claude-logo'),
            });
          }
        }
      } catch { /* skip */ }
    }
    walkResources(resourcesDir);
  }

  // Scan webview/ for JS/CSS bundles (for color patching)
  const webviewDir = path.join(extPath, 'webview');
  if (fs.existsSync(webviewDir)) {
    try {
      const entries = fs.readdirSync(webviewDir);
      for (const entry of entries) {
        const fullPath = path.join(webviewDir, entry);
        const stat = fs.statSync(fullPath);
        if (stat.isFile() && /\.(js|css)$/i.test(entry)) {
          assets.webviewBundles.push({
            path: fullPath,
            name: entry,
            size: stat.size,
          });
        }
      }
    } catch { /* skip */ }
  }

  // Walk the full tree for ASCII art in JS bundles (for CLI patching)
  function walkForAscii(dir, depth = 0) {
    if (depth > 5) return;
    try {
      const entries = fs.readdirSync(dir);
      for (const entry of entries) {
        if (entry === 'node_modules' || entry.startsWith('.')) continue;
        const fullPath = path.join(dir, entry);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          walkForAscii(fullPath, depth + 1);
          continue;
        }
        if (/\.(js|mjs)$/i.test(entry) && stat.size < 10 * 1024 * 1024) {
          try {
            const content = fs.readFileSync(fullPath, 'utf8');
            if (/[▐▛▜▌▘▝█▀▄▖▗▙▚▞▟]{3,}/.test(content)) {
              assets.cliBundles.push({
                path: fullPath,
                name: entry,
                hasAsciiArt: true
              });
            }
          } catch { /* binary or too large */ }
        }
      }
    } catch { /* permission denied */ }
  }
  walkForAscii(extPath);

  return assets;
}

// Scan CLI bundle for ASCII art
function scanCLIAssets(cliPath) {
  const assets = { asciiArt: [], bundles: [] };

  function walk(dir, depth = 0) {
    if (depth > 3) return;
    try {
      const entries = fs.readdirSync(dir);
      for (const entry of entries) {
        if (entry === 'node_modules') continue;
        const fullPath = path.join(dir, entry);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
          walk(fullPath, depth + 1);
          continue;
        }

        if (/\.(js|mjs|cjs)$/i.test(entry)) {
          try {
            const content = fs.readFileSync(fullPath, 'utf8');
            // Look for the specific Claude Code ASCII art pattern
            const artPatterns = [
              /▐▛███▜▌/,
              /▜█████▛/,
              /[▐▛▜▌▘▝█]{4,}/
            ];

            for (const pattern of artPatterns) {
              if (pattern.test(content)) {
                // Extract the art context (surrounding lines)
                const match = content.match(new RegExp('.{0,50}' + pattern.source + '.{0,50}'));
                assets.asciiArt.push({
                  file: fullPath,
                  pattern: pattern.source,
                  context: match ? match[0].substring(0, 100) : 'found'
                });
                if (!assets.bundles.includes(fullPath)) {
                  assets.bundles.push(fullPath);
                }
              }
            }
          } catch { /* skip */ }
        }
      }
    } catch { /* skip */ }
  }

  walk(cliPath);
  return assets;
}

module.exports = {
  findExtension,
  findCLI,
  findVSIX,
  scanExtensionAssets,
  scanCLIAssets,
  getVSCodeExtensionDirs
};
