# TOYING IDEA — 3D Storefront + Admin

A full-stack site for **TOYING IDEA**, a premium 3D-printed toy & collectibles brand:

- A scroll-driven **3D landing experience** (React Three Fiber) telling the brand story.
- A complete **storefront** — shop, product pages, cart, checkout, order tracking, PYOT, about, careers, contact.
- A backend on **Vercel serverless** + **Shopify** (catalog/checkout) + **MongoDB** (inquiries/reviews).
- An **admin panel** at `/admin` for orders, Shopify catalog view, and inquiries.

---

## Tech stack

- **React 19 + TypeScript + Vite**, **React Router**
- **three.js / @react-three/fiber / drei / postprocessing** — the 3D home
- **Tailwind CSS** — UI
- **Shopify Storefront API** — product catalog + checkout
- **Vercel serverless** (`/api/*`) + **Mongoose** — inquiries, reviews, admin auth
- **JWT** — single-admin auth

---

## Quick start

```bash
npm install
cp .env.example .env              # then fill in real values (Shopify + Mongo)

# Frontend only (still needs VITE_SHOPIFY_* for the shop):
npm run dev                        # http://localhost:5173

# Full stack (frontend + /api serverless functions):
npm run dev:full                   # runs `vercel dev` (requires the Vercel CLI)
```

> The product catalog is **Shopify-only**. There is no Mongo/sample product fallback.

### Environment variables (`.env`)

| Var | Purpose |
| --- | --- |
| `VITE_SHOPIFY_STORE_DOMAIN` | Shopify store domain |
| `VITE_SHOPIFY_STOREFRONT_TOKEN` | Storefront API token (catalog + cart) |
| `SHOPIFY_ADMIN_TOKEN` / client creds | Order tracking + admin product counts |
| `MONGODB_URI` | MongoDB for inquiries / reviews / admin |
| `MONGODB_DB` | Database name (default: `toying_idea`) |
| `JWT_SECRET` | secret for signing admin tokens |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | the single admin login |
| `VITE_API_BASE` | leave empty to use same-origin `/api` |

### Initialize MongoDB (non-catalog)

```bash
npm run init:db
```

Creates indexes for orders, inquiries, and reviews. Manage products in **Shopify Admin**.
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
  lib/                        # api client, Shopify storefront helpers, types
  pages/                      # storefront pages
    admin/                    # admin panel (Shopify catalog is read-only)
  App.tsx                    # routes (lazy-loaded; 3D stays in its own chunk)
```

### Routes

Storefront: `/` (3D), `/shop`, `/product/:slug`, `/cart`, `/checkout`,
`/order-confirmed`, `/track`, `/pyot`, `/about`, `/careers`, `/contact`.

Admin: `/admin/login`, `/admin` (dashboard), `/admin/orders`, `/admin/products`, `/admin/inquiries`.

---

## API reference

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| Storefront catalog | Shopify Storefront API | – | Products / collections / cart (client-side) |
| `POST` | `/api/orders` | – | Legacy — storefront checkout uses Shopify |
| `GET` | `/api/orders` | admin | List orders (filters: `status, q`) |
| `GET` | `/api/orders/:idOrNumber?email=` | email/admin | Track / read one |
| `PUT/PATCH` | `/api/orders/:id` | admin | Update status / payment / notes |
| `POST` | `/api/inquiries` | – | Create PYOT / contact inquiry |
| `GET` | `/api/inquiries` | admin | List inquiries |
| `PATCH/DELETE` | `/api/inquiries/:id` | admin | Update status / delete |
| `POST` | `/api/auth/login` | – | Admin login → JWT |
| `GET` | `/api/auth/me` | admin | Verify token |
| `GET` | `/api/admin/stats` | admin | Dashboard metrics |

---

## Data models

Clean schemas live in `api/_lib/models` for inquiries, reviews, and legacy orders.
**Product catalog is Shopify** — manage products, inventory, and checkout there.

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
