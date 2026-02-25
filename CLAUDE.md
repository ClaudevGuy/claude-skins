# Claude Skins

A skin/theme store and patcher for Claude Code. Replaces the mascot in VS Code extension and Terminal CLI with collectible rarity-tier variants.

## Structure
- `src/finder.js` — Detects Claude Code installations across OS (VS Code, Cursor, CLI, VSIX)
- `src/patcher.js` — Core patching engine (media file swap in resources/, ASCII art, color themes)
- `src/watcher.js` — File watcher to re-apply skins after updates, state persistence
- `bin/claude-skins.js` — CLI entry point with scan/list/apply/restore/watch/status commands
- `skins/` — Skin packages, each with manifest.json + mascot.svg + icon.svg + ascii-art.txt
- `generate-skins.js` — Generator script that builds all skins from the official mascot pixel map
- `preview.html` — Visual preview of all skins (open in browser, references skins/ directory)

## Skin Collection
26 skins across 6 rarity tiers:
- Common (5): Color swaps — Ice Blue, Forest Green, Midnight Purple, Blood Red, Slate
- Uncommon (4): Color + glow effects — Gold Edition, Neon Pink, Electric Cyan, Sunset
- Rare (8): Effects + accessories — Diamond, Fire, Shadow, Demon, Gentleman, Angel, Solana Degen, Bitcoin OG
- Epic (4): Premium effects — Holographic, Crown Royal, Void Walker, Aurora
- Seasonal (3): Time-limited drops — Winter Frost, Sakura Bloom, Halloween Haunt
- Legendary (2): Numbered editions — Genesis (#/500), Obsidian (#/200)

All use the exact official Claude Code mascot pixel shape.

## Edition System
- **Permanent**: Always available, unlimited copies
- **Seasonal**: Time-windowed availability (manifest has available_from/available_until dates)
- **Numbered**: Limited supply with serial numbers (manifest has max_supply, serial_number fields)

## Commands
- `node bin/claude-skins.js scan` — Find installations & patchable assets
- `node bin/claude-skins.js list` — Show skins with rarity and ASCII preview
- `node bin/claude-skins.js apply <skin-id>` — Apply skin (auto-backup)
- `node bin/claude-skins.js restore` — Restore originals from backup
- `node bin/claude-skins.js watch` — Auto-reapply after Claude Code updates
- `node bin/claude-skins.js status` — Show active skin info

## Key Technical Details
- Zero dependencies — pure Node.js
- Targets: `~/.vscode/extensions/anthropic.claude-code-*/`
- VS Code mascot is **separate files** in `resources/` (not base64 in JS bundles)
  - `resources/clawd.svg` — pixel art mascot (main target)
  - `resources/claude-logo.svg` / `.png` — sidebar/tab logo
  - `resources/claude-logo-done.svg` / `claude-logo-pending.svg` — status logos
  - `resources/ClawdWithGradCap.png` — mascot with grad cap
  - `resources/walkthrough/chat.png`, `click.png` — walkthrough images
- Webview bundle is `webview/index.js` + `webview/index.css` (no embedded images)
- Patcher directly swaps files in `resources/` (backup + copy)
- Terminal mascot uses Unicode block characters (▐▛███▜▌ etc.)
- Backups use `.claudeskins-backup` suffix
- State persisted in `~/.claude-skins-state.json`

## Adding New Skins
Either add to SKINS array in generate-skins.js and re-run, or manually create a folder in skins/ with manifest.json + assets. The pixel map in generate-skins.js defines the exact mascot shape.

## Next Priorities
- Test scan/apply on real Claude Code installation
- Build web-based skin store UI
- Add Legendary rarity tier
- VS Code companion extension for in-IDE skin browsing
