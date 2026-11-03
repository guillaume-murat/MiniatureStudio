import { deleteAllData } from './db';

/** The studio's own keys: on a shared local origin, another app's keys are not ours to clear. */
const APP_KEY = /^(nt_|nano)/i;

function clearAppKeys(storage: Storage): void {
  for (const key of Object.keys(storage)) if (APP_KEY.test(key)) storage.removeItem(key);
}

/** Back to a first launch: projects, images, people, styles, API keys and preferences are gone. */
export async function resetApp(): Promise<void> {
  await deleteAllData();
  clearAppKeys(localStorage);
  clearAppKeys(sessionStorage);
  location.reload();
}
