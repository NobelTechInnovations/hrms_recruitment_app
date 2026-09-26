// Private file storage for verification documents, resumes and photos.
// Files live outside /public and are only served through an authorised route.

import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { UserError } from "@/lib/errors";

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ALLOWED: Record<string, string> = {
  "application/pdf": ".pdf",
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

// Uploads live outside the build output; tell the bundler not to trace these paths.
function storageRoot(): string {
  return process.env.STORAGE_DIR ? path.resolve(/*turbopackIgnore: true*/ process.env.STORAGE_DIR) : path.join(/*turbopackIgnore: true*/ process.cwd(), "storage", "uploads");
}

function resolveKey(key: string): string {
  if (!/^[a-z]+\/[0-9a-f-]{36}\.(pdf|jpg|png|webp)$/.test(key)) throw new Error("Invalid storage key");
  return path.join(/*turbopackIgnore: true*/ storageRoot(), key);
}

export type StoredFile = { storageKey: string; fileName: string; mimeType: string; sizeBytes: number };

export class UploadError extends UserError {}

export async function saveUpload(file: File, folder: "documents" | "photos", opts: { imagesOnly?: boolean } = {}): Promise<StoredFile> {
  if (!file || typeof file === "string" || file.size === 0) throw new UploadError("Please choose a file to upload.");
  if (file.size > MAX_UPLOAD_BYTES) throw new UploadError("Files must be 5 MB or smaller.");
  const ext = ALLOWED[file.type];
  if (!ext || (opts.imagesOnly && file.type === "application/pdf")) {
    throw new UploadError(opts.imagesOnly ? "Upload a JPG, PNG or WebP image." : "Upload a PDF, JPG, PNG or WebP file.");
  }
  const storageKey = `${folder}/${crypto.randomUUID()}${ext}`;
  const target = resolveKey(storageKey);
  await mkdir(/*turbopackIgnore: true*/ path.dirname(target), { recursive: true });
  await writeFile(/*turbopackIgnore: true*/ target, Buffer.from(await file.arrayBuffer()));
  return { storageKey, fileName: file.name.slice(0, 200) || `upload${ext}`, mimeType: file.type, sizeBytes: file.size };
}

export async function readUpload(storageKey: string): Promise<Buffer> {
  return readFile(/*turbopackIgnore: true*/ resolveKey(storageKey));
}

export async function deleteUpload(storageKey: string): Promise<void> {
  await unlink(/*turbopackIgnore: true*/ resolveKey(storageKey)).catch(() => undefined);
}
