/**
 * patcher.js — Core patching engine
 * Replaces mascot images in VS Code extension resources/ and ASCII art in CLI
 */

const fs = require('fs');
const path = require('path');
const { findExtension, findCLI, scanExtensionAssets, scanCLIAssets } = require('./finder');
const { applyColorTheme, restoreColorTheme } = require('./theme-generator');

const BACKUP_SUFFIX = '.claudeskins-backup';

// Mascot body bounding box in mascot.svg (136x128 viewBox, OX=16, OY=24, PX=8)
const MASCOT_BODY = { x1: 24, y1: 24, x2: 112, y2: 96, w: 88, h: 72 };

// ═══════════════════════════════════════════════════
// SVG ACCESSORY HELPERS
// ═══════════════════════════════════════════════════

/** Parse an SVG attribute string like 'x="10" y="20" fill="#fff"' into {x:"10", y:"20", fill:"#fff"} */
function parseAttributes(attrStr) {
  const attrs = {};
  const re = /([\w-]+)="([^"]*)"/g;
  let m;
  while ((m = re.exec(attrStr)) !== null) attrs[m[1]] = m[2];
  return attrs;
}

/**
 * Extract accessories from a skin's mascot.svg.
 * Returns array of { tag, attrs, inner?, textContent? } or null if none.
 */
function extractAccessories(skinDir, manifest) {
  const mascotFile = manifest.targets?.vscode_mascot;
  if (!mascotFile) return null;

  const mascotPath = path.join(skinDir, mascotFile);
  if (!fs.existsSync(mascotPath)) return null;

  const svg = fs.readFileSync(mascotPath, 'utf8');
  const accMatch = svg.match(/<g id="acc"[^>]*>([\s\S]*?)<\/g>/);
  if (!accMatch) return null;

  const accContent = accMatch[1].trim();
  if (!accContent) return null;

  const elements = [];

  // Parse <rect> elements (with optional inner content like <animate>)
  const rectRe = /<rect\s+([^>]*?)(?:\/>|>([\s\S]*?)<\/rect>)/g;
  let m;
  while ((m = rectRe.exec(accContent)) !== null) {
    elements.push({ tag: 'rect', attrs: parseAttributes(m[1]), inner: m[2] || null });
  }

  // Parse <circle> elements
  const circleRe = /<circle\s+([^>]*?)(?:\/>|>([\s\S]*?)<\/circle>)/g;
  while ((m = circleRe.exec(accContent)) !== null) {
    elements.push({ tag: 'circle', attrs: parseAttributes(m[1]), inner: m[2] || null });
  }

  // Parse <text> elements
  const textRe = /<text\s+([^>]*?)>([\s\S]*?)<\/text>/g;
  while ((m = textRe.exec(accContent)) !== null) {
    elements.push({ tag: 'text', attrs: parseAttributes(m[1]), textContent: m[2] });
  }

  return elements.length > 0 ? elements : null;
}

/**
 * Compute bounding box from an SVG path d attribute (M/H/V/L/Z commands).
 * Returns { x1, y1, x2, y2 } or null.
 */
function getBBox(pathD) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  const segs = pathD.match(/[MHVLZ][-0-9. ]+/gi) || [];
  for (const seg of segs) {
    const cmd = seg[0].toUpperCase();
    const nums = seg.slice(1).trim().match(/[-+]?[0-9]*\.?[0-9]+/g);
    if (!nums) continue;
    if (cmd === 'M' || cmd === 'L') {
      for (let i = 0; i < nums.length; i += 2) {
        const x = parseFloat(nums[i]), y = parseFloat(nums[i + 1]);
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    } else if (cmd === 'H') {
      for (const n of nums) { const x = parseFloat(n); if (x < minX) minX = x; if (x > maxX) maxX = x; }
    } else if (cmd === 'V') {
      for (const n of nums) { const y = parseFloat(n); if (y < minY) minY = y; if (y > maxY) maxY = y; }
    }
  }
  if (minX === Infinity) return null;
  return { x1: minX, y1: minY, x2: maxX, y2: maxY };
}

/**
 * Transform an accessory SVG element from mascot.svg coords to a target coord system.
 * Returns an SVG string fragment.
 */
function transformSvgElement(el, sx, sy, tx, ty) {
  if (el.tag === 'rect') {
    const x = (parseFloat(el.attrs.x) * sx + tx).toFixed(2);
    const y = (parseFloat(el.attrs.y) * sy + ty).toFixed(2);
    const w = (parseFloat(el.attrs.width) * sx).toFixed(2);
    const h = (parseFloat(el.attrs.height) * sy).toFixed(2);
    let extra = '';
    if (el.attrs.fill) extra += ` fill="${el.attrs.fill}"`;
    if (el.attrs.opacity) extra += ` opacity="${el.attrs.opacity}"`;
    if (el.attrs.rx) extra += ` rx="${(parseFloat(el.attrs.rx) * sx).toFixed(2)}"`;
    const inner = el.inner || '';
    return inner
      ? `<rect x="${x}" y="${y}" width="${w}" height="${h}"${extra}>${inner}</rect>`
      : `<rect x="${x}" y="${y}" width="${w}" height="${h}"${extra}/>`;
  }
  if (el.tag === 'circle') {
    const cx = (parseFloat(el.attrs.cx) * sx + tx).toFixed(2);
    const cy = (parseFloat(el.attrs.cy) * sy + ty).toFixed(2);
    const r = (parseFloat(el.attrs.r) * Math.min(sx, sy)).toFixed(2);
    let extra = '';
    if (el.attrs.fill) extra += ` fill="${el.attrs.fill}"`;
    if (el.attrs.stroke) extra += ` stroke="${el.attrs.stroke}"`;
    if (el.attrs['stroke-width']) extra += ` stroke-width="${el.attrs['stroke-width']}"`;
    if (el.attrs.opacity) extra += ` opacity="${el.attrs.opacity}"`;
    return `<circle cx="${cx}" cy="${cy}" r="${r}"${extra}/>`;
  }
  if (el.tag === 'text') {
    const x = (parseFloat(el.attrs.x) * sx + tx).toFixed(2);
    const y = (parseFloat(el.attrs.y) * sy + ty).toFixed(2);
    const fs = el.attrs['font-size'] ? (parseFloat(el.attrs['font-size']) * Math.min(sx, sy)).toFixed(2) : null;
    let extra = '';
    if (el.attrs.fill) extra += ` fill="${el.attrs.fill}"`;
    if (el.attrs.opacity) extra += ` opacity="${el.attrs.opacity}"`;
    if (el.attrs['font-family']) extra += ` font-family="${el.attrs['font-family']}"`;
    if (fs) extra += ` font-size="${fs}"`;
    return `<text x="${x}" y="${y}"${extra}>${el.textContent || ''}</text>`;
  }
  return '';
}

/**
 * Convert an accessory element to a React createElement string for webview injection.
 * Returns string or null (skips unsupported elements like <text>).
 */
function toCreateElement(ce, el, sx, sy, tx, ty) {
  if (el.tag === 'rect') {
    const x = (parseFloat(el.attrs.x) * sx + tx).toFixed(1);
    const y = (parseFloat(el.attrs.y) * sy + ty).toFixed(1);
    const w = (parseFloat(el.attrs.width) * sx).toFixed(1);
    const h = (parseFloat(el.attrs.height) * sy).toFixed(1);
    let props = `x:"${x}",y:"${y}",width:"${w}",height:"${h}"`;
    if (el.attrs.fill) props += `,fill:"${el.attrs.fill}"`;
    if (el.attrs.opacity) props += `,opacity:"${el.attrs.opacity}"`;
    if (el.attrs.rx) props += `,rx:"${(parseFloat(el.attrs.rx) * sx).toFixed(1)}"`;
    return `${ce}("rect",{${props}})`;
  }
  if (el.tag === 'circle') {
    const cx = (parseFloat(el.attrs.cx) * sx + tx).toFixed(1);
    const cy = (parseFloat(el.attrs.cy) * sy + ty).toFixed(1);
    const r = (parseFloat(el.attrs.r) * Math.min(sx, sy)).toFixed(1);
    let props = `cx:"${cx}",cy:"${cy}",r:"${r}"`;
    if (el.attrs.fill) props += `,fill:"${el.attrs.fill}"`;
    if (el.attrs.stroke) props += `,stroke:"${el.attrs.stroke}"`;
    if (el.attrs['stroke-width']) props += `,strokeWidth:"${el.attrs['stroke-width']}"`;
    return `${ce}("circle",{${props}})`;
  }
  return null; // skip <text> — emoji won't render in React SVG createElement
}

// Map of skin target keys to the extension resource files they replace
const MEDIA_MAP = {
  // mascot.svg → the pixel art mascot shown in chat
  'vscode_mascot': [
    'clawd.svg',
  ],
  // logo.svg → Claude asterisk logo (recolored) for sidebar/tabs
  'vscode_logo': [
    'claude-logo.svg',
  ],
  // icon.png → pixel art mascot as extension icon PNG
  'vscode_icon_png': [
    'claude-logo.png',
  ],
};

// ═══════════════════════════════════════════════════
// BACKUP & RESTORE
// ═══════════════════════════════════════════════════

function backupFile(filePath) {
  const backupPath = filePath + BACKUP_SUFFIX;
  if (!fs.existsSync(backupPath)) {
    fs.copyFileSync(filePath, backupPath);
    return { backed: true, path: backupPath };
  }
  return { backed: false, path: backupPath, note: 'Backup already exists' };
}

function restoreFile(filePath) {
  const backupPath = filePath + BACKUP_SUFFIX;
  if (fs.existsSync(backupPath)) {
    fs.copyFileSync(backupPath, filePath);
    return { restored: true };
  }
  return { restored: false, note: 'No backup found' };
}

// ═══════════════════════════════════════════════════
// MEDIA FILE PATCHING (direct file swap in resources/)
// ═══════════════════════════════════════════════════

/**
 * Patch media files in the extension's resources/ directory.
 * Directly copies skin images over the originals (with backup).
 *
 * @param {string} extPath - Extension root (e.g. ~/.vscode/extensions/anthropic.claude-code-x.y.z-...)
 * @param {string} skinDir - Skin directory containing the source images
 * @param {object} manifest - Parsed skin manifest.json
 * @returns {{ patched: Array, skipped: Array, errors: Array }}
 */
function patchMediaFiles(extPath, skinDir, manifest) {
  const results = { patched: [], skipped: [], errors: [] };
  const resourcesDir = path.join(extPath, 'resources');

  if (!fs.existsSync(resourcesDir)) {
    results.errors.push(`resources/ directory not found in ${extPath}`);
    return results;
  }

  const targets = manifest.targets || {};

  for (const [targetKey, resourceFiles] of Object.entries(MEDIA_MAP)) {
    const skinFile = targets[targetKey];
    if (!skinFile) continue;

    const skinFilePath = path.join(skinDir, skinFile);
    if (!fs.existsSync(skinFilePath)) {
      results.skipped.push({ target: targetKey, reason: `Skin file not found: ${skinFile}` });
      continue;
    }

    const skinExt = path.extname(skinFile).toLowerCase();

    for (const resourceFile of resourceFiles) {
      const destPath = path.join(resourcesDir, resourceFile);
      if (!fs.existsSync(destPath)) {
        results.skipped.push({ target: resourceFile, reason: 'File not present in extension' });
        continue;
      }

      const destExt = path.extname(resourceFile).toLowerCase();

      try {
        backupFile(destPath);

        if (skinExt === destExt) {
          // Same format — direct copy
          fs.copyFileSync(skinFilePath, destPath);
        } else if (skinExt === '.svg' && destExt === '.png') {
          // SVG skin → PNG target: write the SVG content as-is
          // VS Code can handle SVG in most places, but for .png targets
          // we keep the original since we can't rasterize without deps.
          // The primary mascot (clawd.svg) is SVG→SVG so this is fine.
          results.skipped.push({
            target: resourceFile,
            reason: `Format mismatch (skin is ${skinExt}, target is ${destExt}) — skipped to avoid corruption`
          });
          continue;
        } else {
          fs.copyFileSync(skinFilePath, destPath);
        }

        const destSize = fs.statSync(destPath).size;
        results.patched.push({
          file: destPath,
          target: resourceFile,
          skinSource: skinFile,
          size: destSize,
          originalBackup: destPath + BACKUP_SUFFIX
        });
      } catch (e) {
        results.errors.push(`Failed to patch ${resourceFile}: ${e.message}`);
      }
    }
  }

  return results;
}

// ═══════════════════════════════════════════════════
// WELCOME ART PATCHING (the main center mascot)
// ═══════════════════════════════════════════════════

// The Claude orange used in the mascot body in welcome-art SVGs
const CLAUDE_ORANGE = '#D97757';

/**
 * Extract gradient <defs> from a skin's mascot SVG and determine fill replacement.
 * Returns { defs: string, fill: string } where fill is either "url(#id)" or a hex color.
 */
function extractSkinFill(skinDir, manifest) {
  const mascotFile = manifest.targets?.vscode_mascot;
  if (!mascotFile) return null;

  const mascotPath = path.join(skinDir, mascotFile);
  if (!fs.existsSync(mascotPath)) return null;

  const svg = fs.readFileSync(mascotPath, 'utf8');

  // Look for <defs>...</defs> containing gradients
  const defsMatch = svg.match(/<defs>([\s\S]*?)<\/defs>/i);
  if (defsMatch) {
    const defsContent = defsMatch[1];
    // Find gradient IDs
    const gradientId = defsContent.match(/id="([^"]+)"/)?.[1];
    if (gradientId) {
      return {
        defs: defsMatch[0],
        fill: `url(#${gradientId})`,
      };
    }
  }

  // No gradient — use the skin's primary color
  if (manifest.colors?.primary) {
    return { defs: null, fill: manifest.colors.primary };
  }

  return null;
}

/**
 * Patch welcome-art-dark.svg and welcome-art-light.svg in-place.
 * Replaces the mascot body color (#D97757) with the skin's color/gradient.
 */
function patchWelcomeArt(extPath, skinDir, manifest) {
  const results = { patched: [], skipped: [], errors: [] };
  const resourcesDir = path.join(extPath, 'resources');

  const skinFill = extractSkinFill(skinDir, manifest);
  if (!skinFill) {
    results.skipped.push({ target: 'welcome-art', reason: 'Could not determine skin fill color' });
    return results;
  }

  const welcomeFiles = ['welcome-art-dark.svg', 'welcome-art-light.svg'];

  for (const fileName of welcomeFiles) {
    const filePath = path.join(resourcesDir, fileName);
    if (!fs.existsSync(filePath)) {
      results.skipped.push({ target: fileName, reason: 'File not present in extension' });
      continue;
    }

    try {
      backupFile(filePath);
      let svg = fs.readFileSync(filePath, 'utf8');

      // Inject gradient defs if the skin uses gradients
      if (skinFill.defs) {
        // Check if the SVG already has a <defs> section
        if (/<defs>/.test(svg)) {
          // Append gradient inside existing defs
          svg = svg.replace(/<defs>/, `<defs>${skinFill.defs.replace(/<\/?defs>/g, '')}`);
        } else {
          // Insert defs after the opening <svg ...> tag
          svg = svg.replace(/(<svg[^>]*>)/, `$1\n${skinFill.defs}`);
        }
      }

      // Replace the mascot body color with the skin fill
      let replaced = svg.replace(
        new RegExp(`fill="${CLAUDE_ORANGE}"`, 'gi'),
        `fill="${skinFill.fill}"`
      );

      if (replaced === svg) {
        results.skipped.push({ target: fileName, reason: `No ${CLAUDE_ORANGE} fill found to replace` });
        continue;
      }

      // ── Inject accessories from mascot.svg ──
      const accessories = extractAccessories(skinDir, manifest);
      if (accessories && accessories.length > 0) {
        // Find the mascot body path to get its bounding box in welcome-art coords
        const fillEsc = skinFill.fill.replace(/[.*+?^${}()|[\]\\#]/g, '\\$&');
        const pathRe = new RegExp(`<path[^>]*d="([^"]*?)"[^>]*fill="${fillEsc}"`, 'i');
        let pathMatch = pathRe.exec(replaced);
        if (!pathMatch) {
          // Try reversed attr order
          const pathRe2 = new RegExp(`<path[^>]*fill="${fillEsc}"[^>]*d="([^"]*?)"`, 'i');
          pathMatch = pathRe2.exec(replaced);
        }
        if (pathMatch) {
          const bbox = getBBox(pathMatch[1]);
          if (bbox) {
            const sx = (bbox.x2 - bbox.x1) / MASCOT_BODY.w;
            const sy = (bbox.y2 - bbox.y1) / MASCOT_BODY.h;
            const tx = bbox.x1 - MASCOT_BODY.x1 * sx;
            const ty = bbox.y1 - MASCOT_BODY.y1 * sy;

            let accSvg = '<g id="skin-acc">';
            for (const el of accessories) {
              accSvg += transformSvgElement(el, sx, sy, tx, ty);
            }
            accSvg += '</g>';
            replaced = replaced.replace(/<\/svg>\s*$/, accSvg + '</svg>');
            results.accInjected = true;
          }
        }
      }

      fs.writeFileSync(filePath, replaced, 'utf8');
      results.patched.push({
        file: filePath,
        target: fileName,
        fill: skinFill.fill,
        accessories: !!results.accInjected,
      });
    } catch (e) {
      results.errors.push(`Failed to patch ${fileName}: ${e.message}`);
    }
  }

  return results;
}

// ═══════════════════════════════════════════════════
// TERMINAL ASCII ART PATCHING
// ═══════════════════════════════════════════════════

function patchTerminalAscii(cliPath, newAsciiArt) {
  const results = { patched: [], errors: [] };
  const assets = scanCLIAssets(cliPath);

  if (assets.bundles.length === 0) {
    results.errors.push('No CLI bundles with ASCII art found');
    return results;
  }

  for (const bundlePath of assets.bundles) {
    try {
      backupFile(bundlePath);
      let content = fs.readFileSync(bundlePath, 'utf8');

      const knownPatterns = [
        /▐▛███▜▌/g,
        /▜█████▛▘/g,
      ];

      let replaced = false;
      for (const pattern of knownPatterns) {
        if (pattern.test(content)) {
          const artLines = typeof newAsciiArt === 'string'
            ? newAsciiArt.split('\n')
            : fs.readFileSync(newAsciiArt, 'utf8').split('\n');

          content = content.replace(/▐▛███▜▌/, artLines[0] || '       ');
          content = content.replace(/▜█████▛▘/, artLines[1] || '       ');
          content = content.replace(/[▘▝]\s*[▘▝]/, artLines[2] || '       ');

          replaced = true;
        }
      }

      if (replaced) {
        fs.writeFileSync(bundlePath, content, 'utf8');
        results.patched.push({ file: bundlePath });
      }
    } catch (e) {
      results.errors.push(`Failed to patch ${bundlePath}: ${e.message}`);
    }
  }

  return results;
}

// ═══════════════════════════════════════════════════
// WEBVIEW INLINE MASCOT PATCHING
// ═══════════════════════════════════════════════════

/**
 * Patch the inline SVG mascot components in webview/index.js.
 * The mascot body uses fill:"#D97757" inside React createElement calls.
 * For gradient skins, we inject a <defs><linearGradient> and use url(#id).
 * For flat-color skins, we just swap the hex fill.
 */
function patchWebviewMascot(extPath, skinDir, manifest) {
  const results = { patched: false, error: null, details: [] };
  const skinFill = extractSkinFill(skinDir, manifest);
  if (!skinFill) {
    results.error = 'Could not determine skin fill';
    return results;
  }

  const jsPath = path.join(extPath, 'webview', 'index.js');
  if (!fs.existsSync(jsPath)) {
    results.error = 'webview/index.js not found';
    return results;
  }

  try {
    backupFile(jsPath);
    let content = fs.readFileSync(jsPath, 'utf8');
    let changed = false;

    const eyeColor = manifest.colors?.eyes;
    const outlineColor = manifest.colors?.outline;

    if (skinFill.defs) {
      // Gradient skin: inject defs into inline SVG createElement calls
      const gradientIdRe = /<linearGradient\s+id="([^"]+)"([^>]*)>/;
      const gradMatch = skinFill.defs.match(gradientIdRe);

      if (gradMatch) {
        const gradId = 'skin-' + gradMatch[1];
        const gradAttrs = gradMatch[2];
        const x1 = gradAttrs.match(/x1="([^"]+)"/)?.[1] || '0';
        const y1 = gradAttrs.match(/y1="([^"]+)"/)?.[1] || '0';
        const x2 = gradAttrs.match(/x2="([^"]+)"/)?.[1] || '0';
        const y2 = gradAttrs.match(/y2="([^"]+)"/)?.[1] || '1';

        const stops = [];
        let m;
        const stopRe2 = /offset="([^"]+)"[^>]*stop-color="([^"]+)"/g;
        while ((m = stopRe2.exec(skinFill.defs)) !== null) {
          stops.push({ offset: m[1], color: m[2] });
        }

        if (stops.length > 0) {
          const mascotSvgPattern = /((\w+\.default\.)createElement\("svg",\{[^}]*viewBox:"0 0 (?:47 38|32 26)"[^}]*\},)/g;
          let match;
          const insertPositions = [];

          while ((match = mascotSvgPattern.exec(content)) !== null) {
            insertPositions.push({
              index: match.index + match[0].length,
              modulePrefix: match[2],
            });
          }

          for (const pos of insertPositions.reverse()) {
            const ce = pos.modulePrefix + 'createElement';
            const stopElements = stops.map(s =>
              `${ce}("stop",{offset:"${s.offset}",stopColor:"${s.color}"})`
            ).join(',');
            const defsElement = `${ce}("defs",null,${ce}("linearGradient",{id:"${gradId}",x1:"${x1}",y1:"${y1}",x2:"${x2}",y2:"${y2}"},${stopElements})),`;
            content = content.substring(0, pos.index) + defsElement + content.substring(pos.index);
            changed = true;
          }

          content = content.replace(/fill:"#[Dd]97757"/g, `fill:"url(#${gradId})"`);
          content = content.replace(/fill:"#ff5722"/g, `fill:"url(#${gradId})"`);
          results.details.push('Injected gradient fill');
          changed = true;
        }
      }
    }

    if (!changed && manifest.colors?.primary) {
      // Flat color: replace body color
      content = content.replace(/#D97757/gi, manifest.colors.primary);
      results.details.push(`Body color → ${manifest.colors.primary}`);
      changed = true;
    }

    // ── Eye color swap ──
    // The 32x26 mascot has separate eye rects with fill:"#1F1F1F"
    if (eyeColor) {
      content = content.replace(/fill:"#1F1F1F"/g, `fill:"${eyeColor}"`);
      results.details.push(`Eye color → ${eyeColor}`);
      changed = true;
    }

    // ── Outline stroke on body path ──
    // Add stroke to body path to make dark skins visible on dark backgrounds.
    // The path uses: fill:"#XXXXXX"} — we append stroke props.
    if (outlineColor) {
      // Add stroke to mascot body paths (they have very long d attributes, 100+ chars).
      // Pattern: createElement("path",{d:"...very long...",fill:"<bodyColor>"})
      // We match the closing fill:"..."} and inject stroke props before the }.
      const bodyColor = manifest.colors?.primary || skinFill.fill;
      const escaped = bodyColor.replace(/[.*+?^${}()|[\]\\#]/g, '\\$&');
      const strokeRe = new RegExp(
        `(createElement\\("path",\\{d:"[^"]{100,}",fill:"${escaped}")(\\})`,
        'g'
      );
      content = content.replace(strokeRe, `$1,stroke:"${outlineColor}",strokeWidth:"0.5"$2`);
      results.details.push(`Outline stroke → ${outlineColor}`);
      changed = true;
    }

    // ── Inject eye rects for 47x38 mascot ──
    // The 47x38 mascot uses a single path where eyes are transparent cutouts.
    // We inject colored rect elements to fill those cutouts.
    // Eye positions: left eye ~(9.2, 10, 4.3x4.6), right eye ~(34.1, 10, 4.3x4.6)
    if (eyeColor) {
      const mascot47Pattern = /((\w+\.default\.)createElement\("svg",\{[^}]*viewBox:"0 0 47 38"[^}]*\},)/g;
      let match47;
      const eyeInserts = [];

      while ((match47 = mascot47Pattern.exec(content)) !== null) {
        eyeInserts.push({
          modulePrefix: match47[2],
          // Find the end of this mascot's createElement block to insert before closing
          svgStart: match47.index,
        });
      }

      for (const ins of eyeInserts.reverse()) {
        const ce = ins.modulePrefix + 'createElement';
        // Insert eye rects right after the svg opening (before the path)
        const insertAt = content.indexOf('),', ins.svgStart + 1);
        if (insertAt === -1) continue;

        // Find the position right after the svg opening createElement
        const svgOpenEnd = content.indexOf('},', ins.svgStart) + 2;
        const eyeRects = [
          `${ce}("rect",{x:"9.2",y:"10",width:"4.3",height:"4.6",fill:"${eyeColor}"})`,
          `${ce}("rect",{x:"34.1",y:"10",width:"4.3",height:"4.6",fill:"${eyeColor}"})`,
        ].join(',') + ',';

        content = content.substring(0, svgOpenEnd) + eyeRects + content.substring(svgOpenEnd);
        results.details.push('Injected eye rects in 47x38 mascot');
        changed = true;
      }
    }

    // ── Inject accessories from mascot.svg ──
    // Transform constants derived from known eye positions:
    //   mascot.svg eyes (40,48) and (80,48) → 47x38 eyes (9.2,10) and (34.1,10)
    const accessories = extractAccessories(skinDir, manifest);
    if (accessories && accessories.length > 0) {
      // Add overflow:visible so above-head accessories (hats, crowns) render outside viewBox
      content = content.replace(
        /viewBox:"0 0 (47 38|32 26)"/g,
        (m) => m + ',overflow:"visible"'
      );

      // 47x38 coordinate mapping
      const SX47 = 0.6225, TX47 = -15.7, SY47 = 0.4167, TY47 = -10.0;
      const mascot47Re = /((\w+\.default\.)createElement\("svg",\{[^}]*viewBox:"0 0 47 38"[^}]*\},)/g;
      let match47;
      const acc47Inserts = [];
      while ((match47 = mascot47Re.exec(content)) !== null) {
        acc47Inserts.push({ modulePrefix: match47[2], svgStart: match47.index });
      }
      for (const ins of acc47Inserts.reverse()) {
        const ce = ins.modulePrefix + 'createElement';
        const svgOpenEnd = content.indexOf('},', ins.svgStart) + 2;
        const accElements = accessories
          .map(el => toCreateElement(ce, el, SX47, SY47, TX47, TY47))
          .filter(Boolean)
          .join(',');
        if (accElements) {
          content = content.substring(0, svgOpenEnd) + accElements + ',' + content.substring(svgOpenEnd);
          changed = true;
        }
      }

      // 32x26 coordinate mapping (proportional from 47x38)
      const scaleX32 = 32 / 47, scaleY32 = 26 / 38;
      const SX32 = SX47 * scaleX32, TX32 = TX47 * scaleX32;
      const SY32 = SY47 * scaleY32, TY32 = TY47 * scaleY32;
      const mascot32Re = /((\w+\.default\.)createElement\("svg",\{[^}]*viewBox:"0 0 32 26"[^}]*\},)/g;
      let match32;
      const acc32Inserts = [];
      while ((match32 = mascot32Re.exec(content)) !== null) {
        acc32Inserts.push({ modulePrefix: match32[2], svgStart: match32.index });
      }
      for (const ins of acc32Inserts.reverse()) {
        const ce = ins.modulePrefix + 'createElement';
        const svgOpenEnd = content.indexOf('},', ins.svgStart) + 2;
        const accElements = accessories
          .map(el => toCreateElement(ce, el, SX32, SY32, TX32, TY32))
          .filter(Boolean)
          .join(',');
        if (accElements) {
          content = content.substring(0, svgOpenEnd) + accElements + ',' + content.substring(svgOpenEnd);
          changed = true;
        }
      }

      if (changed) results.details.push('Injected accessories');
    }

    if (changed) {
      fs.writeFileSync(jsPath, content, 'utf8');
      results.patched = true;
    }
  } catch (e) {
    results.error = `Webview mascot patching failed: ${e.message}`;
  }

  return results;
}

// ═══════════════════════════════════════════════════
// APPLY A FULL SKIN
// ═══════════════════════════════════════════════════

/**
 * Restore a single file from its backup if one exists.
 * Used to reset files to original state before applying a new skin.
 */
function restoreFromBackup(filePath) {
  const backupPath = filePath + BACKUP_SUFFIX;
  if (fs.existsSync(backupPath)) {
    fs.copyFileSync(backupPath, filePath);
    return true;
  }
  return false;
}

/**
 * Restore all backed-up files in an extension directory to original state.
 * This ensures we always patch from the original baseline.
 */
function restoreExtension(extPath) {
  const restored = [];
  function walk(dir, depth = 0) {
    if (depth > 5) return;
    try {
      const entries = fs.readdirSync(dir);
      for (const entry of entries) {
        if (entry === 'node_modules') continue;
        const fullPath = path.join(dir, entry);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          walk(fullPath, depth + 1);
        } else if (entry.endsWith(BACKUP_SUFFIX)) {
          const originalPath = fullPath.replace(BACKUP_SUFFIX, '');
          fs.copyFileSync(fullPath, originalPath);
          fs.unlinkSync(fullPath);
          restored.push(originalPath);
        }
      }
    } catch { /* skip */ }
  }
  walk(extPath);
  return restored;
}

function applySkin(skinDir) {
  const manifestPath = path.join(skinDir, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    return { success: false, error: `No manifest.json found in ${skinDir}` };
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const results = {
    skin: manifest.name,
    version: manifest.version,
    media: null,
    colors: null,
    terminal: null,
    errors: []
  };

  // Find installations
  const extensions = findExtension();
  const cliInstalls = findCLI();

  if (extensions.length === 0 && cliInstalls.length === 0) {
    return { success: false, error: 'No Claude Code installation found. Is Claude Code installed?' };
  }

  // Apply to each VS Code extension found
  for (const ext of extensions) {
    console.log(`  Patching ${ext.type} (v${ext.version})...`);

    // Restore any previous skin patches to get back to original baseline
    const restored = restoreExtension(ext.path);
    if (restored.length > 0) {
      console.log(`  \x1b[36m↻\x1b[0m Restored ${restored.length} file(s) to original before applying`);
    }

    // Swap media files (mascot + icon) in resources/
    results.media = patchMediaFiles(ext.path, skinDir, manifest);

    // Patch the main welcome-art mascot figure
    results.welcomeArt = patchWelcomeArt(ext.path, skinDir, manifest);

    // Patch inline SVG mascot in webview JS (gradient or flat color)
    results.webviewMascot = patchWebviewMascot(ext.path, skinDir, manifest);
  }

  // Apply VS Code color theme
  results.colorTheme = applyColorTheme(skinDir, manifest);

  // Apply terminal ASCII art
  for (const cli of cliInstalls) {
    if (manifest.targets?.terminal_ascii) {
      const asciiPath = path.join(skinDir, manifest.targets.terminal_ascii);
      if (fs.existsSync(asciiPath)) {
        results.terminal = patchTerminalAscii(cli.path, asciiPath);
      }
    }
  }

  results.success = results.errors.length === 0 &&
    (!results.media || results.media.errors.length === 0);
  return results;
}

// ═══════════════════════════════════════════════════
// RESTORE ALL TO ORIGINAL
// ═══════════════════════════════════════════════════

function restoreAll() {
  const results = { restored: [], errors: [] };
  const extensions = findExtension();
  const cliInstalls = findCLI();

  const allPaths = [
    ...extensions.map(e => e.path),
    ...cliInstalls.map(c => c.path)
  ];

  for (const basePath of allPaths) {
    function walkRestore(dir, depth = 0) {
      if (depth > 5) return;
      try {
        const entries = fs.readdirSync(dir);
        for (const entry of entries) {
          if (entry === 'node_modules') continue;
          const fullPath = path.join(dir, entry);
          const stat = fs.statSync(fullPath);

          if (stat.isDirectory()) {
            walkRestore(fullPath, depth + 1);
          } else if (entry.endsWith(BACKUP_SUFFIX)) {
            const originalPath = fullPath.replace(BACKUP_SUFFIX, '');
            try {
              fs.copyFileSync(fullPath, originalPath);
              fs.unlinkSync(fullPath);
              results.restored.push(originalPath);
            } catch (e) {
              results.errors.push(`Failed to restore ${originalPath}: ${e.message}`);
            }
          }
        }
      } catch { /* skip */ }
    }

    walkRestore(basePath);
  }

  // Restore VS Code settings.json color theme
  const themeResult = restoreColorTheme();
  if (themeResult.restored) {
    results.restored.push('VS Code settings.json (color theme)');
  }
  if (themeResult.error) {
    results.errors.push(themeResult.error);
  }

  return results;
}

module.exports = {
  patchMediaFiles,
  patchWelcomeArt,
  patchWebviewMascot,
  patchTerminalAscii,
  applySkin,
  restoreAll,
  backupFile,
  restoreFile
};
