/**
 * Photos are resized on the device before upload: long edge 1920 px, JPEG at
 * quality 0.85. Field networks are slow and the API refuses files over 5 MB.
 */

export const PHOTO_ACCEPT = 'image/jpeg,image/png,image/webp';

const MAX_EDGE = 1920;
const QUALITY = 0.85;
const FALLBACK_QUALITY = 0.7;
const PREVIEW_EDGE = 320;
const MAX_BYTES = 5 * 1024 * 1024;

export type PreparedPhoto = {
  id: string;
  file: File;
  /** Small data URL for thumbnails. Needs no cleanup, unlike object URLs. */
  preview: string;
};

export type PhotoProblem = 'type' | 'unreadable' | 'size';

export class PhotoError extends Error {
  readonly problem: PhotoProblem;
  constructor(problem: PhotoProblem) {
    super(`Photo rejected: ${problem}`);
    this.problem = problem;
  }
}

type Decoded = { source: CanvasImageSource; width: number; height: number; release: () => void };

async function decode(file: File): Promise<Decoded> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() };
    } catch {
      // Some engines reject the options or the format here; the image element below covers them.
    }
  }
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.decoding = 'async';
  image.src = url;
  try {
    await image.decode();
  } catch {
    URL.revokeObjectURL(url);
    throw new PhotoError('unreadable');
  }
  return { source: image, width: image.naturalWidth, height: image.naturalHeight, release: () => URL.revokeObjectURL(url) };
}

function draw(decoded: Decoded, maxEdge: number): HTMLCanvasElement {
  const scale = Math.min(1, maxEdge / Math.max(decoded.width, decoded.height, 1));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(decoded.width * scale));
  canvas.height = Math.max(1, Math.round(decoded.height * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new PhotoError('unreadable');
  // JPEG has no transparency: paint a white ground under PNG and WebP cut-outs.
  context.fillStyle = 'white';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.imageSmoothingQuality = 'high';
  context.drawImage(decoded.source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function toJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new PhotoError('unreadable'))), 'image/jpeg', quality);
  });
}

/** Resizes and re-encodes a picked photo. Any image the browser can decode becomes a JPEG. */
export async function preparePhoto(file: File): Promise<PreparedPhoto> {
  if (file.type && !file.type.startsWith('image/')) throw new PhotoError('type');
  const decoded = await decode(file);
  try {
    const canvas = draw(decoded, MAX_EDGE);
    let blob = await toJpeg(canvas, QUALITY);
    if (blob.size > MAX_BYTES) blob = await toJpeg(canvas, FALLBACK_QUALITY);
    if (blob.size > MAX_BYTES) throw new PhotoError('size');
    const preview = draw(decoded, PREVIEW_EDGE).toDataURL('image/jpeg', 0.75);
    const base = file.name.replace(/\.[^.]*$/, '').trim() || 'photo';
    return {
      id: crypto.randomUUID(),
      file: new File([blob], `${base}.jpg`, { type: 'image/jpeg', lastModified: Date.now() }),
      preview,
    };
  } finally {
    decoded.release();
  }
}
