'use client';

import { startTransition, useActionState, useEffect, useId, useRef, useState } from 'react';
import { m } from 'framer-motion';
import type { AdminTeam } from '@/lib/admin';
import { validateLogo } from '@/lib/logoValidation';
import { primaryButtonClass } from '@/components/PrimaryLink';
import { TeamBadge } from '@/components/TeamBadge';
import { createTeamAction, updateTeamAction } from './actions';

const inputClass =
  'min-h-14 w-full rounded-2xl border border-white/30 bg-navy px-4 text-lg text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-yellow';
const labelClass = 'text-sm font-semibold text-white';
const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';
const PREVIEW_SIZE = 72;

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/, '');
}

export function TeamEditorSheet({ team, onClose }: { team: AdminTeam | null; onClose: () => void }) {
  const uid = useId();
  const headingId = `${uid}-heading`;
  const isEdit = team !== null;
  const [state, formAction, pending] = useActionState(isEdit ? updateTeamAction : createTeamAction, undefined);

  const [noAccent, setNoAccent] = useState(team ? team.accentColor === null : true);
  const [slug, setSlug] = useState(team?.slug ?? '');
  const [slugTouched, setSlugTouched] = useState(isEdit);
  const [preview, setPreview] = useState<string | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);

  const panelRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const pendingRef = useRef(pending);
  const closeRef = useRef(onClose);
  useEffect(() => {
    pendingRef.current = pending;
    closeRef.current = onClose;
  });

  // Close once the server reports success; its revalidation refreshes the list.
  useEffect(() => {
    if (state?.ok) closeRef.current();
    // Slug errors point at a field inside the collapsed Advanced section; reveal it.
    else if (state?.error && /slug/i.test(state.error) && detailsRef.current) detailsRef.current.open = true;
  }, [state]);

  // Revoke each local preview URL when it is replaced and on unmount.
  useEffect(() => {
    if (!preview) return;
    return () => URL.revokeObjectURL(preview);
  }, [preview]);

  // Scroll lock, initial focus, focus return, Escape and focus trap.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    nameRef.current?.focus();
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (!pendingRef.current) closeRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (!items || items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (!panelRef.current?.contains(active)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
      if (opener?.isConnected) opener.focus?.();
    };
  }, []);

  function onPickLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) {
      setPreview(null);
      setLogoError(null);
      return;
    }
    const v = validateLogo(file);
    if (!v.ok) {
      setPreview(null);
      setLogoError(v.error);
      return;
    }
    setLogoError(null);
    setPreview(URL.createObjectURL(file));
  }

  const error = logoError ?? state?.error ?? null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <m.button
        type="button"
        aria-label="Close"
        tabIndex={-1}
        onClick={() => {
          if (!pending) onClose();
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 cursor-default touch-none overscroll-contain bg-black/60"
      />
      <m.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 380, damping: 36 }}
        className="relative max-h-[92dvh] w-full max-w-md overflow-y-auto overscroll-contain rounded-t-3xl bg-navy-light px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-5 text-left text-white"
      >
        <h2 id={headingId} className="text-xl font-extrabold leading-tight">
          {isEdit ? `Edit ${team.name}` : 'Add team'}
        </h2>
        <form
          // onSubmit rather than action={...}: React resets a form after an action prop
          // finishes, which would wipe the admin's edits (and picked file) on an error.
          onSubmit={(e) => {
            e.preventDefault();
            if (pending || logoError) return;
            const fd = new FormData(e.currentTarget);
            startTransition(() => formAction(fd));
          }}
          className="mt-4 flex flex-col gap-3"
        >
          {isEdit && <input type="hidden" name="id" value={team.id} />}

          <label className="flex min-h-12 cursor-pointer items-center gap-4 self-start rounded-2xl p-1 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-brand-yellow">
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element -- local blob: preview; next/image can't load blob URLs
              <img
                data-testid="logo-preview"
                src={preview}
                alt=""
                width={PREVIEW_SIZE}
                height={PREVIEW_SIZE}
                style={{ width: PREVIEW_SIZE, height: PREVIEW_SIZE }}
                className="shrink-0 object-contain"
              />
            ) : (
              <TeamBadge
                name={team?.name ?? ''}
                logoUrl={team?.logoUrl ?? null}
                accentColor={team?.accentColor ?? null}
                size={PREVIEW_SIZE}
              />
            )}
            <span className="flex flex-col">
              <span className="font-bold underline">{team?.logoUrl || preview ? 'Change logo' : 'Add logo'}</span>
              <span className="text-sm text-white/70">PNG, JPG or WEBP, up to 1 MB</span>
            </span>
            <input
              type="file"
              name="logo"
              accept="image/png,image/jpeg,image/webp"
              onChange={onPickLogo}
              className="sr-only"
            />
          </label>

          <label htmlFor={`${uid}-name`} className={labelClass}>
            Name
          </label>
          <input
            ref={nameRef}
            id={`${uid}-name`}
            name="name"
            required
            maxLength={80}
            defaultValue={team?.name ?? ''}
            onChange={(e) => {
              if (!slugTouched) setSlug(slugify(e.target.value));
            }}
            className={inputClass}
          />

          <label htmlFor={`${uid}-accent`} className={labelClass}>
            Accent colour
          </label>
          <div className="flex items-center gap-4">
            <input
              id={`${uid}-accent`}
              name="accent"
              type="color"
              defaultValue={team?.accentColor ?? '#2A4F8F'}
              disabled={noAccent}
              className="h-14 w-24 rounded-2xl border border-white/30 bg-navy p-2 disabled:opacity-40"
            />
            <label className="flex min-h-12 items-center gap-3">
              <input
                type="checkbox"
                name="noAccent"
                checked={noAccent}
                onChange={(e) => setNoAccent(e.target.checked)}
                className="size-6"
              />
              No colour
            </label>
          </div>

          {isEdit && (
            <label className="flex min-h-12 items-center gap-3">
              <input type="checkbox" name="isActive" defaultChecked={team.isActive} className="size-6" />
              Show on ballot
            </label>
          )}

          <details ref={detailsRef} className="rounded-2xl border border-white/20 px-4 py-2">
            <summary className="min-h-10 cursor-pointer py-2 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-yellow">
              Advanced
            </summary>
            <div className="flex flex-col gap-2 pb-2">
              <label htmlFor={`${uid}-slug`} className={labelClass}>
                Slug
              </label>
              <input
                id={`${uid}-slug`}
                name="slug"
                maxLength={40}
                value={slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setSlug(e.target.value);
                }}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                className={inputClass}
              />
            </div>
          </details>

          {error && (
            <p role="alert" className="text-sm font-semibold text-brand-yellow">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending || logoError !== null}
            className={`${primaryButtonClass} mt-1 disabled:cursor-not-allowed disabled:opacity-50`}
          >
            {pending ? 'SAVING…' : 'SAVE'}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="inline-flex min-h-11 items-center justify-center px-4 font-bold text-white/80 underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-yellow disabled:opacity-40"
          >
            Cancel
          </button>
        </form>
      </m.div>
    </div>
  );
}
