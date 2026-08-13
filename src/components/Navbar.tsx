import { useEffect, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { BrandLogo } from "./BrandLogo";

const LINKS = [
  { to: "/shop", label: "Shop" },
  { to: "/pyot", label: "PYOT" },
  { to: "/about", label: "About" },
  { to: "/contact", label: "Contact" },
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
      className={`sticky top-0 z-40 transition-all duration-300 ${
        scrolled ? "border-b border-ink/10 bg-cream/90 backdrop-blur-md" : "bg-cream/40"
      }`}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 md:px-8">
        <BrandLogo to="/" size="md" />

        <nav className="hidden items-center gap-8 text-[13px] font-medium tracking-wide md:flex">
          {LINKS.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) =>
                `transition-colors hover:text-ink ${isActive ? "text-ink" : "text-ink/55"}`
              }
            >
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2">
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
            aria-expanded={menu}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {menu ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M3 6h18M3 12h18M3 18h18" />}
            </svg>
          </button>
        </div>
      </div>

      {menu && (
        <div className="border-t border-ink/10 bg-cream/95 px-5 py-4 md:hidden">
          {LINKS.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              onClick={() => setMenu(false)}
              className="block py-2.5 text-base font-medium text-ink/80"
            >
              {l.label}
            </NavLink>
          ))}
          <Link
            to="/careers"
            onClick={() => setMenu(false)}
            className="mt-2 block border-t border-ink/10 py-2.5 text-base font-medium text-ink/55"
          >
            Careers
          </Link>
        </div>
      )}
    </header>
  );
}
