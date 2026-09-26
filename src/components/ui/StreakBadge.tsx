interface StreakBadgeProps {
  count: number;
  label?: string;
}

/** Placeholder gamification element — count is hardcoded until real streak logic exists. */
export function StreakBadge({ count, label = 'day streak' }: StreakBadgeProps) {
  return (
    <span className="streak-badge">
      🔥 {count} {label}
    </span>
  );
}
