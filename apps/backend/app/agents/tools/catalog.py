"""Products, pricing and SKUs (Product Launch agent)."""
from __future__ import annotations

import math
import re
from typing import Any

from ..core.config import get_settings
from ..core.events import emit_event
from ..core.store import INVENTORY, ORDERS, PRODUCTS, clean, days_ago_iso, now_iso, uid
from ..core.tools import ToolContext, ToolError, tool

SLUG_RX = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


def product_view(p: dict, full: bool = False) -> dict:
    prices = [float((v.get("price") or {}).get("amount") or 0) for v in p.get("variants") or []]
    v = {
        "slug": p.get("slug"),
        "name": p.get("name"),
        "tagline": p.get("tagline"),
        "categories": p.get("categories") or [],
        "active": p.get("active", True),
        "draft": bool(p.get("draft")),
        "price_range_inr": [min(prices), max(prices)] if prices else None,
        "variant_count": len(p.get("variants") or []),
    }
    if full:
        v.update(
            description=p.get("description"),
            badges=p.get("badges") or [],
            images=[i.get("url") for i in p.get("images") or []],
            variants=[
                {"id": x.get("id"), "sku": x.get("sku"), "label": x.get("label"), "material": x.get("material"),
                 "finish": x.get("finish"), "size": x.get("size"), "price": (x.get("price") or {}).get("amount"),
                 "in_stock": x.get("inStock", True)}
                for x in p.get("variants") or []
            ],
            launch=p.get("launch"),
        )
    return v


@tool(
    "list_products",
    "Search the catalog. By default returns live products; set include_drafts to see hidden drafts too.",
    {
        "type": "object",
        "properties": {
            "query": {"type": "string"},
            "category": {"type": "string"},
            "include_drafts": {"type": "boolean", "default": False},
            "limit": {"type": "integer", "default": 50},
        },
    },
    label="List products",
)
async def list_products(ctx: ToolContext, query: str | None = None, category: str | None = None,
                        include_drafts: bool = False, limit: int = 50) -> dict:
    q: dict[str, Any] = {} if include_drafts else {"active": True}
    if category:
        q["categories"] = category
    if query:
        rx = {"$regex": re.escape(query), "$options": "i"}
        q["$or"] = [{"name": rx}, {"tagline": rx}, {"description": rx}, {"slug": rx}]
    docs = await ctx.db[PRODUCTS].find(q).limit(min(int(limit or 50), 200)).to_list(200)
    return {"count": len(docs), "products": [product_view(d) for d in docs]}


@tool(
    "get_product",
    "Full details of one product by slug: description, variants with SKUs and prices, images, launch/pricing notes.",
    {"type": "object", "properties": {"slug": {"type": "string"}}, "required": ["slug"]},
    label="Get product",
)
async def get_product(ctx: ToolContext, slug: str) -> dict:
    p = await ctx.db[PRODUCTS].find_one({"slug": slug})
    if not p:
        raise ToolError("Product not found")
    return product_view(p, full=True)


def _round_price(p: float, step: int) -> int:
    step = max(1, int(step or 50))
    if step in (49, 99):
        base = step + 1
        return int(math.ceil((p + 1) / base) * base - 1)
    return int(math.ceil(p / step) * step)


def compute_price(pricing: dict, *, filament_grams: float, print_hours: float, material: str = "PLA",
                  post_processing_minutes: float = 10, extra_costs: float = 0, target_margin_pct: float | None = None,
                  quantity: int = 1) -> dict:
    per_kg = (pricing.get("filament_cost_per_kg") or {}).get(material) or (pricing.get("filament_cost_per_kg") or {}).get("PLA", 1100)
    fail = float(pricing.get("failure_rate") or 0)
    material_cost = filament_grams / 1000 * per_kg * (1 + fail)
    machine_cost = print_hours * float(pricing.get("machine_cost_per_hour") or 0) * (1 + fail)
    labour_cost = post_processing_minutes / 60 * float(pricing.get("labour_cost_per_hour") or 0)
    packaging = float(pricing.get("packaging_cost") or 0)
    unit_cost = material_cost + machine_cost + labour_cost + packaging + float(extra_costs or 0)
    margin = (target_margin_pct if target_margin_pct is not None else pricing.get("default_target_margin_pct", 55)) / 100
    fee = float(pricing.get("platform_fee_pct") or 0) / 100
    if margin + fee >= 0.95:
        raise ToolError("Target margin too high")
    pre_tax = unit_cost / (1 - margin - fee)
    gst = float(pricing.get("gst_pct") or 0) / 100
    incl = pre_tax * (1 + gst)
    rounded = _round_price(incl, int(pricing.get("round_to") or 49))
    effective_pre_tax = rounded / (1 + gst)
    return {
        "material": material,
        "unit_cost_inr": round(unit_cost, 2),
        "cost_breakdown_inr": {
            "filament": round(material_cost, 2), "machine_time": round(machine_cost, 2),
            "labour": round(labour_cost, 2), "packaging": round(packaging, 2), "extra": round(float(extra_costs or 0), 2),
        },
        "suggested_price_inr_incl_gst": rounded,
        "effective_margin_pct": round((effective_pre_tax * (1 - fee) - unit_cost) / effective_pre_tax * 100, 1),
        "quantity": quantity,
        "total_for_quantity_inr": rounded * max(1, int(quantity or 1)),
        "assumptions": {k: pricing.get(k) for k in ("failure_rate", "machine_cost_per_hour", "labour_cost_per_hour", "gst_pct", "platform_fee_pct")},
    }


@tool(
    "calculate_price",
    "Price a 3D-printed item from filament grams and print hours using the owner's cost model. Returns cost breakdown, suggested GST-inclusive price and margin.",
    {
        "type": "object",
        "properties": {
            "filament_grams": {"type": "number"},
            "print_hours": {"type": "number"},
            "material": {"type": "string", "description": "PLA, PETG, TPU, Silk PLA, Resin"},
            "post_processing_minutes": {"type": "number", "default": 10},
            "extra_costs": {"type": "number", "description": "INR: paint, magnets, keychain rings, etc."},
            "target_margin_pct": {"type": "number"},
            "quantity": {"type": "integer", "default": 1},
        },
        "required": ["filament_grams", "print_hours"],
    },
    label="Calculate price",
)
async def calculate_price(ctx: ToolContext, **kw: Any) -> dict:
    s = await get_settings(ctx.db)
    return compute_price(s["pricing"], **kw)


def _slugify(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


@tool(
    "generate_sku",
    "Generate a unique SKU code like TI-DINO-ORBIT-PLA-M for a new variant.",
    {
        "type": "object",
        "properties": {
            "category": {"type": "string"}, "name": {"type": "string"},
            "material": {"type": "string"}, "size": {"type": "string"},
        },
        "required": ["category", "name"],
    },
    label="Generate SKU",
)
async def generate_sku(ctx: ToolContext, category: str, name: str, material: str = "", size: str = "") -> dict:
    parts = ["TI", _slugify(category)[:5].upper(), _slugify(name).replace("-", "")[:8].upper()]
    if material:
        parts.append(_slugify(material).replace("-", "")[:4].upper())
    if size:
        parts.append(_slugify(size)[:3].upper())
    base = "-".join(p for p in parts if p)
    sku, n = base, 1
    while await ctx.db[PRODUCTS].find_one({"variants.sku": sku}):
        n += 1
        sku = f"{base}-{n}"
    return {"sku": sku}


VARIANT_SCHEMA = {
    "type": "object",
    "properties": {
        "id": {"type": "string", "description": "short id, e.g. 'm-teal'"},
        "sku": {"type": "string"},
        "label": {"type": "string"},
        "material": {"type": "string"},
        "finish": {"type": "string"},
        "size": {"type": "string"},
        "price_inr": {"type": "number"},
    },
    "required": ["id", "label", "material", "finish", "size", "price_inr"],
}


def _variants(variants: list[dict]) -> list[dict]:
    out = []
    for v in variants or []:
        out.append({
            "id": _slugify(str(v["id"])) or "default", "sku": v.get("sku"), "label": v["label"], "material": v["material"],
            "finish": v["finish"], "size": v["size"], "inStock": True,
            "price": {"currency": "INR", "amount": float(v["price_inr"])},
        })
    if not out:
        raise ToolError("At least one variant is required")
    return out


@tool(
    "create_draft_product",
    "Create a NEW product as a hidden draft (not visible on the storefront until publish_product is approved).",
    {
        "type": "object",
        "properties": {
            "slug": {"type": "string", "description": "lowercase-with-dashes, unique"},
            "name": {"type": "string"},
            "tagline": {"type": "string"},
            "description": {"type": "string"},
            "categories": {"type": "array", "items": {"type": "string"}},
            "badges": {"type": "array", "items": {"type": "string"}},
            "image_urls": {"type": "array", "items": {"type": "string"}},
            "variants": {"type": "array", "items": VARIANT_SCHEMA},
            "launch_notes": {"type": "object", "description": "pricing assumptions, print settings, target audience"},
        },
        "required": ["slug", "name", "tagline", "description", "categories", "variants"],
    },
    risk="draft",
    label="Create draft product",
)
async def create_draft_product(ctx: ToolContext, slug: str, name: str, tagline: str, description: str,
                               categories: list[str], variants: list[dict], badges: list[str] | None = None,
                               image_urls: list[str] | None = None, launch_notes: dict | None = None) -> dict:
    slug = slug.strip().lower()
    if not SLUG_RX.match(slug):
        raise ToolError("slug must be lowercase letters/numbers separated by dashes")
    if await ctx.db[PRODUCTS].find_one({"slug": slug}):
        raise ToolError("slug already exists")
    doc = {
        "slug": slug, "name": name, "tagline": tagline, "description": description,
        "badges": badges or ["New"], "categories": categories,
        "images": [{"id": f"img-{i+1}", "alt": name, "url": u} for i, u in enumerate(image_urls or [])],
        "variants": _variants(variants), "featuredRank": None, "active": False, "draft": True,
        "launch": {**(launch_notes or {}), "created_by": ctx.agent, "run_id": ctx.run_id, "created_at": now_iso()},
    }
    await ctx.db[PRODUCTS].insert_one(doc)
    return {"slug": slug, "status": "draft", "admin_hint": "Visible in Admin → Products; publish via approval."}


@tool(
    "update_draft_product",
    "Edit a product that is still a hidden draft. Live products cannot be edited by agents.",
    {
        "type": "object",
        "properties": {
            "slug": {"type": "string"}, "name": {"type": "string"}, "tagline": {"type": "string"},
            "description": {"type": "string"}, "categories": {"type": "array", "items": {"type": "string"}},
            "badges": {"type": "array", "items": {"type": "string"}},
            "image_urls": {"type": "array", "items": {"type": "string"}},
            "variants": {"type": "array", "items": VARIANT_SCHEMA},
        },
        "required": ["slug"],
    },
    risk="draft",
    label="Update draft product",
)
async def update_draft_product(ctx: ToolContext, slug: str, **fields: Any) -> dict:
    p = await ctx.db[PRODUCTS].find_one({"slug": slug})
    if not p:
        raise ToolError("Product not found")
    if p.get("active"):
        raise ToolError("Product is live; agents may only edit drafts")
    upd: dict[str, Any] = {k: v for k, v in fields.items() if k in ("name", "tagline", "description", "categories", "badges") and v is not None}
    if fields.get("image_urls") is not None:
        upd["images"] = [{"id": f"img-{i+1}", "alt": p.get("name"), "url": u} for i, u in enumerate(fields["image_urls"])]
    if fields.get("variants") is not None:
        upd["variants"] = _variants(fields["variants"])
    await ctx.db[PRODUCTS].update_one({"_id": p["_id"]}, {"$set": upd})
    return {"slug": slug, "updated": sorted(upd.keys())}


async def _validate_publish(ctx: ToolContext, slug: str, **_: Any) -> None:
    p = await ctx.db[PRODUCTS].find_one({"slug": slug})
    if not p:
        raise ToolError("Product not found")
    if p.get("active"):
        raise ToolError("Product is already live")
    if not p.get("variants"):
        raise ToolError("Product has no variants")


@tool(
    "publish_product",
    "Make a draft product live on the storefront.",
    {"type": "object", "properties": {"slug": {"type": "string"}, "featured_rank": {"type": "integer"}}, "required": ["slug"]},
    risk="action",
    label="Publish product",
    summarize=lambda a: f"Publish '{a.get('slug')}' on the storefront",
    validate=_validate_publish,
)
async def publish_product(ctx: ToolContext, slug: str, featured_rank: int | None = None) -> dict:
    await _validate_publish(ctx, slug)
    upd: dict[str, Any] = {"active": True, "draft": False, "published_at": now_iso()}
    if featured_rank is not None:
        upd["featuredRank"] = featured_rank
    await ctx.db[PRODUCTS].update_one({"slug": slug}, {"$set": upd})
    await emit_event(ctx.db, "product.published", {"slug": slug}, source=ctx.agent)
    return {"slug": slug, "active": True}


async def _validate_price(ctx: ToolContext, slug: str, variant_id: str, price_inr: float, **_: Any) -> None:
    p = await ctx.db[PRODUCTS].find_one({"slug": slug})
    if not p or not any(v.get("id") == variant_id for v in p.get("variants") or []):
        raise ToolError("Product/variant not found")
    if float(price_inr) <= 0:
        raise ToolError("Price must be positive")


@tool(
    "set_variant_price",
    "Change the price of one variant of a product (live or draft).",
    {
        "type": "object",
        "properties": {"slug": {"type": "string"}, "variant_id": {"type": "string"}, "price_inr": {"type": "number"}},
        "required": ["slug", "variant_id", "price_inr"],
    },
    risk="action",
    label="Change price",
    summarize=lambda a: f"Set {a.get('slug')} / {a.get('variant_id')} to ₹{a.get('price_inr')}",
    validate=_validate_price,
)
async def set_variant_price(ctx: ToolContext, slug: str, variant_id: str, price_inr: float) -> dict:
    await _validate_price(ctx, slug, variant_id, price_inr)
    p = await ctx.db[PRODUCTS].find_one({"slug": slug})
    variants = p.get("variants") or []
    old = None
    for v in variants:
        if v.get("id") == variant_id:
            old = (v.get("price") or {}).get("amount")
            v["price"] = {"currency": "INR", "amount": float(price_inr)}
    await ctx.db[PRODUCTS].update_one({"_id": p["_id"]}, {"$set": {"variants": variants}})
    return {"slug": slug, "variant_id": variant_id, "old_price": old, "new_price": float(price_inr)}


# ---------------------------------------------------------------- sales stats (shared)
async def product_sales(db, days: float = 30) -> list[dict]:
    orders = await db[ORDERS].find({"createdAt": {"$gte": days_ago_iso(days)}, "status": {"$ne": "Cancelled"}}).to_list(5000)
    agg: dict[str, dict] = {}
    for o in orders:
        for it in o.get("items") or []:
            slug = it.get("productSlug") or "?"
            a = agg.setdefault(slug, {"slug": slug, "name": it.get("name"), "units": 0, "revenue_inr": 0.0, "orders": 0})
            q = int(it.get("quantity") or 0)
            a["units"] += q
            a["revenue_inr"] += q * float((it.get("unitPrice") or {}).get("amount") or 0)
            a["orders"] += 1
    rows = sorted(agg.values(), key=lambda r: r["revenue_inr"], reverse=True)
    for r in rows:
        r["revenue_inr"] = round(r["revenue_inr"], 2)
    return rows


@tool(
    "best_sellers",
    "Top products by revenue and units over the last N days (excludes cancelled orders).",
    {"type": "object", "properties": {"days": {"type": "number", "default": 30}, "limit": {"type": "integer", "default": 10}}},
    label="Best sellers",
)
async def best_sellers(ctx: ToolContext, days: float = 30, limit: int = 10) -> dict:
    rows = await product_sales(ctx.db, days)
    return {"days": days, "products": rows[: int(limit or 10)]}


@tool(
    "set_inventory_policy",
    "Mark a SKU as made-to-order (no stock tracking) or tracked with a reorder point.",
    {
        "type": "object",
        "properties": {"sku": {"type": "string"}, "made_to_order": {"type": "boolean"}, "reorder_point": {"type": "integer"}},
        "required": ["sku", "made_to_order"],
    },
    risk="draft",
    label="Set inventory policy",
)
async def set_inventory_policy(ctx: ToolContext, sku: str, made_to_order: bool, reorder_point: int | None = None) -> dict:
    if ":" not in sku:
        raise ToolError("SKU must look like <product-slug>:<variant-id>")
    slug, vid = sku.split(":", 1)
    await ctx.db[INVENTORY].update_one(
        {"sku": sku},
        {"$set": {"made_to_order": made_to_order, "reorder_point": reorder_point, "updated_at": now_iso()},
         "$setOnInsert": {"_id": uid("inv"), "sku": sku, "product_slug": slug, "variant_id": vid, "on_hand": 0, "reserved": 0}},
        upsert=True,
    )
    return clean(await ctx.db[INVENTORY].find_one({"sku": sku}))
