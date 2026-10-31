import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChatHeader } from '../components/ChatHeader';
import { Sidebar } from '../components/Sidebar';
import { AuthModal } from '../components/AuthModal';

describe('Clean Top Header and Active Title', () => {
  it('renders clean top header with sidebar toggle and active conversation title', () => {
    render(
      <ChatHeader
        activeTitle="Binary Search Implementation"
        onToggleSidebar={vi.fn()}
      />
    );

    // Should display conversation title
    expect(screen.getByText('Binary Search Implementation')).toBeInTheDocument();

    // Verify toggle button is present
    expect(screen.getByRole('button', { name: /toggle navigation sidebar/i })).toBeInTheDocument();

    // Verify removed elements are NOT present in the header
    expect(screen.queryByText('Guest User')).not.toBeInTheDocument();
    expect(screen.queryByText('New Conversation')).not.toBeInTheDocument();
    expect(screen.queryByText('Add Key')).not.toBeInTheDocument();
    expect(screen.queryByText('Connected')).not.toBeInTheDocument();
  });

  it('falls back to "New Chat" when conversation has no title', () => {
    render(
      <ChatHeader
        activeTitle=""
        onToggleSidebar={vi.fn()}
      />
    );

    expect(screen.getByText('New Chat')).toBeInTheDocument();
  });
});

describe('Clean Sidebar with Bottom-Left User Account Controls', () => {
  it('renders clean sidebar with Guest User and Sign In button at bottom', () => {
    const handleOpenAuth = vi.fn();
    render(
      <Sidebar
        isOpen={true}
        onClose={vi.fn()}
        conversations={[]}
        onNewChat={vi.fn()}
        onSelectConversation={vi.fn()}
        searchQuery=""
        onSearchChange={vi.fn()}
        user={null}
        onOpenAuth={handleOpenAuth}
      />
    );

    expect(screen.getByText('OmniAI')).toBeInTheDocument();
    expect(screen.getByText('New Chat')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/search title & messages/i)).toBeInTheDocument();
    expect(screen.getByText('Skills')).toBeInTheDocument();
    expect(screen.getByText('Compare Models')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();

    // Bottom-left guest details
    expect(screen.getByText('Guest User')).toBeInTheDocument();
    expect(screen.getByText('Guest Mode')).toBeInTheDocument();
    const signInBtn = screen.getByRole('button', { name: /sign in/i });
    expect(signInBtn).toBeInTheDocument();

    fireEvent.click(signInBtn);
    expect(handleOpenAuth).toHaveBeenCalledWith('signin');
  });

  it('renders authenticated user details, settings, and sign out at bottom of sidebar', () => {
    const handleLogout = vi.fn();
    const handleOpenSettings = vi.fn();
    render(
      <Sidebar
        isOpen={true}
        onClose={vi.fn()}
        conversations={[]}
        onNewChat={vi.fn()}
        onSelectConversation={vi.fn()}
        searchQuery=""
        onSearchChange={vi.fn()}
        user={{ username: 'AlexDev', email: 'alex@example.com' }}
        onOpenSettings={handleOpenSettings}
        onLogout={handleLogout}
      />
    );

    expect(screen.getByText('AlexDev')).toBeInTheDocument();
    expect(screen.getByText('alex@example.com')).toBeInTheDocument();

    const settingsBtn = screen.getByRole('button', { name: /account settings/i });
    expect(settingsBtn).toBeInTheDocument();

    const signOutBtn = screen.getByRole('button', { name: /sign out/i });
    expect(signOutBtn).toBeInTheDocument();

    fireEvent.click(signOutBtn);
    expect(handleLogout).toHaveBeenCalledTimes(1);
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

    expect(screen.getByRole('heading', { name: /welcome to omniai/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /continue with google/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /continue with github/i })).toBeInTheDocument();
    expect(screen.getByText(/continue with email and password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /continue as guest/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /forgot password\?/i })).toBeInTheDocument();

    // Switch to Create Account tab
    const registerTab = screen.getAllByRole('button', { name: /create account/i })[0];
    fireEvent.click(registerTab);

    expect(screen.getByText('Display Username')).toBeInTheDocument();
    expect(screen.getByText('Min 8 characters')).toBeInTheDocument();
  });

  it('toggles to forgot password mode and displays recovery instructions button', () => {
    render(
      <AuthModal
        isOpen={true}
        onClose={vi.fn()}
        initialMode="signin"
        onLogin={vi.fn()}
        onRegister={vi.fn()}
      />
    );

    const forgotBtn = screen.getByRole('button', { name: /forgot password\?/i });
    fireEvent.click(forgotBtn);

    expect(screen.getByRole('button', { name: /send recovery instructions/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /back to sign in/i })).toBeInTheDocument();
  });
});
