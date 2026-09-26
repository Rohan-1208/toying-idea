import Link from "next/link";
import { Suspense } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { AgentOSClient } from "@/app/admin/agents/AgentOSClient";

export const metadata = { title: "Agent OS · Toying Idea Admin" };

async function apiUrl(pathname: string): Promise<string> {
  const h = await headers();
  const host = h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  const base = host ? `${proto}://${host}` : "http://localhost:3000";
  return new URL(pathname, base).toString();
}

export default async function AgentOSPage() {
  const jar = await cookies();
  const res = await fetch(await apiUrl("/api/auth/me"), { cache: "no-store", headers: { cookie: jar.toString() } });
  const me = res.ok ? ((await res.json()) as { is_admin?: boolean }) : null;
  if (!me?.is_admin) redirect("/admin");

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-7xl px-5 py-8 grid gap-4">
        <Link href="/admin" className="text-xs font-medium text-muted hover:text-ti-cocoa w-fit">
          ← Admin
        </Link>
        <Suspense fallback={<div className="text-sm text-muted">Loading Agent OS…</div>}>
          <AgentOSClient />
        </Suspense>
      </div>
    </AppShell>
  );
}
