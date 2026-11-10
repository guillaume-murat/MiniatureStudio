/** Who made the studio, where its code is, and the project it is forked from (Settings, top bar). */
export const AUTHOR_URL = 'https://guillaumemurat.fr';
export const SOURCE_URL = 'https://github.com/guillaume-murat/MiniatureStudio';
export const ORIGIN_REPO_URL = 'https://github.com/yoanbernabeu/NanoThumbnail';
/** From package.json, set at build time (astro.config.mjs). */
export const APP_VERSION: string = import.meta.env.PUBLIC_APP_VERSION ?? '';
