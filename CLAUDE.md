# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

NanoThumbnail is a free, open-source, local-first studio to generate, edit and test YouTube thumbnails with Google's Nano Banana models (Pro / 2), BYOK via Replicate, Google Gemini, OpenRouter or Mammouth, or Vertex AI through the user's gcloud (local only).

**Stack**: Astro 7 (static), React 19 island for `/app`, shadcn/ui + Radix + Tailwind v4, Zustand, IndexedDB (`idb`), Vitest. Deployed on Netlify.

## Commands

```bash
npm run dev        # http://localhost:4321 (Gemini/OpenRouter work; Replicate needs `netlify dev` for the proxy)
npm run build      # → dist/
npm test           # Vitest
npm run typecheck  # tsc --noEmit (src + netlify)
npm run check      # typecheck + test + build (CI)
npm run local      # build + local server (dist + Vertex helper + Netlify functions) on 127.0.0.1:17830
npm run app:mac:install  # macOS app → /Applications (macos/auto-install.sh does it when sources changed)
```

## Architecture

- `src/app/` — the studio, a single React island (`<App client:only="react" />` in `src/pages/app.astro`).
  - `stores/workspace.ts` — core state & actions: projects, generations (with `parentId` lineage), jobs (abortable), brief, refs, personas, brand kit, edit/region-edit, score/rank.
  - `stores/settings.ts` — provider, keys (localStorage or sessionStorage), output params, theme, lang. Keys: `nt_prefs`, `nt_key_<provider>`, `nano_lang`.
  - `lib/providers.ts` — Replicate (via proxy, `Prefer: wait`, backoff polling, cancel on abort) Gemini (direct, `x-goog-api-key`), OpenRouter and Mammouth (direct, same OpenAI-style chat completions code, per-provider endpoint/models in `CHAT_PROVIDERS`) and Vertex AI (same body as Gemini, sent to the same-origin `/vertex/*` helper; the key is optional, `apiKey()` returns the `VERTEX_GCLOUD` sentinel when empty). `generateImage`, `generateText`, `generateJSON`.
  - `lib/prompt.ts` — prompt builder following Google's Nano Banana guidance (declared image roles, identity lock, "change only X" edits). Covered by tests.
  - `lib/ai.ts` — critique, ranking, concepts, channel style analysis (Gemini 3 Flash).
  - `lib/images.ts` — canvas helpers: reference downscaling, YouTube export (1280×720 or 1920×1080, ≤ 2 MB; images smaller than 1920×1080 are first upscaled by the model — `upscale` in the workspace store, a `kind: 'upscale'` version, editable text redrawn on top), mask highlight/merge for region edits.
  - `lib/db.ts` — IndexedDB `NanoThumbnail` (stores Blobs). `lib/migrate.ts` imports v1 data (`NanoThumbnailDB`) once.
  - `lib/styles.ts` — 14 style presets.
  - `lib/colors.ts` — brand colour hex parsing and the 10 preset palettes. `lib/fonts.ts` — brand Google Font: curated list shipped in `public/fonts` (latin subset, regular + heaviest weight, fetched by `npm run fonts:download` / `scripts/download-fonts.ts`; add a family to `GOOGLE_FONTS` then rerun it), loaded with the FontFace API; other families typed by the user go through the Google Fonts CSS API (its 400s have no CORS header, so a failed fetch while online means "not available"), and the specimen image sent as a `font` image role, since the image model can't load the font itself.
  - Text tool (`T`): `components/canvas/TextLayer.tsx` (overlay to move/rotate blocks + style toolbar, reusing the brand-kit `FontPicker` in compact mode), blocks in `stores/text.ts`, layout and canvas render in `lib/textBlocks.ts` (positions/sizes relative to the image, shared metrics so the overlay matches the render). `applyText` draws them on the image: a plain image gets a new `kind: 'text'` version carrying `textLayer` (`base` image + `blocks`), so its text stays editable (text mode reloads the blocks over `base`, and applying again updates that version in place); `mergeText` drops `textLayer` to make the text final.
  - Reframe tool (`R`): `components/canvas/ReframeLayer.tsx`, framing in `stores/reframe.ts`, math and composition in `lib/reframe.ts` (scale + centre offset relative to a frame of the image's own size). `reframe` builds the result locally when the image still covers the frame; otherwise the empty areas are painted `GAP_COLOR`, filled by the model (`buildOutpaintPrompt`) and merged back with `mergeWithMask` so the moved image stays pixel-exact. Text versions move their base and keep the text.
  - Trackpad pinch: `hooks/use-pinch.ts` (ctrl+wheel in Chromium, `gesture*` events in WebKit/the macOS app). The image view zooms 1–8× around the cursor (`lib/zoom.ts`), the reframe view scales the image.
  - Edit prompt (`buildEditPrompt`): the instruction must win over the "keep everything else" clause, which only protects what the instruction does not mention (a fixed "keep the composition" made the model ignore moves and resizes).
  - Feed preview (`components/canvas/FeedPreview.tsx`): the selected image alone among 30 real YouTube videos shipped with the app (`src/app/data/feed-videos.json` + thumbnails/logos in `public/feed/`), drawn with a seeded shuffle per layout (« Mélanger » = new seed); ages are relative to the snapshot date. Your card uses `brand.avatar` (channel picture uploaded from the feed toolbar, never sent to the image model) else `brand.logo`. No key or call at runtime: refresh the snapshot with `npm run feed:update [REGION]` (`scripts/update-feed-videos.ts`, YouTube Data API v3 most popular videos, key from `YOUTUBE_API_KEY` or the gcloud key « NanoThumbnail YouTube… », never printed).
  - « Corriger le visage » (`components/iterate/FaceFixDialog.tsx`, top of the quick edits, disabled without registered people): pick people, `fixFaces` sends the image at full detail plus their photos with `buildFaceFixPrompt` (identity rebuild, change only the faces); editable text is kept as text.
  - `components/dialogs/PromptDialog.tsx` — the eye button next to Generate: the prompt the next generation would send (`previewPrompt()`, same code path as `generate`) and the `fullPrompt` stored on the selected generation.
  - `i18n/` — typed dictionaries; `useT()` in components, `t()` elsewhere. `fr.ts` must satisfy the `en.ts` shape.
  - `components/ui/` — shadcn components (generated; `cn` comes from `@/app/lib/utils`).
- `src/components/site/Landing.astro` + `src/site/i18n.ts` — static landing, pre-rendered in fr (`/`) and en (`/en/`), no client JS. Images live in `src/assets/` and go through `<Image>` (responsive srcset). The style gallery (`src/assets/gallery/`) holds one thumbnail per preset in `lib/styles.ts`, generated in the studio: `<id>.webp` (FR or language-neutral text) and `<id>-en.webp` when the text differs in English. Styles: `src/styles/site.css` (scans only the site, inlined) vs `tailwind.css` (studio); shared tokens in `tokens.css`.
- SEO/GEO: `SiteLayout.astro` (Open Graph per language `public/og-{fr,en}.jpg`, hreflang, JSON-LD WebApplication + FAQPage), `src/pages/sitemap.xml.ts`, `src/pages/llms.txt.ts` and `llms-full.txt.ts` (generated from `src/site/i18n.ts` via `src/site/llms.ts`), `public/robots.txt` (AI crawlers allowed). Landing currently scores 100/100/100/100 on Lighthouse (mobile and desktop).
- `src/app/agent/` + `mcp/` — AI agent bridge. `mcp/` (npm workspace `nanothumbnail-mcp`, bundled with esbuild) is a stdio MCP server that relays tool calls over a WebSocket on `127.0.0.1:17821` to the studio tab (`agent/bridge.ts`, paired with a token via `#agent=<port>:<token>`). Tool definitions are shared in `agent/protocol.ts` (pure, no DOM/Node); handlers in `agent/tools.ts` call the store actions (`generate`/`edit`/`score`/`rankPicked` return an `Outcome` for this). Adding a tool: define it in `STUDIO_TOOLS`, implement it in `handlers`. `skills/nanothumbnail/` is the companion agent skill (skills.sh format: `SKILL.md` + `references/`); keep it in sync with the tool list.
- `local/` — `vertex.ts`: connect-style middleware that relays `/vertex/models/{model}:generateContent` with a cached `gcloud auth print-access-token` and the gcloud project (local Host + same Origin only; tested). Mounted in `astro dev` by an integration in `astro.config.mjs` and by `server.ts`, the static server bundled (esbuild → `local/dist/server.mjs`) into the macOS app, which also adapts the Netlify functions. `macos/` — `NanoThumbnail.swift` (AppKit + WKWebView: starts the server with the login-shell `PATH`, handles downloads, file pickers, external links) and `build.sh` (swiftc, Info.plist, icon, ad-hoc signature). The port 17830 is fixed: IndexedDB is tied to the origin.
- `netlify/functions/replicate-proxy.ts` — relays only create/poll/cancel Replicate routes, only for the site origin (`netlify/lib/origin.ts`). Tested.
- `public/sw.js` — service worker (network-first pages, cache-first hashed assets). Bump `VERSION` when changing its logic.

## Conventions

- Adding UI text: add the key to both `src/app/i18n/en.ts` and `fr.ts` (typecheck enforces parity).
- New shadcn components: `npx shadcn@latest add <name>`; check the import of `cn` afterwards, and note that a stale `deno.lock` in the repo makes the CLI try to use Deno.
- CSP is emitted by Astro (`security.csp` in `astro.config.mjs`). Any new external origin (image CDN, API) must be added to `img-src`/`connect-src` there.
- Don't put API keys in URLs; don't cache anything under `/.netlify/` in the service worker.
