import logging
from typing import Optional
from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException, status
from app.schemas.document import (
    DocumentUploadResponse,
    DocumentItemResponse,
    DocumentListResponse,
)
from app.services.document_service import DocumentService, get_document_service
from app.db.repository import ConversationRepository

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post(
    "/upload",
    response_model=DocumentUploadResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload and Process Document",
    description="Uploads a PDF, TXT, or Markdown document, extracts readable text, chunks it, and associates it with a conversation.",
)
async def upload_document(
    file: UploadFile = File(...),
    conversation_id: Optional[str] = Form(None),
    doc_service: DocumentService = Depends(get_document_service),
) -> DocumentUploadResponse:
    """Validate, parse, extract text, and store uploaded document securely."""
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Filename must not be empty.",
        )

    try:
        file_bytes = await file.read()
    except Exception as read_err:
        logger.error("Error reading uploaded file: %s", read_err)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not read uploaded file content.",
        )

    return await doc_service.process_and_store_document(
        file_bytes=file_bytes,
        filename=file.filename,
        content_type=file.content_type,
        conversation_id=conversation_id,
    )


@router.get(
    "/{document_id}",
    response_model=DocumentItemResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Document Details",
    description="Retrieves metadata of an uploaded document without exposing local filesystem paths.",
)
async def get_document_details(
    document_id: str,
) -> DocumentItemResponse:
    """Retrieve document metadata by ID."""
    doc = await ConversationRepository.a_get_document(document_id)
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document '{document_id}' was not found.",
        )

    return DocumentItemResponse(
        id=doc["id"],
        conversation_id=doc.get("conversation_id"),
        filename=doc["filename"],
        file_type=doc["file_type"],
        file_size=doc["file_size"],
        char_count=doc["char_count"],
        chunk_count=doc["chunk_count"],
        created_at=doc["created_at"],
    )


@router.get(
    "",
    response_model=DocumentListResponse,
    status_code=status.HTTP_200_OK,
    summary="List Uploaded Documents",
    description="Lists documents, optionally filtered by conversation_id.",
)
async def list_documents(
    conversation_id: Optional[str] = None,
    limit: int = 50,
) -> DocumentListResponse:
    """List documents for a conversation or recent uploads."""
    docs = await ConversationRepository.a_list_documents(conv_id=conversation_id, limit=limit)
    items = [
        DocumentItemResponse(
            id=d["id"],
            conversation_id=d.get("conversation_id"),
            filename=d["filename"],
            file_type=d["file_type"],
            file_size=d["file_size"],
            char_count=d["char_count"],
            chunk_count=d["chunk_count"],
            created_at=d["created_at"],
        )
        for d in docs
    ]
    return DocumentListResponse(documents=items)


@router.delete(
    "/{document_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete Document",
    description="Removes document from persistent database and cleans up stored file on disk.",
)
async def delete_document(
    document_id: str,
    doc_service: DocumentService = Depends(get_document_service),
):
    """Delete document and remove file from disk."""
    success = await doc_service.delete_document(document_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document '{document_id}' was not found.",
        )
    return None
