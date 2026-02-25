# 🎨 Claude Skins

Replace the Claude Code mascot in VS Code and Terminal with custom skins.

## Quick Start

```bash
# Clone / download this folder
cd claude-skins

# Make the CLI executable
chmod +x bin/claude-skins.js

# Scan your system for Claude Code installations
node bin/claude-skins.js scan

# See available skins
node bin/claude-skins.js list

# Apply a skin
node bin/claude-skins.js apply neon-crab

# Restore original
node bin/claude-skins.js restore
```

## Global Install (optional)

```bash
npm link
# Now you can run from anywhere:
claude-skins scan
claude-skins apply beitar-gold
```

## Available Skins

| Rarity | Skin | Colors | Vibe |
|--------|------|--------|------|
| ⚪ Common | `ice-blue` | Blue / Dark | Frozen solid. Cool under pressure. |
| ⚪ Common | `forest-green` | Green / Dark | Camouflaged in the codebase. |
| ⚪ Common | `midnight-purple` | Purple / Dark | Late night coding sessions only. |
| 🟢 Uncommon | `gold-edition` | Gold / Brown | Ship to prod with confidence. ★ |
| 🟢 Uncommon | `neon-pink` | Pink / Dark | Hot pink energy. Glow effect. |
| 🔵 Rare | `diamond` | Crystal / Cyan | Transparent + sparkle pixels. |
| 🔵 Rare | `fire` | Red-Yellow gradient | Flame pixels above head. |
| 🔵 Rare | `shadow` | Near-black / Red eyes | Glowing red eyes in the dark. |
| 🟣 Epic | `holographic` | Rainbow gradient | Full spectrum shift. |
| 🟣 Epic | `crown-royal` | Purple + Gold crown | Crown accessory with gems. |

All skins use the **exact official Claude Code mascot shape** — same pixel layout, different colors/effects/accessories.

## How It Works

1. **Scan** finds your Claude Code extension at `~/.vscode/extensions/anthropic.claude-code-*`
2. **Patch** replaces the embedded mascot image (base64 in webview JS), extension icon, and ASCII art
3. **Backup** is created automatically — `restore` brings everything back
4. **Watch** mode re-applies your skin after Claude Code updates

## Creating Custom Skins

Add a folder to `skins/` with:

```
skins/my-skin/
├── manifest.json    # Name, colors, file mappings
├── mascot.svg       # Main mascot (displayed in empty chat)  
├── icon.svg         # Sidebar icon (32x32 or 128x128)
└── ascii-art.txt    # Terminal art (3 lines, ~10 chars wide)
```

### manifest.json

```json
{
  "name": "My Skin",
  "author": "You",
  "version": "1.0.0",
  "description": "Description here",
  "targets": {
    "vscode_mascot": "mascot.svg",
    "vscode_icon": "icon.svg",
    "terminal_ascii": "ascii-art.txt"
  },
  "colors": {
    "primary": "#ff00ff",
    "accent": "#8800ff"
  }
}
```

## Commands

| Command | Description |
|---------|-------------|
| `scan` | Find Claude Code installations & show patchable assets |
| `list` | Show available skins with previews |
| `apply <id>` | Apply a skin (backs up originals automatically) |
| `restore` | Restore original Claude mascot |
| `watch` | Auto-reapply skin after extension updates |
| `status` | Show current skin & installation info |

## Notes

- Skins reset when Claude Code updates — use `watch` mode to auto-reapply
- The patcher creates `.claudeskins-backup` files that `restore` uses
- Restart VS Code after applying a skin to see changes
- No dependencies required — pure Node.js
