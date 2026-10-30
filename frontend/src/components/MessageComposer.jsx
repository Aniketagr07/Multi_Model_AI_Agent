import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { ModelSelector } from './ModelSelector';
import { DocumentAttachmentCard } from './DocumentAttachmentCard';
import { UsagePopover } from './UsagePopover';
import { fetchSkillsCatalog } from '../services/api';

export function MessageComposer({
  input,
  setInput,
  onSend,
  onStop,
  isLoading,
  selectedModelId,
  onSelectModel,
  effort = 'medium',
  onSelectEffort,
  customModels = [],
  onOpenApiKeyModal,
  attachedDocument = null,
  isUploadingDocument = false,
  uploadProgress = 0,
  onAttachFile,
  onRemoveDocument,
  onQuickAction,
  onOpenSkills,
}) {
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const attachMenuRef = useRef(null);
  const slashMenuRef = useRef(null);

  const [isDragging, setIsDragging] = useState(false);
  const [isAttachOpen, setIsAttachOpen] = useState(false);
  const [selectedSkill, setSelectedSkill] = useState(null);
  const [installedSkills, setInstalledSkills] = useState([]);
  const [isSlashOpen, setIsSlashOpen] = useState(false);
  const [slashQuery, setSlashQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  // Load installed skills for the user
  const loadInstalledSkills = useCallback(async () => {
    try {
      const data = await fetchSkillsCatalog(null, null, true);
      const list = data?.skills || [];
      setInstalledSkills(list.filter(s => s.is_installed && s.is_enabled !== false));
    } catch (err) {
      console.warn('Failed to load installed skills:', err);
    }
  }, []);

  useEffect(() => {
    loadInstalledSkills();
  }, [loadInstalledSkills]);

  // Close menus on outside click or Escape
  useEffect(() => {
    function handleClickOutside(e) {
      if (attachMenuRef.current && !attachMenuRef.current.contains(e.target)) {
        setIsAttachOpen(false);
      }
      if (slashMenuRef.current && !slashMenuRef.current.contains(e.target) && textareaRef.current && !textareaRef.current.contains(e.target)) {
        setIsSlashOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Auto-resize textarea height as content expands
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      const scrollHeight = textarea.scrollHeight;
      const maxHeight = 160; // Max ~6 lines
      textarea.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
    }
  }, [input]);

  // Check for slash command at current input cursor / end
  useEffect(() => {
    // Only trigger if '/' is at the beginning of the text or preceded by whitespace:
    // e.g. "/python" or "Please use /web to search"
    // Does NOT trigger on "https://", "/usr/bin", or "10 / 2"
    const slashMatch = input.match(/(?:^|\s)\/([a-zA-Z0-9_-]*)$/);
    if (slashMatch) {
      setSlashQuery(slashMatch[1].toLowerCase());
      setIsSlashOpen(true);
      setHighlightedIndex(0);
    } else {
      setIsSlashOpen(false);
    }
  }, [input]);

  // Filter skills matching slash query
  const filteredSlashSkills = useMemo(() => {
    if (!slashQuery) return installedSkills;
    return installedSkills.filter(
      (s) =>
        s.name.toLowerCase().includes(slashQuery) ||
        s.id.toLowerCase().includes(slashQuery) ||
        (s.description && s.description.toLowerCase().includes(slashQuery))
    );
  }, [installedSkills, slashQuery]);

  const handleSelectSkill = (skill) => {
    setSelectedSkill(skill);
    setIsAttachOpen(false);

    // If selected via slash command, remove the /prefix from input
    if (isSlashOpen) {
      const updated = input.replace(/(?:^|\s)\/([a-zA-Z0-9_-]*)$/, ' ').trimStart();
      setInput(updated);
      setIsSlashOpen(false);
    }
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    // Handle slash command suggestions navigation
    if (isSlashOpen && filteredSlashSkills.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightedIndex((prev) => (prev + 1) % filteredSlashSkills.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightedIndex((prev) => (prev - 1 + filteredSlashSkills.length) % filteredSlashSkills.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        const selected = filteredSlashSkills[highlightedIndex];
        if (selected) {
          handleSelectSkill(selected);
        }
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setIsSlashOpen(false);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      // Strictly prevent duplicate submissions while loading or streaming
      if (!isLoading && (input.trim() || attachedDocument)) {
        handleSubmit();
      }
    }
  };

  const handleSubmit = () => {
    const skillToSend = selectedSkill ? selectedSkill.id : null;
    onSend(undefined, undefined, undefined, undefined, skillToSend);
    setSelectedSkill(null);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file && onAttachFile) {
      onAttachFile(file);
    }
    setIsAttachOpen(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const triggerUpload = (acceptType) => {
    if (fileInputRef.current) {
      fileInputRef.current.accept = acceptType;
      fileInputRef.current.click();
    }
    setIsAttachOpen(false);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile && onAttachFile) {
      onAttachFile(droppedFile);
    }
  };

  const isSendDisabled = isLoading || isUploadingDocument || (!input.trim() && !attachedDocument);

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="shrink-0 w-full max-w-4xl mx-auto px-3 sm:px-4 pb-2 sm:pb-3 pt-1.5 relative"
    >
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.txt,.md,.markdown"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Drag & Drop Visual Overlay */}
      {isDragging && (
        <div className="absolute inset-x-4 inset-y-2 z-30 rounded-2xl bg-[#10131A]/95 border-2 border-dashed border-purple-500 backdrop-blur-sm flex flex-col items-center justify-center gap-2 pointer-events-none animate-fade-in shadow-2xl">
          <div className="w-12 h-12 rounded-full bg-purple-500/20 text-purple-300 flex items-center justify-center animate-bounce">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-purple-200">
            Drop PDF, TXT, or Markdown to Attach
          </p>
          <p className="text-xs text-slate-400">
            Max file size: 10MB
          </p>
        </div>
      )}

      {/* Slash Command Palette Popup */}
      {isSlashOpen && filteredSlashSkills.length > 0 && (
        <div
          ref={slashMenuRef}
          className="absolute bottom-full mb-2 left-4 right-4 sm:left-6 sm:w-80 rounded-2xl bg-[#10131A] border border-[#282D38] shadow-2xl p-2 z-50 animate-fade-in backdrop-blur-md"
        >
          <div className="px-2.5 py-1.5 text-[10px] font-bold text-purple-400 uppercase tracking-wider border-b border-[#282D38]/60 flex items-center justify-between">
            <span>Invoke Skill (/)</span>
            <span className="text-[10px] text-slate-500 font-normal">↑↓ to navigate, Enter to select</span>
          </div>
          <div className="max-h-48 overflow-y-auto mt-1 space-y-0.5">
            {filteredSlashSkills.map((skill, index) => {
              const isSelected = index === highlightedIndex;
              return (
                <button
                  key={skill.id}
                  type="button"
                  onClick={() => handleSelectSkill(skill)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  className={`w-full text-left px-2.5 py-1.5 rounded-xl text-xs transition-colors flex items-center gap-2 cursor-pointer ${
                    isSelected ? 'bg-purple-600/20 text-purple-200 border border-purple-500/30' : 'text-slate-300 hover:bg-[#151923] border border-transparent'
                  }`}
                >
                  <span className="text-sm">{skill.icon || '🧩'}</span>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold truncate">{skill.name}</div>
                    {skill.description && (
                      <div className="text-[10px] text-slate-500 truncate">{skill.description}</div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className={`rounded-2xl bg-[#151923] border ${
        isDragging ? 'border-purple-500 ring-2 ring-purple-500/30' : 'border-[#282D38]'
      } shadow-2xl focus-within:border-[#8B5CF6]/70 focus-within:ring-1 focus-within:ring-[#8B5CF6]/50 transition-all p-3`}>

        {/* Selected Skill Chip */}
        {selectedSkill && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 mb-2 rounded-lg bg-purple-500/15 border border-purple-500/30 text-purple-200 text-xs w-fit animate-fade-in">
            <span className="text-xs">{selectedSkill.icon || '🧩'}</span>
            <span className="font-semibold">{selectedSkill.name}</span>
            <button
              type="button"
              onClick={() => setSelectedSkill(null)}
              className="ml-1 text-purple-400 hover:text-white p-0.5 rounded cursor-pointer leading-none"
              title="Remove skill"
              aria-label="Remove skill"
            >
              ✕
            </button>
          </div>
        )}

        {/* Attached Document Card */}
        {(attachedDocument || isUploadingDocument) && (
          <DocumentAttachmentCard
            document={attachedDocument}
            isUploading={isUploadingDocument}
            uploadProgress={uploadProgress}
            onRemove={onRemoveDocument}
            onQuickAction={onQuickAction}
            disabled={isLoading}
          />
        )}

        {/* Multiline Text Area */}
        <textarea
          ref={textareaRef}
          rows={1}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
          placeholder={
            isLoading
              ? "Generating response... Click Stop to halt."
              : attachedDocument
              ? `Ask a question, request summary, or choose a quick analysis for ${attachedDocument.filename}...`
              : "Ask anything, request code, or type / for skills... (Shift + Enter for new line)"
          }
          className="w-full bg-transparent resize-none text-sm text-[#F3F4F6] placeholder-slate-500 focus:outline-none leading-relaxed min-h-[44px] max-h-[160px] px-1 py-1 disabled:opacity-60"
        />

        {/* Bottom Toolbar strictly displaying: [Attach ▼] [Model Selector ▼]                [Send] */}
        <div className="flex items-center justify-between pt-2 mt-1 border-t border-[#282D38]/60 relative">
          <div className="flex items-center gap-2">
            {/* Attach Popover Button */}
            <div className="relative" ref={attachMenuRef}>
              <button
                type="button"
                onClick={() => {
                  loadInstalledSkills();
                  setIsAttachOpen(prev => !prev);
                }}
                disabled={isLoading || isUploadingDocument}
                title="Attach Document or Use Skill"
                aria-haspopup="true"
                aria-expanded={isAttachOpen}
                className="px-2.5 py-1.5 rounded-xl text-xs bg-[#10131A] hover:bg-[#1E2330] text-slate-300 hover:text-purple-300 border border-[#282D38] hover:border-purple-500/40 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
              >
                <svg className="w-4 h-4 text-purple-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                </svg>
                <span className="font-medium">Attach</span>
                <svg className={`w-3 h-3 text-slate-400 transition-transform duration-200 ${isAttachOpen ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              {/* Attach Popover Menu */}
              {isAttachOpen && (
                <div className="absolute left-0 bottom-full mb-2 w-64 rounded-2xl bg-[#10131A] border border-[#282D38] shadow-2xl p-2 z-50 animate-fade-in backdrop-blur-md">
                  {/* SECTION 1: ATTACH FILE */}
                  <div className="px-2 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-[#282D38]/60 mb-1">
                    Attach File
                  </div>
                  <div className="space-y-0.5">
                    <button
                      type="button"
                      onClick={() => triggerUpload('.pdf')}
                      className="w-full text-left px-2.5 py-1.5 rounded-xl text-xs text-slate-300 hover:text-white hover:bg-[#151923] flex items-center gap-2 cursor-pointer transition-colors"
                    >
                      <span>📄</span>
                      <span className="font-medium">Upload PDF</span>
                      <span className="ml-auto text-[10px] font-mono text-slate-500">.pdf</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => triggerUpload('.txt')}
                      className="w-full text-left px-2.5 py-1.5 rounded-xl text-xs text-slate-300 hover:text-white hover:bg-[#151923] flex items-center gap-2 cursor-pointer transition-colors"
                    >
                      <span>📝</span>
                      <span className="font-medium">Upload TXT</span>
                      <span className="ml-auto text-[10px] font-mono text-slate-500">.txt</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => triggerUpload('.md,.markdown')}
                      className="w-full text-left px-2.5 py-1.5 rounded-xl text-xs text-slate-300 hover:text-white hover:bg-[#151923] flex items-center gap-2 cursor-pointer transition-colors"
                    >
                      <span>📑</span>
                      <span className="font-medium">Upload Markdown</span>
                      <span className="ml-auto text-[10px] font-mono text-purple-400">.md</span>
                    </button>
                  </div>

                  {/* SECTION 2: USE SKILL */}
                  <div className="mt-2.5 pt-2 border-t border-[#282D38]/60">
                    <div className="px-2 py-1 text-[10px] font-bold text-purple-400 uppercase tracking-wider mb-1 flex items-center justify-between">
                      <span>Use Skill</span>
                      <span className="text-[10px] font-mono text-slate-500 font-normal">or type /</span>
                    </div>

                    <div className="max-h-40 overflow-y-auto space-y-0.5">
                      {installedSkills.length === 0 ? (
                        <div className="px-2.5 py-2 text-xs text-slate-500 italic">
                          No skills installed
                        </div>
                      ) : (
                        installedSkills.map((skill) => (
                          <button
                            key={skill.id}
                            type="button"
                            onClick={() => handleSelectSkill(skill)}
                            className="w-full text-left px-2.5 py-1.5 rounded-xl text-xs text-slate-300 hover:text-white hover:bg-[#151923] flex items-center gap-2 cursor-pointer transition-colors"
                          >
                            <span>{skill.icon || '🧩'}</span>
                            <span className="font-medium truncate">{skill.name}</span>
                          </button>
                        ))
                      )}
                    </div>

                    {/* Manage Skills Link */}
                    {onOpenSkills && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsAttachOpen(false);
                          onOpenSkills();
                        }}
                        className="w-full text-left mt-1.5 pt-1.5 border-t border-[#282D38]/60 px-2.5 py-1 rounded-lg text-xs font-medium text-purple-300 hover:text-white hover:bg-[#151923] flex items-center justify-between cursor-pointer transition-colors"
                      >
                        <span>Manage Skills</span>
                        <span>→</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Model Selector */}
            <ModelSelector
              selectedModelId={selectedModelId}
              onSelectModel={onSelectModel}
              effort={effort}
              onSelectEffort={onSelectEffort}
              disabled={isLoading}
              customModels={customModels}
              onOpenApiKeyModal={onOpenApiKeyModal}
            />
          </div>

          <div className="flex items-center gap-2.5">
            {/* Active Stop Generation Action */}
            {isLoading && onStop && (
              <button
                type="button"
                onClick={onStop}
                title="Stop generation"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-950/40 hover:bg-red-900/60 text-red-300 hover:text-red-100 border border-red-500/40 text-xs font-medium transition-all shadow-sm shadow-red-950/50 cursor-pointer animate-pulse"
              >
                <span className="w-2 h-2 rounded-xs bg-red-400"></span>
                <span>Stop</span>
              </button>
            )}

            {/* Keyboard shortcut hint */}
            {!isLoading && (
              <span className="hidden sm:inline-block text-[11px] text-slate-500 select-none">
                Press <kbd className="px-1.5 py-0.5 rounded bg-[#10131A] border border-[#282D38] text-[10px]">Enter</kbd> to send
              </span>
            )}

            {/* Send / Stop Button */}
            {isLoading ? (
              <button
                type="button"
                onClick={onStop}
                title="Stop generation"
                aria-label="Stop generation"
                className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-red-600/90 hover:bg-red-600 active:scale-95 text-white transition-all shadow-sm shadow-red-500/30 cursor-pointer"
              >
                <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                  <rect x="5" y="5" width="14" height="14" rx="2" />
                </svg>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSendDisabled}
                aria-label="Send message"
                className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-[#8B5CF6] hover:bg-[#7C3AED] active:scale-95 text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-[#8B5CF6] shadow-sm shadow-purple-500/20 cursor-pointer"
              >
                <svg
                  className="w-4 h-4 translate-x-0.5 -translate-y-0.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Footer Disclaimer & Compact "View Usage" Popover */}
      <div className="flex items-center justify-between text-[11px] text-slate-500 px-2 pt-1.5 select-none">
        <span className="truncate">OmniAI can make mistakes. Verify critical information.</span>
        <UsagePopover />
      </div>
    </div>
  );
}
