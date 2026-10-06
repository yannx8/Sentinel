import { createReadStream } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { env } from '../env';

/**
 * Local disk storage for photos. Keys are generated server-side (uuid based),
 * never taken from the client. Swap for an S3 adapter with the same interface.
 */
const root = resolve(env.STORAGE_PATH);

function pathFor(key: string): string {
  if (!/^[a-z0-9/-]+\.(jpg|png|webp)$/.test(key)) throw new Error('Invalid storage key');
  return join(root, key);
}

export const storage = {
  async put(key: string, data: Buffer) {
    const path = pathFor(key);
    await mkdir(join(path, '..'), { recursive: true });
    await writeFile(path, data, { flag: 'wx' });
  },
  read(key: string) {
    return createReadStream(pathFor(key));
  },
  async remove(key: string) {
    await rm(pathFor(key), { force: true });
  },
};

/** Detects JPEG, PNG and WebP from magic bytes. The declared type and extension are ignored. */
export function sniffImage(data: Buffer): { mime: string; ext: 'jpg' | 'png' | 'webp' } | null {
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return { mime: 'image/jpeg', ext: 'jpg' };
  if (data.length >= 8 && data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { mime: 'image/png', ext: 'png' };
  }
  if (data.length >= 12 && data.toString('ascii', 0, 4) === 'RIFF' && data.toString('ascii', 8, 12) === 'WEBP') {
    return { mime: 'image/webp', ext: 'webp' };
  }
  return null;
}
