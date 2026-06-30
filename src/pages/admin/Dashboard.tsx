import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../lib/api";
import type { Order } from "../../lib/types";
import { formatINR, formatDate } from "../../lib/format";
import { Spinner } from "../../components/ui";

interface Stats {
  totalOrders: number;
  totalProducts: number;
  openInquiries: number;
  lowStock: number;
  revenue: number;
  byStatus: Record<string, number>;
  recentOrders: Order[];
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .stats()
      .then(setStats)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load stats"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-24"><Spinner className="h-6 w-6" /></div>;

  if (error) {
    return (
      <div className="rounded-2xl border border-clay/30 bg-clay/5 p-6 text-clay-deep">
        <p className="font-semibold">Couldn't load dashboard data.</p>
        <p className="mt-1 text-sm">{error}</p>
        <p className="mt-3 text-sm text-ink/60">
          Make sure <code className="rounded bg-ink/10 px-1">MONGODB_URI</code> and admin env vars are configured.
        </p>
      </div>
    );
  }

  const cards = [
    { label: "Revenue", value: formatINR(stats!.revenue), accent: "text-clay" },
    { label: "Orders", value: stats!.totalOrders, accent: "text-teal-deep" },
    { label: "Products", value: stats!.totalProducts, accent: "text-ink" },
    { label: "Open inquiries", value: stats!.openInquiries, accent: "text-gold" },
    { label: "Low stock", value: stats!.lowStock, accent: "text-clay-deep" },
  ];

  return (
    <div>
      <h1 className="font-display text-3xl font-bold text-ink">Dashboard</h1>
      <p className="mt-1 text-ink/55">An overview of your store.</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl border border-ink/10 bg-cream p-5">
            <p className="text-sm text-ink/50">{c.label}</p>
            <p className={`mt-2 font-display text-3xl font-bold ${c.accent}`}>{c.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="rounded-2xl border border-ink/10 bg-cream p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-ink">Recent orders</h2>
            <Link to="/admin/orders" className="text-sm font-medium text-clay hover:underline">View all</Link>
          </div>
          {stats!.recentOrders.length === 0 ? (
            <p className="py-8 text-center text-sm text-ink/40">No orders yet.</p>
          ) : (
            <div className="divide-y divide-ink/5">
              {stats!.recentOrders.map((o) => (
                <Link key={o._id} to={`/admin/orders?focus=${o.orderNumber}`} className="flex items-center justify-between py-3 hover:opacity-70">
                  <div>
                    <p className="font-medium text-ink">{o.orderNumber}</p>
                    <p className="text-xs text-ink/50">{o.customer.name} · {formatDate(o.createdAt)}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-ink">{formatINR(o.total)}</p>
                    <p className="text-xs capitalize text-ink/50">{o.status}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-ink/10 bg-cream p-5">
          <h2 className="mb-4 font-display text-lg font-bold text-ink">By status</h2>
          <div className="space-y-3">
            {["pending", "confirmed", "printing", "shipped", "delivered", "cancelled"].map((s) => (
              <div key={s} className="flex items-center justify-between">
                <span className="text-sm capitalize text-ink/60">{s}</span>
                <span className="rounded-full bg-ink/5 px-2.5 py-0.5 text-sm font-semibold text-ink">
                  {stats!.byStatus[s] || 0}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
