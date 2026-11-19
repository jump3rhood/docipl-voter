export function Heartbeat({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 300 24"
      preserveAspectRatio="none"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={["h-6 w-full", className].filter(Boolean).join(" ")}
    >
      <polyline
        vectorEffect="non-scaling-stroke"
        points="0,12 110,12 120,12 126,4 134,20 142,1 150,23 158,12 168,12 300,12"
      />
    </svg>
  );
}
