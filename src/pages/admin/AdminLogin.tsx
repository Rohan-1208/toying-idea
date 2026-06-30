import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAdminAuth } from "../../context/AdminAuth";
import { Button, Input } from "../../components/ui";

export default function AdminLogin() {
  const { login } = useAdminAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      navigate("/admin");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink px-5">
      <div className="w-full max-w-sm rounded-3xl bg-cream p-8 shadow-2xl">
        <div className="mb-6 flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-ink text-cream-50">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M12 2 3 7v10l9 5 9-5V7l-9-5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
              <path d="M3 7l9 5 9-5M12 22V12" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
            </svg>
          </span>
          <span className="font-display text-lg font-bold text-ink">
            TOYING<span className="text-clay"> IDEA</span>
          </span>
        </div>
        <h1 className="font-display text-2xl font-bold text-ink">Admin sign in</h1>
        <p className="mt-1 text-sm text-ink/55">Manage products, orders and inquiries.</p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Input label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          {error && <p className="rounded-xl bg-clay/10 px-3 py-2 text-sm text-clay-deep">{error}</p>}
          <Button size="lg" className="w-full" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </div>
    </div>
  );
}
