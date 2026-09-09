import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import analytics, cyclones, era5, health, predict, tcir
from app.services.era5_service import era5_service
from app.services.tcir_service import tcir_service

load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    era5_service.load()
    tcir_service.load()
    yield
    era5_service.close()
    tcir_service.close()


app = FastAPI(title="Cyclone Intelligence Platform API", lifespan=lifespan)

_default_origins = "http://localhost:5173,http://127.0.0.1:5173"
allowed_origins = [
    origin.strip()
    for origin in os.getenv("FRONTEND_ORIGINS", _default_origins).split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/api")
app.include_router(cyclones.router, prefix="/api")
app.include_router(analytics.router, prefix="/api")
app.include_router(era5.router, prefix="/api")
app.include_router(tcir.router, prefix="/api")
app.include_router(predict.router, prefix="/api")
