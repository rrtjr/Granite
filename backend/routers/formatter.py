from fastapi import APIRouter
from pydantic import BaseModel

from backend.services.formatter_service import format_markdown

router = APIRouter()


class FormatRequest(BaseModel):
    content: str


class FormatResponse(BaseModel):
    content: str


@router.post("/api/format", response_model=FormatResponse)
async def format_content_endpoint(request: FormatRequest):
    formatted = format_markdown(request.content)
    return {"content": formatted}
