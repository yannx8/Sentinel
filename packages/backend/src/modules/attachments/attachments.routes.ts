import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import { prisma } from '../../lib/prisma.js';
import { AppError } from '../../lib/errors.js';
import { saveFile, readFile, contentType } from '../../lib/storage.js';
import { audit } from '../shared/audit.js';
import { incidentScope } from '../incidents/incidents.service.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 } });

import { getAuth } from '@clerk/express';
function ctx(req: any) {
  const auth = getAuth(req);
  if (!auth.userId || !auth.orgId) throw new AppError('AUTH_REQUIRED', 401, 'Authentication required');
  return { organizationId: auth.orgId, userId: auth.userId };
}

// Magic byte signatures for file type verification. Users can spoof the MIME
// type in the request, so we verify the actual file header bytes instead of
// trusting the declared mimetype. This prevents uploading an executable
// disguised as an image.
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

router.post('/:id', upload.single('file'), async (req: any, res, next) => {
  try {
    const a = req.ctx;
    const i = await prisma.incident.findFirst({ where: { id: req.params.id, ...incidentScope(a) } });
    if (!i) throw new AppError('NOT_FOUND', 404, 'Incident not found');
    if (i.status === 'CLOSED') throw new AppError('CONFLICT_STATE', 409, 'Closed incident');
    if (!req.file) throw new AppError('VALIDATION_ERROR', 400, 'File required');
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(req.file.mimetype))
      throw new AppError('UNSUPPORTED_MEDIA_TYPE', 415, 'Only JPEG, PNG and WebP are allowed');
    if (!verifyFileType(req.file.buffer, req.file.mimetype))
      throw new AppError('UNSUPPORTED_MEDIA_TYPE', 415, 'File content does not match declared type');
    // Save to storage first, then create DB record. If storage fails the DB
    // stays clean; if the DB fails the orphaned file is acceptable (no PII).
    const ref = await saveFile(req.file.buffer, req.file.mimetype);
    const cleanName = path.basename(req.file.originalname).slice(0, 255);
    const attachment = await prisma.$transaction(async (tx: any) => {
      const x = await tx.attachment.create({
        data: {
          incidentId: i.id,
          organizationId: a.orgId,
          uploadedByMembershipId: a.membershipId,
          kind: 'REPORT_PHOTO',
          originalName: cleanName,
          mimeType: req.file!.mimetype,
          sizeBytes: req.file!.size,
          storageKey: ref
        }
      });
      await audit(tx, a.orgId, i.id, a.membershipId, 'ATTACHMENT', { attachmentId: x.id });
      return x;
    });
    res.status(201).json(attachment);
  } catch (e) {
    next(e);
  }
});

router.get('/:id/:attId', async (req: any, res, next) => {
  try {
    const a = req.ctx;
    const i = await prisma.incident.findFirst({ where: { id: req.params.id, ...incidentScope(a) } });
    if (!i) throw new AppError('NOT_FOUND', 404, 'Incident not found');
    const at = await prisma.attachment.findFirst({ where: { id: req.params.attId, incidentId: i.id } });
    if (!at) throw new AppError('NOT_FOUND', 404, 'Attachment not found');
    res.type(contentType(at.storageKey)).send(await readFile(at.storageKey));
  } catch (e) {
    next(e);
  }
});

export default router;
