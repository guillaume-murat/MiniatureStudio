/// <reference types="astro/client" />

interface ImportMetaEnv {
  /** The app's version, from package.json (astro.config.mjs). */
  readonly PUBLIC_APP_VERSION?: string;
}
