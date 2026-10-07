import type { InviteResult } from '@sentinel/shared';
import { Check, Copy } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { Button } from '../../components/ui/button';
import { DialogContent } from '../../components/ui/dialog';
import { Banner, Skeleton } from '../../components/ui/feedback';
import { Input } from '../../components/ui/input';
import { toast } from '../../components/ui/toast';
import { useT } from '../../i18n';
import { fullName } from './parts';
import { usePlural } from './plural';

/** Read-only link with a Copy button. The text is selected on focus for a manual copy. */
export function CopyLinkField({ url }: { url: string }) {
  const { t } = useT();
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      inputRef.current?.focus();
      inputRef.current?.select();
      toast.error(t('team.result.copyFailed'));
    }
  };

  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {t('team.result.link')}
      </label>
      <div className="flex gap-2">
        <Input
          ref={inputRef}
          id={id}
          value={url}
          readOnly
          spellCheck={false}
          onFocus={(event) => event.currentTarget.select()}
          className="min-w-0 flex-1 font-mono text-xs"
        />
        {/* Focused first: copying the link is the next step after sending. */}
        <Button
          autoFocus
          onClick={copy}
          icon={copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
          className="min-w-24"
        >
          {copied ? t('common.copied') : t('common.copy')}
        </Button>
      </div>
      <span className="sr-only" aria-live="polite">
        {copied ? t('team.result.copied') : ''}
      </span>
    </div>
  );
}

function daysLeft(expiresAt: string) {
  return Math.max(1, Math.round((new Date(expiresAt).getTime() - Date.now()) / 86_400_000));
}

/**
 * What an invitation or a resend produced: the outcome of the email and the
 * link, which is only ever shown here.
 */
export function InviteResultContent({
  result,
  resent,
  onAnother,
  onDone,
}: {
  result: InviteResult;
  resent?: boolean;
  onAnother?: () => void;
  onDone: () => void;
}) {
  const { t, date } = useT();
  const tn = usePlural();
  const { invitation, emailSent } = result;
  const name = fullName(invitation);
  const validity = tn('team.result.valid', daysLeft(invitation.expiresAt), {
    date: date(invitation.expiresAt, 'date'),
  });

  return (
    <DialogContent
      title={emailSent ? t('team.result.sentTitle', { email: invitation.email }) : t('team.result.notSentTitle')}
      description={
        emailSent
          ? t(resent ? 'team.result.resentBody' : 'team.result.sentBody', { name: invitation.firstName })
          : t('team.result.notSentBody', { name, email: invitation.email })
      }
      footer={
        <>
          {onAnother && <Button onClick={onAnother}>{t('team.result.another')}</Button>}
          <Button variant="primary" onClick={onDone}>
            {t('team.result.done')}
          </Button>
        </>
      }
    >
      <div className="grid gap-3">
        {!emailSent && <Banner tone="warning">{t('team.result.notSentHint')}</Banner>}
        <CopyLinkField url={result.acceptUrl} />
        <p className="text-xs text-ink-3">
          {validity}
          {resent && ` ${t('team.result.previousLink')}`}
        </p>
      </div>
    </DialogContent>
  );
}

/** Shown while a resend is on its way, in the same shape as the result. */
export function InviteResultLoading({ email }: { email: string }) {
  const { t } = useT();
  return (
    <DialogContent title={t('team.result.sending', { email })} description={t('team.result.sendingBody')}>
      <div className="grid gap-1.5" aria-busy="true">
        <Skeleton className="h-4 w-28" />
        <div className="flex gap-2">
          <Skeleton className="h-8 flex-1" />
          <Skeleton className="h-8 w-20" />
        </div>
        <Skeleton className="mt-1.5 h-3 w-64" />
      </div>
    </DialogContent>
  );
}
