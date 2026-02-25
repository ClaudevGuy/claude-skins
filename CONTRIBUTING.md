# Contributing a Community Skin

Want your custom Claude Code mascot on the website? Follow these steps.

## Requirements

Your skin needs just **two files**:

```
community-skins/your-skin-id/
  manifest.json
  mascot.svg
```

### manifest.json

```json
{
  "name": "Your Skin Name",
  "author": "your-github-username",
  "version": "1.0.0",
  "description": "A short description (under 80 chars).",
  "colors": {
    "primary": "#hexcolor",
    "accent": "#hexcolor"
  }
}
```

**Required fields:** `name`, `author`, `colors.primary`, `colors.accent`

**Optional fields:** `author_url`, `description`, `version`, `colors.outline`

### mascot.svg

Your mascot SVG. Guidelines:

- Use `viewBox="0 0 136 128"` to match the official mascot dimensions
- Keep it under 50KB
- Must be a valid SVG file
- Can include animations (`<animate>`, `<animateTransform>`)
- The pixel grid is 8px cells — see official skins in `skins/` for reference
- **No `<script>` tags or inline event handlers** (will be rejected)

### Optional: ascii-art.txt

Terminal art preview (3 lines, ~12 chars wide). Example:

```
  ▐▛██▜▌
  ▐████▌
   ▜▛▜▛
```

## Steps

1. **Fork** this repository
2. **Copy** the template: `cp -r community-skins/_template community-skins/your-skin-id`
3. **Edit** `manifest.json` with your skin's info
4. **Replace** `mascot.svg` with your custom mascot
5. **Test** the CLI: `node bin/claude-skins.js apply your-skin-id`
6. **Open a PR** to the `main` branch

## Naming Rules

- Skin ID (folder name): **lowercase, hyphens only** (e.g., `neon-cat`, `retro-wave`)
- No spaces, underscores, or special characters
- Must be unique — check existing names first
- Cannot match any official skin name in `skins/`

## What Happens After Merge

Once your PR is merged:

1. Vercel auto-rebuilds and generates the community skin index
2. Your skin appears in the **Community Creations** section on the website
3. Anyone can install it via `node bin/claude-skins.js apply your-skin-id`

## PR Checklist

- [ ] Folder is in `community-skins/` (not `skins/`)
- [ ] `manifest.json` has all required fields
- [ ] `mascot.svg` exists and is valid SVG
- [ ] `mascot.svg` is under 50KB
- [ ] No `<script>` tags in SVG
- [ ] Skin ID is lowercase with hyphens only
- [ ] No offensive or NSFW content
