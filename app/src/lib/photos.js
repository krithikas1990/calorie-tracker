import { Filesystem, Directory } from "@capacitor/filesystem";
import { storageGet, storageSet, storageDelete } from "../storage.js";

// Meal photos are saved as files on the device, so they survive app restarts.
export const PHOTO_DIR = "meal-photos";

export async function savePhoto(id, base64) {
  const path = `${PHOTO_DIR}/${id}.jpg`;
  await Filesystem.writeFile({ path, data: base64, directory: Directory.Data, recursive: true });
  return path;
}

export async function loadPhoto(path) {
  const { data } = await Filesystem.readFile({ path, directory: Directory.Data });
  if (typeof data === "string") return `data:image/jpeg;base64,${data}`;
  return URL.createObjectURL(data);
}

export async function deletePhoto(path) {
  try {
    await Filesystem.deleteFile({ path, directory: Directory.Data });
  } catch (e) {}
}

// Deletes the given days completely: meals, photos, and their summary entries.
export async function deleteDays(dateKeys, historySummary) {
  const nextSummary = { ...historySummary };
  for (const key of dateKeys) {
    try {
      const d = await storageGet(`day:${key}`);
      const parsed = d && d.value ? JSON.parse(d.value) : [];
      for (const m of parsed) if (m.photoPath) await deletePhoto(m.photoPath);
    } catch (e) {}
    try { await storageDelete(`day:${key}`); } catch (e) {}
    delete nextSummary[key];
  }
  await storageSet("history-summary", JSON.stringify(nextSummary));
  return nextSummary;
}
