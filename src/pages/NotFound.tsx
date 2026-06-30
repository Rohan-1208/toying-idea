import { Button } from "../components/ui";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-2xl px-5 py-32 text-center">
      <p className="font-display text-7xl font-bold text-clay">404</p>
      <h1 className="mt-4 font-display text-3xl font-bold text-ink">Page not found</h1>
      <p className="mt-3 text-ink/60">This corner of the toy universe doesn't exist yet.</p>
      <Button to="/" className="mt-8">Back home</Button>
    </div>
  );
}
