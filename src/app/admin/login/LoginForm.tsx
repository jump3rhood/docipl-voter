'use client';

import { useActionState } from 'react';
import { loginAction } from './actions';
import { primaryButtonClass } from '@/components/PrimaryLink';

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, undefined);
  return (
    <form action={action} className="flex w-full max-w-sm flex-col gap-4 text-left">
      <label htmlFor="password" className="text-sm font-semibold text-white">
        Admin password
      </label>
      <input
        id="password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        className="min-h-14 w-full rounded-2xl border border-white/30 bg-navy-light px-4 text-lg text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-yellow"
      />
      {state?.error && (
        <p role="alert" className="text-sm font-semibold text-brand-yellow">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className={`${primaryButtonClass} disabled:opacity-60`}
      >
        {pending ? 'Checking...' : 'Log in'}
      </button>
    </form>
  );
}
