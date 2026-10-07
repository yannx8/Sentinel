import { cn } from '../../lib/cn';

export function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}

// Quiet, deterministic tints so the same person keeps the same avatar.
const tints = [
  'bg-[#E8EAF6] text-[#3B4290] dark:bg-[#23264A] dark:text-[#B9BEF5]',
  'bg-[#E6F2EE] text-[#22604B] dark:bg-[#15302A] dark:text-[#9FD8C3]',
  'bg-[#F4ECE4] text-[#7A4A1F] dark:bg-[#33251A] dark:text-[#E7C29E]',
  'bg-[#EEE8F4] text-[#5A3A80] dark:bg-[#2A2138] dark:text-[#CDB8EA]',
  'bg-[#E7EEF4] text-[#2A5170] dark:bg-[#1A2734] dark:text-[#AACBE6]',
  'bg-[#F3E9EC] text-[#7E3346] dark:bg-[#33202A] dark:text-[#EBB2C0]',
];

function tintFor(seed: string) {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return tints[Math.abs(hash) % tints.length];
}

export function Avatar({
  name,
  size = 'md',
  className,
}: {
  name: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const dimension = { xs: 'size-5 text-[9px]', sm: 'size-6 text-2xs', md: 'size-8 text-xs', lg: 'size-10 text-sm' }[
    size
  ];
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-semibold',
        dimension,
        tintFor(name),
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
