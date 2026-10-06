/**
 * Incident photos (docs/PRD.md F-COL-02). Uploads are buffered in memory,
 * checked by magic bytes, written to storage, then recorded with their audit
 * event. Downloads pass the same scope check as the incident, and a photo is
 * visible exactly when its ATTACHMENT_ADDED Thread entry is (5.3).
 */
import { randomUUID } from 'node:crypto';
import type { Incident, Prisma, User } from '@prisma/client';
import {
  attachmentKinds,
  isThreadEventVisible,
  type AttachmentDTO,
  type AttachmentKind,
  type MembershipRole,
  type ThreadViewer,
} from '@sentinel/shared';
import { Router, type NextFunction, type Request, type Response } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { authOf, resolveTenant, tenantOf, type Tenant } from '../auth/context';
import { recordIncidentEvent } from '../lib/audit';
import { logger } from '../lib/logger';
import { prisma, type Tx } from '../lib/prisma';
import { sniffImage, storage } from '../lib/storage';
import { AppError, forbidden, invalidTransition, notFound } from '../http/errors';
import { idempotent } from '../http/idempotency';
import { parse, parseId } from '../http/validate';
import { findVisibleIncident, threadViewerFor } from './incidents/scope';

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const REPORTER_PHOTO_LIMIT = 5;
const FILE_NAME_MAX_LENGTH = 120;

const upload = multer({
  storage: multer.memoryStorage(),
  // Only `kind` is expected besides the file, so other fields stay tiny.
  limits: { fileSize: MAX_PHOTO_BYTES, files: 1, fields: 5, fieldSize: 1024 },
  // Browsers send UTF-8 file names. Multer defaults to latin1.
  defParamCharset: 'utf8',
});

const uploadFieldsSchema = z.object({ kind: z.enum(attachmentKinds).optional() });

/** Photo kinds each role may add. The first one is the default. */
const kindsByRole: Record<MembershipRole, readonly [AttachmentKind, ...AttachmentKind[]]> = {
  REPORTER: ['REPORT'],
  SUPERVISOR: ['REPORT'],
  INTERVENANT: ['EVIDENCE', 'PROGRESS'],
};

const withUploader = {
  uploadedBy: { select: { id: true, user: { select: { firstName: true, lastName: true } } } },
} satisfies Prisma.AttachmentInclude;

type AttachmentRow = Prisma.AttachmentGetPayload<{ include: typeof withUploader }>;
type Db = Tx | typeof prisma;

export function toAttachmentDTO(row: AttachmentRow): AttachmentDTO {
  return {
    id: row.id,
    fileName: row.fileName,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    kind: row.kind,
    uploadedBy: {
      membershipId: row.uploadedBy.id,
      name: `${row.uploadedBy.user.firstName} ${row.uploadedBy.user.lastName}`,
    },
    createdAt: row.createdAt.toISOString(),
    url: `/v1/attachments/${row.id}/file`,
  };
}

/** Same rule as the Thread entry: employees never see progress photos, past assignees see nothing after their access ended. */
function canSee(viewer: ThreadViewer, row: { id: string; fileName: string; kind: AttachmentKind; createdAt: Date }) {
  return isThreadEventVisible(
    {
      type: 'ATTACHMENT_ADDED',
      createdAt: row.createdAt,
      payload: { attachmentId: row.id, fileName: row.fileName, kind: row.kind },
    },
    viewer,
  );
}

/**
 * Photos of an incident the caller already passed through findVisibleIncident,
 * oldest first. Pass the viewer when it is already known to save a query.
 */
export async function listAttachments(tenant: Tenant, incidentId: string, viewer?: ThreadViewer): Promise<AttachmentDTO[]> {
  const [rows, resolvedViewer] = await Promise.all([
    prisma.attachment.findMany({
      where: { organizationId: tenant.orgId, incidentId },
      include: withUploader,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    }),
    viewer ?? threadViewerFor(tenant, incidentId),
  ]);
  return rows.filter((row) => canSee(resolvedViewer, row)).map(toAttachmentDTO);
}

export async function listIncidentAttachments(tenant: Tenant, incidentRef: string): Promise<AttachmentDTO[]> {
  const incident = await findVisibleIncident(tenant, incidentRef);
  return listAttachments(tenant, incident.id);
}

/**
 * Who may add which photo (5.2 "Add attachments"). Returns the kind to record.
 * Runs once before the upload is stored and again under the incident lock.
 */
async function authorizeUpload(
  db: Db,
  tenant: Tenant,
  incident: Incident,
  requested: AttachmentKind | undefined,
): Promise<AttachmentKind> {
  if (incident.status === 'CLOSED') throw invalidTransition('Photos cannot be added to a closed incident.');

  const allowed = kindsByRole[tenant.role];
  const kind = requested ?? allowed[0];
  if (!allowed.includes(kind)) throw forbidden(`Use the photo kind ${allowed.join(' or ')}.`);

  switch (tenant.role) {
    case 'SUPERVISOR':
      return kind;
    case 'REPORTER': {
      // The incident scope already limits employees to their own incidents.
      if (incident.status !== 'NEW') throw forbidden('You can add photos only while the incident is new.');
      const added = await db.attachment.count({
        where: { organizationId: tenant.orgId, incidentId: incident.id, uploadedByMembershipId: tenant.membershipId },
      });
      if (added >= REPORTER_PHOTO_LIMIT) throw forbidden(`You can add up to ${REPORTER_PHOTO_LIMIT} photos to an incident.`);
      return kind;
    }
    case 'INTERVENANT': {
      const working = await db.assignment.count({
        where: {
          organizationId: tenant.orgId,
          incidentId: incident.id,
          intervenantMembershipId: tenant.membershipId,
          status: { in: ['ACCEPTED', 'REASSIGNMENT_REQUESTED'] },
        },
      });
      if (!working || incident.status !== 'IN_PROGRESS') {
        throw forbidden('You can add photos only while you are working on this incident.');
      }
      return kind;
    }
  }
}

/**
 * Locks the incident row until commit so a concurrent close, unassign or upload
 * waits, then reloads it: the checks made under the lock stay true at insert.
 */
async function lockIncident(tx: Tx, tenant: Tenant, incidentId: string): Promise<Incident> {
  await tx.$queryRaw`
    SELECT 1 FROM "Incident"
    WHERE "id" = ${incidentId}::uuid AND "organizationId" = ${tenant.orgId}::uuid
    FOR NO KEY UPDATE`;
  return findVisibleIncident(tenant, incidentId, tx);
}

/** Last path segment of the client's name, without control or bidi characters, at most 120 characters. */
function cleanFileName(original: string, ext: string): string {
  const base = original.split(/[/\\]/).pop() ?? '';
  const stripped = base.replace(/[\p{Cc}\u200e\u200f\u202a-\u202e\u2066-\u2069]/gu, '').trim();
  const name = Array.from(stripped).slice(0, FILE_NAME_MAX_LENGTH).join('').trim();
  return name || `photo.${ext}`;
}

export async function addAttachment(
  tenant: Tenant,
  incidentRef: string,
  file: Express.Multer.File | undefined,
  requested: AttachmentKind | undefined,
): Promise<AttachmentDTO> {
  const incident = await findVisibleIncident(tenant, incidentRef);
  // Early answer before anything touches storage. Repeated under the lock below.
  await authorizeUpload(prisma, tenant, incident, requested);
  if (!file) {
    throw new AppError('VALIDATION_FAILED', 'Attach a photo in the file field.', { fields: { file: ['Required'] } });
  }
  const image = sniffImage(file.buffer);
  if (!image) throw new AppError('UPLOAD_REJECTED', 'Upload a JPEG, PNG or WebP photo.');

  const storageKey = `${tenant.orgId}/${incident.id}/${randomUUID()}.${image.ext}`;
  const fileName = cleanFileName(file.originalname, image.ext);
  await storage.put(storageKey, file.buffer);

  try {
    const row = await prisma.$transaction(async (tx) => {
      const current = await lockIncident(tx, tenant, incident.id);
      const kind = await authorizeUpload(tx, tenant, current, requested);
      const created = await tx.attachment.create({
        data: {
          organizationId: tenant.orgId,
          incidentId: current.id,
          uploadedByMembershipId: tenant.membershipId,
          kind,
          fileName,
          mimeType: image.mime,
          sizeBytes: file.size,
          storageKey,
        },
        include: withUploader,
      });
      await recordIncidentEvent(tx, tenant, current.id, 'ATTACHMENT_ADDED', { attachmentId: created.id, fileName, kind });
      return created;
    });
    return toAttachmentDTO(row);
  } catch (error) {
    // No row points at the file, so it must not stay behind.
    await storage.remove(storageKey).catch((cleanupError: unknown) => {
      logger.error({ err: cleanupError, storageKey }, 'Could not remove an unrecorded photo');
    });
    throw error;
  }
}

type ReadableAttachment = { id: string; storageKey: string; mimeType: string; fileName: string; sizeBytes: number };

/**
 * The attachment names its organization, so the tenant is resolved from it.
 * Anything the caller may not see answers 404, like a missing id.
 */
export async function findReadableAttachment(user: User, id: string): Promise<ReadableAttachment> {
  const attachment = await prisma.attachment.findUnique({ where: { id } });
  if (!attachment) throw notFound('Attachment');
  const tenant = await resolveTenant(user, attachment.organizationId);
  const incident = await findVisibleIncident(tenant, attachment.incidentId);
  const viewer = await threadViewerFor(tenant, incident.id);
  if (!canSee(viewer, attachment)) throw notFound('Attachment');
  return attachment;
}

/** RFC 6266 header with an ASCII fallback and the exact name as RFC 5987 UTF-8. */
function contentDisposition(fileName: string): string {
  const fallback = fileName.replace(/[^\x20-\x7e]|["\\%]/g, '_');
  const encoded = encodeURIComponent(fileName).replace(
    /['()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `inline; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}

const photoHeaders = ['Content-Type', 'Content-Length', 'Content-Disposition', 'Cache-Control'];

function sendPhoto(req: Request, res: Response, next: NextFunction, file: ReadableAttachment) {
  const stream = storage.read(file.storageKey);
  res.on('close', () => stream.destroy());
  stream.on('error', (error) => {
    logger.warn({ err: error, attachmentId: file.id, requestId: req.requestId }, 'Photo could not be read from storage');
    if (res.headersSent) {
      res.destroy();
      return;
    }
    // Nothing went out yet: drop the photo headers and answer like a missing photo.
    for (const name of photoHeaders) res.removeHeader(name);
    next(notFound('Attachment'));
  });

  res.setHeader('Content-Type', file.mimeType);
  res.setHeader('Content-Length', String(file.sizeBytes));
  res.setHeader('Content-Disposition', contentDisposition(file.fileName));
  res.setHeader('Cache-Control', 'private, max-age=300');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  stream.pipe(res);
}

type IncidentParams = { incidentId: string };

/** Mounted at /v1/incidents/:incidentId/attachments behind the tenant guard. */
export const incidentAttachmentRoutes = Router({ mergeParams: true });

incidentAttachmentRoutes.get<'/', IncidentParams>('/', async (req, res) => {
  res.json({ data: await listIncidentAttachments(tenantOf(req), req.params.incidentId) });
});

incidentAttachmentRoutes.post<'/', IncidentParams>('/', upload.single('file'), async (req, res) => {
  const tenant = tenantOf(req);
  const { kind } = parse(uploadFieldsSchema, req.body ?? {});
  const result = await idempotent(req, 'attachments.create', async () => ({
    status: 201,
    body: { data: await addAttachment(tenant, req.params.incidentId, req.file, kind) },
  }));
  res.status(result.status).json(result.body);
});

/** Mounted at /v1/attachments behind requireUser only. */
export const attachmentFileRoutes = Router();

attachmentFileRoutes.get('/:id/file', async (req, res, next) => {
  const file = await findReadableAttachment(authOf(req).user, parseId(req.params.id, 'Attachment'));
  sendPhoto(req, res, next, file);
});
