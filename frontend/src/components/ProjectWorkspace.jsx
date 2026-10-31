import React, { useState, useEffect, useRef } from 'react';
import {
  fetchProjectDetail,
  updateProject,
  deleteProject,
  createProjectInvitation,
  updateProjectMemberRole,
  removeProjectMember,
  moveConversationToProject,
  toggleProjectSkill,
  uploadProjectFile,
  deleteProjectFile,
} from '../services/api';

const ICON_MAP = {
  folder: '📁',
  code: '💻',
  terminal: '⚡',
  cpu: '🧠',
  globe: '🌐',
  book: '📚',
  sparkles: '✨',
};

export function ProjectWorkspace({
  projectId,
  onBackToChat,
  onOpenConversation,
  userConversations = [],
  currentUser,
  onProjectDeleted,
  onStartNewProjectChat,
}) {
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'conversations' | 'members' | 'files' | 'skills' | 'settings'
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Invite Form
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [inviting, setInviting] = useState(false);
  const [copiedInvite, setCopiedInvite] = useState(false);

  // Move Conversation modal/selector
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [selectedConvToMove, setSelectedConvToMove] = useState('');

  // File Upload
  const fileInputRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  // Settings Edit Form
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editVisibility, setEditVisibility] = useState('private');
  const [savingSettings, setSavingSettings] = useState(false);

  const loadProject = async () => {
    if (!projectId) return;
    try {
      setLoading(true);
      setError(null);
      const data = await fetchProjectDetail(projectId);
      setProject(data);
      setEditName(data.name);
      setEditDesc(data.description || '');
      setEditVisibility(data.visibility || 'private');
    } catch (err) {
      setError(err.message || 'Failed to load project details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProject();
  }, [projectId]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#0B0D12] text-slate-400">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm">Loading Project Workspace...</span>
        </div>
      </div>
    );
  }

  if (error && !project) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[#0B0D12] text-slate-400 p-6 space-y-4">
        <div className="p-4 rounded-2xl bg-red-950/40 border border-red-500/30 text-red-200 text-sm max-w-md text-center">
          {error}
        </div>
        <button
          onClick={onBackToChat}
          className="px-4 py-2 rounded-xl bg-purple-600 text-white text-xs font-semibold hover:bg-purple-500"
        >
          Return to Chat
        </button>
      </div>
    );
  }

  const role = project?.current_user_role || 'viewer';
  const isOwner = role === 'owner';
  const isAdmin = role === 'admin' || isOwner;
  const isViewer = role === 'viewer';

  // Invite member
  const handleInvite = async (e) => {
    e.preventDefault();
    try {
      setInviting(true);
      setError(null);
      await createProjectInvitation(projectId, {
        email: inviteEmail.trim() || null,
        role: inviteRole,
        expiry_days: 7,
      });
      setSuccessMsg(`Invitation created for ${inviteEmail.trim() || 'invite link'}`);
      setInviteEmail('');
      await loadProject();
    } catch (err) {
      setError(err.message || 'Failed to invite member.');
    } finally {
      setInviting(false);
    }
  };

  // Move conversation
  const handleMoveConversation = async () => {
    if (!selectedConvToMove) return;
    try {
      setError(null);
      await moveConversationToProject(projectId, selectedConvToMove);
      setShowMoveModal(false);
      setSelectedConvToMove('');
      setSuccessMsg('Conversation moved into project.');
      await loadProject();
    } catch (err) {
      setError(err.message || 'Failed to move conversation.');
    }
  };

  // Upload Project File
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      setError(null);
      await uploadProjectFile(projectId, file);
      setSuccessMsg(`Uploaded file '${file.name}'`);
      await loadProject();
    } catch (err) {
      setError(err.message || 'Failed to upload file.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Delete Project File
  const handleDeleteFile = async (fileId) => {
    try {
      setError(null);
      await deleteProjectFile(projectId, fileId);
      await loadProject();
    } catch (err) {
      setError(err.message || 'Failed to delete file.');
    }
  };

  // Toggle Skill
  const handleToggleSkill = async (skillId, currentStatus) => {
    try {
      setError(null);
      await toggleProjectSkill(projectId, skillId, !currentStatus);
      await loadProject();
    } catch (err) {
      setError(err.message || 'Failed to toggle skill.');
    }
  };

  // Update Settings
  const handleSaveSettings = async (e) => {
    e.preventDefault();
    try {
      setSavingSettings(true);
      setError(null);
      await updateProject(projectId, {
        name: editName.trim(),
        description: editDesc.trim() || null,
        visibility: editVisibility,
      });
      setSuccessMsg('Project settings updated.');
      await loadProject();
    } catch (err) {
      setError(err.message || 'Failed to update project settings.');
    } finally {
      setSavingSettings(false);
    }
  };

  // Delete Project
  const handleDeleteProject = async () => {
    if (!window.confirm(`Are you sure you want to permanently delete '${project.name}'? This cannot be undone.`)) {
      return;
    }
    try {
      await deleteProject(projectId);
      if (onProjectDeleted) onProjectDeleted(projectId);
      onBackToChat();
    } catch (err) {
      setError(err.message || 'Failed to delete project.');
    }
  };

  const projectIcon = ICON_MAP[project.icon] || '📁';

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 bg-[#0B0D12] text-[#F3F4F6] overflow-hidden">
      {/* Top Header & Navigation */}
      <div className="px-6 py-4 border-b border-slate-800 bg-[#10131A] flex flex-wrap items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBackToChat}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title="Back to Chat"
          >
            ←
          </button>
          <div className="w-10 h-10 rounded-2xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-xl">
            {projectIcon}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white">{project.name}</h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-wider bg-purple-950 text-purple-300 border border-purple-500/30">
                {role}
              </span>
              <span className="text-xs text-slate-500">
                {project.visibility === 'private' ? '🔒 Private' : '🔗 Invite-Only'}
              </span>
            </div>
            {project.description && (
              <p className="text-xs text-slate-400 max-w-xl truncate mt-0.5">{project.description}</p>
            )}
          </div>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center gap-1 bg-[#151923] p-1 rounded-xl border border-slate-800 text-xs">
          {[
            { id: 'overview', label: 'Overview', icon: '📊' },
            { id: 'conversations', label: `Conversations (${project.conversation_count})`, icon: '💬' },
            { id: 'members', label: `Members (${project.member_count})`, icon: '👥' },
            { id: 'files', label: `Files (${project.file_count})`, icon: '📄' },
            { id: 'skills', label: 'Skills', icon: '🧩' },
            ...(isAdmin ? [{ id: 'settings', label: 'Settings', icon: '⚙️' }] : []),
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span className="mr-1">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="px-6 py-2.5 bg-red-950/60 border-b border-red-500/40 text-red-200 text-xs flex justify-between items-center">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-white">✕</button>
        </div>
      )}
      {successMsg && (
        <div className="px-6 py-2.5 bg-emerald-950/60 border-b border-emerald-500/40 text-emerald-200 text-xs flex justify-between items-center">
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Main Workspace Body */}
      <div className="flex-1 overflow-y-auto p-6 max-w-6xl w-full mx-auto space-y-6">
        {/* 1. OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div className="space-y-6 animate-fade-in">
            {/* Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-2xl bg-[#10131A] border border-slate-800 space-y-1">
                <span className="text-xs text-slate-400">Conversations</span>
                <div className="text-2xl font-bold text-white">{project.conversation_count}</div>
              </div>
              <div className="p-4 rounded-2xl bg-[#10131A] border border-slate-800 space-y-1">
                <span className="text-xs text-slate-400">Members</span>
                <div className="text-2xl font-bold text-white">{project.member_count}</div>
              </div>
              <div className="p-4 rounded-2xl bg-[#10131A] border border-slate-800 space-y-1">
                <span className="text-xs text-slate-400">Project Files</span>
                <div className="text-2xl font-bold text-white">{project.file_count}</div>
              </div>
              <div className="p-4 rounded-2xl bg-[#10131A] border border-slate-800 space-y-1">
                <span className="text-xs text-slate-400">Created</span>
                <div className="text-sm font-semibold text-white truncate">
                  {new Date(project.created_at).toLocaleDateString()}
                </div>
              </div>
            </div>

            {/* Quick Actions & Recent Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Quick Actions */}
              <div className="p-5 rounded-2xl bg-[#10131A] border border-slate-800 space-y-3">
                <h3 className="text-sm font-semibold text-white">Project Quick Actions</h3>
                <div className="space-y-2">
                  {!isViewer && (
                    <button
                      type="button"
                      onClick={() => onStartNewProjectChat && onStartNewProjectChat(projectId)}
                      className="w-full text-left px-3.5 py-2.5 rounded-xl bg-purple-600/15 hover:bg-purple-600/25 border border-purple-500/30 text-purple-200 text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer"
                    >
                      <span>💬 New Project Conversation</span>
                      <span>→</span>
                    </button>
                  )}
                  {!isViewer && (
                    <button
                      type="button"
                      onClick={() => setShowMoveModal(true)}
                      className="w-full text-left px-3.5 py-2.5 rounded-xl bg-[#151923] hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-medium flex items-center justify-between transition-colors cursor-pointer"
                    >
                      <span>📥 Move Existing Conversation</span>
                      <span>→</span>
                    </button>
                  )}
                  {!isViewer && (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full text-left px-3.5 py-2.5 rounded-xl bg-[#151923] hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-medium flex items-center justify-between transition-colors cursor-pointer"
                    >
                      <span>📎 Upload Shared Context File</span>
                      <span>+</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Recent Activity Timeline */}
              <div className="lg:col-span-2 p-5 rounded-2xl bg-[#10131A] border border-slate-800 space-y-3">
                <h3 className="text-sm font-semibold text-white">Recent Activity</h3>
                {project.recent_activity?.length > 0 ? (
                  <div className="divide-y divide-slate-800/60 max-h-64 overflow-y-auto pr-1">
                    {project.recent_activity.map((event) => (
                      <div key={event.id} className="py-2.5 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-purple-400" />
                          <span className="text-slate-300">
                            <strong>{event.user_name}</strong> {event.details || event.event_type}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {new Date(event.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic py-4">No recent activity logged for this project yet.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 2. CONVERSATIONS TAB */}
        {activeTab === 'conversations' && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-white">Project Conversations</h3>
                <p className="text-xs text-slate-400">All chat sessions shared across this workspace.</p>
              </div>
              <div className="flex items-center gap-2">
                {!isViewer && (
                  <button
                    type="button"
                    onClick={() => setShowMoveModal(true)}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium cursor-pointer"
                  >
                    Move Conversation
                  </button>
                )}
                {!isViewer && (
                  <button
                    type="button"
                    onClick={() => onStartNewProjectChat && onStartNewProjectChat(projectId)}
                    className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold cursor-pointer shadow-md shadow-purple-600/30"
                  >
                    + New Conversation
                  </button>
                )}
              </div>
            </div>

            {project.conversations?.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {project.conversations.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => onOpenConversation && onOpenConversation(c.id)}
                    className="p-4 rounded-2xl bg-[#10131A] border border-slate-800 hover:border-purple-500/50 hover:bg-[#151923] transition-all cursor-pointer group space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-white group-hover:text-purple-300 truncate max-w-[260px]">
                        {c.title}
                      </h4>
                      <span className="text-[11px] text-slate-500">
                        {c.message_count} {c.message_count === 1 ? 'msg' : 'msgs'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>Last active: {new Date(c.updated_at).toLocaleDateString()}</span>
                      <span className="text-purple-400 group-hover:translate-x-0.5 transition-transform">Open →</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 rounded-2xl bg-[#10131A] border border-slate-800 space-y-3">
                <span className="text-3xl">💬</span>
                <p className="text-sm text-slate-300 font-medium">No conversations in this project yet.</p>
                {!isViewer && (
                  <button
                    type="button"
                    onClick={() => onStartNewProjectChat && onStartNewProjectChat(projectId)}
                    className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold"
                  >
                    Start the First Conversation
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* 3. MEMBERS TAB */}
        {activeTab === 'members' && (
          <div className="space-y-6 animate-fade-in">
            {/* Invite Form */}
            {isAdmin && (
              <div className="p-4 rounded-2xl bg-[#10131A] border border-slate-800 space-y-3">
                <h4 className="text-sm font-semibold text-white">Invite New Team Member</h4>
                <form onSubmit={handleInvite} className="flex flex-wrap items-center gap-2">
                  <input
                    type="email"
                    placeholder="teammate@company.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="flex-1 min-w-[220px] bg-[#151923] border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                  />
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                    className="bg-[#151923] border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-purple-500 cursor-pointer"
                  >
                    <option value="admin">Admin</option>
                    <option value="member">Member</option>
                    <option value="viewer">Viewer</option>
                  </select>
                  <button
                    type="submit"
                    disabled={inviting}
                    className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-semibold cursor-pointer"
                  >
                    {inviting ? 'Inviting...' : 'Send Invitation'}
                  </button>
                </form>
              </div>
            )}

            {/* Member List */}
            <div className="p-4 rounded-2xl bg-[#10131A] border border-slate-800 space-y-3">
              <h4 className="text-sm font-semibold text-white">Active Members ({project.members?.length})</h4>
              <div className="divide-y divide-slate-800/60">
                {project.members?.map((member) => {
                  const isCurrent = currentUser?.id === member.user_id;
                  const isMemberOwner = member.role === 'owner';

                  return (
                    <div key={member.id} className="py-3 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-purple-600/30 text-purple-300 border border-purple-500/30 flex items-center justify-center font-bold text-xs uppercase">
                          {member.display_name ? member.display_name[0] : (member.email ? member.email[0] : 'U')}
                        </div>
                        <div>
                          <div className="text-white font-medium flex items-center gap-1.5">
                            <span>{member.display_name || member.email || 'Member'}</span>
                            {isCurrent && <span className="text-[10px] text-purple-400">(You)</span>}
                          </div>
                          {member.email && <div className="text-[11px] text-slate-500">{member.email}</div>}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {isOwner && !isMemberOwner ? (
                          <select
                            value={member.role}
                            onChange={(e) => updateProjectMemberRole(projectId, member.user_id, e.target.value).then(loadProject)}
                            className="bg-[#151923] border border-slate-800 rounded-lg px-2 py-1 text-[11px] text-slate-300 focus:outline-none cursor-pointer"
                          >
                            <option value="admin">Admin</option>
                            <option value="member">Member</option>
                            <option value="viewer">Viewer</option>
                          </select>
                        ) : (
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            member.role === 'owner'
                              ? 'bg-purple-950 text-purple-300 border border-purple-500/40'
                              : member.role === 'admin'
                              ? 'bg-blue-950 text-blue-300 border border-blue-500/40'
                              : 'bg-slate-800 text-slate-300 border border-slate-700'
                          }`}>
                            {member.role}
                          </span>
                        )}

                        {((isAdmin && !isMemberOwner) || isCurrent) && (
                          <button
                            type="button"
                            onClick={() => removeProjectMember(projectId, member.user_id).then(loadProject)}
                            className="text-slate-500 hover:text-red-400 p-1 text-xs cursor-pointer transition-colors"
                            title={isCurrent ? 'Leave Project' : 'Remove Member'}
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Pending Invitations */}
            {isAdmin && project.pending_invitations?.length > 0 && (
              <div className="p-4 rounded-2xl bg-[#10131A] border border-slate-800 space-y-3">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Pending Invitations ({project.pending_invitations.length})
                </h4>
                <div className="divide-y divide-slate-800/50">
                  {project.pending_invitations.map((inv) => (
                    <div key={inv.id} className="py-2.5 flex items-center justify-between text-xs">
                      <div>
                        <span className="text-white font-medium">{inv.email || 'Invite Link'}</span>
                        <span className="ml-2 px-1.5 py-0.5 text-[10px] font-mono uppercase bg-slate-800 text-slate-300 rounded">
                          {inv.role}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const url = `${window.location.origin}/join/p/${inv.token}`;
                          navigator.clipboard.writeText(url);
                          setCopiedInvite(true);
                          setTimeout(() => setCopiedInvite(false), 2000);
                        }}
                        className="text-xs text-purple-400 hover:text-white cursor-pointer"
                      >
                        {copiedInvite ? 'Copied Link!' : 'Copy Link'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 4. FILES TAB */}
        {activeTab === 'files' && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-white">Project Documents & Context</h3>
                <p className="text-xs text-slate-400">All project conversations can ground against these files.</p>
              </div>
              {!isViewer && (
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.txt,.md"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    disabled={uploading}
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-semibold cursor-pointer shadow-md shadow-purple-600/30 flex items-center gap-1.5"
                  >
                    <span>{uploading ? 'Uploading...' : '+ Upload File'}</span>
                  </button>
                </div>
              )}
            </div>

            {project.files?.length > 0 ? (
              <div className="divide-y divide-slate-800/80 rounded-2xl bg-[#10131A] border border-slate-800 overflow-hidden">
                {project.files.map((file) => (
                  <div key={file.id} className="p-4 flex items-center justify-between hover:bg-[#151923] transition-colors text-xs">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">
                        {file.file_type === '.pdf' ? '📕' : file.file_type === '.md' ? '📘' : '📄'}
                      </span>
                      <div>
                        <div className="text-white font-medium">{file.filename}</div>
                        <div className="text-[11px] text-slate-500">
                          {(file.file_size / 1024).toFixed(1)} KB • Uploaded by {file.uploaded_by_name || 'User'} on {new Date(file.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <a
                        href={file.download_url}
                        download
                        className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium cursor-pointer"
                      >
                        Download
                      </a>
                      {!isViewer && (
                        <button
                          type="button"
                          onClick={() => handleDeleteFile(file.id)}
                          className="text-slate-500 hover:text-red-400 p-1 text-xs cursor-pointer transition-colors"
                          title="Delete File"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 rounded-2xl bg-[#10131A] border border-slate-800 space-y-3">
                <span className="text-3xl">📁</span>
                <p className="text-sm text-slate-300 font-medium">No files uploaded to this project workspace yet.</p>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Upload PDF specifications, research documentation, or markdown guidelines to empower AI models with grounded project context.
                </p>
                {!isViewer && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold"
                  >
                    Upload Document (.pdf, .txt, .md)
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* 5. SKILLS TAB */}
        {activeTab === 'skills' && (
          <div className="space-y-4 animate-fade-in">
            <div>
              <h3 className="text-base font-semibold text-white">Project-Enabled Skills</h3>
              <p className="text-xs text-slate-400">Configure which AI skills are enabled for all members in this project workspace.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {project.skills?.map((skill) => (
                <div
                  key={skill.skill_id}
                  className="p-4 rounded-2xl bg-[#10131A] border border-slate-800 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-2xl">{skill.icon || '🧩'}</span>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-white truncate">{skill.name}</div>
                      <div className="text-xs text-slate-400 line-clamp-1">{skill.description}</div>
                    </div>
                  </div>

                  {isAdmin ? (
                    <label className="relative inline-flex items-center cursor-pointer shrink-0">
                      <input
                        type="checkbox"
                        checked={skill.is_enabled}
                        onChange={() => handleToggleSkill(skill.skill_id, skill.is_enabled)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600" />
                    </label>
                  ) : (
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                      skill.is_enabled ? 'bg-purple-950 text-purple-300' : 'bg-slate-800 text-slate-500'
                    }`}>
                      {skill.is_enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 6. SETTINGS TAB */}
        {activeTab === 'settings' && isAdmin && (
          <div className="space-y-6 animate-fade-in max-w-xl">
            <form onSubmit={handleSaveSettings} className="p-5 rounded-2xl bg-[#10131A] border border-slate-800 space-y-4">
              <h3 className="text-sm font-semibold text-white">Project Settings</h3>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Project Name</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-[#151923] border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Description</label>
                <textarea
                  rows={2}
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  className="w-full bg-[#151923] border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-purple-500 resize-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Visibility</label>
                <select
                  value={editVisibility}
                  onChange={(e) => setEditVisibility(e.target.value)}
                  className="w-full bg-[#151923] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500 cursor-pointer"
                >
                  <option value="private">Private (Invited members only)</option>
                  <option value="invite_only">Invite Only (Anyone with link can request)</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={savingSettings}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                {savingSettings ? 'Saving...' : 'Save Changes'}
              </button>
            </form>

            {/* Danger Zone */}
            {isOwner && (
              <div className="p-5 rounded-2xl bg-red-950/20 border border-red-500/30 space-y-3">
                <h4 className="text-sm font-bold text-red-300">Danger Zone</h4>
                <p className="text-xs text-slate-400">
                  Deleting a project permanently removes all project-level files, invitations, and membership associations.
                </p>
                <button
                  type="button"
                  onClick={handleDeleteProject}
                  className="px-4 py-2 rounded-xl bg-red-600/80 hover:bg-red-600 text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  Delete Project Workspace
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Move Conversation Modal */}
      {showMoveModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={() => setShowMoveModal(false)}
        >
          <div
            className="w-full max-w-md p-6 bg-[#10131A] border border-slate-800 rounded-2xl shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-bold text-white">Move Conversation to Project</h3>
            <p className="text-xs text-slate-400">
              Select one of your existing conversations to move into <strong>{project.name}</strong>.
            </p>

            <select
              value={selectedConvToMove}
              onChange={(e) => setSelectedConvToMove(e.target.value)}
              className="w-full bg-[#151923] border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none cursor-pointer"
            >
              <option value="">-- Select a conversation --</option>
              {userConversations
                .filter((c) => c.project_id !== projectId)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
            </select>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowMoveModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!selectedConvToMove}
                onClick={handleMoveConversation}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-semibold"
              >
                Move into Project
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

