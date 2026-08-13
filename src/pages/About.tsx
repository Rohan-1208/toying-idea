import { useEffect, useRef, useState } from "react";
import { Button } from "../components/ui";

function Reveal({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setOn(true);
          io.disconnect();
        }
      },
      { threshold: 0.18, rootMargin: "0px 0px -8% 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`about-reveal ${on ? "is-in" : ""} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

/** Layered print growing on a bed — the visual idea of the brand. */
function PrintHeroVisual() {
  return (
    <div className="about-print-stage pointer-events-none absolute inset-y-0 right-0 w-full max-w-xl md:w-[52%]" aria-hidden>
      <div className="about-print-glow" />
      <div className="about-print-bed">
        <div className="about-print-rail" />
        <div className="about-print-gantry">
          <span className="about-print-nozzle" />
        </div>
        <div className="about-print-stack">
          <span className="layer l1" />
          <span className="layer l2" />
          <span className="layer l3" />
          <span className="layer l4" />
          <span className="layer l5" />
          <span className="about-print-head" />
        </div>
      </div>
      <div className="about-orbit about-orbit-a" />
      <div className="about-orbit about-orbit-b" />
      <div className="about-orbit about-orbit-c" />
    </div>
  );
}

const STEPS = [
  {
    n: "01",
    title: "Design for the hand",
    body: "Every form starts as something you want to hold — joints that flex, edges that catch light, scale that feels intentional.",
  },
  {
    n: "02",
    title: "Print when you order",
    body: "No warehouse of plastic waiting around. Your piece starts the moment the order lands, so finish stays consistent.",
  },
  {
    n: "03",
    title: "Finish like a collectible",
    body: "Support cleanup, fit checks, and a last pass so it looks display-ready — not like it just left a print bed.",
  },
  {
    n: "04",
    title: "Ship something that lasts",
    body: "Packed to arrive intact. Made to stay on a shelf, in a kid’s room, or in a collection — not in a landfill next month.",
  },
];

const BELIEFS = [
  {
    title: "Precious, not disposable",
    body: "Toys should feel like objects you’d keep. Weight, snap, surface — the small details that make something feel real.",
  },
  {
    title: "Personal beats mass",
    body: "A custom print for one kid beats a million identical SKUs. That’s the idea behind Toying City — and PYOT.",
  },
  {
    title: "Making is the product",
    body: "We don’t hide the printer. Layer by layer is the story. The workshop is part of the brand.",
  },
];

export default function About() {
  return (
    <div className="pb-0">
      {/* ── Hero: one composition, brand first ── */}
      <section className="relative min-h-[100svh] overflow-hidden border-b border-ink/10">
        <div className="about-hero-bg absolute inset-0" />
        <PrintHeroVisual />

        <div className="relative z-10 mx-auto flex min-h-[100svh] max-w-7xl flex-col justify-end px-5 pb-16 pt-28 md:justify-center md:px-8 md:pb-24 md:pt-20">
          <div className="max-w-xl animate-float-up">
            <p className="font-display text-[clamp(2.5rem,7vw,4.75rem)] font-bold leading-[0.9] tracking-tightish text-ink">
              TOYING
              <br />
              <span className="text-clay">IDEA</span>
            </p>
            <h1 className="mt-6 max-w-md font-display text-2xl font-bold leading-snug tracking-tightish text-ink md:text-3xl">
              Toys that feel <span className="text-teal-deep">made</span> — not massed.
            </h1>
            <p className="mt-5 max-w-md text-base leading-relaxed text-ink/65 md:text-lg">
              Premium 3D printed toys — printed to order, finished by hand, built to keep.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Button to="/shop" variant="dark" size="lg">
                Shop the collection
              </Button>
              <Button to="/pyot" variant="secondary" size="lg">
                Print your own
              </Button>
            </div>
          </div>
        </div>

        <div className="about-marquee absolute bottom-0 left-0 right-0 z-10 border-t border-ink/10 bg-ink text-cream-50" aria-hidden>
          <div className="about-marquee-track">
            {Array.from({ length: 2 }).map((_, i) => (
              <span key={i} className="about-marquee-chunk">
                LAYER BY LAYER · PRINT TO ORDER · KEEP FOREVER · TOYING CITY · CUSTOM FOR EVERY KID ·
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Origin ── */}
      <section className="relative overflow-hidden px-5 py-20 md:px-8 md:py-28">
        <div className="mx-auto grid max-w-7xl gap-12 md:grid-cols-[1.1fr_0.9fr] md:items-end md:gap-16">
          <Reveal>
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-ink/40">Why we exist</p>
            <h2 className="mt-4 font-display text-4xl font-bold leading-[1.02] tracking-tightish text-ink md:text-5xl lg:text-6xl">
              We started with a simple belief.
            </h2>
          </Reveal>
          <Reveal delay={120}>
            <p className="text-lg leading-relaxed text-ink/70 md:text-xl">
              3D printing can make toys that feel precious — not disposable. The snap of a flexi joint.
              The crispness of a turret. The weight of a piece that belongs on a shelf, and in a story.
            </p>
            <p className="mt-5 text-base leading-relaxed text-ink/55">
              Toying Idea is that workshop turned outward: a city of homes where every printer is making
              something for someone specific. You. Your kid. Your design.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ── How we make ── */}
      <section className="border-y border-ink/10 bg-gradient-to-b from-cream-50/80 to-cream px-5 py-20 md:px-8 md:py-28">
        <div className="mx-auto max-w-7xl">
          <Reveal>
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-ink/40">The craft</p>
            <h2 className="mt-4 max-w-2xl font-display text-4xl font-bold tracking-tightish text-ink md:text-5xl">
              From first layer to your door.
            </h2>
          </Reveal>

          <ol className="mt-14 grid gap-0 md:grid-cols-4">
            {STEPS.map((step, i) => (
              <li
                key={step.n}
                className="relative border-t border-ink/15 pt-6 md:border-l md:border-t-0 md:pl-6 md:pt-0 md:first:border-l-0 md:first:pl-0"
              >
                <Reveal delay={i * 90}>
                  <span className="font-display text-sm font-bold tracking-[0.2em] text-clay">{step.n}</span>
                  <h3 className="mt-3 font-display text-xl font-bold text-ink md:text-2xl">{step.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-ink/60 md:text-[15px]">{step.body}</p>
                </Reveal>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── Beliefs ── */}
      <section className="px-5 py-20 md:px-8 md:py-28">
        <div className="mx-auto max-w-7xl">
          <Reveal>
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-ink/40">What we believe</p>
            <h2 className="mt-4 font-display text-4xl font-bold tracking-tightish text-ink md:text-5xl">
              Three ideas we don’t compromise.
            </h2>
          </Reveal>

          <div className="mt-14 space-y-0">
            {BELIEFS.map((b, i) => (
              <Reveal key={b.title} delay={i * 80}>
                <div className="grid gap-4 border-t border-ink/15 py-10 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] md:gap-12 md:py-12">
                  <h3 className="font-display text-2xl font-bold tracking-tightish text-ink md:text-3xl">
                    {b.title}
                  </h3>
                  <p className="text-base leading-relaxed text-ink/65 md:text-lg">{b.body}</p>
                </div>
              </Reveal>
            ))}
            <div className="border-t border-ink/15" />
          </div>
        </div>
      </section>

      {/* ── Closing ── */}
      <section className="relative overflow-hidden bg-ink px-5 py-20 text-cream-50 md:px-8 md:py-28">
        <div className="about-cta-grain absolute inset-0 opacity-40" aria-hidden />
        <div className="relative mx-auto max-w-3xl text-center">
          <Reveal>
            <p className="font-display text-sm font-bold tracking-[0.28em] text-gold">TOYING IDEA</p>
            <h2 className="mt-5 font-display text-4xl font-bold leading-[1.02] tracking-tightish md:text-5xl lg:text-6xl">
              Be part of the city.
            </h2>
            <p className="mx-auto mt-5 max-w-md text-base leading-relaxed text-cream-50/65 md:text-lg">
              Collect a finished piece, or bring your own model. Either way — it gets made for you.
            </p>
            <div className="mt-10 flex flex-wrap justify-center gap-3">
              <Button to="/shop" variant="primary" size="lg">
                Browse toys
              </Button>
              <Button to="/careers" variant="secondary" size="lg" className="!border-cream-50/25 !bg-transparent !text-cream-50 hover:!bg-cream-50/10">
                Join the team
              </Button>
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
