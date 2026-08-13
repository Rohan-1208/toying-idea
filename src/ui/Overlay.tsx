import { SCROLL_PAGES, STOPS } from "../three/scroll";

const SPAN = (pages: number) => pages - 1;
const topFor = (offset: number, pages: number) => `${offset * SPAN(pages) * 100}vh`;

function Section({
  offset,
  scrollPages,
  align = "left",
  children,
}: {
  offset: number;
  scrollPages: number;
  align?: "left" | "right" | "center";
  children: React.ReactNode;
}) {
  const justify =
    align === "left" ? "justify-start" : align === "right" ? "justify-end" : "justify-center";
  return (
    <section
      className={`absolute left-0 flex h-screen w-screen items-center px-6 md:px-16 ${justify}`}
      style={{ top: topFor(offset, scrollPages) }}
    >
      <div className="max-w-xl">{children}</div>
    </section>
  );
}

export function Overlay({ scrollPages = SCROLL_PAGES }: { scrollPages?: number }) {
  return (
    <div
      className="pointer-events-none relative w-screen"
      style={{ height: `${scrollPages * 100}vh` }}
    >
      {/* Hero — brand first, one idea */}
      <Section offset={STOPS.hero} scrollPages={scrollPages} align="left">
        <div className="animate-float-up">
          <p className="font-display text-sm font-bold tracking-[0.22em] text-clay md:text-base">
            TOYING IDEA
          </p>
          <h1 className="mt-4 font-display text-5xl font-bold leading-[0.95] tracking-tightish text-ink md:text-7xl">
            Toys built
            <br />
            to collect.
          </h1>
          <p className="mt-5 max-w-sm text-base leading-relaxed text-ink/65 md:text-lg">
            Premium 3D printed pieces — shop ready-made drops or print your own.
          </p>
          <div className="pointer-events-auto mt-8 flex flex-wrap items-center gap-3">
            <a
              href="/shop"
              className="rounded-full bg-ink px-6 py-3 text-sm font-semibold text-cream-50 transition-transform hover:-translate-y-0.5"
            >
              Shop
            </a>
            <a
              href="/pyot"
              className="rounded-full border border-ink/20 bg-cream-50/50 px-6 py-3 text-sm font-semibold text-ink backdrop-blur transition-transform hover:-translate-y-0.5"
            >
              Print your own
            </a>
          </div>
        </div>
      </Section>

      {/* Dive */}
      <Section offset={0.31} scrollPages={scrollPages} align="right">
        <div className="text-right">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-ink/40">The studio</p>
          <h2 className="mt-3 font-display text-4xl font-bold leading-[1] tracking-tightish text-ink md:text-5xl">
            Made layer
            <br />
            <span className="text-teal-deep">by layer.</span>
          </h2>
          <p className="ml-auto mt-4 max-w-sm text-base leading-relaxed text-ink/65">
            Every piece is printed to order — careful, tactile, and finished by hand.
          </p>
        </div>
      </Section>

      {/* Workshop / PYOT */}
      <Section offset={0.52} scrollPages={scrollPages} align="left">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-ink/40">PYOT</p>
          <h2 className="mt-3 font-display text-4xl font-bold leading-[1] tracking-tightish text-ink md:text-5xl">
            Your model.
            <br />
            <span className="text-clay">Our print.</span>
          </h2>
          <p className="mt-4 max-w-sm text-base leading-relaxed text-ink/65">
            Share an STL, pick material and finish — we quote, print, and ship.
          </p>
          <div className="pointer-events-auto mt-7">
            <a
              href="/pyot"
              className="inline-block rounded-full bg-clay px-6 py-3 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5"
            >
              Start a custom print
            </a>
          </div>
        </div>
      </Section>

      {/* Collection tease */}
      <Section offset={STOPS.archive} scrollPages={scrollPages} align="center">
        <div className="text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-ink/40">The collection</p>
          <h2 className="mt-3 font-display text-4xl font-bold leading-[1] tracking-tightish text-ink md:text-5xl">
            Ready to
            <br />
            <span className="text-gold">take home.</span>
          </h2>
          <p className="mx-auto mt-4 max-w-md text-base leading-relaxed text-ink/65">
            Flexibles, collectibles, and limited drops — printed when you order.
          </p>
          <div className="pointer-events-auto mt-7">
            <a
              href="/shop"
              className="inline-block rounded-full border border-ink/20 bg-cream-50/50 px-6 py-3 text-sm font-semibold text-ink backdrop-blur transition-transform hover:-translate-y-0.5"
            >
              Browse shop
            </a>
          </div>
        </div>
      </Section>

      {/* Close */}
      <Section offset={STOPS.universe} scrollPages={scrollPages} align="center">
        <div className="text-center">
          <p className="font-display text-sm font-bold tracking-[0.22em] text-clay">TOYING IDEA</p>
          <h2 className="mt-4 font-display text-5xl font-bold leading-[0.95] tracking-tightish text-ink md:text-6xl">
            Start collecting.
          </h2>
          <p className="mx-auto mt-5 max-w-md text-base leading-relaxed text-ink/65">
            Shop the catalog or bring your own design to life.
          </p>
          <div className="pointer-events-auto mt-8 flex flex-wrap justify-center gap-3">
            <a
              href="/shop"
              className="rounded-full bg-ink px-7 py-3 text-sm font-semibold text-cream-50 transition-transform hover:-translate-y-0.5"
            >
              Shop now
            </a>
            <a
              href="/about"
              className="rounded-full border border-ink/20 bg-cream-50/50 px-7 py-3 text-sm font-semibold text-ink backdrop-blur transition-transform hover:-translate-y-0.5"
            >
              About us
            </a>
          </div>
        </div>
      </Section>
    </div>
  );
}
