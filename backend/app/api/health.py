from fastapi import APIRouter

from app.config import locate_all_datasets

router = APIRouter()


@router.get("/health")
def health():
    found = locate_all_datasets()
    return {
        "status": "ok",
        "datasets": {key: path is not None for key, path in found.items()},
    }
