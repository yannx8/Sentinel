import { Send } from 'lucide-react';
import { useI18n } from '../../i18n';
import { timeAgo } from '../../lib/utils';

interface DrawerCommentsProps {
  comments: any[];
  status: string;
  comment: string;
  setComment: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  actionLoading: boolean;
}

/** Comments section. Comment form is hidden when incident status is CLOSED. */
export function DrawerComments({ comments, status, comment, setComment, onSubmit, actionLoading }: DrawerCommentsProps) {
  const t = useI18n((s) => s.t);

  return (
    <div className="drawer-section">
      <div className="drawer-section-header">
        <h3>{t('drawer.comments')}</h3>
        {comments.length > 0 && (
          <span className="drawer-section-count">{comments.length}</span>
        )}
      </div>
      {comments.length === 0 && (
        <div className="empty-compact" style={{ padding: '12px 0' }}>
          <div className="empty-title" style={{ fontSize: 11 }}>{t('drawer.noComments')}</div>
        </div>
      )}
      {comments.map((c: any) => (
        <div key={c.id} className="comment">
          <div className="avatar avatar-green" style={{ width: 28, height: 28, fontSize: 9 }}>
            {c.author.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2)}
          </div>
          <div style={{ flex: 1 }}>
            <div>
              <span className="comment-author">{c.author.name}</span>
              <span className="comment-time">{timeAgo(c.createdAt)}</span>
            </div>
            <div className="comment-body">{c.body}</div>
          </div>
        </div>
      ))}
      {status !== 'CLOSED' && (
        <form className="comment-form" onSubmit={onSubmit}>
          <div style={{ flex: 1, position: 'relative' }}>
            <input
              placeholder={t('drawer.addComment')}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              disabled={actionLoading}
              maxLength={2000}
            />
            {comment.length > 0 && (
              <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 10, color: comment.length > 2000 ? '#b91c1c' : '#98a5a8' }}>
                {comment.length}/2000
              </span>
            )}
          </div>
          <button type="submit" className="button button-primary button-small" disabled={comment.trim().length < 1 || comment.trim().length > 2000 || actionLoading}>
            <Send size={14} />
          </button>
        </form>
      )}
    </div>
  );
}
