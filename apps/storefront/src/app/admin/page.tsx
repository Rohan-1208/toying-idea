import Link from "next/link";
import { cookies, headers } from "next/headers";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/Card";
import { AdminLoginClient } from "@/app/admin/AdminLoginClient";

async function apiUrl(pathname: string): Promise<string> {
  const h = await headers();
  const host = h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  const base = host ? `${proto}://${host}` : "http://localhost:3000";
  return new URL(pathname, base).toString();
}

export default async function AdminPage() {
  const jar = await cookies();
  const res = await fetch(await apiUrl("/api/auth/me"), {
    cache: "no-store",
    headers: { cookie: jar.toString() },
  });
  const me = res.ok ? ((await res.json()) as { is_admin?: boolean }) : null;
  const isAdmin = Boolean(me?.is_admin);

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-6xl px-5 py-10 grid gap-6">
        <div className="flex items-end justify-between gap-4">
          <div className="grid gap-2">
            <h1 className="font-[var(--font-ti-display)] text-4xl tracking-tight">Admin</h1>
            <p className="text-sm text-muted">Protected admin access for managing products and orders.</p>
          </div>
          <Link href="/" className="text-sm font-medium hover:underline">
            Back to storefront
          </Link>
        </div>

        {!isAdmin ? (
          <Card className="p-8">
            <AdminLoginClient />
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="p-6 grid gap-2 md:col-span-2 border-ti-orange/40">
              <div className="font-[var(--font-ti-display)] text-xl tracking-tight">Agent OS</div>
              <div className="text-sm text-muted">
                Your AI team: approve agent actions, manage agents and workflows, and see everything they did.
              </div>
              <Link href="/admin/agents" className="text-sm font-medium underline">
                Open Agent OS
              </Link>
            </Card>
            <Card className="p-6 grid gap-2">
              <div className="font-[var(--font-ti-display)] text-xl tracking-tight">Products</div>
              <div className="text-sm text-muted">Create and update products and variants.</div>
              <Link href="/admin/products" className="text-sm font-medium underline">
                Manage products
              </Link>
            </Card>
            <Card className="p-6 grid gap-2">
              <div className="font-[var(--font-ti-display)] text-xl tracking-tight">Orders</div>
              <div className="text-sm text-muted">View and update order status and tracking events.</div>
              <Link href="/admin/orders" className="text-sm font-medium underline">
                Manage orders
              </Link>
            </Card>
          </div>
        )}
      </div>
    </AppShell>
  );
}
