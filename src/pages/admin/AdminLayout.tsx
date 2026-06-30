import { NavLink, Outlet, Navigate, Link } from "react-router-dom";
import { useAdminAuth } from "../../context/AdminAuth";
import { Spinner } from "../../components/ui";

const NAV = [
  { to: "/admin", label: "Dashboard", end: true },
  { to: "/admin/orders", label: "Orders" },
  { to: "/admin/products", label: "Products" },
  { to: "/admin/inquiries", label: "Inquiries" },
];

export default function AdminLayout() {
  const { admin, loading, logout } = useAdminAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  if (!admin) {
    return <Navigate to="/admin/login" replace />;
  }

  return (
    <div className="flex min-h-screen bg-cream-100">
      {/* Sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-ink/10 bg-cream px-4 py-6 md:flex">
        <Link to="/" className="mb-8 flex items-center gap-2 px-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-ink text-cream-50">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M12 2 3 7v10l9 5 9-5V7l-9-5Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
            </svg>
          </span>
          <span className="font-display text-base font-bold text-ink">
            TOYING<span className="text-clay"> IDEA</span>
          </span>
        </Link>
        <nav className="flex flex-col gap-1">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                `rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive ? "bg-ink text-cream-50" : "text-ink/60 hover:bg-ink/5"
                }`
              }
            >
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto px-2">
          <p className="truncate text-xs text-ink/40">{admin.email}</p>
          <button onClick={logout} className="mt-2 text-sm font-medium text-clay hover:underline">
            Sign out
          </button>
        </div>
      </aside>

      {/* Mobile top nav */}
      <div className="flex flex-1 flex-col">
        <div className="flex items-center justify-between border-b border-ink/10 bg-cream px-4 py-3 md:hidden">
          <span className="font-display font-bold text-ink">Admin</span>
          <button onClick={logout} className="text-sm font-medium text-clay">Sign out</button>
        </div>
        <div className="flex gap-1 overflow-x-auto border-b border-ink/10 bg-cream px-4 py-2 md:hidden">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                `whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium ${
                  isActive ? "bg-ink text-cream-50" : "text-ink/60"
                }`
              }
            >
              {n.label}
            </NavLink>
          ))}
        </div>

        <main className="flex-1 p-5 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
