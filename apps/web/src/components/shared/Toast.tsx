import { useEffect } from 'react';
import { X } from 'lucide-react';

function CheckCircle2Icon({ size = 17 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#3B82F6' }}>
      <circle cx="12" cy="12" r="10" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

/** Auto-dismissing success notification. Disappears after 3.4s or on manual close. */
export function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3400);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div className="toast">
      <CheckCircle2Icon size={17} />
      <span>{message}</span>
      <button className="toast-close" onClick={onClose}>
        <X size={14} />
      </button>
    </div>
  );
}
