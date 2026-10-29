import React from 'react';
import { Sidebar } from './components/Sidebar';
import { ChatHeader } from './components/ChatHeader';
import { ChatWindow } from './components/ChatWindow';
import { MessageComposer } from './components/MessageComposer';
import { useChat } from './hooks/useChat';
import { useHealthCheck } from './hooks/useHealthCheck';

export default function App() {
  const {
    conversations,
    activeConversationId,
    activeMessages,
    activeTitle,
    selectedModelId,
    selectedModel,
    input,
    setInput,
    isLoading,
    isSidebarOpen,
    setIsSidebarOpen,
    startNewChat,
    selectConversation,
    deleteConversation,
    setSelectedModelId,
    sendMessage,
  } = useChat();

  const { status: healthStatus, checkHealth: onCheckHealth } = useHealthCheck();

  const handleToggleSidebar = () => {
    setIsSidebarOpen(prev => !prev);
  };

  const handleSelectPrompt = (promptText) => {
    sendMessage(promptText);
  };

  const handleRetryMessage = (promptText) => {
    if (promptText) {
      sendMessage(promptText);
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
        onDeleteConversation={deleteConversation}
        healthStatus={healthStatus}
        onCheckHealth={onCheckHealth}
      />

      {/* Main Chat Interface */}
      <div className="flex-1 flex flex-col h-full min-w-0 relative bg-[#0B0D12]">
        {/* Top Header */}
        <ChatHeader
          activeTitle={activeTitle}
          selectedModelName={selectedModel.name}
          onToggleSidebar={handleToggleSidebar}
          healthStatus={healthStatus}
          onCheckHealth={onCheckHealth}
        />

        {/* Chat Conversation Scroll Area */}
        <main className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
          <ChatWindow
            messages={activeMessages}
            isLoading={isLoading}
            selectedModelName={selectedModel.name}
            onSelectPrompt={handleSelectPrompt}
            onRetryMessage={handleRetryMessage}
          />

          {/* Bottom Message Composer */}
          <MessageComposer
            input={input}
            setInput={setInput}
            onSend={() => sendMessage()}
            isLoading={isLoading}
            selectedModelId={selectedModelId}
            onSelectModel={setSelectedModelId}
          />
        </main>
      </div>
    </div>
  );
}
