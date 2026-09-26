from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os
from .config import settings
from .db import get_db
from .security import hash_password, verify_password
from .routers import auth, products, orders, users, collections, requests, cart, track_order, uploads, checkout, agents
from .agents import service as agent_os


app = FastAPI(title="Toying Idea API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(products.router, prefix="/api")
app.include_router(orders.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(collections.router, prefix="/api")
app.include_router(requests.router, prefix="/api")
app.include_router(cart.router, prefix="/api")
app.include_router(track_order.router, prefix="/api")
app.include_router(uploads.router, prefix="/api")
app.include_router(checkout.router, prefix="/api")
app.include_router(agents.router, prefix="/api")


@app.on_event("startup")
async def start_agent_os():
    await agent_os.startup(get_db)


@app.on_event("shutdown")
async def stop_agent_os():
    await agent_os.shutdown()


@app.on_event("startup")
async def on_startup():
    admin_email = os.getenv("ADMIN_EMAIL") or os.getenv("ADMINN_EMAIL")
    admin_password = os.getenv("ADMIN_PASSWORD")
    if not admin_email or not admin_password:
        return
    try:
        db = await get_db()
    except Exception:
        return
    existing = await db["users"].find_one({"email": admin_email})
    if existing is None:
        await db["users"].insert_one(
            {
                "email": admin_email,
                "name": "Admin",
                "password_hash": hash_password(admin_password),
                "is_admin": True,
            }
        )
        return

    needs_reset = False
    try:
        needs_reset = not verify_password(admin_password, existing.get("password_hash", ""))
    except Exception:
        needs_reset = True

    updates: dict = {"is_admin": True}
    if needs_reset:
        updates["password_hash"] = hash_password(admin_password)
    if updates:
        await db["users"].update_one({"_id": existing["_id"]}, {"$set": updates})


@app.get("/health")
async def health():
    return {"ok": True}


@app.get("/health/db")
async def health_db():
    db = await get_db()
    await db.command("ping")
    return {"ok": True, "db": True, "db_name": settings.db_name}
