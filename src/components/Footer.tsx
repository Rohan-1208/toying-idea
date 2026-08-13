import { Link } from "react-router-dom";
import { BrandLogo } from "./BrandLogo";

const COLS = [
  {
    title: "Shop",
    links: [
      { to: "/shop", label: "All products" },
      { to: "/shop?category=toys", label: "Toys" },
      { to: "/shop?category=fidget", label: "Fidget" },
      { to: "/shop?category=collectibles", label: "Collectibles" },
    ],
  },
  {
    title: "Make",
    links: [
      { to: "/pyot", label: "Print Your Own Toy" },
      { to: "/track", label: "Track an order" },
    ],
  },
  {
    title: "Company",
    links: [
      { to: "/about", label: "About" },
      { to: "/careers", label: "Careers" },
      { to: "/contact", label: "Contact" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="mt-24 border-t border-ink/10 bg-cream-100">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 md:grid-cols-[1.5fr_1fr_1fr_1fr] md:px-8">
        <div>
          <BrandLogo to="/" size="md" />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-ink/60">
            Premium 3D printed toys. Designed to collect, built to last.
          </p>
        </div>

        {COLS.map((col) => (
          <div key={col.title}>
            <h4 className="text-[11px] font-bold uppercase tracking-[0.2em] text-ink/40">{col.title}</h4>
            <ul className="mt-4 space-y-2.5">
              {col.links.map((l) => (
                <li key={l.to + l.label}>
                  <Link to={l.to} className="text-sm text-ink/70 transition-colors hover:text-clay">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-ink/10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-5 py-5 text-xs text-ink/50 md:flex-row md:px-8">
          <span>© {new Date().getFullYear()} TOYING IDEA. All rights reserved.</span>
          <span className="font-semibold uppercase tracking-[0.2em]">Toys for a new generation</span>
        </div>
      </div>
    </footer>
  );
}
