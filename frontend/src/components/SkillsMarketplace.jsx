import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  fetchSkillsCatalog,
  installSkill,
  uninstallSkill,
  toggleSkillStatus,
  executeSkill,
} from '../services/api';

const CATEGORIES = [
  'All',
  'Featured',
  'Coding & Development',
  'Research & Web',
  'Productivity',
  'Data Analysis',
  'Documents & PDF',
  'Mathematics',
  'Automation',
  'Third-Party Integrations',
];

function SkillIcon({ icon, className = 'w-5 h-5 text-purple-400' }) {
  switch (icon) {
    case 'code':
    case 'terminal':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="16 18 22 12 16 6" />
          <polyline points="8 6 2 12 8 18" />
        </svg>
      );
    case 'globe':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
      );
    case 'table':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <line x1="3" y1="9" x2="21" y2="9" />
          <line x1="3" y1="15" x2="21" y2="15" />
          <line x1="12" y1="3" x2="12" y2="21" />
        </svg>
      );
    case 'calculator':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="4" y="2" width="16" height="20" rx="2" />
          <line x1="8" y1="6" x2="16" y2="6" />
          <line x1="16" y1="14" x2="16" y2="18" />
          <path d="M16 10h.01" />
          <path d="M12 10h.01" />
          <path d="M8 10h.01" />
          <path d="M12 14h.01" />
          <path d="M8 14h.01" />
          <path d="M12 18h.01" />
          <path d="M8 18h.01" />
        </svg>
      );
    case 'github':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
        </svg>
      );
    case 'folder':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
        </svg>
      );
    case 'calendar':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      );
    case 'mail':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
          <polyline points="22,6 12,13 2,6" />
        </svg>
      );
    default:
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2L2 7l10 5 10-5-10-5z" />
          <path d="M2 17l10 5 10-5" />
          <path d="M2 12l10 5 10-5" />
        </svg>
      );
  }
}

export function SkillsMarketplace({ onBackToChat }) {
  const [activeTab, setActiveTab] = useState('all'); // 'featured' | 'all' | 'installed' | 'integrations'
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [skills, setSkills] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Consent modal state for installing
  const [consentSkill, setConsentSkill] = useState(null);
  const [isInstalling, setIsInstalling] = useState(false);

  // Try execution modal state
  const [executingSkill, setExecutingSkill] = useState(null);
  const [execInput, setExecInput] = useState('');
  const [execResult, setExecResult] = useState(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [execError, setExecError] = useState(null);

  const loadSkills = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchSkillsCatalog(
        selectedCategory === 'Featured' ? null : selectedCategory,
        searchQuery,
        activeTab === 'installed',
        selectedCategory === 'Featured' || activeTab === 'featured'
      );
      setSkills(data.skills || []);
    } catch (err) {
      console.error('Failed to load skills:', err);
      setError('Unable to load skills marketplace. Please check your connection.');
    } finally {
      setIsLoading(false);
    }
  }, [selectedCategory, searchQuery, activeTab]);

  useEffect(() => {
    loadSkills();
  }, [loadSkills]);

  const handleInstallClick = (skill) => {
    setConsentSkill(skill);
  };

  const handleConfirmInstall = async () => {
    if (!consentSkill) return;
    setIsInstalling(true);
    try {
      await installSkill(consentSkill.id, true);
      setConsentSkill(null);
      await loadSkills();
    } catch (err) {
      alert(`Install failed: ${err.message}`);
    } finally {
      setIsInstalling(false);
    }
  };

  const handleUninstall = async (skillId) => {
    if (!window.confirm('Are you sure you want to uninstall this skill?')) return;
    try {
      await uninstallSkill(skillId);
      await loadSkills();
    } catch (err) {
      alert(`Uninstall failed: ${err.message}`);
    }
  };

  const handleToggle = async (skillId, currentEnabled) => {
    try {
      await toggleSkillStatus(skillId, !currentEnabled);
      await loadSkills();
    } catch (err) {
      alert(`Status toggle failed: ${err.message}`);
    }
  };

  const handleOpenRunner = (skill) => {
    setExecutingSkill(skill);
    setExecResult(null);
    setExecError(null);
    if (skill.id === 'math-solver') {
      setExecInput('(125 * 8) + (450 / 5)');
    } else if (skill.id === 'csv-analyzer') {
      setExecInput("product,sales,revenue\nAlpha,150,4500\nBeta,80,6400\nGamma,220,11000");
    } else if (skill.id === 'code-explainer') {
      setExecInput("def quicksort(arr):\n    if len(arr) <= 1: return arr\n    pivot = arr[len(arr) // 2]\n    return quicksort([x for x in arr if x < pivot]) + [x for x in arr if x == pivot] + quicksort([x for x in arr if x > pivot])");
    } else {
      setExecInput('Summarize the decoupling of frontend interfaces from multi-vendor AI API backends.');
    }
  };

  const handleRunExecution = async () => {
    if (!executingSkill || !execInput.trim()) return;
    setIsExecuting(true);
    setExecError(null);
    setExecResult(null);
    try {
      let params = {};
      if (executingSkill.id === 'math-solver') params = { expression: execInput.trim() };
      else if (executingSkill.id === 'csv-analyzer') params = { csv_text: execInput.trim() };
      else if (executingSkill.id === 'code-explainer') params = { code: execInput.trim(), language: 'python' };
      else params = { text: execInput.trim() };

      const resp = await executeSkill(executingSkill.id, params);
      setExecResult(resp.result);
    } catch (err) {
      setExecError(err.message || 'Execution error');
    } finally {
      setIsExecuting(false);
    }
  };

  // Filter skills based on tab
  const displayedSkills = useMemo(() => {
    if (activeTab === 'featured') {
      return skills.filter((s) => s.is_featured);
    }
    if (activeTab === 'installed') {
      return skills.filter((s) => s.is_installed);
    }
    if (activeTab === 'integrations') {
      return skills.filter((s) => s.is_third_party || s.category === 'Third-Party Integrations');
    }
    return skills;
  }, [skills, activeTab]);

  return (
    <div className="h-full flex flex-col bg-[#0B0D12] text-slate-200 overflow-hidden">
      {/* Marketplace Header */}
      <div className="shrink-0 border-b border-[#282D38] bg-[#10131A]/95 px-4 sm:px-6 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 max-w-6xl mx-auto">
          <div>
            <div className="flex items-center gap-2 mb-1">
              {onBackToChat && (
                <button
                  type="button"
                  onClick={onBackToChat}
                  className="p-1 rounded-lg hover:bg-[#151923] text-slate-400 hover:text-white transition-colors cursor-pointer mr-1"
                  title="Back to chat"
                >
                  ←
                </button>
              )}
              <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white shadow-xs">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5" />
                  <path d="M2 12l10 5 10-5" />
                </svg>
              </div>
              <h1 className="text-base sm:text-lg font-bold text-white tracking-tight">
                Skills Marketplace
              </h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/20">
                Agentic Extensions
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Extend OmniAI capabilities with sandboxed tools, computational solvers, and third-party API integrations.
            </p>
          </div>

          {/* Search Box */}
          <div className="w-full sm:w-72">
            <div className="relative">
              <svg className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search skills, tools, or integrations..."
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-[#151923] border border-[#282D38] focus:border-purple-500 focus:outline-none text-xs text-white placeholder-slate-500 transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white text-xs"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Section Tabs (Featured | All | Installed | Integrations) */}
        <div className="flex items-center gap-2 mt-4 max-w-6xl mx-auto border-b border-[#282D38]/60 pb-2">
          {[
            { id: 'all', label: 'All Skills', icon: '🌐' },
            { id: 'featured', label: 'Featured Skills', icon: '⭐' },
            { id: 'installed', label: 'Installed Skills', icon: '✅' },
            { id: 'integrations', label: 'My Integrations', icon: '🔌' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-purple-600/20 text-purple-200 border border-purple-500/50 shadow-xs'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#151923] border border-transparent'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 mt-3 overflow-x-auto pb-1 max-w-6xl mx-auto no-scrollbar">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-2.5 py-1 rounded-lg text-[11px] whitespace-nowrap transition-colors cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-purple-600 text-white font-medium shadow-xs'
                  : 'bg-[#151923] hover:bg-[#1E2330] text-slate-400 hover:text-slate-200 border border-[#282D38]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Main Grid Content */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="max-w-6xl mx-auto">
          {isLoading ? (
            <div className="py-24 text-center space-y-3">
              <svg className="w-8 h-8 animate-spin text-purple-400 mx-auto" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
              <p className="text-xs text-slate-400">Loading catalog from skill registry...</p>
            </div>
          ) : error ? (
            <div className="py-20 text-center space-y-3">
              <p className="text-sm text-red-300">{error}</p>
              <button
                type="button"
                onClick={loadSkills}
                className="px-4 py-2 rounded-xl bg-[#151923] border border-[#282D38] hover:border-purple-500 text-xs font-semibold text-white"
              >
                Retry
              </button>
            </div>
          ) : displayedSkills.length === 0 ? (
            <div className="py-24 text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-[#151923] border border-[#282D38] flex items-center justify-center mx-auto text-slate-500 mb-2">
                🧩
              </div>
              <p className="text-sm font-semibold text-slate-300">No skills found</p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {activeTab === 'installed'
                  ? 'You have not installed any skills yet. Browse the All Skills tab to install tools.'
                  : 'No skills match your active category and search filter.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {displayedSkills.map((skill) => (
                <div
                  key={skill.id}
                  className={`flex flex-col justify-between rounded-2xl bg-[#151923] border transition-all p-4 ${
                    skill.is_installed
                      ? 'border-purple-500/40 shadow-sm shadow-purple-950/20'
                      : 'border-[#282D38] hover:border-slate-600'
                  }`}
                >
                  <div>
                    {/* Top Row: Icon, Provider, Badges */}
                    <div className="flex items-start justify-between gap-3 mb-2.5">
                      <div className="w-10 h-10 rounded-xl bg-[#10131A] border border-[#282D38] flex items-center justify-center shrink-0 shadow-xs">
                        <SkillIcon icon={skill.icon} />
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 justify-end">
                        {skill.is_featured && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20">
                            ⭐ Featured
                          </span>
                        )}
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[#10131A] text-slate-400 border border-[#282D38]">
                          {skill.category}
                        </span>
                      </div>
                    </div>

                    {/* Skill Title & Provider */}
                    <div className="mb-2">
                      <h3 className="text-sm font-bold text-white group-hover:text-purple-300 transition-colors">
                        {skill.name}
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        by <span className="text-purple-300">{skill.provider}</span> • v{skill.version}
                      </p>
                    </div>

                    {/* Description */}
                    <p className="text-xs text-slate-300 leading-relaxed mb-3 line-clamp-3">
                      {skill.description}
                    </p>

                    {/* Permissions Tag List */}
                    <div className="mb-3">
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                        Required Permissions
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {skill.permissions.map((perm) => (
                          <span
                            key={perm}
                            className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#10131A] border border-[#282D38] text-slate-400"
                          >
                            {perm}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Card Actions Footer */}
                  <div className="pt-3 border-t border-[#282D38]/70 flex items-center justify-between gap-2">
                    {skill.is_third_party ? (
                      <div className="flex items-center justify-between w-full">
                        <span className="text-[11px] font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                          {skill.connection_status === 'connected' ? 'Connected' : 'Requires Server OAuth'}
                        </span>
                        <button
                          type="button"
                          onClick={() => alert(`OAuth connection for ${skill.provider} requires setting up ${skill.provider.toUpperCase()}_CLIENT_ID on the server.`)}
                          className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#10131A] hover:bg-[#1E2330] text-purple-300 border border-purple-500/30 cursor-pointer"
                        >
                          Connect
                        </button>
                      </div>
                    ) : skill.is_installed ? (
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-2">
                          <label className="relative inline-flex items-center cursor-pointer" title="Enable or disable this skill">
                            <input
                              type="checkbox"
                              checked={skill.is_enabled}
                              onChange={() => handleToggle(skill.id, skill.is_enabled)}
                              className="sr-only peer"
                            />
                            <div className="w-8 h-4.5 bg-[#10131A] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-purple-600 border border-[#282D38]"></div>
                          </label>
                          <span className="text-[11px] font-medium text-slate-300">
                            {skill.is_enabled ? 'Active' : 'Disabled'}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {skill.has_executable_runner && skill.is_enabled && (
                            <button
                              type="button"
                              onClick={() => handleOpenRunner(skill)}
                              className="px-2.5 py-1 rounded-lg text-xs font-medium bg-purple-950/40 hover:bg-purple-900/50 text-purple-300 border border-purple-500/30 cursor-pointer"
                            >
                              Try Skill
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleUninstall(skill.id)}
                            className="text-[11px] text-red-400 hover:text-red-300 hover:underline px-1 py-1 cursor-pointer"
                          >
                            Uninstall
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleInstallClick(skill)}
                        className="w-full py-1.5 px-3 rounded-xl text-xs font-semibold bg-[#8B5CF6] hover:bg-[#7C3AED] text-white transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <span>+</span>
                        <span>Install Skill</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Consent & Permission Confirmation Dialog */}
      {consentSkill && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in"
        >
          <div className="w-full max-w-md rounded-2xl bg-[#10131A] border border-[#282D38] shadow-2xl p-6 text-slate-200">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-[#151923] border border-[#282D38] flex items-center justify-center">
                <SkillIcon icon={consentSkill.icon} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Install {consentSkill.name}</h3>
                <p className="text-[11px] text-slate-400">by {consentSkill.provider}</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 mb-4 leading-relaxed">
              {consentSkill.description}
            </p>

            <div className="p-3 rounded-xl bg-[#151923] border border-[#282D38] mb-4">
              <span className="text-xs font-semibold text-purple-300 block mb-1.5">
                Review Required Permissions:
              </span>
              <ul className="space-y-1">
                {consentSkill.permissions.map((perm) => (
                  <li key={perm} className="flex items-center gap-2 text-xs text-slate-300">
                    <span className="text-emerald-400 text-sm">✓</span>
                    <span className="font-mono text-[11px]">{perm}</span>
                  </li>
                ))}
              </ul>
              <p className="text-[11px] text-slate-400 mt-2">
                All execution occurs within isolated sandboxed handlers. You can disable or uninstall this skill at any time.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setConsentSkill(null)}
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-[#151923] hover:bg-[#1E2330] text-slate-300 border border-[#282D38] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isInstalling}
                onClick={handleConfirmInstall}
                className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-[#8B5CF6] hover:bg-[#7C3AED] text-white transition-all shadow-md cursor-pointer disabled:opacity-50"
              >
                {isInstalling ? 'Installing...' : 'Confirm & Install'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Interactive Try Skill Execution Modal */}
      {executingSkill && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in"
        >
          <div className="w-full max-w-lg rounded-2xl bg-[#10131A] border border-[#282D38] shadow-2xl p-6 text-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-[#282D38] mb-3">
              <div className="flex items-center gap-2">
                <SkillIcon icon={executingSkill.icon} />
                <h3 className="text-sm font-bold text-white">Execute {executingSkill.name}</h3>
              </div>
              <button
                type="button"
                onClick={() => setExecutingSkill(null)}
                className="text-slate-400 hover:text-white text-xs p-1"
              >
                ✕
              </button>
            </div>

            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Input Payload
            </label>
            <textarea
              rows={4}
              value={execInput}
              onChange={(e) => setExecInput(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-[#151923] border border-[#282D38] focus:border-purple-500 focus:outline-none text-xs font-mono text-slate-200 resize-none leading-relaxed mb-3"
            />

            <button
              type="button"
              disabled={isExecuting || !execInput.trim()}
              onClick={handleRunExecution}
              className="w-full py-2 rounded-xl text-xs font-semibold bg-[#8B5CF6] hover:bg-[#7C3AED] text-white transition-all shadow-md disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2 mb-3"
            >
              {isExecuting ? 'Executing Skill...' : 'Run Skill'}
            </button>

            {execError && (
              <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/40 text-xs text-red-200 mb-3">
                ⚠️ {execError}
              </div>
            )}

            {execResult && (
              <div className="p-3 rounded-xl bg-[#151923] border border-[#282D38] space-y-2">
                <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block">
                  Execution Output
                </span>
                <pre className="text-[11px] font-mono text-slate-300 overflow-x-auto p-2 rounded bg-black/40 border border-white/5 max-h-48">
                  {JSON.stringify(execResult, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
