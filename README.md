# TOYING IDEA — 3D Storefront + Admin

A full-stack site for **TOYING IDEA**, a premium 3D-printed toy & collectibles brand:

- A scroll-driven **3D landing experience** (React Three Fiber) telling the brand story.
- A complete **storefront** — shop, product pages, cart, **COD checkout**, order tracking, PYOT, about, careers, contact.
- A backend on **Vercel serverless** + **Supabase** (catalog, orders, inquiries, drafts, print jobs, images).
- An **admin Studio** at `/admin` — dashboard, catalog photographer, floor queue, inbox, marketing, website tickets, approvals.

---

## Tech stack

- **React 19 + TypeScript + Vite**, **React Router**
- **three.js / @react-three/fiber / drei / postprocessing** — the 3D home
- **Tailwind CSS** — UI
- **Supabase** — Postgres + Storage (`product-images`)
- **Vercel serverless** (`/api/*`)
- **JWT** — single-admin auth
- Checkout is **cash on delivery** only

---

## Quick start

```bash
npm install
cp .env.example .env              # SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY + admin JWT

# Frontend only (shop still needs /api, so use full stack for catalog):
npm run dev                        # http://localhost:5173

# Full stack (frontend + /api serverless functions):
npm run dev:full                   # runs `vercel dev` (requires the Vercel CLI)
```

Apply `supabase/schema.sql` once in the Supabase SQL editor. That creates tables, a public storage bucket, and seed products (Aura Rocket, Nova Bear, Orbit Dino, Hearth Keychain).

### Environment variables (`.env`)

| Var | Purpose |
| --- | --- |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side key (Vercel / API only — never expose to the browser) |
| `JWT_SECRET` | secret for signing admin tokens |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | the single admin login |
| `VITE_API_BASE` | leave empty to use same-origin `/api` |
| `OPENAI_API_KEY` | optional — catalog/marketing/inbox copy and extra stills |
| `RESEND_API_KEY` | optional — order emails |

If you connected the Supabase project to this GitHub repo in Vercel, `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` should already be on the Vercel project. You still need to run `supabase/schema.sql` once.

---

## Project structure

```
api/                         # Vercel serverless functions
  _lib/                      # supabase client, mapping, COD orders, auth
  studio/                    # catalog, drafts, floor, inbox, marketing, website
  products.ts  orders.ts  inquiries/  reviews.ts  track.ts
src/
  pages/admin/               # Studio: dashboard, catalog, floor, inbox, …
  lib/api.ts                 # storefront + admin client (Supabase via /api)
supabase/schema.sql          # tables, storage, seed catalog
```

### Routes

Storefront: `/` (3D), `/shop`, `/product/:slug`, `/cart`, `/checkout`,
`/order-confirmed`, `/track`, `/pyot`, `/about`, `/careers`, `/contact`.

Admin: `/admin/login`, `/admin` (dashboard), `/admin/catalog`, `/admin/floor`,
`/admin/inquiries`, `/admin/marketing`, `/admin/website`, `/admin/approvals`,
`/admin/orders`, `/admin/products`.

Studio agents always write a **draft**. Approve in `/admin/approvals` before a listing goes live or a reply is sent. Marketing packs and website tickets do not auto-post or auto-commit.

---

## Deploying to Vercel

1. Push to `main` (this repo). Vercel auto-detects **Vite**.
2. Confirm env vars: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`.
3. Run `supabase/schema.sql` in the Supabase SQL editor if tables are not there yet.
4. `vercel.json` rewrites all non-`/api` routes to `index.html` for the SPA.

---

## The 3D home

Five scroll chapters driven by a single camera path:
`Start (0%) → Transition (25%) → 3D Printing Workshop (50%) → Collection Gallery (75%) → Infinite Universe (100%)`.
All geometry is procedural (no external models/HDR). Tuning knobs:

- Camera path — `src/three/CameraRig.tsx` (`KEYS`)
- Chapter timing — `src/three/scroll.ts` (`STOPS`) + `Stage` windows in `Experience.tsx`
- Colors — `src/three/palette.ts` + `tailwind.config.js`
