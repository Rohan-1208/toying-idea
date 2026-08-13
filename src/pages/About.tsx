import { PageHeader } from "../components/Layout";
import { Button } from "../components/ui";

const VALUES = [
  {
    title: "Design-first",
    body: "Every toy is treated like an object you'd display — considered form, clean finish, real presence.",
  },
  {
    title: "Print to order",
    body: "We don't warehouse plastic. Pieces are made when you order, so quality stays consistent.",
  },
  {
    title: "Your designs too",
    body: "PYOT lets you bring your own model. Material, finish, scale — we handle the rest.",
  },
];

export default function About() {
  return (
    <div className="pb-20">
      <PageHeader
        eyebrow="About"
        title="A toy brand built around making."
        subtitle="TOYING IDEA makes premium 3D printed toys for people who care how things feel in the hand — not just how they look online."
      />

      <section className="mx-auto mt-12 max-w-3xl px-5 md:px-8">
        <p className="text-lg leading-relaxed text-ink/70 md:text-xl">
          We started with a simple belief: 3D printing can make toys that feel precious,
          not disposable. The snap of a flexi joint. The crispness of a turret. The weight
          of a piece that belongs on a shelf.
        </p>
      </section>

      <section className="mx-auto mt-16 max-w-7xl px-5 md:px-8">
        <div className="grid gap-6 md:grid-cols-3">
          {VALUES.map((v) => (
            <div key={v.title} className="border-t border-ink/15 pt-5">
              <h3 className="font-display text-xl font-bold text-ink">{v.title}</h3>
              <p className="mt-2 leading-relaxed text-ink/60">{v.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto mt-20 max-w-7xl px-5 text-center md:px-8">
        <h2 className="font-display text-3xl font-bold tracking-tightish text-ink md:text-4xl">
          Toys for a new generation.
        </h2>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button to="/shop" variant="dark">
            Shop the collection
          </Button>
          <Button to="/careers" variant="secondary">
            Join the team
          </Button>
        </div>
      </section>
    </div>
  );
}
