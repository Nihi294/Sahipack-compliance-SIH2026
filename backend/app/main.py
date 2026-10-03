from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.auth import router as auth_router
from app.api.dashboard import router as dashboard_router
from app.api.products import router as products_router
from app.api.scans import router as scans_router
from app.api.inspections import router as inspections_router


app = FastAPI(
    title="SahiPack Backend",
    version="0.1.0",
)


# ============================================================
# CORS
# ============================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# API ROUTES
# ============================================================

app.include_router(
    auth_router,
    prefix="/auth",
    tags=["auth"],
)

app.include_router(
    scans_router,
    prefix="/scan",
    tags=["scans"],
)

app.include_router(
    products_router,
    prefix="/products",
    tags=["products"],
)

app.include_router(
    dashboard_router,
    prefix="/dashboard",
    tags=["dashboard"],
)

app.include_router(
    inspections_router,
    prefix="/api",
    tags=["inspections"],
)


# ============================================================
# HEALTH CHECK
# ============================================================

@app.get("/health")
def health() -> dict[str, str]:
    return {
        "status": "ok",
        "service": "SahiPack Backend",
    }