import { Link } from "react-router-dom";
import { SCROLL_PAGES, STOPS } from "../three/scroll";
import { FEATURED_DROPS } from "../data/catalog-links";

const SPAN = SCROLL_PAGES - 1;
const topFor = (offset: number) => `${offset * SPAN * 100}vh`;

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.28em] text-clay-deep/80">
      <span className="h-[6px] w-[6px] rounded-full bg-clay" />
      {children}
    </span>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-ink/15 bg-cream-50/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-ink/70 backdrop-blur">
      {children}
    </span>
  );
}

function PillLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className="rounded-full border border-ink/15 bg-cream-50/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-ink/70 backdrop-blur transition-transform hover:-translate-y-0.5 hover:border-clay/40 hover:text-clay-deep"
    >
      {children}
    </Link>
  );
}

function Section({
  offset,
  align = "left",
  children,
}: {
  offset: number;
  align?: "left" | "right" | "center";
  children: React.ReactNode;
}) {
  const justify =
    align === "left" ? "justify-start" : align === "right" ? "justify-end" : "justify-center";
  return (
    <section
      className={`absolute left-0 flex h-screen w-screen items-center px-6 md:px-16 ${justify}`}
      style={{ top: topFor(offset) }}
    >
      <div className="max-w-xl">{children}</div>
    </section>
  );
}

export function Overlay() {
  return (
    <div
      className="pointer-events-none relative w-screen"
      style={{ height: `${SCROLL_PAGES * 100}vh` }}
    >
      <Section offset={STOPS.hero} align="left">
        <div className="animate-float-up">
          <Eyebrow>Toys for a new generation</Eyebrow>
          <h1 className="mt-5 font-display text-5xl font-bold leading-[0.95] tracking-tightish text-ink md:text-7xl">
            3D printed toys
            <br />
            built like future
            <br />
            <span className="text-clay">collectibles.</span>
          </h1>
          <p className="mt-6 max-w-md text-base leading-relaxed text-ink/70 md:text-lg">
            Upload, customize, gift and collect — precision-built toys that feel
            like high-end design objects, not disposables.
          </p>
          <div className="pointer-events-auto mt-8 flex flex-wrap items-center gap-3">
            <Link
              to="/pyot"
              className="rounded-full bg-ink px-6 py-3 text-sm font-semibold text-cream-50 transition-transform hover:-translate-y-0.5"
            >
              PYOT — Print Your Own Toy
            </Link>
            <Link
              to="/shop"
              className="rounded-full border border-ink/20 bg-cream-50/60 px-6 py-3 text-sm font-semibold text-ink backdrop-blur transition-transform hover:-translate-y-0.5"
            >
              Shop the Collection
            </Link>
          </div>
          <div className="mt-10 flex flex-wrap gap-2">
            <Pill>Premium 3D Printed</Pill>
            <Pill>Customization-first</Pill>
            <Pill>Collector-ready</Pill>
          </div>
        </div>
      </Section>

      <Section offset={0.31} align="right">
        <div className="text-right">
          <Eyebrow>The Dive · Transition</Eyebrow>
          <h2 className="mt-4 font-display text-4xl font-bold leading-[1] tracking-tightish text-ink md:text-6xl">
            Every building
            <br />
            <span className="text-teal-deep">is a print studio.</span>
          </h2>
          <p className="ml-auto mt-5 max-w-md text-base leading-relaxed text-ink/70">
            Glowing windows across the city — each one making something special.
            Descend into a maker building and watch toys take shape layer by layer.
          </p>
        </div>
      </Section>

      <Section offset={0.52} align="left">
        <div>
          <Eyebrow>The Workshop</Eyebrow>
          <h2 className="mt-4 font-display text-4xl font-bold leading-[1] tracking-tightish text-ink md:text-6xl">
            Print Your
            <br />
            <span className="text-clay">Own Toy.</span>
          </h2>
          <p className="mt-5 max-w-md text-base leading-relaxed text-ink/70">
            Drop in your STL / OBJ / STEP files, pick material &amp; finish, and we
            build it layer by precise layer. From one-offs to small-batch drops.
          </p>
          <div className="pointer-events-auto mt-7 flex flex-wrap gap-3">
            <Link
              to="/pyot"
              className="rounded-full bg-clay px-6 py-3 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5"
            >
              Upload your files
            </Link>
            <Link
              to="/pyot"
              className="rounded-full border border-ink/20 px-6 py-3 text-sm font-semibold text-ink transition-transform hover:-translate-y-0.5"
            >
              Learn the flow
            </Link>
          </div>
        </div>
      </Section>

      <Section offset={STOPS.archive} align="center">
        <div className="text-center">
          <Eyebrow>The Designer Archive</Eyebrow>
          <h2 className="mt-4 font-display text-4xl font-bold leading-[1] tracking-tightish text-ink md:text-6xl">
            Featured
            <br />
            <span className="text-gold">Drops.</span>
          </h2>
          <p className="mx-auto mt-5 max-w-lg text-base leading-relaxed text-ink/70">
            Limited-edition drops from our catalog — tap a piece to view details and add to cart.
          </p>
          <div className="pointer-events-auto mx-auto mt-7 flex max-w-lg flex-wrap justify-center gap-2">
            {FEATURED_DROPS.map((drop) => (
              <PillLink key={drop.to} to={drop.to}>
                {drop.label}
              </PillLink>
            ))}
          </div>
          <Link
            to="/collections"
            className="pointer-events-auto mt-6 inline-block text-sm font-semibold text-clay hover:underline"
          >
            Browse all collections →
          </Link>
        </div>
      </Section>

      <Section offset={STOPS.universe} align="center">
        <div className="text-center">
          <Eyebrow>The Universe</Eyebrow>
          <h2 className="mt-4 font-display text-5xl font-bold leading-[0.95] tracking-tightish text-ink md:text-7xl">
            Enter the
            <br />
            <span className="text-clay">Toying Idea World.</span>
          </h2>
          <p className="mx-auto mt-6 max-w-lg text-base leading-relaxed text-ink/70 md:text-lg">
            A world-class brand that happens to sell toys. Premium motion,
            sculptural product, and a collection that never stops growing.
          </p>
          <div className="pointer-events-auto mt-8 flex flex-wrap justify-center gap-3">
            <Link
              to="/shop"
              className="rounded-full bg-ink px-7 py-3 text-sm font-semibold text-cream-50 transition-transform hover:-translate-y-0.5"
            >
              Shop now
            </Link>
            <Link
              to="/track"
              className="rounded-full border border-ink/20 bg-cream-50/60 px-7 py-3 text-sm font-semibold text-ink backdrop-blur transition-transform hover:-translate-y-0.5"
            >
              Track an order
            </Link>
          </div>
          <p className="mt-12 text-xs font-semibold uppercase tracking-[0.3em] text-ink/40">
            TOYING IDEA — © {new Date().getFullYear()}
          </p>
        </div>
      </Section>
    </div>
  );
}
