# JTSC Achievement Card Studio

A private, browser-based social graphic maker for Jenks Trojan Swim Club.
Upload a swimmer portrait, select an achievement, personalize the details, and
download a high-resolution PNG for Instagram or Facebook. Photos never leave
the user's device.

## Prerequisites

- Node.js `>=22.13.0`

## Quick Start

```bash
npm install
npm run dev
npm run build
```

This starter does not use `wrangler.jsonc`.

## Product features

- state, sectionals, junior nationals, and national team presets
- editable swimmer, team, event, and achievement text
- portrait and square social formats
- photo zoom and vertical positioning controls
- 1080px PNG export from the browser canvas
- responsive desktop and mobile editing experience

## Useful Commands

- `npm run dev`: start local development
- `npm run build`: verify the vinext build output
- `npm test`: build the starter and verify its rendered loading skeleton
- `npm run db:generate`: generate Drizzle migrations after schema changes

## Learn More

- [vinext Documentation](https://github.com/cloudflare/vinext)
- [Drizzle D1 Guide](https://orm.drizzle.team/docs/get-started/d1-new)
