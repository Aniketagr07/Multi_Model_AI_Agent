import React, { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { ChatHeader } from './components/ChatHeader';
import { ChatWindow } from './components/ChatWindow';
import { MessageComposer } from './components/MessageComposer';
import { CompareView } from './components/CompareView';
import { SettingsView } from './components/SettingsView';
import { ApiKeyModal } from './components/ApiKeyModal';
import { useChat } from './hooks/useChat';
import { useHealthCheck } from './hooks/useHealthCheck';
import { useCustomKeys } from './hooks/useCustomKeys';
import { useSettings } from './hooks/useSettings';

export default function App() {
  const [activeView, setActiveView] = useState('chat'); // 'chat' | 'compare' | 'settings'
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);

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
  } = useChat({ customModels, customKeys, userSettings: settings });

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

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0B0D12] text-[#F3F4F6] font-sans antialiased selection:bg-purple-600 selection:text-white">
      {/* Collapsible / Responsive Sidebar */}
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
      <div className="flex-1 flex flex-col h-full min-w-0 relative bg-[#0B0D12]">
        {/* Top Header */}
        <ChatHeader
          activeTitle={
            activeView === 'settings'
              ? 'Settings & Personalization'
              : activeView === 'compare'
              ? 'Compare Models'
              : activeTitle
          }
          selectedModelName={
            activeView === 'settings'
              ? 'User Configuration'
              : activeView === 'compare'
              ? 'Parallel Dual-Model Benchmark'
              : selectedModel.name
          }
          totalTokens={activeMessages.reduce((acc, m) => acc + (m.tokens || Math.max(1, Math.ceil(((m.content || '').length) / 4))), 0)}
          showTokenMetrics={settings.show_token_metrics !== false}
          onToggleSidebar={handleToggleSidebar}
          healthStatus={healthStatus}
          onCheckHealth={onCheckHealth}
          onOpenApiKeyModal={() => setIsApiKeyModalOpen(true)}
          onOpenSettings={() => setActiveView('settings')}
          activeView={activeView}
          onSelectView={setActiveView}
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
    </div>
  );
}
