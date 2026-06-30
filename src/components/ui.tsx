import { Link } from "react-router-dom";

type ButtonProps = {
  variant?: "primary" | "secondary" | "ghost" | "dark";
  size?: "sm" | "md" | "lg";
  to?: string;
  href?: string;
  className?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>;

const VARIANTS: Record<string, string> = {
  primary: "bg-clay text-white hover:bg-clay-deep",
  secondary: "border border-ink/20 bg-cream-50/60 text-ink hover:bg-cream-100 backdrop-blur",
  ghost: "text-ink/70 hover:text-ink",
  dark: "bg-ink text-cream-50 hover:bg-ink/90",
};
const SIZES: Record<string, string> = {
  sm: "px-4 py-2 text-sm",
  md: "px-6 py-3 text-sm",
  lg: "px-8 py-4 text-base",
};

export function Button({ variant = "primary", size = "md", to, href, className = "", children, ...rest }: ButtonProps) {
  const cls = `inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-all hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0 ${VARIANTS[variant]} ${SIZES[size]} ${className}`;
  if (to) return <Link to={to} className={cls}>{children}</Link>;
  if (href) return <a href={href} className={cls}>{children}</a>;
  return (
    <button className={cls} {...rest}>
      {children}
    </button>
  );
}

const BADGE_COLORS: Record<string, string> = {
  premium: "bg-ink text-cream-50",
  limited: "bg-clay text-white",
  trending: "bg-teal text-white",
  fun: "bg-gold text-ink",
  new: "bg-teal-deep text-white",
};

export function Badge({ children }: { children: string }) {
  const cls = BADGE_COLORS[children.toLowerCase()] || "bg-ink/10 text-ink";
  return (
    <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${cls}`}>
      {children}
    </span>
  );
}

export function Eyebrow({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-clay-deep/80 ${className}`}>
      <span className="h-[6px] w-[6px] rounded-full bg-clay" />
      {children}
    </span>
  );
}

export function Input({ label, className = "", ...rest }: { label?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      {label && <span className="mb-1.5 block text-sm font-medium text-ink/70">{label}</span>}
      <input
        className={`w-full rounded-xl border border-ink/15 bg-white/70 px-4 py-2.5 text-ink outline-none transition-colors placeholder:text-ink/30 focus:border-clay ${className}`}
        {...rest}
      />
    </label>
  );
}

export function Textarea({ label, className = "", ...rest }: { label?: string } & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <label className="block">
      {label && <span className="mb-1.5 block text-sm font-medium text-ink/70">{label}</span>}
      <textarea
        className={`w-full rounded-xl border border-ink/15 bg-white/70 px-4 py-2.5 text-ink outline-none transition-colors placeholder:text-ink/30 focus:border-clay ${className}`}
        {...rest}
      />
    </label>
  );
}

export function Select({ label, className = "", children, ...rest }: { label?: string } & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <label className="block">
      {label && <span className="mb-1.5 block text-sm font-medium text-ink/70">{label}</span>}
      <select
        className={`w-full rounded-xl border border-ink/15 bg-white/70 px-4 py-2.5 text-ink outline-none transition-colors focus:border-clay ${className}`}
        {...rest}
      >
        {children}
      </select>
    </label>
  );
}

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-block h-4 w-4 animate-spin-slow rounded-sm bg-clay ${className}`} aria-label="Loading" />
  );
}
