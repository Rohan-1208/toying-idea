import type { Product } from "../lib/types";

const GRADIENTS: [string, string][] = [
  ["#F0913A", "#E8731E"],
  ["#6FD0D9", "#2A8C97"],
  ["#FFD23F", "#E8731E"],
  ["#3FB8C4", "#2B2018"],
  ["#F0913A", "#F2B705"],
  ["#5BC0CC", "#3FB8C4"],
];

function hash(str: string) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function ProductImage({
  product,
  className = "",
  rounded = "rounded-2xl",
}: {
  product: Product;
  className?: string;
  rounded?: string;
}) {
  const img = product.thumbnail || product.images?.[0];
  if (img) {
    return (
      <img
        src={img}
        alt={product.name}
        loading="lazy"
        className={`h-full w-full object-cover ${rounded} ${className}`}
      />
    );
  }

  const [a, b] = GRADIENTS[hash(product.slug) % GRADIENTS.length];
  const initials = product.name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  return (
    <div
      className={`relative flex h-full w-full items-center justify-center overflow-hidden ${rounded} ${className}`}
      style={{ background: `linear-gradient(135deg, ${a}, ${b})` }}
    >
      {/* decorative voxel cubes */}
      <svg className="absolute inset-0 h-full w-full opacity-30" viewBox="0 0 100 100" preserveAspectRatio="none">
        <g fill="#FBF6EC">
          <rect x="14" y="60" width="14" height="14" rx="2" transform="rotate(-8 21 67)" />
          <rect x="68" y="20" width="12" height="12" rx="2" transform="rotate(12 74 26)" />
          <rect x="74" y="64" width="16" height="16" rx="2" transform="rotate(-6 82 72)" />
        </g>
      </svg>
      <span className="relative font-display text-4xl font-bold text-cream-50 drop-shadow">{initials}</span>
    </div>
  );
}
