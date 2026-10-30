import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Sidebar } from '../components/Sidebar';

describe('Conversation Management & Sidebar Tests', () => {
  const mockConversations = [
    {
      id: 'conv-1',
      title: 'Python Algorithms',
      isPinned: false,
      isArchived: false,
      messageCount: 4,
      updatedAt: '2026-10-30T10:00:00Z',
    },
    {
      id: 'conv-2',
      title: 'Research Notes',
      isPinned: true,
      isArchived: false,
      messageCount: 8,
      updatedAt: '2026-10-30T11:00:00Z',
    },
    {
      id: 'conv-3',
      title: 'Old Archived Project',
      isPinned: false,
      isArchived: true,
      messageCount: 2,
      updatedAt: '2026-10-29T10:00:00Z',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders pinned and recent sections correctly in sidebar', () => {
    render(
      <Sidebar
        conversations={mockConversations}
        activeConversationId="conv-1"
        onSelectConversation={vi.fn()}
        onNewChat={vi.fn()}
        onRenameConversation={vi.fn()}
        onDeleteConversation={vi.fn()}
        onPinConversation={vi.fn()}
        onArchiveConversation={vi.fn()}
        isOpen={true}
        onClose={vi.fn()}
        onOpenSettings={vi.fn()}
      />
    );

    // Pinned section check
    expect(screen.getByText(/Pinned/i)).toBeInTheDocument();
    expect(screen.getByText('Research Notes')).toBeInTheDocument();

    // Recent section check
    expect(screen.getByText(/Recent/i)).toBeInTheDocument();
    expect(screen.getByText('Python Algorithms')).toBeInTheDocument();
  });

  it('triggers onSearchChange when typing in the search bar', () => {
    const handleSearchChange = vi.fn();
    render(
      <Sidebar
        conversations={mockConversations}
        activeConversationId="conv-1"
        onSelectConversation={vi.fn()}
        onNewChat={vi.fn()}
        onRenameConversation={vi.fn()}
        onDeleteConversation={vi.fn()}
        onPinConversation={vi.fn()}
        onArchiveConversation={vi.fn()}
        isOpen={true}
        onClose={vi.fn()}
        onOpenSettings={vi.fn()}
        searchQuery=""
        onSearchChange={handleSearchChange}
      />
    );

    const searchInput = screen.getByPlaceholderText(/Search title & messages/i);
    fireEvent.change(searchInput, { target: { value: 'Python' } });

    expect(handleSearchChange).toHaveBeenCalledWith('Python');
  });

  it('calls onPinConversation when clicking pin action button', () => {
    const handlePin = vi.fn();
    render(
      <Sidebar
        conversations={mockConversations}
        activeConversationId="conv-1"
        onSelectConversation={vi.fn()}
        onNewChat={vi.fn()}
        onRenameConversation={vi.fn()}
        onDeleteConversation={vi.fn()}
        onPinConversation={handlePin}
        onArchiveConversation={vi.fn()}
        isOpen={true}
        onClose={vi.fn()}
        onOpenSettings={vi.fn()}
      />
    );

    const pinButtons = screen.getAllByTitle(/Pin conversation|Unpin conversation/i);
    expect(pinButtons.length).toBeGreaterThan(0);
    fireEvent.click(pinButtons[0]);

    expect(handlePin).toHaveBeenCalled();
  });

  it('calls onArchiveConversation when clicking archive action button', () => {
    const handleArchive = vi.fn();
    render(
      <Sidebar
        conversations={mockConversations}
        activeConversationId="conv-1"
        onSelectConversation={vi.fn()}
        onNewChat={vi.fn()}
        onRenameConversation={vi.fn()}
        onDeleteConversation={vi.fn()}
        onPinConversation={vi.fn()}
        onArchiveConversation={handleArchive}
        isOpen={true}
        onClose={vi.fn()}
        onOpenSettings={vi.fn()}
      />
    );

    const archiveButtons = screen.getAllByTitle(/Archive conversation/i);
    expect(archiveButtons.length).toBeGreaterThan(0);
    fireEvent.click(archiveButtons[0]);

    expect(handleArchive).toHaveBeenCalled();
  });
});
