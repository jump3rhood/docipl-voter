'use client';

/** Shown in the ballot footer when Turnstile has not produced a token in time. */
export function VerifyNotice({ onReload }: { onReload: () => void }) {
  return (
    <div role="status" className="mb-3 rounded-xl bg-navy-dark p-3 text-center">
      <p className="font-bold text-brand-yellow">Verification is taking too long.</p>
      <p className="text-sm text-white/80">Reload this page, or open it in your phone&apos;s browser.</p>
      <button
        type="button"
        onClick={onReload}
        className="mt-2 inline-block font-bold underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-yellow"
      >
        Reload
      </button>
    </div>
  );
}
