import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { env } from '../env.js';

/**
 * Save an image file to local storage with a UUID-based name.
 * @returns A unique file reference suitable for database storage.
 */
export async function saveFile(buffer: Buffer, mimeType: string) {
  await fs.mkdir(env.STORAGE_PATH, { recursive: true });
  const ref = `${crypto.randomUUID()}.${({ 'image/jpeg':'jpg','image/png':'png','image/webp':'webp' } as Record<string,string>)[mimeType]}`;
  // 'wx' flag fails atomically if file already exists, preventing silent overwrites
  await fs.writeFile(path.join(env.STORAGE_PATH, ref), new Uint8Array(buffer), { flag:'wx' });
  return ref;
}

/** Read a file from local storage. path.basename prevents directory traversal attacks. */
export async function readFile(ref: string) {
  return fs.readFile(path.join(env.STORAGE_PATH, path.basename(ref)));
}

/** Map a file reference extension to its MIME content type. */
export function contentType(ref: string) {
  const ext = path.extname(ref).toLowerCase();
  return ext === '.jpg' ? 'image/jpeg' : ext === '.png' ? 'image/png' : 'image/webp';
}

/** SHA-256 hash a token for secure storage (refresh tokens, password reset links). */
export function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}
