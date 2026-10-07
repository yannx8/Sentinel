import type { ImportResult } from '@sentinel/shared';
import { useState } from 'react';
import { Button } from '../../components/ui/button';
import { Dialog, DialogContent } from '../../components/ui/dialog';
import { toast } from '../../components/ui/toast';
import { useT } from '../../i18n';
import { ApiError, newIdempotencyKey } from '../../lib/api';
import { toastError } from '../../lib/forms';
import { Stepper } from '../auth/parts';
import { IMPORT_MAX_ROWS, isProblem, readCsv, type CsvFile, type CsvProblem } from './csv';
import { DoneStep, ReviewStep } from './import-review';
import { UploadStep } from './import-upload';
import { usePlural } from './plural';
import { useImportEmployees } from './queries';

/**
 * Import employees from a CSV file in three steps: upload, review the dry run,
 * then send the invitations. Rendered only while open, so every opening starts clean.
 */
export function ImportDialog({ onClose, onViewInvitations }: { onClose: () => void; onViewInvitations: () => void }) {
  const { t, number } = useT();
  const tn = usePlural();
  const run = useImportEmployees();
  const [file, setFile] = useState<CsvFile | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [review, setReview] = useState<ImportResult | null>(null);
  const [done, setDone] = useState<ImportResult | null>(null);
  // One key per reviewed file: sending twice never invites twice.
  const [commitKey, setCommitKey] = useState<string | null>(null);
  const step = done ? 2 : review ? 1 : 0;
  const committing = run.isPending && run.variables?.dryRun === false;

  const explain = (found: CsvProblem) => {
    switch (found.kind) {
      case 'type':
        return t('team.import.problems.type');
      case 'size':
        return t('team.import.problems.size', { max: number(IMPORT_MAX_ROWS) });
      case 'empty':
        return t('team.import.problems.empty');
      case 'noRows':
        return t('team.import.problems.noRows');
      case 'tooMany':
        return t('team.import.problems.tooMany', { count: number(found.rows), max: number(IMPORT_MAX_ROWS) });
      case 'columns':
        return t('team.import.problems.columns', { columns: found.missing.join(', ') });
    }
  };

  const pick = async (picked: File) => {
    setProblem(null);
    setReading(true);
    try {
      const read = await readCsv(picked);
      if (isProblem(read)) setProblem(explain(read));
      else setFile(read);
    } catch {
      setProblem(t('team.import.problems.unreadable'));
    } finally {
      setReading(false);
    }
  };

  const check = async () => {
    if (!file) return;
    setProblem(null);
    try {
      const result = await run.mutateAsync({ csv: file.text, dryRun: true });
      setCommitKey(newIdempotencyKey());
      setReview(result);
    } catch (error) {
      const message = error instanceof ApiError ? error.fields.csv?.[0] : undefined;
      if (message) setProblem(message);
      else toastError(error, t);
    }
  };

  const send = async () => {
    if (!file || !review) return;
    try {
      const result = await run.mutateAsync({
        csv: file.text,
        dryRun: false,
        idempotencyKey: commitKey ?? undefined,
      });
      setDone(result);
      if (result.created > 0) toast.success(tn('team.import.sentToast', result.created));
    } catch (error) {
      toastError(error, t);
    }
  };

  const footer =
    step === 0 ? (
      <>
        <Button variant="ghost" onClick={onClose}>
          {t('common.cancel')}
        </Button>
        <Button variant="primary" onClick={check} disabled={!file} loading={run.isPending}>
          {t('common.continue')}
        </Button>
      </>
    ) : step === 1 && review ? (
      <>
        <Button variant="ghost" onClick={() => setReview(null)} disabled={run.isPending}>
          {t('common.back')}
        </Button>
        <Button variant="primary" onClick={send} disabled={review.ready === 0} loading={run.isPending}>
          {tn('team.import.send', review.ready)}
        </Button>
      </>
    ) : (
      <>
        <Button onClick={onViewInvitations}>{t('team.import.viewInvitations')}</Button>
        <Button variant="primary" onClick={onClose}>
          {t('team.result.done')}
        </Button>
      </>
    );

  return (
    // Closing waits for the invitations being sent, so their outcome is never lost.
    <Dialog open onOpenChange={(open) => !open && !committing && onClose()}>
      <DialogContent
        size="lg"
        title={t('team.import.title')}
        description={t(
          step === 0
            ? 'team.import.descriptions.upload'
            : step === 1
              ? 'team.import.descriptions.review'
              : 'team.import.descriptions.done',
        )}
        modalLock={step === 1 || (step === 0 && file !== null)}
        footer={footer}
      >
        <div className="grid gap-5">
          <Stepper
            steps={[t('team.import.steps.upload'), t('team.import.steps.review'), t('team.import.steps.done')]}
            current={step}
          />
          {step === 0 && (
            <UploadStep
              file={file}
              problem={problem}
              reading={reading}
              onPick={pick}
              onRemove={() => {
                setFile(null);
                setProblem(null);
              }}
            />
          )}
          {step === 1 && review && <ReviewStep result={review} />}
          {step === 2 && done && <DoneStep result={done} />}
        </div>
      </DialogContent>
    </Dialog>
  );
}
