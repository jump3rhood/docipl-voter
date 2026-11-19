'use client';

import { useActionState } from 'react';
import { primaryButtonClass } from '@/components/PrimaryLink';
import { purgeAction, resetAction } from './actions';

const inputClass =
  'min-h-14 w-full rounded-2xl border border-white/30 bg-navy-light px-4 text-lg text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-yellow';

function Messages({ state }: { state: { ok?: string; error?: string } | undefined }) {
  return (
    <>
      {state?.error && (
        <p role="alert" className="text-sm font-semibold text-brand-yellow">
          {state.error}
        </p>
      )}
      {state?.ok && (
        <p role="status" className="text-sm font-semibold text-white">
          {state.ok}
        </p>
      )}
    </>
  );
}

export function DangerZone({ enabled }: { enabled: boolean }) {
  const [resetState, reset, resetPending] = useActionState(resetAction, undefined);
  const [purgeState, purge, purgePending] = useActionState(purgeAction, undefined);
  return (
    <section aria-labelledby="danger" className="flex flex-col gap-8 rounded-2xl border border-brand-yellow/60 p-4">
      <h2 id="danger" className="text-xl font-extrabold text-brand-yellow">
        Danger zone
      </h2>
      <form action={reset} className="flex flex-col gap-3">
        <h3 className="font-bold">Reset all votes &amp; tokens</h3>
        <label htmlFor="reset-confirm" className="text-sm font-semibold">
          Type RESET to confirm
        </label>
        <input id="reset-confirm" name="confirm" autoComplete="off" required className={inputClass} />
        {enabled && <p className="text-sm text-white/70">Pause voting first.</p>}
        <Messages state={resetState} />
        <button type="submit" disabled={enabled || resetPending} className={`${primaryButtonClass} disabled:opacity-60`}>
          {resetPending ? 'RESETTING...' : 'RESET'}
        </button>
      </form>
      <form action={purge} className="flex flex-col gap-3">
        <h3 className="font-bold">Purge identifiers</h3>
        <p className="text-sm text-white/70">Run only after voting has closed.</p>
        <label htmlFor="purge-confirm" className="text-sm font-semibold">
          Type PURGE to confirm
        </label>
        <input id="purge-confirm" name="confirm" autoComplete="off" required className={inputClass} />
        <Messages state={purgeState} />
        <button type="submit" disabled={purgePending} className={`${primaryButtonClass} disabled:opacity-60`}>
          {purgePending ? 'PURGING...' : 'PURGE'}
        </button>
      </form>
    </section>
  );
}
