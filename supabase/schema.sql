-- Toying Idea — Supabase schema (replaces Mongo + Shopify)
-- Run in Supabase SQL editor, then set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY on Vercel.

create extension if not exists pgcrypto;

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  sku text,
  tagline text default '',
  description text default '',
  short_description text default '',
  price numeric not null default 0,
  compare_at_price numeric,
  currency text not null default 'INR',
  category text default 'toys',
  categories text[] default '{}',
  collection_name text default '',
  tags text[] default '{}',
  badges text[] default '{}',
  images text[] default '{}',
  thumbnail text default '',
  material text default 'PLA',
  finishes text[] default '{}',
  colors text[] default '{}',
  variants jsonb default '[]',
  pricing_mode text default 'variant',
  stock int not null default 10,
  low_stock_threshold int not null default 5,
  in_stock boolean not null default true,
  featured boolean not null default false,
  featured_rank int,
  rating numeric default 5,
  review_count int default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  order_number text unique not null,
  customer jsonb not null,
  shipping_address jsonb default '{}',
  items jsonb not null default '[]',
  subtotal numeric not null default 0,
  shipping numeric not null default 0,
  total numeric not null default 0,
  currency text not null default 'INR',
  status text not null default 'pending',
  payment_status text not null default 'unpaid',
  payment_method text not null default 'cod',
  tracking jsonb default '{}',
  status_history jsonb default '[]',
  notes text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists inquiries (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  name text not null,
  email text not null,
  phone text default '',
  message text default '',
  pyot jsonb,
  gifting jsonb,
  contact jsonb,
  details jsonb default '{}',
  quote jsonb,
  status text not null default 'new',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists reviews (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  author_name text not null,
  rating int not null,
  title text default '',
  body text not null,
  status text not null default 'approved',
  created_at timestamptz not null default now()
);

create table if not exists inventory_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid,
  slug text,
  sku text,
  delta int not null,
  stock_after int not null,
  reason text not null,
  order_number text,
  note text default '',
  actor text default 'system',
  created_at timestamptz not null default now()
);

create table if not exists drafts (
  id uuid primary key default gen_random_uuid(),
  agent text not null,
  status text not null default 'pending',
  title text default '',
  payload jsonb not null default '{}',
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists print_jobs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id) on delete cascade,
  order_number text not null,
  sku text default '',
  qty int not null default 1,
  status text not null default 'queued',
  printer text default '',
  due_at timestamptz,
  notes text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists website_tickets (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  brief text not null,
  files text default '',
  acceptance text default '',
  priority text not null default 'normal',
  status text not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists counters (
  key text primary key,
  seq int not null default 0
);

create index if not exists products_active_idx on products (active, created_at desc);
create index if not exists orders_status_idx on orders (status, created_at desc);
create index if not exists inquiries_status_idx on inquiries (type, status, created_at desc);
create index if not exists drafts_status_idx on drafts (status, created_at desc);
create index if not exists print_jobs_status_idx on print_jobs (status, due_at);

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

drop policy if exists "Public read product-images" on storage.objects;
create policy "Public read product-images"
on storage.objects for select
to public
using (bucket_id = 'product-images');

alter table products enable row level security;
alter table orders enable row level security;
alter table inquiries enable row level security;
alter table reviews enable row level security;
alter table inventory_movements enable row level security;
alter table drafts enable row level security;
alter table print_jobs enable row level security;
alter table website_tickets enable row level security;
alter table counters enable row level security;

-- Seed catalog so admin and shop show real rows immediately after apply.
insert into products (
  slug, name, sku, tagline, description, short_description, price, currency,
  category, categories, collection_name, tags, badges, images, thumbnail,
  material, variants, pricing_mode, stock, in_stock, featured, featured_rank, active
) values
(
  'aura-rocket',
  'Aura Rocket',
  'TI_AURA_ROCKET',
  'A desk-size collectible with a launch-ready silhouette.',
  'Printed in PLA as a small-batch collectible. Designed to sit on a shelf, not disappear into a toy bin. Custom colours on request.',
  'Collectible PLA rocket for desks and shelves.',
  899, 'INR', 'collectibles', array['collectibles','character-figures'],
  'character-figures', array['rocket','desk'], array['Collector','New'],
  array[]::text[], '',
  'PLA',
  '[{"id":"v-small","label":"PLA / Matte / Small","material":"PLA","finish":"Matte","size":"Small","inStock":true,"price":{"currency":"INR","amount":899}}]'::jsonb,
  'variant', 12, true, true, 1, true
),
(
  'nova-bear',
  'Nova Bear',
  'TI_NOVA_BEAR',
  'A squat guardian figure with a soft, collectible face.',
  'A compact PLA figure made to be held and displayed. Part of the Toying Idea collectible line — uniqueness over mass production.',
  'Compact PLA guardian figure.',
  749, 'INR', 'collectibles', array['collectibles','character-figures'],
  'character-figures', array['bear','figure'], array['Collector'],
  array[]::text[], '',
  'PLA',
  '[{"id":"v-small","label":"PLA / Matte / Small","material":"PLA","finish":"Matte","size":"Small","inStock":true,"price":{"currency":"INR","amount":749}}]'::jsonb,
  'variant', 18, true, true, 2, true
),
(
  'orbit-dino',
  'Orbit Dino',
  'TI_ORBIT_DINO',
  'A pocket dinosaur with display-first proportions.',
  'Printed in biodegradable PLA. Articulated enough to pose, sturdy enough to keep. Built to collect.',
  'Poseable PLA dinosaur collectible.',
  649, 'INR', 'collectibles', array['collectibles','character-figures'],
  'character-figures', array['dino','kids'], array['New'],
  array[]::text[], '',
  'PLA',
  '[{"id":"v-small","label":"PLA / Matte / Small","material":"PLA","finish":"Matte","size":"Small","inStock":true,"price":{"currency":"INR","amount":649}}]'::jsonb,
  'variant', 20, true, false, null, true
),
(
  'hearth-keychain',
  'Hearth Keychain',
  'TI_HEARTH_KEY',
  'A small charm for bags, keys, and gifting.',
  'Everyday PLA charm. Pair it with a custom colour for gifting — we print to order in Patiala.',
  'Small PLA charm for gifting.',
  249, 'INR', 'keychains', array['keychains-charms'],
  'keychains-charms', array['keychain','gift'], array['New'],
  array[]::text[], '',
  'PLA',
  '[{"id":"v-one","label":"PLA / Gloss / Mini","material":"PLA","finish":"Gloss","size":"Small","inStock":true,"price":{"currency":"INR","amount":249}}]'::jsonb,
  'variant', 40, true, false, null, true
)
on conflict (slug) do nothing;
