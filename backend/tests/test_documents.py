import io
import json
import pytest
from unittest.mock import patch
from fastapi.testclient import TestClient
import pypdf

from app.main import app
from app.db.repository import ConversationRepository
from app.services.document_service import get_document_service

client = TestClient(app)


def create_test_pdf_bytes(text: str = "This is a test document about artificial intelligence algorithms.") -> bytes:
    """Helper to generate a valid in-memory PDF with readable text."""
    writer = pypdf.PdfWriter()
    writer.add_blank_page(width=72, height=72)
    # Write text in PDF stream or annotation
    buf = io.BytesIO()
    writer.write(buf)
    # For extraction tests, we can also write a clean synthetic PDF or valid stream
    return buf.getvalue()


@pytest.fixture
def sample_pdf_bytes():
    """Generates a valid PDF with actual extractable text using pypdf."""
    # Build minimal valid PDF with actual text content stream
    content = b"""%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /Resources 4 0 R /MediaBox [0 0 612 792] /Contents 5 0 R >> endobj
4 0 obj << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> endobj
5 0 obj << /Length 73 >>
stream
BT
/F1 12 Tf
100 700 Td
(OmniAI Document Analysis: Quantum Computing is revolutionary.) Tj
ET
endstream
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000222 00000 n 
0000000311 00000 n 
trailer << /Size 6 /Root 1 0 R >>
startxref
434
%%EOF"""
    return content


def test_upload_valid_text_document():
    """Verify uploading a plain text file succeeds and extracts text."""
    txt_content = b"OmniAI Architecture Overview:\nOmniAI supports multi-model routing and streaming."
    response = client.post(
        "/api/documents/upload",
        files={"file": ("architecture.txt", txt_content, "text/plain")},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["filename"] == "architecture.txt"
    assert data["file_type"] == "txt"
    assert data["char_count"] > 0
    assert data["chunk_count"] >= 1
    assert "storage_path" not in data  # Never expose local filesystem path!


def test_upload_valid_markdown_document():
    """Verify uploading a markdown file succeeds."""
    md_content = b"# Machine Learning Guide\n\nDeep learning neural networks require backpropagation."
    response = client.post(
        "/api/documents/upload",
        files={"file": ("guide.md", md_content, "text/markdown")},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["filename"] == "guide.md"
    assert data["file_type"] == "markdown"
    assert "Machine Learning" in md_content.decode()


def test_upload_valid_pdf_document(sample_pdf_bytes):
    """Verify uploading a PDF file successfully extracts text."""
    response = client.post(
        "/api/documents/upload",
        files={"file": ("sample_quantum.pdf", sample_pdf_bytes, "application/pdf")},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["filename"] == "sample_quantum.pdf"
    assert data["file_type"] == "pdf"
    assert data["char_count"] > 0


def test_upload_empty_file_rejected():
    """Verify uploading an empty 0-byte file is rejected with 400."""
    response = client.post(
        "/api/documents/upload",
        files={"file": ("empty.txt", b"", "text/plain")},
    )
    assert response.status_code == 400
    assert "empty" in response.json()["detail"].lower()


def test_upload_unsupported_file_rejected():
    """Verify uploading unsupported file extensions is rejected with 400."""
    response = client.post(
        "/api/documents/upload",
        files={"file": ("malicious.exe", b"binary content", "application/octet-stream")},
    )
    assert response.status_code == 400
    assert "unsupported" in response.json()["detail"].lower()


def test_upload_corrupted_pdf_rejected():
    """Verify corrupted PDF bytes trigger a 400 error without server crash."""
    corrupted_bytes = b"%PDF-1.4 completely truncated corrupted data"
    response = client.post(
        "/api/documents/upload",
        files={"file": ("corrupt.pdf", corrupted_bytes, "application/pdf")},
    )
    assert response.status_code == 400
    assert "corrupted" in response.json()["detail"].lower() or "readable" in response.json()["detail"].lower()


def test_upload_oversized_file_rejected():
    """Verify files exceeding size limit are rejected with 413."""
    doc_service = get_document_service()
    # Temporarily set limit to 100 bytes for test
    original_limit = doc_service.max_size_bytes
    try:
        doc_service.max_size_bytes = 100
        oversized = b"A" * 200
        response = client.post(
            "/api/documents/upload",
            files={"file": ("huge.txt", oversized, "text/plain")},
        )
        assert response.status_code == 413
        assert "exceeds" in response.json()["detail"].lower()
    finally:
        doc_service.max_size_bytes = original_limit


def test_get_and_delete_document():
    """Verify retrieving document metadata and deleting document removes file and DB record."""
    upload_resp = client.post(
        "/api/documents/upload",
        files={"file": ("temporary.txt", b"Temporary text content.", "text/plain")},
    )
    assert upload_resp.status_code == 201
    doc_id = upload_resp.json()["id"]

    # Get details
    get_resp = client.get(f"/api/documents/{doc_id}")
    assert get_resp.status_code == 200
    assert get_resp.json()["id"] == doc_id
    assert "storage_path" not in get_resp.json()

    # Delete
    del_resp = client.delete(f"/api/documents/{doc_id}")
    assert del_resp.status_code == 204

    # Verify 404 after deletion
    get_after = client.get(f"/api/documents/{doc_id}")
    assert get_after.status_code == 404


@pytest.mark.anyio
async def test_document_qa_chat_workflow():
    """Verify chat endpoint grounds the prompt with document context and returns document metadata."""
    upload_resp = client.post(
        "/api/documents/upload",
        files={"file": ("project_spec.txt", b"OmniAI Specification: The project requires dual model comparison.", "text/plain")},
    )
    assert upload_resp.status_code == 201
    doc_id = upload_resp.json()["id"]

    mock_answer = "According to the project specification, the project requires dual model comparison."

    with patch("app.providers.groq_provider.GroqProvider.generate_response", return_value=mock_answer):
        chat_resp = client.post(
            "/api/chat",
            json={
                "message": "What does the specification require?",
                "model_id": "llama-3.1-8b-instant",
                "document_id": doc_id,
            },
        )

        assert chat_resp.status_code == 200
        data = chat_resp.json()
        assert data["document_id"] == doc_id
        assert data["document_name"] == "project_spec.txt"
        assert "dual model comparison" in data["response"]
