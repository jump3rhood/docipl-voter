'use client';

import { useActionState } from 'react';
import { saveVotingAction } from './actions';
import { primaryButtonClass } from '@/components/PrimaryLink';

const inputClass =
  'min-h-14 w-full rounded-2xl border border-white/30 bg-navy-light px-4 text-lg text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-yellow';

export function VotingForm(props: {
  start: string;
  end: string;
  enabled: boolean;
  maxVotes: number;
}) {
  const [state, action, pending] = useActionState(saveVotingAction, undefined);
  return (
    <form action={action} className="flex w-full flex-col gap-4 text-left">
      <label htmlFor="start" className="text-sm font-semibold text-white">
        Start (IST)
      </label>
      <input id="start" name="start" type="datetime-local" required defaultValue={props.start} className={inputClass} />
      <label htmlFor="end" className="text-sm font-semibold text-white">
        End (IST)
      </label>
      <input id="end" name="end" type="datetime-local" required defaultValue={props.end} className={inputClass} />
      <label className="flex min-h-14 items-center gap-3 text-lg text-white">
        <input type="checkbox" name="enabled" defaultChecked={props.enabled} className="size-6" />
        Voting enabled
      </label>
      <label htmlFor="maxVotes" className="text-sm font-semibold text-white">
        Max votes per device + network
      </label>
      <input
        id="maxVotes"
        name="maxVotes"
        type="number"
        inputMode="numeric"
        min={0}
        max={1000}
        step={1}
        required
        defaultValue={props.maxVotes}
        aria-describedby="maxVotesHelp"
        className={inputClass}
      />
      <p id="maxVotesHelp" className="text-sm text-white/70">
        0 turns this check off
      </p>
      {state?.error && (
        <p role="alert" className="text-sm font-semibold text-brand-yellow">
          {state.error}
        </p>
      )}
      {state?.ok && (
        <p role="status" className="text-sm font-semibold text-white">
          Saved.
        </p>
      )}
      <button type="submit" disabled={pending} className={`${primaryButtonClass} disabled:opacity-60`}>
        {pending ? 'SAVING...' : 'SAVE'}
      </button>
    </form>
  );
}
