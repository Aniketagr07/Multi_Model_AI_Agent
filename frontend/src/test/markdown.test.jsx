import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MarkdownRenderer, CodeBlock } from '../components/MarkdownRenderer';

describe('Markdown Rendering & Code Copy Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders markdown headings, lists, and formatting properly', () => {
    const markdown = `
# Main Title
Here is **bold text** and *italic text*.
- Item 1
- Item 2
`;
    render(<MarkdownRenderer content={markdown} />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Main Title');
    expect(screen.getByText('bold text')).toBeInTheDocument();
    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.getByText('Item 2')).toBeInTheDocument();
  });

  it('renders code block with syntax language and handles code copy', async () => {
    const code = 'const answer = 42;\nconsole.log(answer);';
    render(<CodeBlock code={code} language="javascript" />);

    expect(screen.getByText(/javascript/i)).toBeInTheDocument();
    expect(screen.getByText(/const answer = 42;/)).toBeInTheDocument();

    const copyBtn = screen.getByRole('button', { name: /Copy code/i });
    fireEvent.click(copyBtn);

    await waitFor(() => {
      expect(screen.getByText('Copied!')).toBeInTheDocument();
    });
  });

  it('neutralizes unsafe javascript: URIs in links', () => {
    const maliciousMarkdown = '[Click Me](javascript:alert("XSS"))';
    render(<MarkdownRenderer content={maliciousMarkdown} />);

    const link = screen.getByRole('link', { name: /Click Me/i });
    expect(link).toHaveAttribute('href', '#');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('renders external links safely with rel="noopener noreferrer"', () => {
    const safeMarkdown = '[Google Search](https://google.com)';
    render(<MarkdownRenderer content={safeMarkdown} />);

    const link = screen.getByRole('link', { name: /Google Search/i });
    expect(link).toHaveAttribute('href', 'https://google.com');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(link).toHaveAttribute('target', '_blank');
  });
});
