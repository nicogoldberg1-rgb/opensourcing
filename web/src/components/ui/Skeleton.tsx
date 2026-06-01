import { cn } from "../../lib/cn";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-neutral-200/60",
        className,
      )}
    />
  );
}

export function SkeletonRow({
  height = "h-12",
  count = 5,
}: {
  height?: string;
  count?: number;
}) {
  return (
    <div className="space-y-1.5">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className={height} />
      ))}
    </div>
  );
}
