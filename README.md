# TOYING IDEA — 3D Storefront + Admin

A full-stack site for **TOYING IDEA**, a premium 3D-printed toy & collectibles brand:

- A scroll-driven **3D landing experience** (React Three Fiber) telling the brand story.
- A complete **storefront** — shop, product pages, cart, checkout, order tracking, PYOT, gifting, collections.
- A backend on **Vercel serverless functions + MongoDB** (Mongoose).
- An **admin panel** at `/admin` to track orders, manage products and review inquiries.

---

## Tech stack

- **React 19 + TypeScript + Vite**, **React Router**
- **three.js / @react-three/fiber / drei / postprocessing** — the 3D home
- **Tailwind CSS** — UI
- **Vercel serverless** (`/api/*`) + **Mongoose** — backend
- **JWT** — single-admin auth

---

## Quick start

```bash
npm install
cp .env.example .env              # then fill in real values

# Frontend only (storefront works on the bundled sample catalog):
npm run dev                        # http://localhost:5173

# Full stack (frontend + /api serverless functions + MongoDB):
npm run dev:full                   # runs `vercel dev` (requires the Vercel CLI)
```

> Without a DB configured, the storefront gracefully falls back to a bundled
> sample catalog (`src/data/products.json`) so it's always browsable. The admin
> panel and order/checkout flows require a real `MONGODB_URI`.

### Environment variables (`.env`)

| Var | Purpose |
| --- | --- |
| `MONGODB_URI` | MongoDB Atlas connection string (new `toying_idea` database) |
| `MONGODB_DB` | Database name (default: `toying_idea`) |
| `JWT_SECRET` | secret for signing admin tokens |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | the single admin login |
| `VITE_API_BASE` | leave empty to use same-origin `/api` |

### Initialize the database

```bash
npm run init:db
```

Creates indexes and seeds the catalog from `src/data/products.json` (safe to re-run).

---

## Project structure

```
api/                         # Vercel serverless functions
  _lib/
    db.ts                    # cached Mongo connection (serverless-safe)
    http.ts                  # CORS + error wrapper + body parsing
    auth.ts                  # JWT sign/verify, admin credential check
    slug.ts
    models/                  # Product, Order, Inquiry (Mongoose)
  auth/login.ts  auth/me.ts
  products/index.ts  products/[id].ts
  orders/index.ts   orders/[id].ts
  inquiries/index.ts inquiries/[id].ts
  admin/stats.ts

src/
  three/                     # the 3D experience (see "3D home" below)
  ui/                        # in-canvas overlay + chrome + loader
  components/                # Navbar, Footer, CartDrawer, ProductCard, ui kit…
  context/                   # CartContext, AdminAuth
  lib/                       # api client, types, formatters
  data/                      # products.json (catalog source + offline fallback)
  pages/                     # storefront pages
    admin/                   # admin panel pages
  App.tsx                    # routes (lazy-loaded; 3D stays in its own chunk)
```

### Routes

Storefront: `/` (3D), `/shop`, `/product/:slug`, `/cart`, `/checkout`,
`/order-confirmed`, `/track`, `/pyot`, `/gifting`, `/collections`, `/about`, `/contact`.

Admin: `/admin/login`, `/admin` (dashboard), `/admin/orders`, `/admin/products`, `/admin/inquiries`.

---

## API reference

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/api/products` | – | List products (filters: `q, category, collection, tag, badge, featured, sort`) |
| `POST` | `/api/products` | admin | Create product |
| `GET` | `/api/products/:idOrSlug` | – | Get one |
| `PUT/PATCH` | `/api/products/:id` | admin | Update |
| `DELETE` | `/api/products/:id` | admin | Delete |
| `POST` | `/api/orders` | – | Create order (totals recomputed server-side) |
| `GET` | `/api/orders` | admin | List orders (filters: `status, q`) |
| `GET` | `/api/orders/:idOrNumber?email=` | email/admin | Track / read one |
| `PUT/PATCH` | `/api/orders/:id` | admin | Update status / payment / notes |
| `POST` | `/api/inquiries` | – | Create PYOT / gifting / contact inquiry |
| `GET` | `/api/inquiries` | admin | List inquiries |
| `PATCH/DELETE` | `/api/inquiries/:id` | admin | Update status / delete |
| `POST` | `/api/auth/login` | – | Admin login → JWT |
| `GET` | `/api/auth/me` | admin | Verify token |
| `GET` | `/api/admin/stats` | admin | Dashboard metrics |

---

## Data models

Clean schemas live in `api/_lib/models`. Collections: `products`, `inventory_movements`, `orders`, `inquiries`.

---

## Deploying to Vercel

1. Push the repo and import it in Vercel (framework auto-detects **Vite**).
2. Add the env vars from `.env.example` in **Project → Settings → Environment Variables**.
3. In Atlas, allow Vercel egress (Network Access → `0.0.0.0/0`, or Vercel's ranges).
4. Deploy. `vercel.json` rewrites all non-`/api` routes to `index.html` for the SPA.

---

## The 3D home

Five scroll chapters driven by a single camera path:
`Start (0%) → Transition (25%) → 3D Printing Workshop (50%) → Collection Gallery (75%) → Infinite Universe (100%)`.
All geometry is procedural (no external models/HDR). Tuning knobs:

- Camera path — `src/three/CameraRig.tsx` (`KEYS`)
- Chapter timing — `src/three/scroll.ts` (`STOPS`) + `Stage` windows in `Experience.tsx`
- Colors — `src/three/palette.ts` + `tailwind.config.js`

---

## Roadmap / follow-ups

- Direct product **image upload** (Cloudinary/S3) — currently image URLs in `/admin`.
- Real **payments** (Razorpay/Stripe) — checkout records COD/manual for now.
- Transactional **emails** (order confirmation / status updates).
- Multi-admin users with roles (currently a single env-configured admin).
