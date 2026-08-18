// Replaces the Claude-artifact-only `window.storage` with Capacitor's
// on-device Preferences storage, so data is saved right on the phone.
import { Preferences } from "@capacitor/preferences";

export async function storageGet(key) {
  const { value } = await Preferences.get({ key });
  return value ? { value } : null;
}

export async function storageSet(key, value) {
  await Preferences.set({ key, value });
  return { key, value };
}

export async function storageDelete(key) {
  await Preferences.remove({ key });
}
