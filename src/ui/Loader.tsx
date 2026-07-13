import { useEffect, useState } from "react";
import { useDeviceProfile } from "../hooks/useDeviceProfile";
import { BrandLogo } from "../components/BrandLogo";

// Brand intro overlay — shorter on mobile for faster time-to-content.
export function Loader() {
  const { mobile, reducedMotion } = useDeviceProfile();
  const fast = mobile || reducedMotion;
  const [gone, setGone] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const fadeMs = fast ? 500 : 1100;
    const hideMs = fast ? 900 : 1900;
    const t = setTimeout(() => setGone(true), fadeMs);
    const t2 = setTimeout(() => setHidden(true), hideMs);
    return () => {
      clearTimeout(t);
      clearTimeout(t2);
    };
  }, [fast]);

  if (hidden) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-cream transition-opacity ${
        fast ? "duration-500" : "duration-700"
      } ${gone ? "opacity-0" : "opacity-100"}`}
      aria-hidden={gone}
    >
      <BrandLogo to={false} size="lg" showWordmark className="flex-col gap-3 sm:flex-row" />
      {!reducedMotion && (
        <span className="mt-4 h-2 w-2 animate-spin-slow rounded-sm bg-clay" aria-hidden />
      )}
      <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.3em] text-ink/40">
        {fast ? "Loading" : "Building your world"}
      </p>
    </div>
  );
}
