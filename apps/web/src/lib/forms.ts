import type { FieldValues, Path, UseFormReturn } from 'react-hook-form';
import { z } from 'zod';
import type { Formatter } from '../i18n';
import { toast } from '../components/ui/toast';
import { ApiError } from './api';

/**
 * Localized messages for the shared zod schemas. Field names decide the wording
 * for format errors (email, phone, website, code), so one rule reads well everywhere.
 */
export function installValidationMessages(t: Formatter['t']) {
  z.config({
    customError: (issue) => {
      const field = String(issue.path?.[issue.path.length - 1] ?? '').toLowerCase();
      switch (issue.code) {
        case 'invalid_type':
          return issue.input === undefined || issue.input === null || issue.input === ''
            ? t('common.validation.required')
            : t('common.validation.invalid');
        case 'too_small':
          if (issue.origin === 'string') {
            if (field.includes('password')) return t('common.validation.password');
            return Number(issue.minimum) <= 1
              ? t('common.validation.required')
              : t('common.validation.tooShort', { min: Number(issue.minimum) });
          }
          if (issue.origin === 'array') return t('common.validation.choose');
          return t('common.validation.invalid');
        case 'too_big':
          return issue.origin === 'string'
            ? t('common.validation.tooLong', { max: Number(issue.maximum) })
            : t('common.validation.invalid');
        case 'invalid_format':
          if (field.includes('email')) return t('common.validation.email');
          if (field.includes('phone')) return t('common.validation.phone');
          if (field.includes('website') || field.includes('url')) return t('common.validation.url');
          if (field.includes('code')) return t('common.validation.code');
          return t('common.validation.invalid');
        case 'invalid_value':
          return t('common.validation.choose');
        default:
          return undefined;
      }
    },
  });
}

/** Puts server-side field errors on the form. Returns true when at least one field was marked. */
export function applyServerErrors<T extends FieldValues>(form: UseFormReturn<T>, error: unknown): boolean {
  if (!(error instanceof ApiError)) return false;
  const entries = Object.entries(error.fields);
  for (const [path, messages] of entries) {
    form.setError(path as Path<T>, { type: 'server', message: messages[0] });
  }
  return entries.length > 0;
}

/** Message for an API error in the person's language when a translation exists. */
export function errorMessage(error: unknown, t: Formatter['t']): string {
  if (error instanceof ApiError) {
    switch (error.code) {
      case 'UNAUTHENTICATED':
      case 'FORBIDDEN':
      case 'NOT_FOUND':
      case 'CONFLICT_CONCURRENT_UPDATE':
      case 'RATE_LIMITED':
      case 'ORG_SUSPENDED':
      case 'MEMBERSHIP_INACTIVE':
        return t(`common.errors.${error.code}`);
      default:
        return error.message;
    }
  }
  return t('common.genericError');
}

export function toastError(error: unknown, t: Formatter['t']) {
  const requestId = error instanceof ApiError && error.code === 'INTERNAL' ? error.requestId : undefined;
  toast.error(
    errorMessage(error, t),
    requestId ? { description: t('common.requestId', { id: requestId }) } : undefined,
  );
}
