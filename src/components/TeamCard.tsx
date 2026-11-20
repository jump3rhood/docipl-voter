'use client';

import { m } from 'motion/react';
import { TeamBadge, teamInitials } from '@/components/TeamBadge';
import type { Team } from '@/lib/voting';

export { teamInitials };

export function TeamCard({
  team,
  selected,
  onSelect,
  disabled = false,
}: {
  team: Team;
  selected: boolean;
  onSelect: () => void;
  disabled?: boolean;
}) {
  return (
    <m.button
      animate={{ scale: selected ? [1, 1.04, 1] : 1 }}
      transition={{ duration: 0.25 }}
      type="button"
      role="radio"
      aria-checked={selected}
      aria-disabled={disabled}
      onClick={() => {
        if (!disabled) onSelect();
      }}
      className={`relative flex min-h-[120px] flex-col items-center justify-center gap-2 rounded-2xl bg-navy-light p-3 text-center text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-yellow ${
        disabled ? 'cursor-not-allowed opacity-60' : ''
      } ${
        selected ? 'border-[3px] border-brand-yellow' : 'border-[3px] border-transparent'
      }`}
    >
      {selected && (
        <m.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          aria-hidden="true"
          className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-brand-yellow text-sm font-extrabold text-navy"
        >
          ✓
        </m.span>
      )}
      <TeamBadge
        name={team.name}
        logoUrl={team.logoUrl}
        accentColor={team.accentColor}
        size={64}
      />
      <span className="text-sm font-semibold leading-tight">{team.name}</span>
    </m.button>
  );
}
