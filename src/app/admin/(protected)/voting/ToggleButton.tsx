'use client';

import { useFormStatus } from 'react-dom';
import { primaryButtonClass } from '@/components/PrimaryLink';

export function ToggleButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={`${primaryButtonClass} w-full disabled:opacity-60`}>
      {pending ? 'WORKING...' : label}
    </button>
  );
}
