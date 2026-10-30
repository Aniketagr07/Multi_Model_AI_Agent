import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DocumentAttachmentCard } from '../components/DocumentAttachmentCard';
import { MessageComposer } from '../components/MessageComposer';
import { AVAILABLE_MODELS } from '../components/ModelSelector';

describe('Document Upload & Validation Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders attached document metadata card with file size and type', () => {
    const handleRemove = vi.fn();
    const doc = {
      id: 'doc-123',
      filename: 'research_notes.pdf',
      file_size: 204800, // 200 KB
      char_count: 1500,
    };

    render(
      <DocumentAttachmentCard
        document={doc}
        onRemove={handleRemove}
      />
    );

    expect(screen.getByText('research_notes.pdf')).toBeInTheDocument();
    expect(screen.getByText(/200.0 KB/i)).toBeInTheDocument();

    const removeBtn = screen.getByTitle('Remove attached document');
    fireEvent.click(removeBtn);
    expect(handleRemove).toHaveBeenCalledTimes(1);
  });

  it('triggers onAttachFile when selecting a file via file input', () => {
    const handleUpload = vi.fn();
    render(
      <MessageComposer
        input=""
        setInput={vi.fn()}
        onSendMessage={vi.fn()}
        isLoading={false}
        selectedModelId="auto"
        selectedModel={AVAILABLE_MODELS[0]}
        onSelectModel={vi.fn()}
        effort="medium"
        onSelectEffort={vi.fn()}
        attachedDocument={null}
        onRemoveDocument={vi.fn()}
        onAttachFile={handleUpload}
        isUploadingDocument={false}
      />
    );

    const file = new File(['content'], 'sample.pdf', { type: 'application/pdf' });
    const input = document.querySelector('input[type="file"]');
    expect(input).toBeInTheDocument();

    fireEvent.change(input, { target: { files: [file] } });
    expect(handleUpload).toHaveBeenCalledWith(file);
  });
});
