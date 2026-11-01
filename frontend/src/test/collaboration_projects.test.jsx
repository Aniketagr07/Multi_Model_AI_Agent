import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChatHeader } from '../components/ChatHeader';
import { MessageBubble } from '../components/MessageBubble';
import { Sidebar } from '../components/Sidebar';
import { CreateProjectModal } from '../components/CreateProjectModal';
import { ShareConversationModal } from '../components/ShareConversationModal';
import * as api from '../services/api';

describe('Collaboration & Projects Frontend Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders ChatHeader with role badge and online presence count', () => {
    render(
      <ChatHeader
        activeTitle="Distributed Consensus Study"
        onToggleSidebar={vi.fn()}
        activeConversationId="conv-shared-1"
        presence={[{ user_id: 'u-1', display_name: 'Alice' }, { user_id: 'u-2', display_name: 'Bob' }]}
        onOpenShare={vi.fn()}
        currentUserRole="editor"
      />
    );

    expect(screen.getByText('Distributed Consensus Study')).toBeInTheDocument();
    expect(screen.getByText('editor')).toBeInTheDocument();
    expect(screen.getByText('2 online')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /share/i })).toBeInTheDocument();
  });

  it('renders author attribution badge on MessageBubble for collaborative messages', () => {
    const mockMessage = {
      id: 'msg-1',
      sender: 'user',
      content: 'Can someone explain the Byzantine Fault Tolerance algorithm?',
      author_id: 'u-123',
      author_name: 'Alice Cooper',
      timestamp: '2026-10-31T05:00:00Z',
    };

    render(
      <MessageBubble
        message={mockMessage}
        onRetry={vi.fn()}
        showTokenMetrics={true}
      />
    );

    expect(screen.getByText('Alice Cooper')).toBeInTheDocument();
    expect(screen.getByText('Can someone explain the Byzantine Fault Tolerance algorithm?')).toBeInTheDocument();
  });

  it('renders projects in Sidebar and triggers project selection callback', () => {
    const mockProjects = [
      { id: 'proj-1', name: 'AI Architecture Core', icon: 'code', role: 'owner' },
      { id: 'proj-2', name: 'Robotics Lab', icon: 'cpu', role: 'member' },
    ];
    const onSelectProjectMock = vi.fn();
    const onOpenCreateProjectMock = vi.fn();

    render(
      <Sidebar
        isOpen={true}
        onClose={vi.fn()}
        conversations={[]}
        projects={mockProjects}
        activeProjectId="proj-1"
        onSelectProject={onSelectProjectMock}
        onOpenCreateProject={onOpenCreateProjectMock}
        user={{ id: 'u-1', username: 'alex', email: 'alex@example.com' }}
      />
    );

    expect(screen.getByText('AI Architecture Core')).toBeInTheDocument();
    expect(screen.getByText('Robotics Lab')).toBeInTheDocument();

    const projButton = screen.getByText('Robotics Lab');
    fireEvent.click(projButton);
    expect(onSelectProjectMock).toHaveBeenCalledWith('proj-2');
  });

  it('renders CreateProjectModal and displays inputs for project creation', () => {
    render(
      <CreateProjectModal
        isOpen={true}
        onClose={vi.fn()}
        onProjectCreated={vi.fn()}
      />
    );

    expect(screen.getByText('New Collaborative Project')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. Q4 Research & Synthesis')).toBeInTheDocument();
  });

  it('renders unauthenticated state in ShareConversationModal without triggering failing API call', () => {
    const getShareSpy = vi.spyOn(api, 'getConversationShareSettings');
    const onOpenAuthMock = vi.fn();

    render(
      <ShareConversationModal
        isOpen={true}
        onClose={vi.fn()}
        conversationId="conv-test-1"
        conversationTitle="Quantum Computing"
        currentUser={null}
        onOpenAuth={onOpenAuthMock}
      />
    );

    expect(screen.getByText('Sign in to Share Conversations')).toBeInTheDocument();
    expect(screen.getByText('Sign In')).toBeInTheDocument();
    expect(getShareSpy).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText('Sign In'));
    expect(onOpenAuthMock).toHaveBeenCalledWith('signin');
  });

  it('renders authenticated ShareConversationModal with participants and share link', async () => {
    const mockShareData = {
      conversation_id: 'conv-test-1',
      title: 'Quantum Computing',
      sharing_enabled: true,
      share_permission: 'editor',
      share_token: 'token-abc',
      current_user_role: 'owner',
      members: [
        { id: 'm-1', user_id: 'u-1', display_name: 'Owner Alice', role: 'owner' },
        { id: 'm-2', user_id: 'u-2', display_name: 'Bob Dev', role: 'editor' },
      ],
      pending_invitations: [],
    };

    vi.spyOn(api, 'getConversationShareSettings').mockResolvedValue(mockShareData);

    render(
      <ShareConversationModal
        isOpen={true}
        onClose={vi.fn()}
        conversationId="conv-test-1"
        conversationTitle="Quantum Computing"
        currentUser={{ id: 'u-1', username: 'Owner Alice', is_guest: false }}
      />
    );

    expect(await screen.findByText('Owner Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob Dev')).toBeInTheDocument();
    expect(screen.getByText('Shareable Link')).toBeInTheDocument();
    expect(screen.getByText('Invite Collaborators')).toBeInTheDocument();
  });
});
