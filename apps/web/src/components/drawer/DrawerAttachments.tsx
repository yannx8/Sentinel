import { useState, useEffect } from 'react';
import { Image, Download } from 'lucide-react';
import { useI18n } from '../../i18n';
import { api } from '../../api/client';
import { timeAgo } from '../../lib/utils';

interface DrawerAttachmentsProps {
  incidentId: string;
  attachments: Array<{ id: string; originalName: string; mimeType: string; sizeBytes: number; createdAt: string }>;
}

/** Displays incident attachments. File type validation happens server-side via magic bytes, not client MIME checks. */
export function DrawerAttachments({ incidentId, attachments }: DrawerAttachmentsProps) {
  const t = useI18n((s) => s.t);

  if (attachments.length === 0) {
    return null;
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="drawer-section">
      <div className="drawer-section-header">
        <h3>{t('drawer.attachments')}</h3>
        <span className="drawer-section-count">{attachments.length}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {attachments.map((att) => (
          <div key={att.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', backgroundColor: '#f8f9fa', borderRadius: 6 }}>
            <Image size={16} color="#6b7280" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {att.originalName}
              </div>
              <div style={{ fontSize: 10, color: '#9ca3af' }}>
                {formatSize(att.sizeBytes)} · {timeAgo(att.createdAt)}
              </div>
            </div>
            <a
              href={`/api/incidents/${incidentId}/attachments/${att.id}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#3b7dd8', padding: 4 }}
              onClick={(e) => e.stopPropagation()}
            >
              <Download size={14} />
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}
