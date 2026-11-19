'use client';

import { primaryButtonClass } from '@/components/PrimaryLink';

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 pb-8 text-center">
      <h1 className="text-3xl font-extrabold leading-tight">Something went wrong.</h1>
      <p className="text-base">Please try again in a moment.</p>
      <button type="button" onClick={() => reset()} className={primaryButtonClass}>
        TRY AGAIN
      </button>
    </div>
  );
}
