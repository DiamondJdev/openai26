/** The ClaimLens mark: a rotated square holding a 2×2 grid of ink cells. */
export function BrandMark({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-grid rotate-45 grid-cols-2 gap-[2px] rounded-[3px] border border-fg p-[3px] ${className}`}
    >
      {[0, 1, 2, 3].map((i) => (
        <span key={i} className="h-1 w-1 rounded-[1px] bg-fg" />
      ))}
    </span>
  );
}
