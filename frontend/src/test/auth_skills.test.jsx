import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChatHeader } from '../components/ChatHeader';
import { Sidebar } from '../components/Sidebar';
import { AuthModal } from '../components/AuthModal';

describe('Clean Top Header and Account Profile Menu', () => {
  it('renders clean top header with only the user profile control', () => {
    render(
      <ChatHeader
        user={null}
        onToggleSidebar={vi.fn()}
        onOpenAuth={vi.fn()}
        onOpenSettings={vi.fn()}
      />
    );

    // Should display Guest User account control
    expect(screen.getByText('Guest User')).toBeInTheDocument();

    // Verify removed elements are NOT present in the header
    expect(screen.queryByText('New Conversation')).not.toBeInTheDocument();
    expect(screen.queryByText('Add Key')).not.toBeInTheDocument();
    expect(screen.queryByText('Connected')).not.toBeInTheDocument();
  });

  it('opens account menu with Sign In and Create Account for guest user', () => {
    const handleOpenAuth = vi.fn();
    render(
      <ChatHeader
        user={null}
        onToggleSidebar={vi.fn()}
        onOpenAuth={handleOpenAuth}
        onOpenSettings={vi.fn()}
      />
    );

    // Click profile control
    const profileBtn = screen.getByText('Guest User').closest('button');
    fireEvent.click(profileBtn);

    // Menu options should appear
    expect(screen.getByText('Sign In')).toBeInTheDocument();
    expect(screen.getByText('Create Account')).toBeInTheDocument();

    // Clicking Sign In triggers callback
    fireEvent.click(screen.getByText('Sign In'));
    expect(handleOpenAuth).toHaveBeenCalledWith('signin');
  });

  it('displays authenticated username and options when logged in', () => {
    const handleLogout = vi.fn();
    render(
      <ChatHeader
        user={{ username: 'AlexDev', email: 'alex@example.com' }}
        onToggleSidebar={vi.fn()}
        onOpenAuth={vi.fn()}
        onOpenSettings={vi.fn()}
        onLogout={handleLogout}
      />
    );

    expect(screen.getByText('AlexDev')).toBeInTheDocument();

    // Open menu
    const profileBtn = screen.getByText('AlexDev').closest('button');
    fireEvent.click(profileBtn);

    expect(screen.getByText('Account Settings')).toBeInTheDocument();
    expect(screen.getByText('Sign Out')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Sign Out'));
    expect(handleLogout).toHaveBeenCalled();
  });
});

describe('Clean Sidebar and Empty State', () => {
  it('renders clean sidebar with branding, new chat, search, and navigation links', () => {
    render(
      <Sidebar
        isOpen={true}
        onClose={vi.fn()}
        conversations={[]}
        onNewChat={vi.fn()}
        onSelectConversation={vi.fn()}
        searchQuery=""
        onSearchChange={vi.fn()}
      />
    );

    expect(screen.getByText('OmniAI')).toBeInTheDocument();
    expect(screen.getByText('New Chat')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/search title & messages/i)).toBeInTheDocument();
    expect(screen.getByText('Skills')).toBeInTheDocument();
    expect(screen.getByText('Compare Models')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();

    // Verify completely removed bottom cards
    expect(screen.queryByText('FastAPI Online')).not.toBeInTheDocument();
    expect(screen.queryByText(/v0\.1\.0/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Day 7\+/i)).not.toBeInTheDocument();
    expect(screen.queryByText('REST API Healthy')).not.toBeInTheDocument();

    // Verify clean empty state for new users
    expect(screen.getByText('No conversations yet')).toBeInTheDocument();
  });
});

describe('User Authentication Modal', () => {
  it('renders sign in form and toggles to create account mode', () => {
    const handleLogin = vi.fn();
    const handleRegister = vi.fn();

    render(
      <AuthModal
        isOpen={true}
        onClose={vi.fn()}
        initialMode="signin"
        onLogin={handleLogin}
        onRegister={handleRegister}
      />
    );

    expect(screen.getByRole('heading', { name: /sign in to omniai/i })).toBeInTheDocument();

    // Switch to Create Account tab
    const registerTab = screen.getByRole('button', { name: /create account/i });
    fireEvent.click(registerTab);

    expect(screen.getByText('Display Username')).toBeInTheDocument();
    expect(screen.getByText('Min 8 characters')).toBeInTheDocument();
  });
});
