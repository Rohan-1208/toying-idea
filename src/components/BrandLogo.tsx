import { Link } from "react-router-dom";

const SIZES = {
  sm: { img: 28, text: "text-base" },
  md: { img: 36, text: "text-lg" },
  lg: { img: 48, text: "text-xl" },
};

export function BrandLogo({
  size = "md",
  showWordmark = true,
  to = "/",
  className = "",
}: {
  size?: keyof typeof SIZES;
  showWordmark?: boolean;
  to?: string | false;
  className?: string;
}) {
  const { img, text } = SIZES[size];
  const inner = (
    <>
      <img
        src="/logo.png"
        alt="Toying Idea"
        width={img}
        height={img}
        className="object-contain"
        style={{ height: img, width: "auto" }}
      />
      {showWordmark && (
        <span className={`font-display font-bold tracking-tightish text-ink ${text}`}>
          TOYING<span className="text-clay"> IDEA</span>
        </span>
      )}
    </>
  );

  if (to !== false) {
    return (
      <Link to={to || "/"} className={`flex items-center gap-2.5 ${className}`}>
        {inner}
      </Link>
    );
  }

  return <div className={`flex items-center gap-2.5 ${className}`}>{inner}</div>;
}
