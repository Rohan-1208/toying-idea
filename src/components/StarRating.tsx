import { useId } from "react";

export function StarRating({
  value,
  size = "md",
  className = "",
}: {
  value: number;
  size?: "sm" | "md";
  className?: string;
}) {
  const uid = useId();
  const stars = Math.round(Math.min(5, Math.max(0, value)) * 2) / 2;
  const dim = size === "sm" ? 14 : 18;

  return (
    <span className={`inline-flex items-center gap-0.5 ${className}`} aria-label={`${value} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, i) => {
        const filled = stars >= i + 1;
        const half = !filled && stars >= i + 0.5;
        const gradId = `${uid}-half-${i}`;
        return (
          <svg key={i} width={dim} height={dim} viewBox="0 0 24 24" className="shrink-0">
            {half && (
              <defs>
                <linearGradient id={gradId}>
                  <stop offset="50%" stopColor="#E8731E" />
                  <stop offset="50%" stopColor="#E8731E" stopOpacity="0" />
                </linearGradient>
              </defs>
            )}
            <path
              d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14l-5-4.87 6.91-1.01L12 2z"
              fill={filled ? "#E8731E" : half ? `url(#${gradId})` : "none"}
              stroke="#E8731E"
              strokeWidth="1.5"
              opacity={filled || half ? 1 : 0.28}
            />
          </svg>
        );
      })}
    </span>
  );
}

export function StarRatingInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className="rounded p-0.5 transition-transform active:scale-95"
          aria-label={`Rate ${n} stars`}
        >
          <svg width={28} height={28} viewBox="0 0 24 24">
            <path
              d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14l-5-4.87 6.91-1.01L12 2z"
              fill={n <= value ? "#E8731E" : "none"}
              stroke="#E8731E"
              strokeWidth="1.5"
              opacity={n <= value ? 1 : 0.3}
            />
          </svg>
        </button>
      ))}
    </div>
  );
}
