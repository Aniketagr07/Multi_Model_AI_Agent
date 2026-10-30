import React, { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { ChatHeader } from './components/ChatHeader';
import { ChatWindow } from './components/ChatWindow';
import { MessageComposer } from './components/MessageComposer';
import { CompareView } from './components/CompareView';
import { SettingsView } from './components/SettingsView';
import { SkillsMarketplace } from './components/SkillsMarketplace';
import { ApiKeyModal } from './components/ApiKeyModal';
import { AuthModal } from './components/AuthModal';
import { useChat } from './hooks/useChat';
import { useAuth } from './hooks/useAuth';
import { useHealthCheck } from './hooks/useHealthCheck';
import { useCustomKeys } from './hooks/useCustomKeys';
import { useSettings } from './hooks/useSettings';

export default function App() {
  const [activeView, setActiveView] = useState('chat'); // 'chat' | 'compare' | 'skills' | 'settings'
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState('signin'); // 'signin' | 'register'

  const {
    user,
    token,
    isGuest,
    login,
    register,
    logout,
    deleteAccount,
  } = useAuth();

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
  } = useChat({
    customModels,
    customKeys,
    userSettings: settings,
    userToken: token,
  });

  const { status: healthStatus, checkHealth: onCheckHealth } = useHealthCheck();

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

  return (
    <div className="flex h-screen h-[100dvh] w-screen overflow-hidden bg-[#0B0D12] text-[#F3F4F6] font-sans antialiased selection:bg-purple-600 selection:text-white">
      {/* Collapsible / Responsive Clean Sidebar */}
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        conversations={conversations}
        activeConversationId={activeConversationId}
        onSelectConversation={selectConversation}
        onNewChat={startNewChat}
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
      />

      {/* Main Interface */}
      <div className="flex-1 flex flex-col h-full min-h-0 min-w-0 relative bg-[#0B0D12]">
        {/* Clean Top Header (Only Account Control [ Profile Icon | Guest User / Username ▼ ]) */}
        <ChatHeader
          user={user}
          onToggleSidebar={handleToggleSidebar}
          onOpenAuth={handleOpenAuth}
          onOpenSettings={() => setActiveView('settings')}
          onLogout={logout}
          onDeleteAccount={deleteAccount}
        />

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
            />

            {/* Bottom Message Composer */}
            <MessageComposer
              input={input}
              setInput={setInput}
              onSend={() => sendMessage()}
              onStop={stopGeneration}
              isLoading={isLoading}
              selectedModelId={selectedModelId}
              onSelectModel={setSelectedModelId}
              effort={effort}
              onSelectEffort={setEffort}
              customModels={customModels}
              onOpenApiKeyModal={() => setIsApiKeyModalOpen(true)}
              attachedDocument={attachedDocument}
              isUploadingDocument={isUploadingDocument}
              uploadProgress={uploadProgress}
              onAttachFile={attachFile}
              onRemoveDocument={removeDocument}
              onQuickAction={(prompt) => sendMessage(prompt)}
              onOpenSkills={() => setActiveView('skills')}
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
        onLogin={login}
        onRegister={register}
      />
    </div>
  );
}
