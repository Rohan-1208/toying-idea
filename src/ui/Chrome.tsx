import { useSyncExternalStore } from "react";
import { Link } from "react-router-dom";
import { progressStore } from "./progressStore";
import { BrandLogo } from "../components/BrandLogo";
import { STOPS } from "../three/scroll";

const CHAPTERS = [
  { label: "City", offset: STOPS.hero },
  { label: "Homes", offset: 0.22 },
  { label: "Print", offset: 0.48 },
  { label: "Shop", offset: STOPS.archive },
  { label: "Join", offset: STOPS.universe },
];

function useProgress() {
  return useSyncExternalStore(progressStore.subscribe, progressStore.get, () => 0);
}

function activeIndex(offset: number) {
  let best = 0;
  let bestD = Infinity;
  CHAPTERS.forEach((c, i) => {
    const d = Math.abs(c.offset - offset);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  return best;
}

export function Chrome() {
  const offset = useProgress();
  const active = activeIndex(offset);

  return (
    <div className="pointer-events-none fixed inset-0 z-20">
      <header className="flex items-center justify-between px-6 py-5 md:px-10">
        <BrandLogo to="/" size="md" className="pointer-events-auto" />

        <nav className="pointer-events-auto hidden items-center gap-8 text-[13px] font-medium tracking-wide text-ink/55 md:flex">
          <Link className="transition-colors hover:text-ink" to="/shop">
            Shop
          </Link>
          <Link className="transition-colors hover:text-ink" to="/pyot">
            PYOT
          </Link>
          <Link className="transition-colors hover:text-ink" to="/about">
            About
          </Link>
          <Link className="transition-colors hover:text-ink" to="/contact">
            Contact
          </Link>
        </nav>

        <Link
          to="/shop"
          className="pointer-events-auto rounded-full bg-ink px-5 py-2 text-sm font-semibold text-cream-50 transition-transform hover:-translate-y-0.5"
        >
          Shop
        </Link>
      </header>

      <div className="absolute right-6 top-1/2 hidden -translate-y-1/2 flex-col items-end gap-3.5 md:flex">
        {CHAPTERS.map((c, i) => (
          <div key={c.label} className="flex items-center gap-3">
            <span
              className={`text-[10px] font-semibold uppercase tracking-[0.18em] transition-all duration-300 ${
                i === active ? "text-ink opacity-100" : "text-ink/35 opacity-70"
              }`}
            >
              {c.label}
            </span>
            <span
              className={`h-[2px] rounded-full transition-all duration-300 ${
                i === active ? "w-7 bg-clay" : "w-3.5 bg-ink/20"
              }`}
            />
          </div>
        ))}
      </div>

      <div className="absolute bottom-0 left-0 h-[2px] w-full bg-ink/8">
        <div
          className="h-full bg-clay transition-[width] duration-150 ease-out"
          style={{ width: `${Math.round(offset * 100)}%` }}
        />
      </div>

      <div
        className="absolute bottom-8 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2 transition-opacity duration-500"
        style={{ opacity: offset < 0.05 ? 1 : 0 }}
      >
        <span className="text-[10px] font-semibold uppercase tracking-[0.28em] text-ink/45">Scroll</span>
        <span className="flex h-8 w-5 justify-center rounded-full border border-ink/25 pt-1.5">
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink/50" />
        </span>
      </div>
    </div>
  );
}
