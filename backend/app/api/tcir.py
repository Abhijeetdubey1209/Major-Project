from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response

from app.services.intensity_service import intensity_service
from app.services.tcir_service import tcir_service

router = APIRouter(prefix="/tcir", tags=["tcir"])


@router.get("/overview")
def overview():
    return tcir_service.overview()


@router.get("/samples")
def list_samples(
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=200),
    dataset: str | None = None,
    cyclone_id: str | None = None,
):
    items, total = tcir_service.list_samples(page, limit, dataset, cyclone_id)
    return {"items": items, "total": total, "page": page, "limit": limit}


@router.get("/sample/{index}")
def get_sample(index: int):
    try:
        return tcir_service.get_sample_metadata(index)
    except IndexError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/model")
def model_metadata():
    return intensity_service.metadata()


@router.post("/sample/{index}/predict")
def predict_sample(index: int):
    try:
        return intensity_service.predict(index)
    except IndexError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/sample/{index}/image")
def get_sample_image(index: int, channel: int = Query(0, ge=0, le=3)):
    try:
        png_bytes = tcir_service.render_channel_png(index, channel)
    except IndexError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    return Response(content=png_bytes, media_type="image/png")
