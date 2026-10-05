import { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Overlay';

export type ReasonCode = { value: string; label: string };

function ReasonForm({
  label,
  placeholder,
  confirmLabel,
  minLength,
  codes,
  danger,
  onCancel,
  onConfirm,
}: {
  label: string;
  placeholder: string;
  confirmLabel: string;
  minLength: number;
  codes?: ReasonCode[];
  danger?: boolean;
  onCancel: () => void;
  onConfirm: (result: { reason: string; code?: string }) => void;
}) {
  const [reason, setReason] = useState('');
  const [code, setCode] = useState(codes?.[0]?.value);
  const trimmed = reason.trim();
  const needsText = minLength > 0;
  const valid = needsText ? trimmed.length >= minLength : true;
  const short = needsText && reason.length > 0 && !valid;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) onConfirm({ reason: trimmed, code });
      }}
    >
      <div className="grid gap-4 px-5 py-4">
        {codes ? (
          <fieldset className="grid gap-2">
            <legend className="text-sm font-medium text-ink">Why dismiss it?</legend>
            {codes.map((c) => (
              <label key={c.value} className="flex cursor-pointer items-center gap-2.5 text-base text-ink">
                <input type="radio" name="code" value={c.value} checked={code === c.value} onChange={() => setCode(c.value)} className="size-4" />
                {c.label}
              </label>
            ))}
          </fieldset>
        ) : null}
        <div className="grid gap-1">
          <label htmlFor="reason" className="text-sm font-medium text-ink">
            {label}
            {needsText ? null : <span className="font-normal text-ink-3"> (optional)</span>}
          </label>
          <textarea
            id="reason"
            rows={3}
            maxLength={500}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={placeholder}
            aria-invalid={short || undefined}
            aria-describedby="reason-help"
            className="w-full resize-none rounded-control border border-border-strong bg-surface px-3 py-2 text-base text-ink transition-[border-color,box-shadow] duration-(--dur-small) focus:border-brand focus:outline-none focus:ring-3 focus:ring-brand-tint aria-invalid:border-critical"
          />
          <p id="reason-help" className={short ? 'text-sm text-critical' : 'text-sm text-ink-3'}>
            {short ? `Add ${minLength - trimmed.length} more characters so the technician knows what to fix.` : `${reason.length} of 500`}
          </p>
        </div>
      </div>
      <div className="flex justify-end gap-2 border-t border-border px-5 py-3.5">
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button variant={danger ? 'danger' : 'primary'} type="submit" disabled={!valid}>
          {confirmLabel}
        </Button>
      </div>
    </form>
  );
}

export function ReasonDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  label: string;
  placeholder: string;
  confirmLabel: string;
  minLength: number;
  codes?: ReasonCode[];
  danger?: boolean;
  onConfirm: (result: { reason: string; code?: string }) => void;
}) {
  const { open, onOpenChange, title, description, onConfirm, ...form } = props;
  return (
    <Modal open={open} onOpenChange={onOpenChange} title={title} description={description}>
      {/* Remounts on open so the form never keeps text from the last use. */}
      <ReasonForm
        key={String(open)}
        {...form}
        onCancel={() => onOpenChange(false)}
        onConfirm={(r) => {
          onConfirm(r);
          onOpenChange(false);
        }}
      />
    </Modal>
  );
}
