import { SCROLL_PAGES, STOPS } from "../three/scroll";

const SPAN = (pages: number) => pages - 1;
const topFor = (offset: number, pages: number) => `${offset * SPAN(pages) * 100}vh`;

function Section({
  offset,
  scrollPages,
  align = "left",
  children,
  className = "",
}: {
  offset: number;
  scrollPages: number;
  align?: "left" | "right" | "center";
  children: React.ReactNode;
  className?: string;
}) {
  const justify =
    align === "left" ? "justify-start" : align === "right" ? "justify-end" : "justify-center";
  return (
    <section
      className={`absolute left-0 flex h-screen w-screen items-center px-6 md:px-16 ${justify} ${className}`}
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
      {/* 01 — Enter the city */}
      <Section offset={STOPS.hero} scrollPages={scrollPages} align="left">
        <div className="animate-float-up">
          <p className="font-display text-sm font-bold tracking-[0.22em] text-clay md:text-base">
            TOYING IDEA
          </p>
          <h1 className="mt-4 font-display text-5xl font-bold leading-[0.95] tracking-tightish text-ink md:text-7xl">
            Entering
            <br />
            <span className="text-clay">Toying City.</span>
          </h1>
          <p className="mt-5 max-w-sm text-base leading-relaxed text-ink/65 md:text-lg">
            Scroll to explore — every home is making something new.
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

      {/* 02 — Homes creating */}
      <Section offset={0.22} scrollPages={scrollPages} align="right">
        <div className="text-right">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-ink/40">Look closer</p>
          <h2 className="mt-3 font-display text-4xl font-bold leading-[1] tracking-tightish text-ink md:text-5xl">
            Each home
            <br />
            <span className="text-teal-deep">creating something new.</span>
          </h2>
          <p className="ml-auto mt-4 max-w-sm text-base leading-relaxed text-ink/65">
            Windows glow. Printers run. A custom toy for every kid.
          </p>
        </div>
      </Section>

      {/* 03 — Inside / personalized print */}
      <Section offset={0.48} scrollPages={scrollPages} align="left">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-ink/40">The print</p>
          <h2 className="mt-3 font-display text-4xl font-bold leading-[1] tracking-tightish text-ink md:text-5xl">
            Your personalized toy —
            <br />
            <span className="text-clay">printed layer by layer.</span>
          </h2>
          <p className="mt-4 max-w-sm text-base leading-relaxed text-ink/65">
            Not mass-made. Built one layer at a time, just for you.
          </p>
        </div>
      </Section>

      {/* 04 — Collection */}
      <Section offset={STOPS.archive} scrollPages={scrollPages} align="center">
        <div className="text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-ink/40">The shelves</p>
          <h2 className="mt-3 font-display text-4xl font-bold leading-[1] tracking-tightish text-ink md:text-5xl">
            Toys ready
            <br />
            <span className="text-gold">to take home.</span>
          </h2>
          <div className="pointer-events-auto mt-7">
            <a
              href="/shop"
              className="inline-block rounded-full bg-ink px-8 py-3.5 text-sm font-semibold text-cream-50 transition-transform hover:-translate-y-0.5"
            >
              Browse the collection
            </a>
          </div>
        </div>
      </Section>

      {/* 05 — Join the city */}
      <Section offset={STOPS.universe} scrollPages={scrollPages} align="center">
        <div className="text-center">
          <p className="font-display text-sm font-bold tracking-[0.22em] text-clay">TOYING IDEA</p>
          <h2 className="mt-4 font-display text-5xl font-bold leading-[0.95] tracking-tightish text-ink md:text-6xl">
            Be a part
            <br />
            of the city.
          </h2>
          <p className="mx-auto mt-5 max-w-md text-base leading-relaxed text-ink/65">
            Shop a drop — or print something only yours.
          </p>
          <div className="pointer-events-auto mt-8 flex flex-wrap justify-center gap-3">
            <a
              href="/shop"
              className="rounded-full bg-ink px-7 py-3 text-sm font-semibold text-cream-50 transition-transform hover:-translate-y-0.5"
            >
              Shop now
            </a>
            <a
              href="/pyot"
              className="rounded-full border border-ink/20 bg-cream-50/50 px-7 py-3 text-sm font-semibold text-ink backdrop-blur transition-transform hover:-translate-y-0.5"
            >
              Print your own
            </a>
          </div>
        </div>
      </Section>
    </div>
  );
}
