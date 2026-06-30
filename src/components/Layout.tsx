import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Navbar } from "./Navbar";
import { Footer } from "./Footer";
import { CartDrawer } from "./CartDrawer";

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export function Layout() {
  return (
    <div className="flex min-h-screen flex-col bg-cream">
      <ScrollToTop />
      <Navbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
      <CartDrawer />
    </div>
  );
}

// Standard page heading block reused across content pages.
export function PageHeader({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mx-auto max-w-7xl px-5 pb-2 pt-10 md:px-8 md:pt-16">
      {eyebrow && (
        <span className="text-[11px] font-semibold uppercase tracking-[0.28em] text-clay-deep/80">
          {eyebrow}
        </span>
      )}
      <h1 className="mt-3 font-display text-4xl font-bold tracking-tightish text-ink md:text-6xl">
        {title}
      </h1>
      {subtitle && <p className="mt-4 max-w-2xl text-lg text-ink/60">{subtitle}</p>}
    </div>
  );
}
