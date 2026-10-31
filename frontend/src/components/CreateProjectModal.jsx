import React, { useState } from 'react';
import { createProject } from '../services/api';

const PROJECT_ICONS = [
  { id: 'folder', label: 'Folder', icon: '📁' },
  { id: 'code', label: 'Code', icon: '💻' },
  { id: 'terminal', label: 'Terminal', icon: '⚡' },
  { id: 'cpu', label: 'System', icon: '🧠' },
  { id: 'globe', label: 'Web', icon: '🌐' },
  { id: 'book', label: 'Docs', icon: '📚' },
  { id: 'sparkles', label: 'AI Labs', icon: '✨' },
];

export function CreateProjectModal({ isOpen, onClose, onProjectCreated }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('folder');
  const [visibility, setVisibility] = useState('private');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please provide a project name.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const project = await createProject({
        name: name.trim(),
        description: description.trim() || null,
        icon: selectedIcon,
        visibility,
      });
      setName('');
      setDescription('');
      onClose();
      if (onProjectCreated) onProjectCreated(project);
    } catch (err) {
      setError(err.message || 'Failed to create project.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md bg-[#10131A] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#151923]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">New Collaborative Project</h3>
              <p className="text-xs text-slate-400">Create a shared workspace for team AI collaboration.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 text-xs bg-red-950/60 border border-red-500/40 rounded-xl text-red-200 flex items-center justify-between">
              <span>{error}</span>
              <button type="button" onClick={() => setError(null)} className="text-red-400 hover:text-white">✕</button>
            </div>
          )}

          {/* Project Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Project Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Q4 Research & Synthesis"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-[#151923] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Description (Optional)</label>
            <textarea
              rows={2}
              placeholder="Summarize project goals, team members, or shared context..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-[#151923] border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 resize-none"
            />
          </div>

          {/* Project Icon */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Workspace Icon</label>
            <div className="grid grid-cols-7 gap-2">
              {PROJECT_ICONS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedIcon(item.id)}
                  className={`p-2 rounded-xl text-lg flex items-center justify-center border transition-all cursor-pointer ${
                    selectedIcon === item.id
                      ? 'bg-purple-600/20 border-purple-500 shadow-sm shadow-purple-500/30'
                      : 'bg-[#151923] border-slate-800 hover:border-slate-700'
                  }`}
                  title={item.label}
                >
                  {item.icon}
                </button>
              ))}
            </div>
          </div>

          {/* Visibility */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Visibility</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setVisibility('private')}
                className={`p-2.5 rounded-xl border text-left cursor-pointer transition-colors ${
                  visibility === 'private'
                    ? 'bg-purple-600/15 border-purple-500 text-white'
                    : 'bg-[#151923] border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="text-xs font-semibold">🔒 Private</div>
                <div className="text-[10px] text-slate-400">Only invited members</div>
              </button>
              <button
                type="button"
                onClick={() => setVisibility('invite_only')}
                className={`p-2.5 rounded-xl border text-left cursor-pointer transition-colors ${
                  visibility === 'invite_only'
                    ? 'bg-purple-600/15 border-purple-500 text-white'
                    : 'bg-[#151923] border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="text-xs font-semibold">🔗 Link / Invite</div>
                <div className="text-[10px] text-slate-400">Via invite link</div>
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-800/80">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-semibold transition-colors cursor-pointer shadow-md shadow-purple-600/30"
            >
              {loading ? 'Creating...' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

