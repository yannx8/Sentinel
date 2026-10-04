import { describe, it, expect } from 'vitest';

const MAGIC_BYTES: Record<string, number[][]> = {
  'image/jpeg': [[0xff, 0xd8, 0xff]],
  'image/png': [[0x89, 0x50, 0x4e, 0x47]],
  'image/webp': [[0x52, 0x49, 0x46, 0x46]]
};

function verifyFileType(buffer: Buffer, declaredMime: string): boolean {
  const signatures = MAGIC_BYTES[declaredMime];
  if (!signatures) return false;
  return signatures.some((sig) => sig.every((byte, i) => buffer[i] === byte));
}

describe('attachment content sniffing', () => {
  it('validates JPEG file signature', () => {
    const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    expect(verifyFileType(jpegBuffer, 'image/jpeg')).toBe(true);
  });

  it('validates PNG file signature', () => {
    const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
    expect(verifyFileType(pngBuffer, 'image/png')).toBe(true);
  });

  it('validates WebP file signature', () => {
    const webpBuffer = Buffer.from([0x52, 0x49, 0x46, 0x46, 0x00, 0x00]);
    expect(verifyFileType(webpBuffer, 'image/webp')).toBe(true);
  });

  it('rejects mismatched file type', () => {
    const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
    expect(verifyFileType(pngBuffer, 'image/jpeg')).toBe(false);
  });

  it('rejects unknown mime type', () => {
    const buffer = Buffer.from([0x00, 0x00, 0x00]);
    expect(verifyFileType(buffer, 'application/pdf')).toBe(false);
  });

  it('rejects empty buffer', () => {
    const emptyBuffer = Buffer.from([]);
    expect(verifyFileType(emptyBuffer, 'image/jpeg')).toBe(false);
  });
});
