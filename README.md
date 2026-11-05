# NanoThumbnail

> This project is a fork of [yoanbernabeu/NanoThumbnail](https://github.com/yoanbernabeu/NanoThumbnail).

NanoThumbnail is a free, open-source studio to **generate, edit and test YouTube thumbnails** with Google's Nano Banana models (Nano Banana Pro, Nano Banana 2 and its Lite version). It runs entirely in your browser: bring your own **Replicate**, **Google Gemini**, **OpenRouter** or **Mammouth** key (or use **Vertex AI** through your gcloud, locally), your images stay on your device.

![NanoThumbnail Studio](src/assets/landing/en-studio.webp)

**Live:** [nanothumbnail.com](https://nanothumbnail.com) · [Studio](https://nanothumbnail.com/app/) · [English](https://nanothumbnail.com/en/) / [Français](https://nanothumbnail.com/)

| Generate | Edit | Edit again |
|---|---|---|
| ![Generation](src/assets/landing/step-1.webp) | ![Accent switched to orange](src/assets/landing/step-2.webp) | ![Text changed to 1M](src/assets/landing/step-3.webp) |
| “Tech tutorial” style, text “0 → 100K” | “Switch every blue accent to bright orange” | “Replace ‘100K’ with ‘1M’, same style” |

## Features

**Create**
- **Brief-driven generation**: video title and scene (the AI leaves clean space for the text you add afterwards), 1, 2 or 4 variants, 16:9 or 9:16, 1K/2K/4K (Lite is 1K only), with the price per image shown beside each model. An eye next to each input shows exactly what it adds to the prompt, and the numbered sections fold.
- **Per-project brief**: everything in the left panel is saved with its project and comes back when you open it.
- **14 proven styles**: reaction + object, versus, before/after, tech tutorial, cinematic documentary, hyper-saturated, 3D clay… plus a style library where you create your own, shared by all your projects.
- **Concept assistant**: three genuinely different angles from your video title, written in your language, with optional image previews (Nano Banana 2 Lite).
- **People**: a library of people shared by all your projects (front/profile photos plus expressions); each project picks up to 5 of them, and their identity is preserved.
- **Channel & brand colours**: channel name and logo (paste a channel or video URL to fetch both) for the feed preview, and brand colours sent as the dominant accents.
- **References & YouTube remix**: up to 14 reference images, each with its role (composition, style, object, background or free), or paste a YouTube URL to pull its thumbnail and title.

**Iterate**
- **Edit bar**: floats under the image and moves with its handle (below the image on mobile). It holds the instruction, the image tools, a suggestions menu that fills the field without sending anything, and an eye that shows on hover the prompt, images and model the next edit would send.
- **Conversational edits**: “make the face more surprised” changes only that.
- **History**: a thumbnail has one simple line of versions. Click one to see it; go back to it, which deletes the newer ones after a warning, or duplicate it as a new independent thumbnail.
- **Area edits**: paint a mask, describe the change; the model gets the clean image plus a marked copy as a location guide, and pixels outside the mask are merged back untouched. **Smooth** refills the painted area from its surroundings, locally and instantly (for seams and lines on soft backgrounds); **AI heal** does the same, then lets the model restore texture.
- **Text & arrows** (`T`, `A`): text blocks with Google Fonts and curved arrows (solid, open or double head, thickness, bend, colour, border, dashes, shadow), placed over the image. Applying them draws them in for good as a new version: to fix a mistake, go back to the previous one.
- **Reframe** (`R`): move or zoom the whole image, or circle one part freehand (a person, an object) and move only that part; the AI fills only what's left empty and repaints the cut so no seam shows, everything else stays pixel-exact. The studio is locked, image blurred, while the AI works.

**Test**
- **Safe zones**: duration badge, hover icons, progress bar, Shorts UI.
- **Channel preview**: your project's thumbnails on a YouTube channel page (banner, logo, name, subscribers, six videos with titles, plausible views and dates), clickable to choose each video's thumbnail and title, exported at 2560×1440. Concept from NanoChannel.
- **Feed preview**: your thumbnail alone among 30 real popular YouTube videos (home, search, up next, mobile, TV), bundled with the app (`npm run feed:update` refreshes the snapshot).
- **Compare & rank** variants side by side, then **export for YouTube Studio's Test & Compare** (1280×720, under 2 MB). Single thumbnails also export at 1920×1080; a smaller image is first upscaled by the model.

**AI agents (MCP)**
- Let Claude, Cursor or any MCP-capable agent drive the studio: brief, generate, edit (whole image or a region), rank, export to disk. You watch every action live and can disconnect at any time.
- `claude mcp add nanothumbnail -- npx -y nanothumbnail-mcp`, then ask the agent to “open the NanoThumbnail studio” and click **Allow** once.
- Companion skill with the workflow and thumbnail craft: `npx skills add yoanbernabeu/NanoThumbnail --skill nanothumbnail`.

**Keyboard-first**
- `⌘K` command palette, `⌘↵` generate, `P` feed preview, `C` channel preview, `Z` safe zones, `T` text, `A` arrow, `M` paint an area, `R` reframe, `Esc` leave the current tool.

**Local-first**
- Projects, images, people and channel details live in IndexedDB. No account, no database.
- Installable PWA; the library works offline.
- One-click zip backup and restore, and an app reset in Settings.
- API key stored in the browser, or for the current session only.

## How it works

- **Gemini** is called directly from the browser (Google's API supports CORS). The key is sent in the `x-goog-api-key` header.
- **OpenRouter** is called directly from the browser too (`google/gemini-3-pro-image`, `google/gemini-3.1-flash-image`, `google/gemini-3.1-flash-lite-image`), with the key in the `Authorization` header.
- **Mammouth** is called directly from the browser as well, through the same OpenAI-style chat completions (`gemini-3-pro-image-preview`, `gemini-3.1-flash-image-preview`, `gemini-3.1-flash-lite-image`, key in the `Authorization` header).
- **Vertex AI** (local only) bills your own Google Cloud project. The browser can't run gcloud, so the studio calls `/vertex/*` on its own origin and a small helper (`local/vertex.ts`) adds a token from `gcloud auth print-access-token` and your gcloud project. It's mounted by `npm run dev` and by the macOS app, only answers requests from the local studio, and also accepts a Vertex express-mode key instead of gcloud. `VERTEX_LOCATION` (default `global`) and `VERTEX_PROJECT` override the defaults.
- **Channel details**: youtube.com has no CORS either, so `netlify/functions/youtube-channel.ts` reads the channel page for a channel or video URL (name and picture from its Open Graph tags, banner from its page data); it only accepts YouTube URLs and the site's own origin.
- **Replicate** has no browser CORS support, so calls go through a small Netlify function (`netlify/functions/replicate-proxy.ts`). It only accepts requests from the site's own origin, only relays the three Replicate routes the app needs (create, poll, cancel), and never stores or logs anything.
- Reference images are downscaled client-side before upload, so requests stay small.
- Prompts are built as structured natural language following Google's Nano Banana prompting guidance (declared image roles, identity locks, “change only X, keep everything else” edits), see `src/app/lib/prompt.ts`. They are written in the interface's language, French or English, and so are the style presets and the assistant's answers.
- **AI agents**: the MCP server (`mcp/`, published as `nanothumbnail-mcp`) only relays tool calls over a WebSocket on `127.0.0.1` to the open studio tab, which runs them as store actions. Keys, projects and images never leave the browser. The socket accepts only the studio's origin and a pairing token; see [`mcp/README.md`](mcp/README.md).
- Ranking and concepts use Gemini Flash: `gemini-3.8-flash` with a Gemini key or on Vertex AI, `google/gemini-3-flash` on Replicate, `google/gemini-3.8-flash` on OpenRouter, or `gemini-3.8-flash` on Mammouth.

## Landing, SEO & GEO

- Static landing pre-rendered in French (`/`) and English (`/en/`), zero client JS, real studio screenshots per language.
- Lighthouse 100 / 100 / 100 / 100 (performance, accessibility, best practices, SEO) on mobile and desktop.
- Open Graph image per language, `hreflang`, JSON-LD (`WebApplication`, `FAQPage`, `WebSite`, `Person`), `sitemap.xml`.
- Agent-readable: [`/llms.txt`](https://nanothumbnail.com/llms.txt) and [`/llms-full.txt`](https://nanothumbnail.com/llms-full.txt) are generated at build time from the landing copy; `robots.txt` explicitly allows AI crawlers.

## Tech stack

- [Astro 7](https://astro.build/) — static site, CSP with script hashes, responsive images via `astro:assets`
- React 19 island for the studio (`/app`), [shadcn/ui](https://ui.shadcn.com/) + Radix, Tailwind CSS v4, Lucide icons, Zustand
- IndexedDB via `idb`, zip via `fflate`
- Vitest, GitHub Actions
- Netlify (static hosting + three functions)

## Project structure

```
src/
├── app/                    # Studio (React island mounted on /app)
│   ├── App.tsx             # Layout, shortcuts, dialogs
│   ├── components/         # brief/, canvas/, iterate/, dialogs/, ui/ (shadcn)
│   ├── stores/             # Zustand: workspace, settings, ui, text, reframe
│   ├── lib/                # providers, prompt, ai, images, db, backup, versions, reframe, textBlocks…
│   ├── agent/              # MCP bridge: tool definitions (protocol.ts), handlers, WebSocket client
│   └── i18n/               # en.ts, fr.ts (typed: a missing key fails the build)
├── assets/                 # Landing images and screenshots (fr-*/en-*), optimised at build
├── components/site/        # Landing page (static Astro, no JS)
├── site/                   # Landing copy (i18n.ts) and llms.txt generator (llms.ts)
├── layouts/                # SiteLayout (SEO, JSON-LD), AppLayout, LegalLayout
├── pages/                  # index, en/index, app, legal pages, sitemap.xml, llms.txt, llms-full.txt
└── styles/                 # tokens.css (light/dark), tailwind.css (studio), site.css (landing, inlined)
local/                      # Vertex AI helper (vertex.ts) and local server for the macOS app (server.ts)
macos/                      # macOS app: WKWebView shell (NanoThumbnail.swift) and build.sh
netlify/
├── functions/              # replicate-proxy, youtube-channel, youtube-thumbnail-proxy
└── lib/origin.ts           # Origin allowlist
mcp/                        # nanothumbnail-mcp: stdio MCP server relaying to the studio
skills/nanothumbnail/       # Companion agent skill (skills.sh)
public/                     # sw.js, manifest, icons, og-{fr,en}.jpg, robots.txt
```

## Getting started

Prerequisites: Node.js 22+, and a [Replicate](https://replicate.com/account/api-tokens) or [Google Gemini](https://aistudio.google.com/apikey) or [OpenRouter](https://openrouter.ai/settings/keys) or [Mammouth](https://mammouth.ai/app/account/settings/api) API key.

```bash
git clone https://github.com/yoanbernabeu/NanoThumbnail.git
cd NanoThumbnail
npm install
npm run dev          # http://localhost:4321
```

With `astro dev`, Gemini, OpenRouter and Mammouth work out of the box, and so does Vertex AI if `gcloud` is logged in (`gcloud auth login`) with a project set (`gcloud config set project <id>`). To use Replicate locally, run `netlify dev` so the proxy function is available.

### macOS app

```bash
npm run app:mac:install   # builds NanoThumbnail.app and copies it to /Applications
```

The app is a native window (WKWebView) around the studio. It starts a bundled local server on `127.0.0.1:17830` with your Node.js (found through your login shell's `PATH`) that serves the build, the Vertex AI helper and the Replicate/YouTube proxies, so every provider works. Needs the Xcode Command Line Tools to build, and Node.js 22+ at runtime. Its data (projects, images, keys) is separate from your browser's: use Settings → Export / Import to move it over. `npm run local` runs the same server without the app.

| Command | Description |
|---------|-------------|
| `npm run dev` | Development server |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview the production build |
| `npm test` | Unit tests (Vitest) |
| `npm run typecheck` | TypeScript check |
| `npm run check` | Typecheck + tests + build (what CI runs) |
| `npm run local` | Build and serve the studio with the local helpers on http://127.0.0.1:17830/app/ |
| `npm run app:mac` | Build the macOS app into `macos/build/` (`app:mac:install` also copies it to `/Applications`) |
| `npm run feed:update` | Refresh the feed preview's snapshot of YouTube videos (needs a YouTube Data API key) |
| `npm run fonts:download` | Download the Google Fonts shipped for text blocks |

## License

MIT — see [LICENSE](LICENSE).

## Author

**Yoan Bernabeu** — [YoanDev.co](https://yoandev.co) · [@yOyO38](https://twitter.com/yOyO38)
