import { PageHeader } from "../components/Layout";
import { Button } from "../components/ui";

const STATS = [
  { value: "100%", label: "Made to order" },
  { value: "10+", label: "Materials & finishes" },
  { value: "₹150+", label: "Starting price" },
  { value: "1–2 days", label: "Custom quote time" },
];

const VALUES = [
  { title: "Design-first", body: "Every toy is treated like a design object — sculptural, considered, built to be displayed." },
  { title: "Customization-first", body: "Print Your Own Toy means your ideas become real objects, in your material and color." },
  { title: "Collector-ready", body: "Limited drops, premium finishes and packaging worthy of a shelf." },
];

export default function About() {
  return (
    <div className="pb-20">
      <PageHeader
        eyebrow="About"
        title="A world-class brand that happens to sell toys."
        subtitle="Premium motion, sculptural product presentation, and backend-driven content — built for the next generation of collectors."
      />

      <section className="mx-auto mt-10 max-w-7xl px-5 md:px-8">
        <div className="grid gap-4 rounded-3xl border border-ink/10 bg-cream-100 p-6 sm:grid-cols-4 md:p-10">
          {STATS.map((s) => (
            <div key={s.label} className="text-center">
              <p className="font-display text-3xl font-bold text-clay md:text-4xl">{s.value}</p>
              <p className="mt-1 text-sm text-ink/60">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto mt-16 max-w-7xl px-5 md:px-8">
        <div className="grid gap-6 md:grid-cols-3">
          {VALUES.map((v) => (
            <div key={v.title} className="rounded-3xl border border-ink/10 bg-white/60 p-6">
              <h3 className="font-display text-xl font-bold text-ink">{v.title}</h3>
              <p className="mt-2 leading-relaxed text-ink/60">{v.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto mt-16 max-w-4xl px-5 text-center md:px-8">
        <h2 className="font-display text-3xl font-bold tracking-tightish text-ink md:text-4xl">
          Toys for a new generation.
        </h2>
        <p className="mx-auto mt-4 max-w-2xl leading-relaxed text-ink/60">
          TOYING IDEA started with a simple belief: 3D printing can make toys that feel
          precious, not disposable. We obsess over the details — the snap of a flexi joint,
          the crispness of a castle turret, the weight of a collectible in your hand.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Button to="/shop" variant="dark">Shop the collection</Button>
          <Button to="/pyot" variant="secondary">Print your own toy</Button>
        </div>
      </section>
    </div>
  );
}
