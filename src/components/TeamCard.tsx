import Image from 'next/image';
import { pickTextColor } from '@/lib/contrast';
import type { Team } from '@/lib/voting';

const FALLBACK_ACCENT = '#2A4F8F';

export function teamInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter((w) => w && !/^\d/.test(w))
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}

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
    <button
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
        <span
          aria-hidden="true"
          className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-brand-yellow text-sm font-extrabold text-navy"
        >
          ✓
        </span>
      )}
      {team.logoUrl ? (
        <Image
          src={team.logoUrl}
          alt=""
          width={64}
          height={64}
          unoptimized
          className="h-16 w-16 object-contain"
        />
      ) : (
        <span
          aria-hidden="true"
          style={{
            backgroundColor: team.accentColor ?? FALLBACK_ACCENT,
            color: team.accentColor ? pickTextColor(team.accentColor) : '#FFFFFF',
          }}
          className="flex h-16 w-16 items-center justify-center rounded-full text-xl font-extrabold"
        >
          {teamInitials(team.name)}
        </span>
      )}
      <span className="text-sm font-semibold leading-tight">{team.name}</span>
    </button>
  );
}
