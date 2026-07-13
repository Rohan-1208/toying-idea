import { useSyncExternalStore, useState } from "react";
import { Link } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { progressStore } from "./progressStore";
import { STOPS } from "../three/scroll";

const NAV_LINKS = [
  { to: "/shop", label: "Shop" },
  { to: "/pyot", label: "PYOT" },
  { to: "/gifting", label: "Gifting" },
  { to: "/collections", label: "Collections" },
  { to: "/about", label: "About" },
];

const CHAPTERS = [
  { label: "Start", offset: STOPS.hero },
  { label: "Transition", offset: 0.31 },
  { label: "Workshop", offset: STOPS.workshop },
  { label: "Collection", offset: STOPS.archive },
  { label: "Universe", offset: STOPS.universe },
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
  const { count, setOpen } = useCart();
  const [menu, setMenu] = useState(false);

  return (
    <div className="pointer-events-none fixed inset-0 z-20">
      <header className="flex items-center justify-between px-6 py-5 md:px-10">
        <Link to="/" className="pointer-events-auto flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-ink text-cream-50">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M12 2 3 7v10l9 5 9-5V7l-9-5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
              <path d="M3 7l9 5 9-5M12 22V12" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
            </svg>
          </span>
          <span className="font-display text-lg font-bold tracking-tightish text-ink">
            TOYING<span className="text-clay"> IDEA</span>
          </span>
        </Link>

        <nav className="pointer-events-auto hidden items-center gap-7 text-sm font-medium text-ink/70 md:flex">
          {NAV_LINKS.map((l) => (
            <Link key={l.to} className="transition-colors hover:text-ink" to={l.to}>
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="pointer-events-auto flex items-center gap-2">
          <Link
            to="/track"
            className="hidden rounded-full px-3 py-2 text-sm font-medium text-ink/60 transition-colors hover:text-ink sm:block"
          >
            Track order
          </Link>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="relative rounded-full bg-ink px-4 py-2 text-sm font-semibold text-cream-50 transition-transform hover:-translate-y-0.5"
          >
            Cart
            {count > 0 && (
              <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-clay px-1 text-[11px] font-bold text-white">
                {count}
              </span>
            )}
          </button>
          <button
            type="button"
            className="grid h-9 w-9 place-items-center rounded-lg border border-ink/15 md:hidden"
            onClick={() => setMenu((m) => !m)}
            aria-label="Menu"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 6h18M3 12h18M3 18h18" />
            </svg>
          </button>
        </div>
      </header>

      {menu && (
        <div className="pointer-events-auto absolute left-6 right-6 top-[72px] rounded-2xl border border-ink/10 bg-cream/95 p-4 shadow-lg backdrop-blur md:hidden">
          {[...NAV_LINKS, { to: "/track", label: "Track order" }].map((l) => (
            <Link
              key={l.to}
              to={l.to}
              onClick={() => setMenu(false)}
              className="block py-2 text-base font-medium text-ink/80"
            >
              {l.label}
            </Link>
          ))}
        </div>
      )}

      <div className="absolute right-6 top-1/2 hidden -translate-y-1/2 flex-col items-end gap-4 md:flex">
        {CHAPTERS.map((c, i) => (
          <div key={c.label} className="flex items-center gap-3">
            <span
              className={`text-[11px] font-semibold uppercase tracking-[0.18em] transition-all duration-300 ${
                i === active ? "text-ink opacity-100" : "text-ink/40 opacity-60"
              }`}
            >
              {c.label}
            </span>
            <span
              className={`h-[2px] rounded-full transition-all duration-300 ${
                i === active ? "w-8 bg-clay" : "w-4 bg-ink/25"
              }`}
            />
          </div>
        ))}
      </div>

      <div className="absolute bottom-0 left-0 h-[3px] w-full bg-ink/10">
        <div
          className="h-full bg-gradient-to-r from-gold via-clay to-teal transition-[width] duration-150 ease-out"
          style={{ width: `${Math.round(offset * 100)}%` }}
        />
      </div>

      <div
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 transition-opacity duration-500"
        style={{ opacity: offset < 0.04 ? 1 : 0 }}
      >
        <span className="text-[11px] font-semibold uppercase tracking-[0.28em] text-ink/50">
          Scroll to explore
        </span>
        <span className="flex h-9 w-5 justify-center rounded-full border border-ink/30 pt-2">
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink/60" />
        </span>
      </div>

      <div className="absolute bottom-6 right-6 font-display text-sm font-bold tabular-nums text-ink/60">
        {String(Math.round(offset * 100)).padStart(3, "0")}%
      </div>
    </div>
  );
}
