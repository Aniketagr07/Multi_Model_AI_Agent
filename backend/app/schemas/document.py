from pydantic import BaseModel, Field
from typing import Optional, List


class DocumentUploadResponse(BaseModel):
    """Metadata response returned when a document is uploaded and processed."""
    id: str = Field(..., description="Unique document identifier")
    conversation_id: Optional[str] = Field(None, description="Associated conversation ID if provided")
    filename: str = Field(..., description="Sanitized original document name")
    file_type: str = Field(..., description="Normalized document type ('pdf', 'txt', 'markdown')")
    file_size: int = Field(..., description="File size in bytes")
    char_count: int = Field(..., description="Total extracted text characters")
    chunk_count: int = Field(..., description="Number of chunks generated for context retrieval")
    created_at: str = Field(..., description="ISO 8601 creation timestamp")


class DocumentItemResponse(BaseModel):
    """Document metadata item for list views."""
    id: str
    conversation_id: Optional[str] = None
    filename: str
    file_type: str
    file_size: int
    char_count: int
    chunk_count: int
    created_at: str


class DocumentListResponse(BaseModel):
    """List of documents response."""
    documents: List[DocumentItemResponse]
