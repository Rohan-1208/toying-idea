import { Link } from "react-router-dom";
import { PageHeader } from "../components/Layout";
import { Button } from "../components/ui";

const ROLES = [
  {
    title: "3D Print Technician",
    type: "Full-time · On-site",
    blurb: "Run printers, finish parts, and keep quality consistent from first layer to packed order.",
  },
  {
    title: "Product Designer",
    type: "Full-time · Hybrid",
    blurb: "Shape collectible toys — from concept sketches to print-ready models that feel premium in hand.",
  },
  {
    title: "Operations Associate",
    type: "Full-time · On-site",
    blurb: "Own order flow, packing, and customer follow-ups so every delivery lands clean and on time.",
  },
];

export default function Careers() {
  return (
    <div className="pb-20">
      <PageHeader
        eyebrow="Careers"
        title="Build toys people keep."
        subtitle="We're a small team making premium 3D printed collectibles. If you care about craft, detail, and shipping real objects — we'd like to hear from you."
      />

      <section className="mx-auto mt-10 max-w-7xl px-5 md:px-8">
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { title: "Craft over noise", body: "Fewer SKUs, better finishes. We ship things we're proud to put our name on." },
            { title: "Small team, clear ownership", body: "You'll own real work — printers, design, or ops — not endless meetings." },
            { title: "Maker culture", body: "Prototype fast, learn from prints, and improve the next batch." },
          ].map((item) => (
            <div key={item.title} className="rounded-2xl border border-ink/10 bg-white/50 p-6">
              <h3 className="font-display text-lg font-bold text-ink">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink/60">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto mt-16 max-w-3xl px-5 md:px-8">
        <h2 className="font-display text-2xl font-bold text-ink md:text-3xl">Open roles</h2>
        <p className="mt-2 text-ink/55">Don't see a perfect fit? Write anyway — we're always looking for people who make things.</p>

        <ul className="mt-8 divide-y divide-ink/10 border-y border-ink/10">
          {ROLES.map((role) => (
            <li key={role.title} className="flex flex-col gap-3 py-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="font-display text-xl font-bold text-ink">{role.title}</h3>
                <p className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-ink/40">{role.type}</p>
                <p className="mt-2 max-w-md text-sm leading-relaxed text-ink/60">{role.blurb}</p>
              </div>
              <a
                href={`mailto:hello@toyingidea.com?subject=${encodeURIComponent(`Application: ${role.title}`)}`}
                className="shrink-0 rounded-full bg-ink px-5 py-2.5 text-center text-sm font-semibold text-cream-50 transition-transform hover:-translate-y-0.5"
              >
                Apply
              </a>
            </li>
          ))}
        </ul>

        <div className="mt-12 rounded-2xl bg-ink px-6 py-10 text-center text-cream-50 md:px-10">
          <h3 className="font-display text-2xl font-bold">General applications</h3>
          <p className="mx-auto mt-3 max-w-md text-sm text-cream-50/70">
            Send a short note and portfolio / resume to{" "}
            <a href="mailto:hello@toyingidea.com" className="underline decoration-clay underline-offset-2">
              hello@toyingidea.com
            </a>
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Button to="/about" variant="secondary" className="!bg-cream-50 !text-ink">
              About the brand
            </Button>
            <Link
              to="/contact"
              className="rounded-full border border-cream-50/30 px-5 py-2.5 text-sm font-semibold text-cream-50 transition-colors hover:bg-cream-50/10"
            >
              Contact
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
