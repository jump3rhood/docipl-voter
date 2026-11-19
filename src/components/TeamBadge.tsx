import Image from 'next/image';
import { pickTextColor } from '@/lib/contrast';

const FALLBACK_ACCENT = '#2A4F8F';

export function teamInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter((w) => w && !/^\d/.test(w))
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}

export function TeamBadge({
  name,
  logoUrl,
  accentColor,
  size,
}: {
  name: string;
  logoUrl: string | null;
  accentColor: string | null;
  size: number;
}) {
  if (logoUrl) {
    return (
      <Image
        src={logoUrl}
        alt=""
        width={size}
        height={size}
        unoptimized
        style={{ width: size, height: size }}
        className="shrink-0 object-contain"
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.31),
        backgroundColor: accentColor ?? FALLBACK_ACCENT,
        color: accentColor ? pickTextColor(accentColor) : '#FFFFFF',
      }}
      className="flex shrink-0 items-center justify-center rounded-full font-extrabold"
    >
      {teamInitials(name)}
    </span>
  );
}
