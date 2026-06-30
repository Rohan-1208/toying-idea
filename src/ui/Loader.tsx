import { useEffect, useState } from "react";

// Brand intro overlay — fades out shortly after the canvas mounts.
export function Loader() {
  const [gone, setGone] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setGone(true), 1100);
    const t2 = setTimeout(() => setHidden(true), 1900);
    return () => {
      clearTimeout(t);
      clearTimeout(t2);
    };
  }, []);

  if (hidden) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-cream transition-opacity duration-700 ${
        gone ? "opacity-0" : "opacity-100"
      }`}
    >
      <div className="flex items-center gap-3">
        <span className="h-3 w-3 animate-spin-slow rounded-sm bg-clay" />
        <span className="font-display text-2xl font-bold tracking-tightish text-ink">
          TOYING<span className="text-clay"> IDEA</span>
        </span>
      </div>
      <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.3em] text-ink/40">
        Building your world
      </p>
    </div>
  );
}
