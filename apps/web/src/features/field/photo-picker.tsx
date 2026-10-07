import { Camera, CircleAlert, ImagePlus, X } from 'lucide-react';
import { useId, useRef, useState, type ChangeEvent, type Dispatch, type SetStateAction } from 'react';
import { Button } from '../../components/ui/button';
import { Skeleton } from '../../components/ui/feedback';
import { useT } from '../../i18n';
import { cn } from '../../lib/cn';
import { PHOTO_ACCEPT, PhotoError, preparePhoto, type PreparedPhoto } from './photos';

/**
 * Up to `max` photos from the camera or the library, resized on the device.
 * The parent owns the list so it survives step changes and sheet closes.
 */
export function PhotoPicker({
  label,
  photos,
  onPhotosChange,
  max,
  hint,
  error,
  optional = true,
}: {
  label: string;
  photos: PreparedPhoto[];
  onPhotosChange: Dispatch<SetStateAction<PreparedPhoto[]>>;
  max: number;
  hint?: string;
  error?: string;
  optional?: boolean;
}) {
  const { t } = useT();
  const id = useId();
  const camera = useRef<HTMLInputElement>(null);
  const library = useRef<HTMLInputElement>(null);
  const [preparing, setPreparing] = useState(0);
  const [problem, setProblem] = useState<string | null>(null);
  const free = max - photos.length - preparing;

  const describe = (cause: unknown) => {
    if (cause instanceof PhotoError) {
      if (cause.problem === 'type') return t('field.photos.wrongType');
      if (cause.problem === 'size') return t('field.photos.tooLarge');
    }
    return t('field.photos.unreadable');
  };

  const add = async (event: ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(event.target.files ?? []);
    // Reset so picking the same file again still fires a change.
    event.target.value = '';
    if (picked.length === 0) return;
    const files = picked.slice(0, Math.max(0, free));
    setProblem(picked.length > files.length ? t('field.photos.limit', { max }) : null);
    setPreparing((count) => count + files.length);
    for (const file of files) {
      try {
        const photo = await preparePhoto(file);
        onPhotosChange((current) => (current.length < max ? [...current, photo] : current));
      } catch (cause) {
        setProblem(describe(cause));
      } finally {
        setPreparing((count) => count - 1);
      }
    }
  };

  const message = error ?? problem;
  const remove = (photo: PreparedPhoto) => {
    setProblem(null);
    onPhotosChange((current) => current.filter((item) => item.id !== photo.id));
  };

  return (
    <div
      role="group"
      aria-labelledby={`${id}-label`}
      aria-describedby={message ? `${id}-message` : hint ? `${id}-hint` : undefined}
      className="grid gap-2"
    >
      <div className="flex items-baseline justify-between gap-3">
        <span id={`${id}-label`} className="text-sm font-medium text-ink">
          {label}
          {optional && <span className="ml-1.5 font-normal text-ink-3">{t('common.optional')}</span>}
        </span>
        {max > 1 && (
          <span className="text-xs text-ink-3 tabular-nums">
            {photos.length} / {max}
          </span>
        )}
      </div>

      {(photos.length > 0 || preparing > 0) && (
        <ul className={cn('grid gap-2', max > 1 ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-3')}>
          {photos.map((photo, index) => (
            <li
              key={photo.id}
              className="relative aspect-square overflow-hidden rounded-md border border-line bg-subtle"
            >
              <img
                src={photo.preview}
                alt={t('field.photos.alt', { index: index + 1 })}
                className="size-full object-cover"
              />
              <button
                type="button"
                onClick={() => remove(photo)}
                aria-label={t('field.photos.remove', { index: index + 1 })}
                className="absolute top-0 right-0 flex size-11 items-center justify-center rounded-md"
              >
                <span className="flex size-7 items-center justify-center rounded-full bg-primary/80 text-on-primary shadow-control">
                  <X className="size-4" aria-hidden />
                </span>
              </button>
            </li>
          ))}
          {Array.from({ length: preparing }, (_, index) => (
            <li key={`preparing-${index}`} className="aspect-square">
              <Skeleton className="size-full rounded-md" />
              <span className="sr-only">{t('field.photos.preparing')}</span>
            </li>
          ))}
        </ul>
      )}

      {free > 0 && (
        <div className="flex flex-wrap gap-2">
          <Button
            size="xl"
            icon={<Camera className="size-5" />}
            className="min-w-[9.5rem] flex-1 px-4"
            onClick={() => camera.current?.click()}
          >
            {t('field.photos.take')}
          </Button>
          <Button
            size="xl"
            icon={<ImagePlus className="size-5" />}
            className="min-w-[9.5rem] flex-1 px-4"
            onClick={() => library.current?.click()}
          >
            {t('field.photos.choose')}
          </Button>
        </div>
      )}
      <input
        ref={camera}
        type="file"
        accept={PHOTO_ACCEPT}
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(event) => void add(event)}
      />
      <input
        ref={library}
        type="file"
        accept={PHOTO_ACCEPT}
        multiple={max > 1}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(event) => void add(event)}
      />

      {message ? (
        <p id={`${id}-message`} role="alert" className="flex items-start gap-1.5 text-sm text-critical-ink">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {message}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-sm text-ink-3">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
