import React, { useState, useEffect, useCallback } from 'react';
import { Sidebar } from './components/Sidebar';
import { ChatHeader } from './components/ChatHeader';
import { ChatWindow } from './components/ChatWindow';
import { MessageComposer } from './components/MessageComposer';
import { CompareView } from './components/CompareView';
import { SettingsView } from './components/SettingsView';
import { SkillsMarketplace } from './components/SkillsMarketplace';
import { ApiKeyModal } from './components/ApiKeyModal';
import { AuthModal } from './components/AuthModal';
import { ShareConversationModal } from './components/ShareConversationModal';
import { CreateProjectModal } from './components/CreateProjectModal';
import BYOKOnboardingModal from './components/BYOKOnboardingModal';
import { ProjectWorkspace } from './components/ProjectWorkspace';
import { useChat } from './hooks/useChat';
import { useAuth } from './hooks/useAuth';
import { useHealthCheck } from './hooks/useHealthCheck';
import { useCustomKeys } from './hooks/useCustomKeys';
import { useSettings } from './hooks/useSettings';
import { useRealtimeConversation } from './hooks/useRealtimeConversation';
import {
  handleOAuthCallback,
  migrateGuestConversations,
  fetchProjects,
  joinConversationByToken,
  joinProjectByToken,
} from './services/api';

export default function App() {
  const [activeView, setActiveView] = useState('chat'); // 'chat' | 'compare' | 'skills' | 'settings' | 'project'
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState('signin'); // 'signin' | 'register'

  // Modals for Collaboration & Projects
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isCreateProjectModalOpen, setIsCreateProjectModalOpen] = useState(false);
  const [isBYOKModalOpen, setIsBYOKModalOpen] = useState(false);
  const [hasDismissedBYOK, setHasDismissedBYOK] = useState(false);
  const [projects, setProjects] = useState([]);
  const [activeProjectId, setActiveProjectId] = useState(null);

  const {
    user,
    token,
    isGuest,
    login,
    register,
    logout,
    deleteAccount,
    setAuthSession,
    refreshUser,
  } = useAuth();

  const [migrationBanner, setMigrationBanner] = useState(false);
  const [notification, setNotification] = useState(null); // { type: 'success' | 'error', text: '' }

  const {
    settings,
    updateSettings,
    saveStatus,
    saveError,
  } = useSettings();

  const {
    customKeys,
    customModels,
    saveKeyAndModels,
    removeKey,
  } = useCustomKeys();

  const {
    conversations,
    activeConversationId,
    activeMessages,
    activeTitle,
    selectedModelId,
    selectedModel,
    effort,
    setEffort,
    input,
    setInput,
    isLoading,
    isSidebarOpen,
    setIsSidebarOpen,
    startNewChat,
    selectConversation,
    renameConversation,
    deleteConversation,
    pinConversation,
    archiveConversation,
    exportConversation,
    refreshConversations,
    searchQuery,
    setSearchQuery,
    setSelectedModelId,
    sendMessage,
    stopGeneration,
    regenerateResponse,
    attachedDocument,
    isUploadingDocument,
    uploadProgress,
    attachFile,
    removeDocument,
    currentUserRole,
    handleIncomingRealtimeMessage,
    handleIncomingRealtimeChunk,
    handleIncomingRealtimeDone,
  } = useChat({
    customModels,
    customKeys,
    userSettings: settings,
    userToken: token,
  });

  const { status: healthStatus, checkHealth: onCheckHealth } = useHealthCheck();

  // Auto-trigger BYOK Setup for new or existing users who have not completed key setup
  useEffect(() => {
    if (user && !isGuest && user.byok_setup_completed === false && !hasDismissedBYOK) {
      setIsBYOKModalOpen(true);
    }
  }, [user, isGuest, hasDismissedBYOK]);

  // Real-time conversation synchronization via WebSockets
  const {
    presence,
    typingUsers,
    sendTyping,
  } = useRealtimeConversation({
    conversationId: activeConversationId,
    token,
    onMessageReceived: handleIncomingRealtimeMessage,
    onAssistantChunk: handleIncomingRealtimeChunk,
    onAssistantDone: handleIncomingRealtimeDone,
  });

  // Load Collaborative Projects
  const loadProjects = useCallback(async () => {
    if (!token || isGuest) {
      setProjects([]);
      return;
    }
    try {
      const data = await fetchProjects();
      setProjects(data || []);
    } catch (err) {
      console.warn('[OmniAI] Failed to load projects:', err.message);
    }
  }, [token, isGuest]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  // Handle invitation or share links in URL on load
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const path = window.location.pathname;
    const params = new URLSearchParams(window.location.search);

    const convToken = params.get('join_conv') || (path.startsWith('/join/c/') ? path.replace('/join/c/', '') : null);
    const projToken = params.get('join_proj') || (path.startsWith('/join/p/') ? path.replace('/join/p/', '') : null);

    if (convToken && token) {
      joinConversationByToken(convToken)
        .then((res) => {
          setNotification({
            type: 'success',
            text: res.message || 'Joined conversation successfully!',
          });
          refreshConversations().then(() => {
            selectConversation(res.conversation_id);
            setActiveView('chat');
          });
        })
        .catch((e) => {
          setNotification({
            type: 'error',
            text: e.message || 'Failed to join conversation.',
          });
        })
        .finally(() => {
          window.history.replaceState({}, document.title, window.location.pathname.startsWith('/join/') ? '/' : window.location.pathname);
        });
    } else if (projToken && token) {
      joinProjectByToken(projToken)
        .then((res) => {
          setNotification({
            type: 'success',
            text: res.message || 'Joined project successfully!',
          });
          loadProjects().then(() => {
            setActiveProjectId(res.project_id);
            setActiveView('project');
          });
        })
        .catch((e) => {
          setNotification({
            type: 'error',
            text: e.message || 'Failed to join project.',
          });
        })
        .finally(() => {
          window.history.replaceState({}, document.title, window.location.pathname.startsWith('/join/') ? '/' : window.location.pathname);
        });
    }
  }, [token, refreshConversations, selectConversation, loadProjects]);

  // Handle OAuth callback from Google or GitHub
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    const err = params.get('error');
    const errDesc = params.get('error_description');

    if (err) {
      setNotification({
        type: 'error',
        text: errDesc || `Authentication was cancelled or failed (${err}).`,
      });
      window.history.replaceState({}, document.title, window.location.pathname);
      return;
    }

    if (code && state) {
      let provider = 'google';
      if (state.startsWith('github_') || sessionStorage.getItem('omniai_oauth_provider') === 'github') {
        provider = 'github';
      } else if (state.startsWith('google_') || sessionStorage.getItem('omniai_oauth_provider') === 'google') {
        provider = 'google';
      }

      handleOAuthCallback(provider, code, state)
        .then((data) => {
          if (data?.token && data?.user) {
            setAuthSession(data);
            setNotification({
              type: 'success',
              text: `Signed in with ${provider === 'google' ? 'Google' : 'GitHub'} as ${data.user.username || data.user.email}!`,
            });
            if (conversations && conversations.length > 0) {
              setMigrationBanner(true);
            }
          } else if (data?.status === 'linked') {
            setNotification({
              type: 'success',
              text: `Successfully linked ${provider === 'google' ? 'Google' : 'GitHub'} to your account.`,
            });
            refreshUser();
          }
        })
        .catch((e) => {
          setNotification({
            type: 'error',
            text: e.message || 'OAuth authentication failed.',
          });
        })
        .finally(() => {
          sessionStorage.removeItem('omniai_oauth_provider');
          sessionStorage.removeItem('omniai_oauth_action');
          window.history.replaceState({}, document.title, window.location.pathname);
        });
    }
  }, []);

  const handleMigrateConversations = async () => {
    try {
      const res = await migrateGuestConversations();
      setNotification({
        type: 'success',
        text: res.message || `Successfully imported ${res.migrated_count} conversation(s).`,
      });
      setMigrationBanner(false);
      refreshConversations();
    } catch (e) {
      setNotification({
        type: 'error',
        text: e.message || 'Failed to import guest conversations.',
      });
    }
  };

  const handleLoginWithMigration = async (email, password) => {
    const prevCount = conversations ? conversations.length : 0;
    const res = await login(email, password);
    if (prevCount > 0) {
      setMigrationBanner(true);
    }
    return res;
  };

  const handleRegisterWithMigration = async (email, username, password) => {
    const prevCount = conversations ? conversations.length : 0;
    const res = await register(email, username, password);
    if (prevCount > 0) {
      setMigrationBanner(true);
    }
    return res;
  };

  const handleToggleSidebar = () => {
    setIsSidebarOpen(prev => !prev);
  };

  const handleSelectPrompt = (promptText) => {
    sendMessage(promptText);
  };

  const handleRetryMessage = (promptText, modelId, effortTier) => {
    if (promptText) {
      sendMessage(promptText, modelId, effortTier);
    }
  };

  const handleOpenAuth = (mode = 'signin') => {
    setAuthModalMode(mode);
    setIsAuthModalOpen(true);
  };

  const handleSelectProject = (projectId) => {
    setActiveProjectId(projectId);
    setActiveView('project');
  };

  const handleProjectCreated = (newProject) => {
    loadProjects();
    setActiveProjectId(newProject.id);
    setActiveView('project');
    setNotification({
      type: 'success',
      text: `Project "${newProject.name}" created!`,
    });
  };

  const handleProjectDeleted = () => {
    loadProjects();
    setActiveProjectId(null);
    setActiveView('chat');
    setNotification({
      type: 'success',
      text: 'Project deleted.',
    });
  };

  const handleOpenProjectConversation = (convId) => {
    setActiveView('chat');
    selectConversation(convId);
  };

  return (
    <div className="flex h-screen h-[100dvh] w-screen overflow-hidden bg-[#0B0D12] text-[#F3F4F6] font-sans antialiased selection:bg-purple-600 selection:text-white">
      {/* Collapsible / Responsive Clean Sidebar */}
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        conversations={conversations}
        activeConversationId={activeConversationId}
        onSelectConversation={(id) => {
          setActiveView('chat');
          selectConversation(id);
        }}
        onNewChat={() => {
          setActiveView('chat');
          startNewChat();
        }}
        onRenameConversation={renameConversation}
        onDeleteConversation={deleteConversation}
        onPinConversation={pinConversation}
        onArchiveConversation={archiveConversation}
        onExportConversation={exportConversation}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        healthStatus={healthStatus}
        onCheckHealth={onCheckHealth}
        activeView={activeView}
        onSelectView={setActiveView}
        user={user}
        onOpenAuth={handleOpenAuth}
        onOpenSettings={() => setActiveView('settings')}
        onLogout={logout}
        onDeleteAccount={deleteAccount}
        projects={projects}
        activeProjectId={activeProjectId}
        onSelectProject={handleSelectProject}
        onOpenCreateProject={() => {
          if (!user || isGuest) {
            handleOpenAuth('signin');
          } else {
            setIsCreateProjectModalOpen(true);
          }
        }}
      />

      {/* Main Interface */}
      <div className="flex-1 flex flex-col h-full min-h-0 min-w-0 relative bg-[#0B0D12]">
        {/* Clean Top Header: Sidebar Toggle + Active Conversation Title + Collaboration */}
        <ChatHeader
          activeTitle={activeTitle}
          onToggleSidebar={handleToggleSidebar}
          activeConversationId={activeConversationId}
          presence={presence}
          onOpenShare={() => setIsShareModalOpen(true)}
          currentUserRole={currentUserRole}
        />

        {/* Global Notification Toast */}
        {notification && (
          <div className={`px-4 py-2.5 flex items-center justify-between text-xs border-b ${
            notification.type === 'error'
              ? 'bg-red-950/60 border-red-500/40 text-red-200'
              : 'bg-emerald-950/60 border-emerald-500/40 text-emerald-200'
          }`}>
            <div className="flex items-center gap-2">
              <span className="font-bold">{notification.type === 'error' ? '⚠️' : '✓'}</span>
              <span>{notification.text}</span>
            </div>
            <button
              type="button"
              onClick={() => setNotification(null)}
              className="text-slate-400 hover:text-white text-xs px-1 cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* Guest Conversation Migration Banner */}
        {migrationBanner && user && (
          <div className="bg-purple-950/50 border-b border-purple-500/30 px-4 py-2.5 flex items-center justify-between text-xs text-purple-200 animate-in fade-in">
            <div className="flex items-center gap-2">
              <span className="text-purple-400 font-semibold">🔄 Guest Conversations:</span>
              <span>Import previous guest conversations into your account (<strong>{user.username || user.email}</strong>)?</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleMigrateConversations}
                className="px-3 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-medium text-xs transition-colors cursor-pointer"
              >
                Import to Account
              </button>
              <button
                type="button"
                onClick={() => setMigrationBanner(false)}
                className="px-2 py-1 text-slate-400 hover:text-white text-xs transition-colors cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Dynamic Main View Area */}
        {activeView === 'settings' ? (
          <main className="flex-1 min-h-0 overflow-hidden relative">
            <SettingsView
              settings={settings}
              onUpdateSettings={updateSettings}
              saveStatus={saveStatus}
              saveError={saveError}
              onBackToChat={() => setActiveView('chat')}
              customModels={customModels}
              user={user}
              onOpenAuth={handleOpenAuth}
              onLogout={logout}
              onDeleteAccount={deleteAccount}
            />
          </main>
        ) : activeView === 'skills' ? (
          <main className="flex-1 min-h-0 overflow-hidden relative">
            <SkillsMarketplace onBackToChat={() => setActiveView('chat')} />
          </main>
        ) : activeView === 'compare' ? (
          <main className="flex-1 min-h-0 overflow-hidden relative">
            <CompareView customModels={customModels} customKeys={customKeys} onBackToChat={() => setActiveView('chat')} />
          </main>
        ) : activeView === 'project' ? (
          <main className="flex-1 min-h-0 overflow-hidden relative">
            <ProjectWorkspace
              projectId={activeProjectId}
              onBackToChat={() => setActiveView('chat')}
              onOpenConversation={handleOpenProjectConversation}
              userConversations={conversations}
              currentUser={user}
              onProjectDeleted={handleProjectDeleted}
              onStartNewProjectChat={(projId) => {
                setActiveView('chat');
                startNewChat();
              }}
            />
          </main>
        ) : (
          <main className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
            <ChatWindow
              messages={activeMessages}
              isLoading={isLoading}
              selectedModelName={selectedModel.name}
              onSelectPrompt={handleSelectPrompt}
              onRetryMessage={handleRetryMessage}
              onRegenerate={regenerateResponse}
              onSelectView={setActiveView}
              showTokenMetrics={settings.show_token_metrics !== false}
              currentUserRole={currentUserRole}
              typingUsers={typingUsers}
            />

            {/* Bottom Message Composer */}
            <MessageComposer
              input={input}
              setInput={setInput}
              onSend={(...args) => sendMessage(...args)}
              onStop={stopGeneration}
              isLoading={isLoading}
              selectedModelId={selectedModelId}
              onSelectModel={setSelectedModelId}
              effort={effort}
              onSelectEffort={setEffort}
              customModels={customModels}
              onOpenApiKeyModal={() => setIsBYOKModalOpen(true)}
              attachedDocument={attachedDocument}
              isUploadingDocument={isUploadingDocument}
              uploadProgress={uploadProgress}
              onAttachFile={attachFile}
              onRemoveDocument={removeDocument}
              onQuickAction={(prompt) => sendMessage(prompt)}
              onOpenSkills={() => setActiveView('skills')}
              currentUserRole={currentUserRole}
              onTyping={sendTyping}
            />
          </main>
        )}
      </div>

      {/* Dynamic API Key Modal for Multi-Provider Auto-Discovery */}
      <ApiKeyModal
        isOpen={isApiKeyModalOpen}
        onClose={() => setIsApiKeyModalOpen(false)}
        customKeys={customKeys}
        onSaveKeyAndModels={saveKeyAndModels}
        onRemoveKey={removeKey}
        onSelectModel={(modelId) => {
          setSelectedModelId(modelId);
          setIsApiKeyModalOpen(false);
        }}
      />

      {/* Clean User Authentication Modal (Sign In & Create Account) */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        initialMode={authModalMode}
        onLogin={handleLoginWithMigration}
        onRegister={handleRegisterWithMigration}
      />

      {/* Share Conversation Modal */}
      <ShareConversationModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        conversationId={activeConversationId}
        conversationTitle={activeTitle}
        currentUser={user}
        onLeftConversation={() => {
          setIsShareModalOpen(false);
          refreshConversations();
          startNewChat();
        }}
      />

      {/* Create Project Modal */}
      <CreateProjectModal
        isOpen={isCreateProjectModalOpen}
        onClose={() => setIsCreateProjectModalOpen(false)}
        onProjectCreated={handleProjectCreated}
      />

      {/* BYOK Onboarding & Provider Setup Modal */}
      <BYOKOnboardingModal
        isOpen={isBYOKModalOpen}
        onClose={() => {
          setIsBYOKModalOpen(false);
          setHasDismissedBYOK(true);
        }}
        onComplete={() => {
          setIsBYOKModalOpen(false);
          if (refreshUser) refreshUser();
        }}
        isExistingUser={Boolean(user?.created_at && new Date(user.created_at) < new Date(Date.now() - 60000))}
      />
    </div>
  );
}
