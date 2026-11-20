'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
// Admin-only: domMax and Reorder (full `motion` components) must never be imported by
// voter-facing code. The nested LazyMotion below is deliberately NOT strict, which
// overrides the root strict provider for this subtree (Reorder renders `motion.*`).
import { AnimatePresence, LazyMotion, Reorder, domMax, useDragControls } from 'framer-motion';
import type { AdminTeam } from '@/lib/admin';
import { TeamBadge } from '@/components/TeamBadge';
import { reorderTeamsAction } from './actions';
import { TeamEditorSheet } from './TeamEditorSheet';

const smallButtonClass =
  'inline-flex size-9 items-center justify-center rounded-lg text-white/80 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-yellow disabled:opacity-25 aria-disabled:opacity-25';

function sameOrder(a: string[], b: string[]) {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}

function Row({
  team,
  index,
  count,
  onMove,
  onOpen,
  onDragStart,
  onDragEnd,
  locked,
}: {
  team: AdminTeam;
  index: number;
  count: number;
  onMove: (index: number, delta: -1 | 1) => void;
  onOpen: (team: AdminTeam) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  /** A save is in flight: no new reorders until it settles, so saves never overlap. */
  locked: boolean;
}) {
  const controls = useDragControls();
  return (
    <Reorder.Item
      as="li"
      value={team.id}
      dragListener={false}
      dragControls={controls}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      // The Move up/down buttons are the keyboard path, so the item itself is not a tab stop.
      tabIndex={-1}
      className="relative flex items-center gap-1 rounded-2xl border border-white/15 bg-navy-dark py-1 pl-1 pr-1"
    >
      <span
        aria-hidden="true"
        data-testid="drag-handle"
        onPointerDown={(e) => {
          if (!locked) controls.start(e);
        }}
        style={{ touchAction: 'none' }}
        className={`flex h-12 w-8 shrink-0 select-none items-center justify-center text-xl text-white/60 ${
          locked ? 'cursor-wait opacity-30' : 'cursor-grab active:cursor-grabbing'
        }`}
      >
        ⠿
      </span>
      <button
        type="button"
        onClick={() => onOpen(team)}
        className="flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-xl px-1 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-yellow"
      >
        <TeamBadge name={team.name} logoUrl={team.logoUrl} accentColor={team.accentColor} size={40} />
        <span className="flex min-w-0 flex-1 flex-col items-start gap-0.5">
          <span data-testid="team-name" className="w-full truncate font-bold leading-tight">
            {team.name}
          </span>
          <span className="flex items-center gap-2">
            <span
              className={`rounded-full px-2 py-px text-xs font-bold ${
                team.isActive ? 'bg-brand-yellow text-navy' : 'bg-white/15 text-white/80'
              }`}
            >
              {team.isActive ? 'Live' : 'Hidden'}
            </span>
            {team.accentColor && (
              <span
                aria-hidden="true"
                style={{ backgroundColor: team.accentColor }}
                className="size-3 rounded-full ring-1 ring-white/40"
              />
            )}
          </span>
        </span>
      </button>
      <div className="flex shrink-0 flex-col">
        <button
          type="button"
          aria-label={`Move ${team.name} up`}
          data-move={`${team.id}:up`}
          disabled={index === 0}
          aria-disabled={locked || index === 0}
          onClick={() => onMove(index, -1)}
          className={`${smallButtonClass} h-6`}
        >
          <span aria-hidden="true">▲</span>
        </button>
        <button
          type="button"
          aria-label={`Move ${team.name} down`}
          data-move={`${team.id}:down`}
          disabled={index === count - 1}
          aria-disabled={locked || index === count - 1}
          onClick={() => onMove(index, 1)}
          className={`${smallButtonClass} h-6`}
        >
          <span aria-hidden="true">▼</span>
        </button>
      </div>
    </Reorder.Item>
  );
}

type Editing = { team: AdminTeam | null } | null;

export function TeamList({ teams }: { teams: AdminTeam[] }) {
  const [prevTeams, setPrevTeams] = useState(teams);
  const [order, setOrder] = useState(() => teams.map((t) => t.id));
  const [savedIds, setSavedIds] = useState(order);
  const [dragging, setDragging] = useState(false);
  // Handlers read the ref: the first onReorder can arrive before the drag-start re-render.
  const draggingRef = useRef(false);
  const [saving, setSaving] = useState(false);
  // Set synchronously in handlers so a second tap before the re-render is also refused.
  const savingRef = useRef(false);
  const [status, setStatus] = useState('');
  const [editing, setEditing] = useState<Editing>(null);
  const router = useRouter();
  const listRef = useRef<HTMLDivElement>(null);
  // Which Move button should hold focus once the moved row has re-rendered in place.
  const pendingFocus = useRef<string | null>(null);

  useEffect(() => {
    const key = pendingFocus.current;
    if (!key) return;
    pendingFocus.current = null;
    listRef.current?.querySelector<HTMLElement>(`[data-move="${key}"]`)?.focus();
  }, [order]);

  // Adopt the server's list when it revalidates, but never mid-drag or mid-save
  // (the deferred update is picked up on the first render after both finish).
  if (teams !== prevTeams && !dragging && !saving) {
    const ids = teams.map((t) => t.id);
    setPrevTeams(teams);
    setOrder(ids);
    setSavedIds(ids);
  }

  const byId = new Map(teams.map((t) => [t.id, t]));
  const rows = order.map((id) => byId.get(id)).filter((t): t is AdminTeam => t !== undefined);

  // "Order saved" fades out after a few seconds; errors stay until the next action.
  useEffect(() => {
    if (status !== 'Order saved') return;
    const t = setTimeout(() => setStatus(''), 3000);
    return () => clearTimeout(t);
  }, [status]);

  // Only one save at a time (reordering is locked while saving), so savedIds is
  // always the server's current order when a save starts and when it fails.
  async function save(ids: string[]) {
    const restoreTo = savedIds;
    savingRef.current = true;
    setSaving(true);
    setStatus('Saving…');
    try {
      const res = await reorderTeamsAction(ids);
      if (res?.error) {
        setOrder(restoreTo);
        setStatus(res.error);
        router.refresh();
      } else {
        setSavedIds(ids);
        setStatus('Order saved');
      }
    } catch {
      setOrder(restoreTo);
      setStatus('Could not save the order. Try again.');
      router.refresh();
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  function move(index: number, delta: -1 | 1) {
    const target = index + delta;
    if (savingRef.current || target < 0 || target >= order.length) return;
    const next = [...order];
    [next[index], next[target]] = [next[target], next[index]];
    // Keep focus on the pressed button; if the row just reached the end that button
    // becomes truly disabled, so focus the opposite Move button instead.
    const reachedEnd = delta === -1 ? target === 0 : target === order.length - 1;
    const dir = reachedEnd ? (delta === -1 ? 'down' : 'up') : delta === -1 ? 'up' : 'down';
    pendingFocus.current = `${order[index]}:${dir}`;
    setOrder(next);
    void save(next);
  }

  function onReorder(next: string[]) {
    // Only pointer drags (started from the handle) reorder; drag end saves.
    if (draggingRef.current) setOrder(next);
  }

  function onDragStart() {
    draggingRef.current = true;
    setDragging(true);
  }

  function onDragEnd() {
    draggingRef.current = false;
    setDragging(false);
    if (savingRef.current) return;
    if (!sameOrder(order, savedIds)) void save(order);
  }

  return (
    <div ref={listRef} className="flex flex-col gap-4">
      <LazyMotion features={domMax}>
        <Reorder.Group axis="y" values={order} onReorder={onReorder} className="flex flex-col gap-2">
          {rows.map((t, i) => (
            <Row
              key={t.id}
              team={t}
              index={i}
              count={rows.length}
              onMove={move}
              onOpen={(team) => setEditing({ team })}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              locked={saving}
            />
          ))}
        </Reorder.Group>
      </LazyMotion>
      <p role="status" aria-live="polite" className="min-h-5 text-sm font-semibold text-white/90">
        {status}
      </p>
      <button
        type="button"
        onClick={() => setEditing({ team: null })}
        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-white/40 font-bold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-yellow"
      >
        <span aria-hidden="true">＋</span> Add team
      </button>
      <AnimatePresence>
        {editing && (
          <TeamEditorSheet
            key={editing.team?.id ?? 'new'}
            team={editing.team ? (byId.get(editing.team.id) ?? editing.team) : null}
            onClose={() => setEditing(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
