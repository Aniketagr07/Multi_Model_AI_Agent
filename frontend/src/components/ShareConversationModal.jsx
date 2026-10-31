import React, { useState, useEffect } from 'react';
import {
  getConversationShareSettings,
  updateConversationShareSettings,
  createConversationInvitation,
  revokeConversationInvitation,
  removeConversationMember,
} from '../services/api';

export function ShareConversationModal({
  isOpen,
  onClose,
  conversationId,
  conversationTitle,
  currentUser,
  onLeftConversation,
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [shareData, setShareData] = useState(null);

  // Invite by email form
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('editor');
  const [inviting, setInviting] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState(null);

  // Link copy feedback
  const [copiedLink, setCopiedLink] = useState(false);

  const loadSettings = async () => {
    if (!conversationId) return;
    try {
      setLoading(true);
      setError(null);
      const data = await getConversationShareSettings(conversationId);
      setShareData(data);
    } catch (e) {
      setError(e.message || 'Failed to load sharing settings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && conversationId) {
      loadSettings();
      setInviteEmail('');
      setInviteSuccess(null);
      setCopiedLink(false);
    }
  }, [isOpen, conversationId]);

  if (!isOpen) return null;

  const isOwner = shareData?.current_user_role === 'owner';

  const handleToggleSharing = async (e) => {
    const enabled = e.target.checked;
    try {
      const updated = await updateConversationShareSettings(conversationId, {
        sharing_enabled: enabled,
        share_permission: shareData?.share_permission || 'editor',
      });
      setShareData(updated);
    } catch (err) {
      setError(err.message || 'Failed to update sharing settings.');
    }
  };

  const handlePermissionChange = async (perm) => {
    try {
      const updated = await updateConversationShareSettings(conversationId, {
        sharing_enabled: shareData?.sharing_enabled ?? true,
        share_permission: perm,
      });
      setShareData(updated);
    } catch (err) {
      setError(err.message || 'Failed to update link permission.');
    }
  };

  const handleCopyLink = () => {
    if (!shareData?.share_token) return;
    const fullUrl = `${window.location.origin}/join/c/${shareData.share_token}`;
    navigator.clipboard.writeText(fullUrl).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    });
  };

  const handleSendInvite = async (e) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    try {
      setInviting(true);
      setError(null);
      setInviteSuccess(null);
      await createConversationInvitation(conversationId, {
        email: inviteEmail.trim(),
        role: inviteRole,
        expiry_days: 7,
      });
      setInviteSuccess(`Invitation sent to ${inviteEmail.trim()}`);
      setInviteEmail('');
      await loadSettings();
    } catch (err) {
      setError(err.message || 'Failed to send invitation.');
    } finally {
      setInviting(false);
    }
  };

  const handleRevokeInvite = async (invId) => {
    try {
      await revokeConversationInvitation(conversationId, invId);
      await loadSettings();
    } catch (err) {
      setError(err.message || 'Failed to revoke invitation.');
    }
  };

  const handleRemoveMember = async (userId) => {
    try {
      await removeConversationMember(conversationId, userId);
      if (currentUser?.id === userId) {
        onClose();
        if (onLeftConversation) onLeftConversation(conversationId);
      } else {
        await loadSettings();
      }
    } catch (err) {
      setError(err.message || 'Failed to remove member.');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg bg-[#10131A] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/80 bg-[#151923]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Share Conversation</h3>
              <p className="text-xs text-slate-400 truncate max-w-[280px]">
                {shareData?.title || conversationTitle || 'Conversation'}
              </p>
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

        {/* Content Body */}
        <div className="p-6 space-y-6 overflow-y-auto">
          {error && (
            <div className="p-3 text-xs bg-red-950/60 border border-red-500/40 rounded-xl text-red-200 flex items-center justify-between">
              <span>{error}</span>
              <button onClick={() => setError(null)} className="text-red-400 hover:text-white">✕</button>
            </div>
          )}

          {inviteSuccess && (
            <div className="p-3 text-xs bg-emerald-950/60 border border-emerald-500/40 rounded-xl text-emerald-200">
              {inviteSuccess}
            </div>
          )}

          {/* Section 1: Shareable Link */}
          <div className="bg-[#151923]/80 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium text-white">Shareable Link</h4>
                <p className="text-xs text-slate-400">
                  Anyone with the link can access this conversation.
                </p>
              </div>
              {isOwner && (
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={Boolean(shareData?.sharing_enabled)}
                    onChange={handleToggleSharing}
                  />
                  <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                </label>
              )}
            </div>

            {shareData?.sharing_enabled ? (
              <div className="space-y-3 pt-2 border-t border-slate-800/80">
                {/* Mode Selector */}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-slate-300 font-medium">Access Mode:</span>
                  <div className="flex items-center gap-1.5 bg-[#0B0D12] p-1 rounded-lg border border-slate-800">
                    <button
                      type="button"
                      disabled={!isOwner}
                      onClick={() => handlePermissionChange('viewer')}
                      className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors cursor-pointer ${
                        shareData.share_permission === 'viewer'
                          ? 'bg-purple-600 text-white'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      View Only
                    </button>
                    <button
                      type="button"
                      disabled={!isOwner}
                      onClick={() => handlePermissionChange('editor')}
                      className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors cursor-pointer ${
                        shareData.share_permission === 'editor'
                          ? 'bg-purple-600 text-white'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Collaborative Access
                    </button>
                  </div>
                </div>

                {/* Link & Copy Button */}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={
                      shareData.share_token
                        ? `${window.location.origin}/join/c/${shareData.share_token}`
                        : ''
                    }
                    className="flex-1 bg-[#0B0D12] border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-300 font-mono focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className={`px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                      copiedLink
                        ? 'bg-emerald-600 text-white'
                        : 'bg-purple-600 hover:bg-purple-500 text-white'
                    }`}
                  >
                    {copiedLink ? (
                      <>
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                        </svg>
                        Copied!
                      </>
                    ) : (
                      <>
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                        </svg>
                        Copy Link
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic">
                Link sharing is currently disabled. Toggle on to share via link.
              </p>
            )}
          </div>

          {/* Section 2: Invite Collaborators via Email (Owner Only) */}
          {isOwner && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-white">Invite Collaborators</h4>
              <form onSubmit={handleSendInvite} className="flex items-center gap-2">
                <input
                  type="email"
                  placeholder="collaborator@company.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="flex-1 bg-[#151923] border border-slate-800 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                />
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="bg-[#151923] border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-slate-300 focus:outline-none focus:border-purple-500 cursor-pointer"
                >
                  <option value="editor">Editor</option>
                  <option value="viewer">Viewer</option>
                </select>
                <button
                  type="submit"
                  disabled={inviting || !inviteEmail.trim()}
                  className="px-3.5 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  {inviting ? 'Inviting...' : 'Invite'}
                </button>
              </form>
            </div>
          )}

          {/* Section 3: Active Participants */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-white">
                Participants ({shareData?.members?.length || 1})
              </h4>
              {!isOwner && (
                <button
                  type="button"
                  onClick={() => handleRemoveMember(currentUser?.id)}
                  className="text-xs text-red-400 hover:text-red-300 underline cursor-pointer"
                >
                  Leave Conversation
                </button>
              )}
            </div>

            <div className="divide-y divide-slate-800/60 max-h-48 overflow-y-auto">
              {shareData?.members?.map((member) => {
                const isMemberOwner = member.role === 'owner';
                const isCurrent = currentUser?.id === member.user_id;

                return (
                  <div key={member.id} className="py-2.5 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-7 h-7 rounded-full bg-purple-600/30 text-purple-300 border border-purple-500/30 flex items-center justify-center font-bold text-xs uppercase flex-shrink-0">
                        {member.display_name ? member.display_name[0] : (member.email ? member.email[0] : 'U')}
                      </div>
                      <div className="min-w-0">
                        <div className="text-white font-medium truncate flex items-center gap-1.5">
                          <span>{member.display_name || member.email || 'User'}</span>
                          {isCurrent && <span className="text-[10px] text-purple-400">(You)</span>}
                        </div>
                        {member.email && (
                          <div className="text-[11px] text-slate-400 truncate">{member.email}</div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                        member.role === 'owner'
                          ? 'bg-purple-950 text-purple-300 border border-purple-500/40'
                          : member.role === 'editor'
                          ? 'bg-blue-950 text-blue-300 border border-blue-500/40'
                          : 'bg-slate-800 text-slate-300 border border-slate-700'
                      }`}>
                        {member.role}
                      </span>

                      {isOwner && !isMemberOwner && (
                        <button
                          type="button"
                          onClick={() => handleRemoveMember(member.user_id)}
                          className="text-slate-500 hover:text-red-400 text-xs px-1.5 py-0.5 transition-colors cursor-pointer"
                          title="Remove Participant"
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

          {/* Section 4: Pending Invitations (Owner Only) */}
          {isOwner && shareData?.pending_invitations?.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-slate-800/80">
              <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                Pending Invitations ({shareData.pending_invitations.length})
              </h4>
              <div className="divide-y divide-slate-800/50">
                {shareData.pending_invitations.map((inv) => (
                  <div key={inv.id} className="py-2 flex items-center justify-between text-xs">
                    <div className="text-slate-300 truncate">
                      <span>{inv.email || 'Invite Link'}</span>
                      <span className="ml-2 text-[10px] text-slate-500 font-mono uppercase">
                        ({inv.role})
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRevokeInvite(inv.id)}
                      className="text-xs text-red-400 hover:text-red-300 cursor-pointer"
                    >
                      Revoke
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800/80 bg-[#151923] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

