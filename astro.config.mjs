import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import { readFileSync } from 'node:fs';
import { createVertexHandler } from './local/vertex.ts';

/** Shown in Settings → About. */
const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

/** Vertex AI through the user's gcloud credentials, in dev only (local/vertex.ts). */
const vertexLocal = {
  name: 'vertex-local',
  hooks: {
    'astro:server:setup': ({ server }) => {
      server.middlewares.use(createVertexHandler());
    },
  },
};

// https://astro.build/config
export default defineConfig({
  output: 'static',
  // The studio is the only page.
  redirects: { '/': '/app/' },
  integrations: [react(), vertexLocal],
  security: {
    // Emits a <meta> CSP with hashes for every script Astro renders.
    csp: {
      directives: [
        "default-src 'self'",
        // Generated images (Replicate CDN), YouTube thumbnails, blobs/data for local images
        "img-src 'self' data: blob: https://replicate.delivery https://*.replicate.delivery https://i.ytimg.com https://img.youtube.com",
        // Gemini, OpenRouter and Mammouth are called directly; Replicate goes through our function; images are downloaded from Replicate's CDN.
        // ws://127.0.0.1: the local MCP server (mcp/) that lets an AI agent drive the studio.
        "connect-src 'self' data: blob: https://generativelanguage.googleapis.com https://openrouter.ai https://api.mammouth.ai https://replicate.delivery https://*.replicate.delivery https://www.youtube.com https://i.ytimg.com https://img.youtube.com https://fonts.googleapis.com ws://127.0.0.1:*",
        // Brand kit: the chosen Google Font is loaded for the preview and the specimen.
        "font-src 'self' https://fonts.gstatic.com",
        "worker-src 'self'",
        "manifest-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ],
      // Radix/sonner set inline styles at runtime; scripts stay strictly hashed.
      styleDirective: { resources: ["'self'", "'unsafe-inline'"] },
    },
  },
  build: {
    assets: 'assets',
    // Inline CSS in the HTML: removes a render-blocking request.
    inlineStylesheets: 'always'
  },
  // No Markdown code blocks here; Shiki's inline styles would conflict with the CSP.
  markdown: { syntaxHighlight: false },
  vite: {
    plugins: [tailwindcss()],
    define: { 'import.meta.env.PUBLIC_APP_VERSION': JSON.stringify(version) },
    // Pre-bundle the studio's deps up front: otherwise Vite re-optimizes them
    // mid-session (e.g. after a build) and the island fails with "Outdated Optimize Dep".
    optimizeDeps: {
      include: [
        'react', 'react-dom', 'react-dom/client', 'react/jsx-runtime', 'react/jsx-dev-runtime',
        'radix-ui', 'lucide-react', 'sonner', 'cmdk', 'react-resizable-panels', 'zustand',
        'idb', 'fflate', 'clsx', 'tailwind-merge', 'class-variance-authority',
      ],
    },
    build: {
      cssCodeSplit: true
    }
  }
});
