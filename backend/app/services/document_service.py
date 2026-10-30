import os
import re
import io
import uuid
import logging
from pathlib import Path
from typing import Tuple, List, Optional, Dict, Any
from fastapi import HTTPException, status
import pypdf

from app.core.config import get_settings
from app.db.repository import ConversationRepository
from app.schemas.document import DocumentUploadResponse, DocumentItemResponse

logger = logging.getLogger(__name__)


class DocumentService:
    """
    Handles secure validation, filesystem storage, text extraction,
    semantic chunking, and grounded context retrieval for AI document analysis.
    """

    def __init__(self):
        settings = get_settings()
        self.upload_dir = Path(__file__).resolve().parent.parent.parent / settings.UPLOAD_DIR
        self.upload_dir.mkdir(parents=True, exist_ok=True)
        self.max_size_bytes = settings.MAX_UPLOAD_SIZE_BYTES
        self.allowed_extensions = settings.allowed_document_extensions_list

    def sanitize_filename(self, filename: str) -> str:
        """Prevent path traversal and sanitize filename."""
        raw_name = Path(filename).name
        # Remove null bytes, traversal symbols, and special characters
        clean_name = re.sub(r'[^\w\-_\. ]', '_', raw_name).strip()
        if not clean_name:
            clean_name = f"document_{uuid.uuid4().hex[:8]}"
        return clean_name

    def detect_file_type(self, filename: str) -> str:
        """Determine normalized file type based on file extension."""
        ext = Path(filename).suffix.lower()
        if ext == ".pdf":
            return "pdf"
        elif ext in (".md", ".markdown"):
            return "markdown"
        elif ext == ".txt":
            return "txt"
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported file format '{ext}'. Allowed formats: PDF (.pdf), Plain Text (.txt), and Markdown (.md).",
            )

    def extract_text_from_pdf(self, file_bytes: bytes) -> str:
        """Extract text from PDF using pypdf with corruption and empty page handling."""
        try:
            reader = pypdf.PdfReader(io.BytesIO(file_bytes))
        except Exception as e:
            logger.error("PDF read error: %s", e)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Corrupted or unreadable PDF document. Please ensure the file is a valid PDF.",
            )

        if len(reader.pages) == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="The uploaded PDF contains no pages.",
            )

        extracted_pages = []
        for idx, page in enumerate(reader.pages):
            try:
                page_text = page.extract_text() or ""
                if page_text.strip():
                    extracted_pages.append(f"--- Page {idx + 1} ---\n{page_text.strip()}")
            except Exception as page_err:
                logger.warning("Error reading page %d: %s", idx + 1, page_err)

        full_text = "\n\n".join(extracted_pages).strip()
        if not full_text:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No readable text content found in the PDF. Scanned images without OCR are not supported.",
            )
        return full_text

    def extract_text_from_text(self, file_bytes: bytes) -> str:
        """Extract text from TXT or Markdown with encoding fallbacks."""
        for enc in ("utf-8", "utf-8-sig", "latin-1", "cp1252"):
            try:
                decoded = file_bytes.decode(enc)
                cleaned = decoded.replace("\x00", "").strip()
                if cleaned:
                    return cleaned
            except (UnicodeDecodeError, AttributeError):
                continue

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unable to decode text document. Please verify the document contains valid UTF-8 text.",
        )

    def chunk_text(self, text: str, chunk_size: int = 2500, overlap: int = 250) -> List[str]:
        """
        Split text into overlapping semantic chunks (by paragraph or sentence)
        to prevent splitting thoughts across token boundaries.
        """
        if len(text) <= chunk_size:
            return [text]

        paragraphs = text.split("\n\n")
        chunks = []
        current_chunk: List[str] = []
        current_len = 0

        for para in paragraphs:
            para = para.strip()
            if not para:
                continue

            if current_len + len(para) + 2 > chunk_size and current_chunk:
                joined = "\n\n".join(current_chunk)
                chunks.append(joined)
                # Apply overlap by keeping last paragraph if small enough
                if len(current_chunk[-1]) < overlap:
                    current_chunk = [current_chunk[-1], para]
                    current_len = len(current_chunk[0]) + len(para) + 2
                else:
                    current_chunk = [para]
                    current_len = len(para)
            else:
                current_chunk.append(para)
                current_len += len(para) + 2

        if current_chunk:
            chunks.append("\n\n".join(current_chunk))

        return chunks if chunks else [text]

    async def process_and_store_document(
        self,
        file_bytes: bytes,
        filename: str,
        content_type: Optional[str] = None,
        conversation_id: Optional[str] = None,
    ) -> DocumentUploadResponse:
        """
        Validates, extracts text, chunks, stores file securely on disk outside webroot,
        and saves metadata into SQLite.
        """
        # 1. File size check
        file_size = len(file_bytes)
        if file_size == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Uploaded file is empty (0 bytes).",
            )
        if file_size > self.max_size_bytes:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"Uploaded file ({file_size / (1024*1024):.1f}MB) exceeds the maximum allowed limit of {self.max_size_bytes / (1024*1024):.0f}MB.",
            )

        # 2. Sanitize filename and validate extension
        safe_filename = self.sanitize_filename(filename)
        file_type = self.detect_file_type(safe_filename)

        # 3. Extract text
        if file_type == "pdf":
            extracted_text = self.extract_text_from_pdf(file_bytes)
        else:
            extracted_text = self.extract_text_from_text(file_bytes)

        if not extracted_text.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="The document contains no readable text content.",
            )

        # 4. Generate unique document ID and secure storage path
        doc_id = f"doc-{uuid.uuid4().hex[:12]}"
        safe_ext = Path(safe_filename).suffix.lower()
        secure_filename = f"{doc_id}_{safe_filename}"
        storage_path = str(self.upload_dir / secure_filename)

        # Write file securely to disk
        try:
            with open(storage_path, "wb") as f:
                f.write(file_bytes)
        except Exception as write_err:
            logger.error("Failed to write document to disk: %s", write_err)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to store document on server.",
            )

        # 5. Chunk text
        chunks = self.chunk_text(extracted_text)
        char_count = len(extracted_text)
        chunk_count = len(chunks)

        # 6. Save document record in SQLite
        doc_record = await ConversationRepository.a_add_document(
            doc_id=doc_id,
            filename=safe_filename,
            file_type=file_type,
            file_size=file_size,
            storage_path=storage_path,
            extracted_text=extracted_text,
            char_count=char_count,
            chunk_count=chunk_count,
            conv_id=conversation_id,
        )

        return DocumentUploadResponse(
            id=doc_record["id"],
            conversation_id=doc_record.get("conversation_id"),
            filename=doc_record["filename"],
            file_type=doc_record["file_type"],
            file_size=doc_record["file_size"],
            char_count=doc_record["char_count"],
            chunk_count=doc_record["chunk_count"],
            created_at=doc_record["created_at"],
        )

    async def get_document_context(
        self,
        doc_id: str,
        user_query: str,
        max_context_chars: int = 7000,
    ) -> Tuple[str, str]:
        """
        Retrieves grounded context for a document. For large documents, selects
        relevant chunks (or summary-sampling) to fit within token limits.
        Returns: (document_name, selected_context_text)
        """
        doc = await ConversationRepository.a_get_document(doc_id)
        if not doc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Attached document '{doc_id}' was not found.",
            )

        doc_name = doc["filename"]
        full_text = doc["extracted_text"]

        # If document is compact enough, return full text directly
        if len(full_text) <= max_context_chars:
            return doc_name, full_text

        chunks = self.chunk_text(full_text, chunk_size=2000, overlap=200)
        query_lower = user_query.lower()

        # Check if query is asking for summary or general overview
        is_summary_query = any(k in query_lower for k in ["summarize", "summary", "overview", "key points", "main points", "important points", "study questions"])

        if is_summary_query:
            # Sample evenly across document chunks
            step = max(1, len(chunks) // 3)
            sampled = chunks[::step][:3]
            context = "\n\n[... Document Section ...]\n\n".join(sampled)
            return doc_name, context[:max_context_chars]

        # Targeted query: score chunks by query keyword overlap
        query_terms = set(re.findall(r'\w{3,}', query_lower))
        scored_chunks = []
        for idx, chunk in enumerate(chunks):
            chunk_lower = chunk.lower()
            score = sum(chunk_lower.count(term) for term in query_terms)
            scored_chunks.append((score, idx, chunk))

        # Sort by relevance score descending
        scored_chunks.sort(key=lambda x: x[0], reverse=True)
        top_chunks = scored_chunks[:3]
        # Re-sort chronologically by document order
        top_chunks.sort(key=lambda x: x[1])

        joined_context = "\n\n[...]\n\n".join(c[2] for c in top_chunks)
        return doc_name, joined_context[:max_context_chars]

    def build_grounded_prompt(self, user_query: str, doc_name: str, context: str) -> str:
        """
        Builds a strictly grounded prompt ensuring the model does not invent information
        outside the uploaded document context.
        """
        return f"""You are analyzing the uploaded document: "{doc_name}".

=== DOCUMENT CONTEXT ===
{context}
=== END DOCUMENT CONTEXT ===

CRITICAL INSTRUCTIONS:
1. Answer the user's request thoroughly and accurately using ONLY the information provided in the document context above.
2. If the user asks a question whose answer is NOT present in the provided document, explicitly reply: "Based on the provided document, this information is not mentioned." Never hallucinate or invent facts.
3. Cite specific headings, numbers, or sections from the document when relevant.

User Request: {user_query}"""

    async def delete_document(self, doc_id: str) -> bool:
        """Deletes document record from SQLite and cleans up the stored file from disk."""
        storage_path = await ConversationRepository.a_delete_document(doc_id)
        if not storage_path:
            return False

        try:
            p = Path(storage_path)
            if p.exists() and p.is_file():
                p.unlink()
                logger.info("Deleted document file from disk: %s", storage_path)
        except Exception as e:
            logger.warning("Failed to delete physical file '%s': %s", storage_path, e)

        return True


_doc_service: Optional[DocumentService] = None


def get_document_service() -> DocumentService:
    global _doc_service
    if _doc_service is None:
        _doc_service = DocumentService()
    return _doc_service

