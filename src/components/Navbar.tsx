import { useEffect, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { useCart } from "../context/CartContext";

const LINKS = [
  { to: "/shop", label: "Shop" },
  { to: "/pyot", label: "PYOT" },
  { to: "/gifting", label: "Gifting" },
  { to: "/collections", label: "Collections" },
  { to: "/about", label: "About" },
];

export function Navbar() {
  const { count, setOpen } = useCart();
  const [scrolled, setScrolled] = useState(false);
  const [menu, setMenu] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-40 transition-all ${
        scrolled ? "border-b border-ink/10 bg-cream/80 backdrop-blur-md" : "bg-transparent"
      }`}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 md:px-8">
        <Link to="/" className="flex items-center gap-2">
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

        <nav className="hidden items-center gap-7 text-sm font-medium md:flex">
          {LINKS.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) =>
                `transition-colors hover:text-ink ${isActive ? "text-ink" : "text-ink/60"}`
              }
            >
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            to="/track"
            className="hidden rounded-full px-3 py-2 text-sm font-medium text-ink/60 transition-colors hover:text-ink sm:block"
          >
            Track order
          </Link>
          <button
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
            className="ml-1 grid h-9 w-9 place-items-center rounded-lg border border-ink/15 md:hidden"
            onClick={() => setMenu((m) => !m)}
            aria-label="Menu"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 6h18M3 12h18M3 18h18" />
            </svg>
          </button>
        </div>
      </div>

      {menu && (
        <div className="border-t border-ink/10 bg-cream/95 px-5 py-3 md:hidden">
          {[...LINKS, { to: "/track", label: "Track order" }].map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              onClick={() => setMenu(false)}
              className="block py-2 text-base font-medium text-ink/80"
            >
              {l.label}
            </NavLink>
          ))}
        </div>
      )}
    </header>
  );
}
