'use client';

import { useActionState, useState } from 'react';
import { createTeamAction, updateTeamAction, uploadLogoAction, type TeamState } from './actions';
import { primaryButtonClass } from '@/components/PrimaryLink';
import { TeamBadge } from '@/components/TeamBadge';

const inputClass =
  'min-h-14 w-full rounded-2xl border border-white/30 bg-navy-light px-4 text-lg text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-yellow';
const labelClass = 'text-sm font-semibold text-white';

function Feedback({ state }: { state: TeamState }) {
  return (
    <>
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
    </>
  );
}

type Values = { name: string; slug: string; accentColor: string | null; displayOrder: number };

function Fields({ id, v }: { id: string; v: Values }) {
  const [noAccent, setNoAccent] = useState(v.accentColor === null);
  return (
    <>
      <label htmlFor={`${id}-name`} className={labelClass}>
        Name
      </label>
      <input id={`${id}-name`} name="name" required maxLength={80} defaultValue={v.name} className={inputClass} />
      <label htmlFor={`${id}-slug`} className={labelClass}>
        Slug
      </label>
      <input
        id={`${id}-slug`}
        name="slug"
        required
        maxLength={40}
        pattern="[a-z0-9]+(-[a-z0-9]+)*"
        defaultValue={v.slug}
        className={inputClass}
      />
      <label htmlFor={`${id}-accent`} className={labelClass}>
        Accent colour
      </label>
      <input
        id={`${id}-accent`}
        name="accent"
        type="color"
        defaultValue={v.accentColor ?? '#2A4F8F'}
        disabled={noAccent}
        className="h-14 w-full rounded-2xl border border-white/30 bg-navy-light p-2 disabled:opacity-40"
      />
      <label className="flex min-h-12 items-center gap-3 text-white">
        <input
          type="checkbox"
          name="noAccent"
          checked={noAccent}
          onChange={(e) => setNoAccent(e.target.checked)}
          className="size-6"
        />
        No colour
      </label>
      <label htmlFor={`${id}-order`} className={labelClass}>
        Display order
      </label>
      <input
        id={`${id}-order`}
        name="displayOrder"
        type="number"
        inputMode="numeric"
        min={0}
        max={10000}
        step={1}
        required
        defaultValue={v.displayOrder}
        className={inputClass}
      />
    </>
  );
}

export function TeamRow(props: Values & { id: string; logoUrl: string | null; isActive: boolean }) {
  const [saveState, save, saving] = useActionState(updateTeamAction, undefined);
  const [logoState, upload, uploading] = useActionState(uploadLogoAction, undefined);
  return (
    <section
      aria-label={props.name}
      className="flex flex-col gap-4 rounded-2xl border border-white/20 bg-navy-dark p-4"
    >
      <div className="flex items-center gap-3">
        <TeamBadge name={props.name} logoUrl={props.logoUrl} accentColor={props.accentColor} size={56} />
        <h2 className="text-lg font-extrabold">{props.name}</h2>
        {!props.isActive && <span className="text-sm text-white/70">(inactive)</span>}
      </div>
      <form action={save} className="flex flex-col gap-3 text-left">
        <input type="hidden" name="id" value={props.id} />
        <Fields id={props.id} v={props} />
        <label className="flex min-h-12 items-center gap-3 text-white">
          <input type="checkbox" name="isActive" defaultChecked={props.isActive} className="size-6" />
          Active
        </label>
        <Feedback state={saveState} />
        <button type="submit" disabled={saving} className={`${primaryButtonClass} disabled:opacity-60`}>
          {saving ? 'SAVING...' : 'SAVE'}
        </button>
      </form>
      <form action={upload} className="flex flex-col gap-3 text-left">
        <input type="hidden" name="id" value={props.id} />
        <label htmlFor={`${props.id}-logo`} className={labelClass}>
          Logo (PNG, JPG or WEBP, up to 1 MB)
        </label>
        <input
          id={`${props.id}-logo`}
          name="logo"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          required
          className="text-white"
        />
        <Feedback state={logoState} />
        <button type="submit" disabled={uploading} className={`${primaryButtonClass} disabled:opacity-60`}>
          {uploading ? 'UPLOADING...' : 'UPLOAD LOGO'}
        </button>
      </form>
    </section>
  );
}

export function AddTeamForm({ nextOrder }: { nextOrder: number }) {
  const [state, action, pending] = useActionState(createTeamAction, undefined);
  return (
    <form action={action} className="flex flex-col gap-3 text-left">
      <h2 className="text-lg font-extrabold">Add team</h2>
      <Fields id="new" v={{ name: '', slug: '', accentColor: null, displayOrder: nextOrder }} />
      <Feedback state={state} />
      <button type="submit" disabled={pending} className={`${primaryButtonClass} disabled:opacity-60`}>
        {pending ? 'ADDING...' : 'ADD TEAM'}
      </button>
    </form>
  );
}
