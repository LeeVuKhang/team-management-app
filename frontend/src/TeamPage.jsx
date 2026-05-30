import React, { useState, useEffect } from 'react';
import { useOutletContext, useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import toast from 'react-hot-toast';
import {
  getTeam,
  getTeamProjects,
  getTeamStats,
  getTeamMembers,
  updateTeam,
  deleteTeam,
  createProject,
  updateProject,
  deleteProject,
  getProjectMembers,
  addProjectMember,
  removeProjectMember,
  updateProjectMemberRole,
  searchUsers,
  createInvitation,
  removeTeamMember,
  updateTeamMemberRole,
  getTeamPendingInvitations,
  revokeInvitation,
  leaveTeam
} from './services/projectApi';
import { useDebounce } from './hooks/useDebounce';
import { useAuth } from './hooks/useAuth';
import {
  getSocket,
  joinTeam,
  leaveTeam as leaveTeamSocket,
  onProjectCreated,
  onProjectUpdated,
  onProjectDeleted,
} from './services/socketService';
import {
  LayoutDashboard,
  FolderKanban,
  CheckCircle2,
  Clock,
  AlertCircle,
  MoreVertical,
  Plus,
  Users,
  Search,
  X,
  Edit3,
  Trash2,
  Settings,
  Calendar,
  Loader2,
  UserCheck,
  Mail,
  Pin,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

/**
 * UTILITY FUNCTIONS
 */

// Render user avatar with image or initials fallback
const renderUserAvatar = (user, size = 'md', darkMode = false) => {
  const sizeClasses = {
    sm: 'h-6 w-6 text-xs',
    md: 'h-10 w-10 text-sm',
    lg: 'h-12 w-12 text-base'
  };

  if (user.avatar_url) {
    return (
      <img
        src={user.avatar_url}
        alt={user.username || 'User'}
        className={`${sizeClasses[size]} rounded-full object-cover border-2 ${darkMode ? 'border-[rgb(30,36,30)]' : 'border-white'
          }`}
        onError={(e) => {
          // Fallback to initials if image fails to load
          e.target.style.display = 'none';
          e.target.nextSibling.style.display = 'flex';
        }}
      />
    );
  }

  return (
    <div className={`${sizeClasses[size]} rounded-full flex items-center justify-center font-medium ${darkMode ? 'bg-[#006239] text-white' : 'bg-gray-200 text-black'
      }`}>
      {user.username?.substring(0, 2).toUpperCase() || 'U'}
    </div>
  );
};

/**
 * VALIDATION SCHEMAS (Client-Side with Zod)
 */

// Team validation
const teamSchema = z.object({
  name: z.string()
    .min(1, 'Team name is required')
    .max(100, 'Team name must be 100 characters or less')
    .trim(),
  description: z.string()
    .max(500, 'Description must be 500 characters or less')
    .optional()
    .or(z.literal(''))
});

// Project validation - STRICT with Security & Type Safety
const projectSchema = z.object({
  name: z.string()
    .trim() // Sanitization: remove whitespace
    .min(1, 'Project name is required')
    .max(100, 'Project name must be 100 characters or less'),
  description: z.string()
    .trim() // Sanitization
    .max(500, 'Description must be 500 characters or less')
    .optional()
    .or(z.literal('')),
  status: z.enum(['active', 'archived', 'completed'], {
    errorMap: () => ({ message: 'Invalid status' })
  }),
  start_date: z.string()
    .optional()
    .or(z.literal(''))
    .refine(
      (val) => {
        if (!val || val === '') return true;
        const date = new Date(val);
        return !isNaN(date.getTime()) && date.getFullYear() > 1900 && date.getFullYear() < 2100;
      },
      { message: 'Invalid start date' }
    ),
  end_date: z.string()
    .optional()
    .or(z.literal(''))
    .refine(
      (val) => {
        if (!val || val === '') return true;
        const date = new Date(val);
        return !isNaN(date.getTime()) && date.getFullYear() > 1900 && date.getFullYear() < 2100;
      },
      { message: 'Invalid end date' }
    )
}).refine(
  (data) => {
    // CRITICAL: Date comparison validation
    if (data.start_date && data.end_date && data.start_date !== '' && data.end_date !== '') {
      const start = new Date(data.start_date);
      const end = new Date(data.end_date);
      // Type safety check
      if (isNaN(start.getTime()) || isNaN(end.getTime())) return true;
      // end_date must be >= start_date
      return end >= start;
    }
    return true;
  },
  {
    message: 'End date must be after or equal to start date',
    path: ['end_date'] // Associate error with end_date field
  }
);

// Invite member validation
const inviteMemberSchema = z.object({
  email: z.string()
    .trim()
    .min(1, 'Email is required')
    .email('Invalid email format'),
  role: z.enum(['member', 'admin'], {
    errorMap: () => ({ message: 'Invalid role' })
  })
});

/**
 * COMPONENTS
 */

// Modal wrapper component
const Modal = ({ isOpen, onClose, title, children, darkMode }) => {
  if (!isOpen) return null;

  React.useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
    >
      <div
        className={`w-full max-w-lg rounded-xl shadow-2xl my-8 overflow-hidden ${darkMode ? 'bg-dark-secondary border border-[#171717]' : 'bg-white border border-gray-200'
          }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`sticky top-0 z-10 ${darkMode ? 'bg-dark-secondary' : 'bg-white'
          }`}>
          <div className={`flex items-center justify-between p-6 border-b ${darkMode ? 'border-[#171717]' : 'border-gray-200'
            }`}>
            <h2 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-black'}`}>
              {title}
            </h2>
            <button
              onClick={onClose}
              className={`p-2 rounded-lg transition-colors ${darkMode ? 'hover:bg-[#171717] text-gray-400' : 'hover:bg-gray-100 text-gray-600'
                }`}
            >
              <X size={20} />
            </button>
          </div>
        </div>
        <div className="p-6 max-h-[calc(100vh-200px)] overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
};

// Edit Team Modal with Members Management
const EditTeamModal = ({ isOpen, onClose, team, onSubmit, darkMode, teamId, queryClient }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: ''
  });
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('general'); // 'general' or 'members'

  // Fetch team members for the members tab
  const { data: membersData } = useQuery({
    queryKey: ['teamMembers', teamId],
    queryFn: () => getTeamMembers(teamId),
    enabled: !!teamId && isOpen && activeTab === 'members',
  });

  const members = membersData?.data || [];

  // Remove member mutation
  const removeMemberMutation = useMutation({
    mutationFn: ({ memberId }) => removeTeamMember(teamId, memberId),
    onSuccess: () => {
      queryClient.invalidateQueries(['teamMembers', teamId]);
      toast.success('Member removed successfully');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to remove member');
    },
  });

  React.useEffect(() => {
    if (team) {
      setFormData({
        name: team.name || '',
        description: team.description || ''
      });
    }
    setError(null);
    setFieldErrors({});
    setActiveTab('general'); // Reset to general tab on open
  }, [team, isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    setIsSubmitting(true);

    // CLIENT-SIDE VALIDATION with Zod
    try {
      teamSchema.parse(formData);
    } catch (err) {
      if (err instanceof z.ZodError) {
        const errors = {};
        err.errors.forEach((error) => {
          errors[error.path[0]] = error.message;
        });
        setFieldErrors(errors);
        setError('Please fix the errors below');
        setIsSubmitting(false);
        return;
      }
    }

    try {
      await onSubmit(formData);

      // SUCCESS: Only close modal if no error thrown
      onClose();
    } catch (err) {
      // Extract server error message from response
      const errorMessage = err.response?.data?.message || err.message || 'Failed to update team';
      console.error('Server error:', errorMessage);
      setError(errorMessage);
      // Modal stays open, user can see the error and retry
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveMember = (memberId) => {
    if (window.confirm('Are you sure you want to remove this member?')) {
      removeMemberMutation.mutate({ memberId });
    }
  };

  const getInputClass = (fieldName) => {
    const hasError = fieldErrors[fieldName];
    return `w-full rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 transition-all ${hasError
      ? 'border-2 border-red-500 focus:ring-red-500/50 bg-red-50 dark:bg-red-500/10'
      : darkMode
        ? 'bg-dark-secondary border border-[#171717] text-white focus:ring-blue-500/20'
        : 'bg-white border border-gray-200 text-black focus:ring-blue-500/20'
      }`;
  };

  const labelClass = `block text-sm font-bold mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-400'}`;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Team" darkMode={darkMode}>
      {/* Tabs */}
      <div className={`flex border-b mb-6 -mt-2 ${darkMode ? 'border-[#171717]' : 'border-gray-200'}`}>
        <button
          type="button"
          onClick={() => setActiveTab('general')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === 'general'
            ? `border-[#006239] ${darkMode ? 'text-white' : 'text-black'}`
            : `border-transparent ${darkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700'}`
            }`}
        >
          General
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('members')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === 'members'
            ? `border-[#006239] ${darkMode ? 'text-white' : 'text-black'}`
            : `border-transparent ${darkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-500 hover:text-gray-700'}`
            }`}
        >
          Members ({members.length})
        </button>
      </div>

      {/* General Tab */}
      {activeTab === 'general' && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={labelClass}>Team Name *</label>
            <input
              type="text"
              maxLength={100}
              value={formData.name}
              onChange={(e) => {
                setFormData({ ...formData, name: e.target.value });
                if (fieldErrors.name) {
                  setFieldErrors({ ...fieldErrors, name: null });
                }
              }}
              className={getInputClass('name')}
              placeholder="Enter team name"
            />
            {fieldErrors.name && (
              <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                <AlertCircle size={12} />
                {fieldErrors.name}
              </p>
            )}
          </div>

          <div>
            <label className={labelClass}>Description</label>
            <textarea
              rows={4}
              maxLength={500}
              value={formData.description}
              onChange={(e) => {
                setFormData({ ...formData, description: e.target.value });
                if (fieldErrors.description) {
                  setFieldErrors({ ...fieldErrors, description: null });
                }
              }}
              className={getInputClass('description')}
              placeholder="Enter team description"
            />
            {fieldErrors.description && (
              <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                <AlertCircle size={12} />
                {fieldErrors.description}
              </p>
            )}
          </div>

          {error && (
            <div className={`p-3 rounded-lg border ${darkMode ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-red-50 border-red-200 text-red-600'
              }`}>
              <div className="flex items-start gap-2">
                <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
                <p className="text-sm">{error}</p>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className={`flex-1 px-6 py-3 rounded-lg font-semibold transition-all ${darkMode ? 'bg-[#171717] text-gray-300 hover:bg-gray-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                } disabled:opacity-50`}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-6 py-3 bg-[#006239] hover:bg-[#005230] text-white rounded-lg font-semibold transition-all disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      )}

      {/* Members Tab */}
      {activeTab === 'members' && (
        <div className="space-y-3">
          <div className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'} mb-4`}>
            Manage team members. Only owners can remove other members.
          </div>

          {members.length === 0 ? (
            <div className={`text-center py-8 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              <Users size={32} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm">No members found</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {members.map((member) => (
                <div
                  key={member.id}
                  className={`flex items-center justify-between p-3 rounded-lg border ${darkMode ? 'bg-[#171717] border-[#171717]' : 'bg-gray-50 border-gray-200'
                    }`}
                >
                  <div className="flex items-center gap-3">
                    {renderUserAvatar(member, 'sm', darkMode)}
                    <div>
                      <div className={`text-sm font-medium ${darkMode ? 'text-white' : 'text-black'}`}>
                        {member.username}
                      </div>
                      <div className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                        {member.email}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Role Badge */}
                    <span
                      className={`px-2.5 py-1 text-xs font-medium rounded-full ${member.role === 'owner'
                        ? 'bg-purple-500/20 text-purple-400'
                        : member.role === 'admin'
                          ? 'bg-blue-500/20 text-blue-400'
                          : 'bg-gray-500/20 text-gray-400'
                        }`}
                    >
                      {member.role}
                    </span>

                    {/* Remove Button (only for non-owners) */}
                    {member.role !== 'owner' && (
                      <button
                        type="button"
                        onClick={() => handleRemoveMember(member.user_id)}
                        disabled={removeMemberMutation.isLoading}
                        className={`p-1.5 rounded-lg transition-colors ${darkMode
                          ? 'hover:bg-red-500/20 text-red-400'
                          : 'hover:bg-red-50 text-red-600'
                          } disabled:opacity-50`}
                        title="Remove member"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-3 pt-4 border-t" style={{ borderColor: darkMode ? '#171717' : '#e5e7eb' }}>
            <button
              type="button"
              onClick={onClose}
              className={`flex-1 px-6 py-3 rounded-lg font-semibold transition-all ${darkMode ? 'bg-[#171717] text-gray-300 hover:bg-gray-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
};

// Delete Team Modal
const DeleteTeamModal = ({ isOpen, onClose, team, onConfirm, darkMode }) => {
  const [confirmText, setConfirmText] = useState('');
  const [error, setError] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  React.useEffect(() => {
    setConfirmText('');
    setError(null);
  }, [isOpen]);

  const handleDelete = async () => {
    if (confirmText !== team?.name) {
      setError('Team name does not match');
      return;
    }

    setError(null);
    setIsDeleting(true);

    try {
      await onConfirm();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to delete team');
    } finally {
      setIsDeleting(false);
    }
  };

  const inputClass = `w-full rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/50 transition-all ${darkMode ? 'bg-dark-secondary border border-[#171717] text-white' : 'bg-white border border-gray-200 text-black'
    }`;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Delete Team" darkMode={darkMode}>
      <div className="space-y-4">
        <div className={`p-4 rounded-lg border-2 ${darkMode ? 'bg-red-500/10 border-red-500/30' : 'bg-red-50 border-red-200'
          }`}>
          <div className="flex items-start gap-3">
            <AlertCircle className="text-red-500 flex-shrink-0 mt-0.5" size={20} />
            <div>
              <h4 className={`font-bold text-sm mb-1 ${darkMode ? 'text-red-400' : 'text-red-600'}`}>
                Warning: This action cannot be undone
              </h4>
              <p className={`text-sm ${darkMode ? 'text-red-300' : 'text-red-500'}`}>
                Deleting this team will permanently remove:
              </p>
              <ul className={`text-xs mt-2 space-y-1 list-disc list-inside ${darkMode ? 'text-red-300' : 'text-red-500'}`}>
                <li>All projects in this team</li>
                <li>All tasks in those projects</li>
                <li>All team members</li>
                <li>All related data</li>
              </ul>
            </div>
          </div>
        </div>

        <div>
          <label className={`block text-sm font-bold mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-400'}`}>
            Type <span className="font-mono text-red-500">"{team?.name}"</span> to confirm:
          </label>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            className={inputClass}
            placeholder={team?.name}
          />
        </div>

        {error && (
          <div className={`p-3 rounded-lg border ${darkMode ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-red-50 border-red-200 text-red-600'
            }`}>
            <div className="flex items-start gap-2">
              <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
              <p className="text-sm">{error}</p>
            </div>
          </div>
        )}

        <div className="flex gap-3 pt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className={`flex-1 px-6 py-3 rounded-lg font-semibold transition-all ${darkMode ? 'bg-[#171717] text-gray-300 hover:bg-[#171717]/70' : 'bg-gray-200/50 text-gray-400 hover:bg-gray-200'
              } disabled:opacity-50`}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting || confirmText !== team?.name}
            className="flex-1 px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isDeleting ? 'Deleting...' : 'Delete Team'}
          </button>
        </div>
      </div>
    </Modal>
  );
};

// Leave Team Modal
const LeaveTeamModal = ({ isOpen, onClose, team, onConfirm, darkMode }) => {
  const [isLeaving, setIsLeaving] = useState(false);
  const [error, setError] = useState(null);

  React.useEffect(() => {
    setError(null);
  }, [isOpen]);

  const handleLeave = async () => {
    setError(null);
    setIsLeaving(true);

    try {
      await onConfirm();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to leave team');
    } finally {
      setIsLeaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Leave Team" darkMode={darkMode}>
      <div className="space-y-4">
        <div className={`p-4 rounded-lg border-2 ${darkMode ? 'bg-yellow-500/10 border-yellow-500/30' : 'bg-yellow-50 border-yellow-200'
          }`}>
          <div className="flex items-start gap-3">
            <AlertCircle className="text-yellow-500 flex-shrink-0 mt-0.5" size={20} />
            <div>
              <h4 className={`font-bold text-sm mb-1 ${darkMode ? 'text-yellow-400' : 'text-yellow-600'
                }`}>
                Are you sure you want to leave this team?
              </h4>
              <p className={`text-sm ${darkMode ? 'text-yellow-300' : 'text-yellow-600'
                }`}>
                Leaving <span className="font-bold">{team?.name}</span> will remove your access to:
              </p>
              <ul className={`text-xs mt-2 space-y-1 list-disc list-inside ${darkMode ? 'text-yellow-300' : 'text-yellow-600'
                }`}>
                <li>All projects in this team</li>
                <li>All tasks you're assigned to</li>
                <li>Team chat and channels</li>
                <li>Team notifications</li>
              </ul>
            </div>
          </div>
        </div>

        {error && (
          <div className={`p-3 rounded-lg border ${darkMode ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-red-50 border-red-200 text-red-600'
            }`}>
            <div className="flex items-start gap-2">
              <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
              <p className="text-sm">{error}</p>
            </div>
          </div>
        )}

        <div className="flex gap-3 pt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isLeaving}
            className={`flex-1 px-6 py-3 rounded-lg font-semibold transition-all ${darkMode ? 'bg-[#171717] text-gray-300 hover:bg-[#171717]/70' : 'bg-gray-200/50 text-gray-400 hover:bg-gray-200'
              } disabled:opacity-50`}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleLeave}
            disabled={isLeaving}
            className="flex-1 px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLeaving ? 'Leaving...' : 'Leave Team'}
          </button>
        </div>
      </div>
    </Modal>
  );
};

// Invite Member Modal (GitHub-Style Search & Select)
const InviteMemberModal = ({ isOpen, onClose, teamId, darkMode }) => {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedRole, setSelectedRole] = useState('member');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Debounce search query to avoid spamming API
  const debouncedQuery = useDebounce(searchQuery, 300);

  // Reset state when modal opens/closes
  React.useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setSelectedUser(null);
      setSelectedRole('member');
    }
  }, [isOpen]);

  // Search users query (only when debounced query has value)
  const { data: searchResults, isLoading: isSearching } = useQuery({
    queryKey: ['searchUsers', teamId, debouncedQuery],
    queryFn: () => searchUsers(teamId, debouncedQuery),
    enabled: debouncedQuery.length > 0 && isOpen,
    select: (response) => response.data,
  });

  // Create invitation mutation
  const inviteMutation = useMutation({
    mutationFn: ({ email, role }) => createInvitation(teamId, email, role),
    onSuccess: (data) => {
      toast.success(data.message || 'Invitation sent successfully!');
      queryClient.invalidateQueries(['teamMembers', teamId]);
      queryClient.invalidateQueries(['teamPendingInvitations', teamId]);
      onClose();
    },
    onError: (error) => {
      const errorMessage = error.response?.data?.message || error.message || 'Failed to send invitation';
      toast.error(errorMessage);
    },
  });

  const handleInvite = () => {
    if (!selectedUser) return;

    setIsSubmitting(true);
    inviteMutation.mutate(
      { email: selectedUser.email, role: selectedRole },
      { onSettled: () => setIsSubmitting(false) }
    );
  };

  // Get user avatar (initials fallback)
  const getUserAvatar = (user) => {
    if (user.avatar_url) {
      return (
        <img
          src={user.avatar_url}
          alt={user.username}
          className="w-8 h-8 rounded-full object-cover"
        />
      );
    }

    // Fallback to initials
    const initials = user.username
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);

    return (
      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${darkMode ? 'bg-[#006239] text-black' : 'bg-[#006239] text-white'
        }`}>
        {initials}
      </div>
    );
  };

  // Get status badge
  const getStatusBadge = (status) => {
    switch (status) {
      case 'member':
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
            <UserCheck size={12} />
            Already a member
          </span>
        );
      case 'pending':
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-700 text-amber-900 dark:bg-black-100/10 dark:text-amber-400">
            <Clock size={12} />
            Invitation pending
          </span>
        );
      default:
        return null;
    }
  };

  const labelClass = `block text-sm font-bold mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Invite Team Member" darkMode={darkMode}>
      <div className="space-y-4">
        {/* Search Input */}
        <div>
          <label className={labelClass}>
            Search by username or email <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Type to search users..."
              className={`w-full rounded-lg px-4 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 transition-all ${darkMode
                ? 'bg-dark-secondary border border-[#171717] text-white focus:ring-blue-500/20 placeholder:text-gray-400'
                : 'bg-white border border-gray-200 text-black focus:ring-blue-500/20 placeholder:text-gray-600'
                }`}
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {isSearching ? (
                <Loader2 size={16} className="animate-spin text-gray-400" />
              ) : (
                <Search size={16} className="text-gray-400" />
              )}
            </div>
          </div>
        </div>

        {/* Search Results */}
        {debouncedQuery.length > 0 && (
          <div className={`border rounded-lg max-h-60 overflow-y-auto ${darkMode ? 'border-[#171717]' : 'border-gray-200'
            }`}>
            {isSearching ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 size={24} className="animate-spin text-gray-400" />
              </div>
            ) : searchResults?.length > 0 ? (
              <div className="divide-y divide-[#171717]">
                {searchResults.map((user) => {
                  const isDisabled = user.status !== 'none';
                  const isSelected = selectedUser?.id === user.id;

                  return (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => !isDisabled && setSelectedUser(user)}
                      disabled={isDisabled}
                      className={`w-full p-3 flex items-center gap-3 transition-all text-left ${isDisabled
                        ? 'cursor-not-allowed'
                        : isSelected
                          ? darkMode
                            ? 'bg-blue-500/20'
                            : 'bg-blue-100'
                          : darkMode
                            ? 'hover:bg-[#171717]'
                            : 'hover:bg-gray-50'
                        }`}
                    >
                      <div className={`flex items-center gap-3 flex-1 min-w-0 ${isDisabled ? 'opacity-50' : ''}`}>
                        {getUserAvatar(user)}
                        <div className="flex-1 min-w-0">
                          <p className={`font-medium text-sm ${darkMode ? 'text-white' : 'text-black'}`}>
                            {user.username}
                          </p>
                          <p className={`text-xs truncate ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                            {user.email}
                          </p>
                        </div>
                      </div>
                      {getStatusBadge(user.status)}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="py-8 text-center">
                <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  No users found matching "{debouncedQuery}"
                </p>
              </div>
            )}
          </div>
        )}

        {/* Selected User Display */}
        {selectedUser && (
          <div className={`p-3 rounded-lg border ${darkMode
            ? 'bg-blue-500/10 border-blue-500/30'
            : 'bg-blue-50 border-blue-200'
            }`}>
            <div className="flex items-center gap-3">
              <Mail size={16} className="text-gray-400" />
              <div className="flex-1">
                <p className={`text-sm font-medium ${darkMode ? 'text-white' : 'text-black'}`}>
                  {selectedUser.username}
                </p>
                <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  {selectedUser.email}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedUser(null)}
                className="p-1 rounded hover:bg-red-500/20 text-red-500 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Role Selection */}
        {selectedUser && (
          <div>
            <label className={labelClass}>Role</label>
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className={`w-full rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 transition-all ${darkMode
                ? 'bg-dark-secondary border border-[#171717] text-white focus:ring-blue-500/20'
                : 'bg-white border border-gray-200 text-black focus:ring-blue-500/20'
                }`}
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
            <p className={`text-xs mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              {selectedRole === 'admin' ? 'Can manage team settings and members' : 'Can view and work on projects'}
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className={`flex-1 px-6 py-3 rounded-lg font-semibold transition-all ${darkMode ? 'bg-[#171717] text-gray-300 hover:bg-gray-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              } disabled:opacity-50`}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleInvite}
            disabled={!selectedUser || isSubmitting}
            className="flex-1 px-6 py-3 bg-[#006239] hover:bg-[#005230] text-white rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Sending...
              </>
            ) : (
              'Send Invitation'
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
};

// Pending Invitations List Component
const PendingInvitationsList = ({ invitations, onRevoke, darkMode }) => {
  if (!invitations || invitations.length === 0) {
    return null;
  }

  return (
    <div className={`${darkMode ? 'bg-dark-secondary border-[#171717]' : 'bg-white border-gray-200 shadow-sm'
      } border rounded-xl p-5 transition-all mb-6`}>
      <h3 className={`font-bold mb-4 ${darkMode ? 'text-white' : 'text-black'}`}>
        Pending Invitations ({invitations.length})
      </h3>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className={`border-b ${darkMode ? 'border-[#171717]' : 'border-gray-200'
              }`}>
              <th className={`text-left py-2 px-3 text-xs font-semibold uppercase tracking-wider ${darkMode ? 'text-gray-400' : 'text-gray-600'
                }`}>Email</th>
              <th className={`text-left py-2 px-3 text-xs font-semibold uppercase tracking-wider ${darkMode ? 'text-gray-400' : 'text-gray-600'
                }`}>Role</th>
              <th className={`text-left py-2 px-3 text-xs font-semibold uppercase tracking-wider ${darkMode ? 'text-gray-400' : 'text-gray-600'
                }`}>Sent Date</th>
              <th className={`text-left py-2 px-3 text-xs font-semibold uppercase tracking-wider ${darkMode ? 'text-gray-400' : 'text-gray-600'
                }`}>Status</th>
              <th className={`text-right py-2 px-3 text-xs font-semibold uppercase tracking-wider ${darkMode ? 'text-gray-400' : 'text-gray-600'
                }`}>Action</th>
            </tr>
          </thead>
          <tbody className={`divide-y ${darkMode ? 'divide-[#171717]' : 'divide-gray-200'
            }`}>
            {invitations.map((invite) => (
              <tr key={invite.id} className={`transition-colors ${darkMode ? 'hover:bg-[#171717]' : 'hover:bg-gray-50'
                }`}>
                <td className={`py-3 px-3 text-sm ${darkMode ? 'text-gray-300' : 'text-black'
                  }`}>
                  {invite.email}
                </td>
                <td className="py-3 px-3">
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${invite.role === 'admin'
                    ? 'bg-purple-500/10 text-purple-500'
                    : 'bg-blue-500/10 text-blue-500'
                    }`}>
                    {invite.role}
                  </span>
                </td>
                <td className={`py-3 px-3 text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                  {new Date(invite.sent_date).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </td>
                <td className="py-3 px-3">
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${invite.status === 'pending'
                    ? 'bg-amber-500/10 text-amber-500'
                    : 'bg-gray-500/10 text-gray-500'
                    }`}>
                    {invite.status}
                  </span>
                </td>
                <td className="py-3 px-3 text-right">
                  <button
                    onClick={() => onRevoke(invite)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${darkMode
                      ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                      : 'bg-red-50 text-red-600 hover:bg-red-100'
                      }`}
                  >
                    Revoke
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Create Project Modal
const CreateProjectModal = ({ isOpen, onClose, teamId, teamMembers, onSubmit, darkMode, currentUserId }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    status: 'active',
    start_date: '',
    end_date: '',
    selectedMembers: [] // Array of {userId, role}
  });
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  React.useEffect(() => {
    if (isOpen) {
      setFormData({
        name: '',
        description: '',
        status: 'active',
        start_date: '',
        end_date: '',
        selectedMembers: [] // Creator will be auto-added as lead on backend
      });
      setError(null);
      setFieldErrors({});
    }
  }, [isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Reset all error states
    setError(null);
    setFieldErrors({});

    // SECURITY: STRICT CLIENT-SIDE VALIDATION - BLOCK REQUEST IF INVALID
    try {
      const validatedData = projectSchema.parse({
        name: formData.name,
        description: formData.description,
        status: formData.status,
        start_date: formData.start_date,
        end_date: formData.end_date
      });

      // If validation passes, validatedData is now sanitized (trimmed strings, etc.)
      console.log('✅ Validation passed:', validatedData);
    } catch (err) {
      if (err instanceof z.ZodError) {
        // Build field-specific error map
        const errors = {};
        err.errors.forEach((error) => {
          const fieldName = error.path[0];
          errors[fieldName] = error.message;
        });

        console.log('Validation failed:', errors);

        // Set errors to trigger visual feedback
        setFieldErrors(errors);
        setError('Please fix the errors below');

        // CRITICAL: DO NOT PROCEED - Block API call
        return; // Exit immediately without calling mutation
      }
    }

    // Validation passed - proceed with API call
    setIsSubmitting(true);

    try {
      const dataToSubmit = {
        name: formData.name.trim(),
        status: formData.status
      };

      if (formData.description?.trim()) {
        dataToSubmit.description = formData.description.trim();
      }

      if (formData.start_date) {
        dataToSubmit.start_date = new Date(formData.start_date).toISOString();
      }

      if (formData.end_date) {
        dataToSubmit.end_date = new Date(formData.end_date).toISOString();
      }

      // Pass selected members separately
      dataToSubmit.members = formData.selectedMembers;

      await onSubmit(dataToSubmit);

      // SUCCESS: Only close modal if no error thrown
      onClose();
    } catch (err) {
      // Extract server error message from response
      const errorMessage = err.response?.data?.message || err.message || 'Failed to create project';
      console.error('Server error:', errorMessage);
      setError(errorMessage);
      // Modal stays open, user can see the error and retry
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleMember = (member) => {
    setFormData(prev => {
      const exists = prev.selectedMembers.find(m => m.userId === member.user_id);
      if (exists) {
        return {
          ...prev,
          selectedMembers: prev.selectedMembers.filter(m => m.userId !== member.user_id)
        };
      } else {
        return {
          ...prev,
          selectedMembers: [...prev.selectedMembers, { userId: member.user_id, role: 'viewer' }]
        };
      }
    });
  };

  const updateMemberRole = (userId, newRole) => {
    setFormData(prev => ({
      ...prev,
      selectedMembers: prev.selectedMembers.map(m =>
        m.userId === userId ? { ...m, role: newRole } : m
      )
    }));
  };

  const getInputClass = (fieldName) => {
    const hasError = fieldErrors[fieldName];
    return `w-full rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 transition-all ${hasError
      ? 'border-2 border-red-500 focus:ring-red-500/50 bg-red-50 dark:bg-red-500/10'
      : darkMode
        ? 'bg-dark-secondary border border-[#171717] text-white placeholder-gray-500 focus:ring-blue-500/20'
        : 'bg-white border border-gray-200 text-black placeholder-gray-500 focus:ring-blue-500/20'
      }`;
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create New Project" darkMode={darkMode}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className={`block text-sm font-bold mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-400'}`}>
            Project Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => {
              setFormData({ ...formData, name: e.target.value });
              if (fieldErrors.name) setFieldErrors({ ...fieldErrors, name: null });
            }}
            className={getInputClass('name')}
            placeholder="Enter project name"
            maxLength={100}
          />
          {fieldErrors.name ? (
            <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
              <AlertCircle size={12} />
              {fieldErrors.name}
            </p>
          ) : (
            <p className={`text-xs mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-400'}`}>
              {formData.name.length}/100 characters
            </p>
          )}
        </div>

        <div>
          <label className={`block text-sm font-bold mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-400'}`}>
            Description
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => {
              setFormData({ ...formData, description: e.target.value });
              if (fieldErrors.description) setFieldErrors({ ...fieldErrors, description: null });
            }}
            className={getInputClass('description')}
            placeholder="Project description (optional)"
            rows={3}
            maxLength={500}
          />
          {fieldErrors.description ? (
            <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
              <AlertCircle size={12} />
              {fieldErrors.description}
            </p>
          ) : (
            <p className={`text-xs mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-400'}`}>
              {formData.description.length}/500 characters
            </p>
          )}
        </div>

        <div>
          <label className={`block text-sm font-bold mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-400'}`}>
            Status
          </label>
          <select
            value={formData.status}
            onChange={(e) => {
              setFormData({ ...formData, status: e.target.value });
              if (fieldErrors.status) setFieldErrors({ ...fieldErrors, status: null });
            }}
            className={getInputClass('status')}
          >
            <option value="active">Active</option>
            <option value="archived">Archived</option>
            <option value="completed">Completed</option>
          </select>
          {fieldErrors.status && (
            <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
              <AlertCircle size={12} />
              {fieldErrors.status}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={`block text-sm font-bold mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-400'}`}>
              Start Date
            </label>
            <input
              type="date"
              value={formData.start_date}
              onChange={(e) => {
                setFormData({ ...formData, start_date: e.target.value });
                if (fieldErrors.start_date) setFieldErrors({ ...fieldErrors, start_date: null });
              }}
              className={getInputClass('start_date')}
            />
            {fieldErrors.start_date && (
              <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                <AlertCircle size={12} />
                {fieldErrors.start_date}
              </p>
            )}
          </div>
          <div>
            <label className={`block text-sm font-bold mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-400'}`}>
              End Date
            </label>
            <input
              type="date"
              value={formData.end_date}
              onChange={(e) => {
                setFormData({ ...formData, end_date: e.target.value });
                if (fieldErrors.end_date) setFieldErrors({ ...fieldErrors, end_date: null });
              }}
              onBlur={() => {
                // Validate date comparison on blur for CreateProjectModal
                if (formData.start_date && formData.end_date) {
                  const start = new Date(formData.start_date);
                  const end = new Date(formData.end_date);
                  if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && start > end) {
                    setFieldErrors(prev => ({ ...prev, end_date: 'End date must be after start date' }));
                  }
                }
              }}
              className={getInputClass('end_date')}
            />
            {fieldErrors.end_date && (
              <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                <AlertCircle size={12} />
                {fieldErrors.end_date}
              </p>
            )}
          </div>
        </div>

        {/* Member Selection */}
        <div>
          <label className={`block text-sm font-bold mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-400'}`}>
            Team Members <span className="text-xs font-normal">(You will be added as lead automatically)</span>
          </label>
          <div className={`max-h-48 overflow-y-auto rounded-lg border ${darkMode ? 'border-[#171717] bg-dark-secondary' : 'border-gray-200 bg-white'
            }`}>
            {/* SECURITY: Filter out current user since they are auto-added as lead */}
            {teamMembers && teamMembers.filter(m => m.user_id !== currentUserId).length > 0 ? (
              <div className="divide-y divide-[#171717]">
                {teamMembers.filter(m => m.user_id !== currentUserId).map((member) => {
                  const isSelected = formData.selectedMembers.find(m => m.userId === member.user_id);
                  return (
                    <div key={member.user_id} className={`p-3 flex items-center justify-between hover:bg-[#171717]/30 transition-colors`}>
                      <div className="flex items-center gap-3 flex-1">
                        <input
                          type="checkbox"
                          checked={!!isSelected}
                          onChange={() => toggleMember(member)}
                          className="w-4 h-4 rounded border-gray-400 text-gray-400 focus:ring-blue-500/20"
                        />
                        <div className="flex items-center gap-2">
                          {member.avatar_url ? (
                            <img src={member.avatar_url} alt={member.username} className="w-8 h-8 rounded-full" />
                          ) : (
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${darkMode ? 'bg-[#006239] text-white' : 'bg-gray-200 text-black'
                              }`}>
                              {member.username[0].toUpperCase()}
                            </div>
                          )}
                          <span className={`text-sm ${darkMode ? 'text-white' : 'text-black'}`}>
                            {member.username}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${darkMode ? 'bg-[#171717] text-gray-300' : 'bg-gray-200/50 text-gray-400'
                            }`}>
                            {member.role}
                          </span>
                        </div>
                      </div>
                      {isSelected && (
                        <select
                          value={isSelected.role}
                          onChange={(e) => updateMemberRole(member.user_id, e.target.value)}
                          className={`text-xs px-2 py-1 rounded border focus:outline-none focus:ring-1 focus:ring-blue-500/20 ${darkMode ? 'bg-dark-secondary border-[#171717] text-gray-300' : 'bg-white border-gray-200 text-gray-400'
                            }`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <option value="lead">Lead</option>
                          <option value="editor">Editor</option>
                          <option value="viewer">Viewer</option>
                        </select>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className={`p-4 text-center text-sm ${darkMode ? 'text-gray-300' : 'text-gray-400'}`}>
                No team members available
              </div>
            )}
          </div>
          <p className={`text-xs mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-400'}`}>
            {formData.selectedMembers.length} member(s) selected (+ you as lead)
          </p>
        </div>

        {error && (
          <div className={`p-3 rounded-lg border ${darkMode ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-red-50 border-red-200 text-red-600'
            }`}>
            <div className="flex items-start gap-2">
              <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
              <p className="text-sm">{error}</p>
            </div>
          </div>
        )}

        <div className="flex gap-3 pt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className={`flex-1 px-6 py-3 rounded-lg font-semibold transition-all ${darkMode ? 'bg-[#171717] text-gray-300 hover:bg-[#171717]/70' : 'bg-gray-200/50 text-gray-400 hover:bg-gray-200'
              } disabled:opacity-50`}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !formData.name.trim()}
            className={`flex-1 px-6 py-3 rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${darkMode ? 'bg-[#006239] hover:bg-[#006239]/80 text-white' : 'bg-[#006239] hover:bg-[#006239]/90 text-white'
              }`}
          >
            {isSubmitting ? 'Creating...' : 'Create Project'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

// Remove Member Confirmation Modal
const RemoveMemberConfirmModal = ({ isOpen, onClose, memberInfo, onConfirm, darkMode }) => {
  const [confirmText, setConfirmText] = useState('');
  const [error, setError] = useState(null);
  const [isRemoving, setIsRemoving] = useState(false);

  React.useEffect(() => {
    if (isOpen) {
      setConfirmText('');
      setError(null);
    }
  }, [isOpen]);

  const handleRemove = async () => {
    if (confirmText.toLowerCase() !== 'yes') {
      setError('Please type "Yes" to confirm');
      return;
    }

    setError(null);
    setIsRemoving(true);

    try {
      await onConfirm();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to remove member');
    } finally {
      setIsRemoving(false);
    }
  };

  const inputClass = `w-full rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/50 transition-all ${darkMode ? 'bg-dark-secondary border border-[#171717] text-white' : 'bg-white border border-gray-200 text-black'
    }`;

  return (
    <div className={`${isOpen ? 'fixed' : 'hidden'} inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto`}>
      <div
        className={`w-full max-w-lg rounded-xl shadow-2xl my-8 ${darkMode ? 'bg-dark-secondary border border-[#171717]' : 'bg-white border border-gray-200'
          }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`flex items-center justify-between p-6 border-b ${darkMode ? 'border-[#171717] bg-dark-secondary' : 'border-gray-200 bg-white'
          }`}>
          <h2 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-black'}`}>
            Remove Project Member
          </h2>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg transition-colors ${darkMode ? 'hover:bg-[#171717] text-gray-300' : 'hover:bg-gray-200/50 text-gray-400'
              }`}
          >
            <X size={20} />
          </button>
        </div>
        <div className="p-6">
          <div className="space-y-4">
            <div className={`p-4 rounded-lg border-2 ${darkMode ? 'bg-red-500/10 border-red-500/30' : 'bg-red-50 border-red-200'
              }`}>
              <div className="flex items-start gap-3">
                <AlertCircle className="text-red-500 flex-shrink-0 mt-0.5" size={20} />
                <div>
                  <h4 className={`font-bold text-sm mb-1 ${darkMode ? 'text-red-400' : 'text-red-600'}`}>
                    Warning: This action cannot be undone
                  </h4>
                  <p className={`text-sm mb-2 ${darkMode ? 'text-red-300' : 'text-red-500'}`}>
                    This member has <span className="font-bold">{memberInfo?.taskCount || 0} assigned task(s)</span>.
                  </p>
                  <p className={`text-sm ${darkMode ? 'text-red-300' : 'text-red-500'}`}>
                    Removing this member will:
                  </p>
                  <ul className={`text-xs mt-2 space-y-1 list-disc list-inside ${darkMode ? 'text-red-300' : 'text-red-500'}`}>
                    <li>Unassign them from all {memberInfo?.taskCount || 0} task(s)</li>
                    <li>Remove their access to this project</li>
                    <li>Remove them from project channels</li>
                  </ul>
                </div>
              </div>
            </div>

            <div>
              <label className={`block text-sm font-bold mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-400'}`}>
                Type <span className="font-mono text-red-500">"Yes"</span> to confirm:
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                className={inputClass}
                placeholder="Yes"
              />
            </div>

            {error && (
              <div className={`p-3 rounded-lg border ${darkMode ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-red-50 border-red-200 text-red-600'
                }`}>
                <div className="flex items-start gap-2">
                  <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
                  <p className="text-sm">{error}</p>
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                disabled={isRemoving}
                className={`flex-1 px-6 py-3 rounded-lg font-semibold transition-all ${darkMode ? 'bg-[#171717] text-gray-300 hover:bg-[#171717]/70' : 'bg-gray-200/50 text-gray-400 hover:bg-gray-200'
                  } disabled:opacity-50`}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRemove}
                disabled={isRemoving || confirmText.toLowerCase() !== 'yes'}
                className="flex-1 px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isRemoving ? 'Removing...' : 'Remove Member'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Edit Project Modal
const EditProjectModal = ({ isOpen, onClose, project, onSubmit, darkMode, teamMembers, teamId, queryClient }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    status: 'active',
    start_date: '',
    end_date: '',
    selectedMembers: [] // {userId, role}
  });
  const [error, setError] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [initialMembers, setInitialMembers] = useState([]); // Track initial state for comparison
  const [showRemoveMemberModal, setShowRemoveMemberModal] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState(null); // {userId, taskCount}
  const [pendingChanges, setPendingChanges] = useState(null); // Store changes to apply after confirmation

  // Fetch current project members when modal opens
  React.useEffect(() => {
    if (project && isOpen) {
      const fetchProjectMembers = async () => {
        try {
          const response = await getProjectMembers(project.id);
          const members = response.data.map(m => ({ userId: m.user_id, role: m.role }));
          setInitialMembers(members);

          setFormData({
            name: project.name || '',
            description: project.description || '',
            status: project.status || 'active',
            start_date: project.start_date ? new Date(project.start_date).toISOString().split('T')[0] : '',
            end_date: project.end_date ? new Date(project.end_date).toISOString().split('T')[0] : '',
            selectedMembers: members
          });
          setError(null);
        } catch (err) {
          console.error('Failed to fetch project members:', err);
          setError('Failed to load project members');
        }
      };

      fetchProjectMembers();
    }
  }, [project, isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Reset all error states
    setError(null);
    setFieldErrors({});

    // SECURITY: STRICT CLIENT-SIDE VALIDATION - BLOCK REQUEST IF INVALID
    try {
      const validatedData = projectSchema.parse({
        name: formData.name,
        description: formData.description,
        status: formData.status,
        start_date: formData.start_date,
        end_date: formData.end_date
      });

      console.log('✅ EditProject validation passed:', validatedData);
    } catch (err) {
      if (err instanceof z.ZodError) {
        // Build field-specific error map
        const errors = {};
        err.errors.forEach((error) => {
          const fieldName = error.path[0];
          errors[fieldName] = error.message;
        });

        console.log('EditProject validation failed:', errors);

        // Set errors to trigger visual feedback
        setFieldErrors(errors);
        setError('Please fix the errors below');

        // CRITICAL: DO NOT PROCEED - Block API call
        return; // Exit immediately without calling mutation
      }
    }

    // Validation passed - proceed with updates
    setIsSubmitting(true);

    try {
      // Handle project detail updates
      const dataToSubmit = {};

      if (formData.name.trim() !== project.name) {
        dataToSubmit.name = formData.name.trim();
      }

      if (formData.description?.trim() !== project.description) {
        dataToSubmit.description = formData.description.trim();
      }

      if (formData.status !== project.status) {
        dataToSubmit.status = formData.status;
      }

      const projectStartDate = project.start_date ? new Date(project.start_date).toISOString().split('T')[0] : '';
      if (formData.start_date !== projectStartDate) {
        dataToSubmit.start_date = formData.start_date ? new Date(formData.start_date).toISOString() : null;
      }

      const projectEndDate = project.end_date ? new Date(project.end_date).toISOString().split('T')[0] : '';
      if (formData.end_date !== projectEndDate) {
        dataToSubmit.end_date = formData.end_date ? new Date(formData.end_date).toISOString() : null;
      }

      // Update project if there are changes
      if (Object.keys(dataToSubmit).length > 0) {
        try {
          await onSubmit(dataToSubmit);
        } catch (err) {
          // Extract server error message from response
          const errorMessage = err.response?.data?.message || err.message || 'Failed to update project';
          console.error('Server error:', errorMessage);
          setError(errorMessage);
          setIsSubmitting(false);
          return; // Exit early, modal stays open
        }
      }

      // Handle member changes
      const currentMemberIds = initialMembers.map(m => m.userId);
      const selectedMemberIds = formData.selectedMembers.map(m => m.userId);

      // Members to add (in selected but not in current)
      const membersToAdd = formData.selectedMembers.filter(m => !currentMemberIds.includes(m.userId));

      // Members to remove (in current but not in selected)
      const membersToRemove = initialMembers.filter(m => !selectedMemberIds.includes(m.userId));

      // Members to update role (in both but role changed)
      const membersToUpdate = formData.selectedMembers.filter(m => {
        const initial = initialMembers.find(im => im.userId === m.userId);
        return initial && initial.role !== m.role;
      });

      // Execute member operations
      for (const member of membersToAdd) {
        try {
          await addProjectMember(project.id, member.userId, member.role);
        } catch (err) {
          const errorMessage = err.response?.data?.message || err.message || 'Failed to add member';
          console.error(`Failed to add member ${member.userId}:`, errorMessage);
          setError(`Failed to add member: ${errorMessage}`);
          setIsSubmitting(false);
          return; // Exit early, modal stays open
        }
      }

      for (const member of membersToRemove) {
        try {
          // Try to remove without force first
          await removeProjectMember(project.id, member.userId, false);
        } catch (err) {
          // Extract error message properly
          const errorMessage = err.response?.data?.message || err.message || 'Failed to remove member';

          // If member has tasks, show confirmation modal
          console.log('Remove member error:', errorMessage); // Debug log
          if (errorMessage.includes('assigned task')) {
            // Extract task count from error message
            const taskCountMatch = errorMessage.match(/(\d+)/);
            const taskCount = taskCountMatch ? parseInt(taskCountMatch[0]) : 0;

            // Store pending changes and show modal
            setPendingChanges({ dataToSubmit, membersToAdd, membersToRemove, membersToUpdate });
            setMemberToRemove({ userId: member.userId, taskCount });
            setShowRemoveMemberModal(true);
            setIsSubmitting(false);
            return; // Stop execution, wait for user confirmation
          } else {
            // Other errors - display and stop
            setError(`Failed to remove member: ${errorMessage}`);
            setIsSubmitting(false);
            return; // Exit early, modal stays open
          }
        }
      }

      for (const member of membersToUpdate) {
        try {
          await updateProjectMemberRole(project.id, member.userId, member.role);
        } catch (err) {
          console.error(`Failed to update member ${member.userId}:`, err);
          throw new Error(`Failed to update member role: ${err.message}`);
        }
      }

      // If no project changes and no member changes, show error
      if (Object.keys(dataToSubmit).length === 0 &&
        membersToAdd.length === 0 &&
        membersToRemove.length === 0 &&
        membersToUpdate.length === 0) {
        setError('No changes detected');
        setIsSubmitting(false);
        return;
      }

      // Invalidate queries to refresh data
      if (queryClient) {
        queryClient.invalidateQueries(['teamProjects', teamId]);
        queryClient.invalidateQueries(['teamStats', teamId]);
      }

      // SUCCESS: Only close modal if all operations succeeded
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleMember = (member) => {
    setFormData(prev => {
      const exists = prev.selectedMembers.find(m => m.userId === member.user_id);
      if (exists) {
        return {
          ...prev,
          selectedMembers: prev.selectedMembers.filter(m => m.userId !== member.user_id)
        };
      } else {
        return {
          ...prev,
          selectedMembers: [...prev.selectedMembers, { userId: member.user_id, role: 'viewer' }]
        };
      }
    });
  };

  const updateMemberRole = (userId, newRole) => {
    setFormData(prev => ({
      ...prev,
      selectedMembers: prev.selectedMembers.map(m =>
        m.userId === userId ? { ...m, role: newRole } : m
      )
    }));
  };

  // Handle confirmed member removal with force
  const handleConfirmedRemoval = async () => {
    if (!memberToRemove || !pendingChanges) return;

    setIsSubmitting(true);
    setShowRemoveMemberModal(false);

    try {
      const { dataToSubmit, membersToAdd, membersToRemove, membersToUpdate } = pendingChanges;

      // Execute member additions first
      for (const member of membersToAdd) {
        try {
          await addProjectMember(project.id, member.userId, member.role);
        } catch (err) {
          console.error(`Failed to add member ${member.userId}:`, err);
          throw new Error(`Failed to add member: ${err.message}`);
        }
      }

      // Execute member removals (including the one with tasks using force)
      for (const member of membersToRemove) {
        try {
          const forceRemove = member.userId === memberToRemove.userId;
          await removeProjectMember(project.id, member.userId, forceRemove);
        } catch (err) {
          throw new Error(`Failed to remove member: ${err.message}`);
        }
      }

      // Execute role updates
      for (const member of membersToUpdate) {
        try {
          await updateProjectMemberRole(project.id, member.userId, member.role);
        } catch (err) {
          console.error(`Failed to update member ${member.userId}:`, err);
          throw new Error(`Failed to update member role: ${err.message}`);
        }
      }

      // Invalidate queries to refresh data
      if (queryClient) {
        queryClient.invalidateQueries(['teamProjects', teamId]);
        queryClient.invalidateQueries(['teamStats', teamId]);
      }

      // Clear pending changes and close
      setPendingChanges(null);
      setMemberToRemove(null);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to update project');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getInputClass = (fieldName) => {
    const hasError = fieldErrors[fieldName];
    return `w-full rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 transition-all ${hasError
      ? 'border-2 border-red-500 focus:ring-red-500/50 bg-red-50 dark:bg-red-500/10'
      : darkMode
        ? 'bg-dark-secondary border border-[#171717] text-white placeholder-gray-500 focus:ring-blue-500/20'
        : 'bg-white border border-gray-200 text-black placeholder-gray-500 focus:ring-blue-500/20'
      }`;
  };

  return (
    <>
      <RemoveMemberConfirmModal
        isOpen={showRemoveMemberModal}
        onClose={() => {
          setShowRemoveMemberModal(false);
          setMemberToRemove(null);
          setPendingChanges(null);
          setIsSubmitting(false);
        }}
        memberInfo={memberToRemove}
        onConfirm={handleConfirmedRemoval}
        darkMode={darkMode}
      />

      <Modal isOpen={isOpen} onClose={onClose} title="Edit Project" darkMode={darkMode}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={`block text-sm font-bold mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-400'}`}>
              Project Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => {
                setFormData({ ...formData, name: e.target.value });
                if (fieldErrors.name) setFieldErrors({ ...fieldErrors, name: null });
              }}
              className={getInputClass('name')}
              placeholder="Enter project name"
              maxLength={100}
            />
            {fieldErrors.name ? (
              <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                <AlertCircle size={12} />
                {fieldErrors.name}
              </p>
            ) : (
              <p className={`text-xs mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-400'}`}>
                {formData.name.length}/100 characters
              </p>
            )}
          </div>

          <div>
            <label className={`block text-sm font-bold mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-400'}`}>
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => {
                setFormData({ ...formData, description: e.target.value });
                if (fieldErrors.description) setFieldErrors({ ...fieldErrors, description: null });
              }}
              className={getInputClass('description')}
              placeholder="Project description (optional)"
              rows={3}
              maxLength={500}
            />
            {fieldErrors.description ? (
              <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                <AlertCircle size={12} />
                {fieldErrors.description}
              </p>
            ) : (
              <p className={`text-xs mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-400'}`}>
                {formData.description.length}/500 characters
              </p>
            )}
          </div>

          <div>
            <label className={`block text-sm font-bold mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-400'}`}>
              Status
            </label>
            <select
              value={formData.status}
              onChange={(e) => {
                setFormData({ ...formData, status: e.target.value });
                if (fieldErrors.status) setFieldErrors({ ...fieldErrors, status: null });
              }}
              className={getInputClass('status')}
            >
              <option value="active">Active</option>
              <option value="archived">Archived</option>
              <option value="completed">Completed</option>
            </select>
            {fieldErrors.status && (
              <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                <AlertCircle size={12} />
                {fieldErrors.status}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={`block text-sm font-bold mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-400'}`}>
                Start Date
              </label>
              <input
                type="date"
                value={formData.start_date}
                onChange={(e) => {
                  setFormData({ ...formData, start_date: e.target.value });
                  if (fieldErrors.start_date) setFieldErrors({ ...fieldErrors, start_date: null });
                }}
                className={getInputClass('start_date')}
              />
              {fieldErrors.start_date && (
                <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                  <AlertCircle size={12} />
                  {fieldErrors.start_date}
                </p>
              )}
            </div>
            <div>
              <label className={`block text-sm font-bold mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-400'}`}>
                End Date
              </label>
              <input
                type="date"
                value={formData.end_date}
                onChange={(e) => {
                  setFormData({ ...formData, end_date: e.target.value });
                  if (fieldErrors.end_date) setFieldErrors({ ...fieldErrors, end_date: null });
                }}
                onBlur={() => {
                  // Validate date comparison on blur for EditProjectModal
                  if (formData.start_date && formData.end_date) {
                    const start = new Date(formData.start_date);
                    const end = new Date(formData.end_date);
                    if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && start > end) {
                      setFieldErrors(prev => ({ ...prev, end_date: 'End date must be after start date' }));
                    }
                  }
                }}
                className={getInputClass('end_date')}
              />
              {fieldErrors.end_date && (
                <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                  <AlertCircle size={12} />
                  {fieldErrors.end_date}
                </p>
              )}
            </div>
          </div>

          {/* Member Selection */}
          <div>
            <label className={`block text-sm font-bold mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-400'}`}>
              Project Members
            </label>
            <div className={`max-h-48 overflow-y-auto rounded-lg border ${darkMode ? 'border-[#171717] bg-dark-secondary' : 'border-gray-200 bg-white'
              }`}>
              {teamMembers && teamMembers.length > 0 ? (
                <div className="divide-y divide-[#171717]">
                  {teamMembers.map((member) => {
                    const isSelected = formData.selectedMembers.find(m => m.userId === member.user_id);
                    return (
                      <div key={member.user_id} className={`p-3 flex items-center justify-between hover:bg-[#171717]/30 transition-colors`}>
                        <div className="flex items-center gap-3 flex-1">
                          <input
                            type="checkbox"
                            checked={!!isSelected}
                            onChange={() => toggleMember(member)}
                            className="w-4 h-4 rounded border-gray-400 text-gray-400 focus:ring-blue-500/20"
                          />
                          <div className="flex items-center gap-2">
                            {member.avatar_url ? (
                              <img src={member.avatar_url} alt={member.username} className="w-8 h-8 rounded-full" />
                            ) : (
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${darkMode ? 'bg-[#006239] text-white' : 'bg-gray-200 text-black'
                                }`}>
                                {member.username[0].toUpperCase()}
                              </div>
                            )}
                            <span className={`text-sm ${darkMode ? 'text-white' : 'text-black'}`}>
                              {member.username}
                            </span>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${darkMode ? 'bg-[#171717] text-gray-300' : 'bg-gray-200/50 text-gray-400'
                              }`}>
                              {member.role}
                            </span>
                          </div>
                        </div>
                        {isSelected && (
                          <select
                            value={isSelected.role}
                            onChange={(e) => updateMemberRole(member.user_id, e.target.value)}
                            className={`text-xs px-2 py-1 rounded border focus:outline-none focus:ring-1 focus:ring-blue-500/20 ${darkMode ? 'bg-dark-secondary border-[#171717] text-gray-300' : 'bg-white border-gray-200 text-gray-400'
                              }`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <option value="lead">Lead</option>
                            <option value="editor">Editor</option>
                            <option value="viewer">Viewer</option>
                          </select>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className={`p-4 text-center text-sm ${darkMode ? 'text-gray-300' : 'text-gray-400'}`}>
                  No team members available
                </div>
              )}
            </div>
            <p className={`text-xs mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-400'}`}>
              {formData.selectedMembers.length} member(s) selected
            </p>
          </div>

          {error && (
            <div className={`p-3 rounded-lg border ${darkMode ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-red-50 border-red-200 text-red-600'
              }`}>
              <div className="flex items-start gap-2">
                <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
                <p className="text-sm">{error}</p>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className={`flex-1 px-6 py-3 rounded-lg font-semibold transition-all ${darkMode ? 'bg-[#171717] text-gray-300 hover:bg-[#171717]/70' : 'bg-gray-200/50 text-gray-400 hover:bg-gray-200'
                } disabled:opacity-50`}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !formData.name.trim()}
              className={`flex-1 px-6 py-3 rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${darkMode ? 'bg-[#006239] hover:bg-[#006239]/80 text-white' : 'bg-[#006239] hover:bg-[#006239]/90 text-white'
                }`}
            >
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
};

// Team Members Modal (View Only - Read-Only)
const TeamMembersModal = ({ isOpen, onClose, teamId, darkMode }) => {
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch team members
  const { data: membersData, isLoading } = useQuery({
    queryKey: ['teamMembers', teamId],
    queryFn: () => getTeamMembers(teamId),
    enabled: isOpen && !!teamId,
  });

  const members = membersData?.data || [];

  // Filter members based on search
  const filteredMembers = members.filter(member =>
    member.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    member.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Get user avatar
  const getUserAvatar = (member) => {
    if (member.avatar_url) {
      return (
        <img
          src={member.avatar_url}
          alt={member.username}
          className="h-10 w-10 rounded-full object-cover"
        />
      );
    }
    return (
      <div className={`h-10 w-10 rounded-full flex items-center justify-center text-sm font-medium ${darkMode ? 'bg-[#006239] text-white' : 'bg-gray-200 text-black'
        }`}>
        {member.username?.substring(0, 2).toUpperCase() || 'U'}
      </div>
    );
  };

  // Get role badge color
  const getRoleBadgeColor = (role) => {
    switch (role) {
      case 'owner':
        return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
      case 'admin':
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'member':
        return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
      default:
        return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Team Members (${members.length})`} darkMode={darkMode}>
      <div className="space-y-4">
        {/* Search Bar */}
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name or email..."
            className={`w-full rounded-lg px-4 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 transition-all ${darkMode
              ? 'bg-dark-secondary border border-[#171717] text-white focus:ring-blue-500/20 placeholder:text-gray-400'
              : 'bg-white border border-gray-200 text-black focus:ring-blue-500/20 placeholder:text-gray-400'
              }`}
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <Search size={16} className="text-gray-400" />
          </div>
        </div>

        {/* Members List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={24} className="animate-spin text-gray-400" />
          </div>
        ) : filteredMembers.length === 0 ? (
          <div className="py-8 text-center">
            <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              {searchQuery ? `No members found matching "${searchQuery}"` : 'No members in this team'}
            </p>
          </div>
        ) : (
          <div className={`divide-y ${darkMode ? 'divide-[#171717]' : 'divide-gray-200'
            }`}>
            {filteredMembers.map((member) => (
              <div
                key={member.id}
                className={`p-4 transition-colors ${darkMode ? 'hover:bg-[#171717]/50' : 'hover:bg-gray-50'
                  }`}
              >
                <div className="flex items-center gap-4">
                  {/* Avatar */}
                  {getUserAvatar(member)}

                  {/* Member Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className={`text-sm font-medium truncate ${darkMode ? 'text-white' : 'text-black'
                        }`}>
                        {member.username}
                      </p>
                    </div>
                    <p className={`text-xs truncate ${darkMode ? 'text-gray-400' : 'text-gray-500'
                      }`}>
                      {member.email}
                    </p>
                  </div>

                  {/* Role Badge (Read-Only) */}
                  <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium border ${getRoleBadgeColor(member.role)
                    }`}>
                    {member.role}
                  </span>
                </div>
              </div>
            ))}

            {/* Footer Info */}
            <div className={`text-xs text-center py-3 border-t ${darkMode ? 'text-gray-400 border-[#171717]' : 'text-gray-500 border-gray-200'
              }`}>
              {searchQuery
                ? `Showing ${filteredMembers.length} of ${members.length} members`
                : `Total ${members.length} team member${members.length !== 1 ? 's' : ''}`
              }
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

// Delete Project Modal
const DeleteProjectModal = ({ isOpen, onClose, project, onConfirm, darkMode }) => {
  const [confirmText, setConfirmText] = useState('');
  const [error, setError] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  React.useEffect(() => {
    if (isOpen) {
      setConfirmText('');
      setError(null);
    }
  }, [isOpen]);

  const handleDelete = async () => {
    if (confirmText !== project?.name) {
      setError('Project name does not match');
      return;
    }

    setError(null);
    setIsDeleting(true);

    try {
      await onConfirm();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to delete project');
    } finally {
      setIsDeleting(false);
    }
  };

  const inputClass = `w-full rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/50 transition-all ${darkMode ? 'bg-dark-secondary border border-[#171717] text-white' : 'bg-white border border-gray-200 text-black'
    }`;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Delete Project" darkMode={darkMode}>
      <div className="space-y-4">
        <div className={`p-4 rounded-lg border-2 ${darkMode ? 'bg-red-500/10 border-red-500/30' : 'bg-red-50 border-red-200'
          }`}>
          <div className="flex items-start gap-3">
            <AlertCircle className="text-red-500 flex-shrink-0 mt-0.5" size={20} />
            <div>
              <h4 className={`font-bold text-sm mb-1 ${darkMode ? 'text-red-400' : 'text-red-600'}`}>
                Warning: This action cannot be undone
              </h4>
              <p className={`text-sm ${darkMode ? 'text-red-300' : 'text-red-500'}`}>
                Deleting this project will permanently remove:
              </p>
              <ul className={`text-xs mt-2 space-y-1 list-disc list-inside ${darkMode ? 'text-red-300' : 'text-red-500'}`}>
                <li>All tasks in this project</li>
                <li>All project members</li>
                <li>All related channels</li>
                <li>All related data</li>
              </ul>
            </div>
          </div>
        </div>

        <div>
          <label className={`block text-sm font-bold mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-400'}`}>
            Type <span className="font-mono text-red-500">"{project?.name}"</span> to confirm:
          </label>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            className={inputClass}
            placeholder={project?.name}
          />
        </div>

        {error && (
          <div className={`p-3 rounded-lg border ${darkMode ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-red-50 border-red-200 text-red-600'
            }`}>
            <div className="flex items-start gap-2">
              <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
              <p className="text-sm">{error}</p>
            </div>
          </div>
        )}

        <div className="flex gap-3 pt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className={`flex-1 px-6 py-3 rounded-lg font-semibold transition-all ${darkMode ? 'bg-[#171717] text-gray-300 hover:bg-[#171717]/70' : 'bg-gray-200/50 text-gray-400 hover:bg-gray-200'
              } disabled:opacity-50`}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting || confirmText !== project?.name}
            className="flex-1 px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isDeleting ? 'Deleting...' : 'Delete Project'}
          </button>
        </div>
      </div>
    </Modal>
  );
};

const FilterButton = ({ active, onClick, children, darkMode }) => (
  <button
    onClick={onClick}
    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${active
      ? 'bg-[#006239] text-white shadow-md'
      : darkMode
        ? 'bg-[#171717] text-gray-300 hover:bg-gray-700'
        : 'bg-gray-200/50 text-gray-600 hover:bg-gray-200'
      }`}
  >
    {children}
  </button>
);

const ProjectCard = ({ project, darkMode, onClick, onEdit, onDelete, isPinned, onTogglePin }) => {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = React.useRef(null);

  // Close menu when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowMenu(false);
      }
    };

    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showMenu]);

  // Calculate progress percentage
  const progress = project.total_tasks > 0
    ? Math.round((project.completed_tasks / project.total_tasks) * 100)
    : 0;

  // Determine status color
  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'text-green-500 bg-green-500/10';
      case 'completed': return 'text-blue-500 bg-blue-500/10';
      case 'archived': return 'text-gray-500 bg-gray-500/10';
      default: return 'text-purple-500 bg-purple-500/10';
    }
  };

  return (
    <div
      className={`${darkMode ? 'bg-dark-secondary/50 border-[#171717]/50' : 'bg-white border-gray-200 shadow-sm'} ${isPinned ? 'ring-2 ring-amber-500/50' : ''} border rounded-xl p-5 hover:border-blue-500 transition-all flex flex-col h-full relative group`}
    >
      {/* Pinned indicator */}
      {isPinned && (
        <div className="absolute -top-2 -right-2 bg-amber-500 text-white p-1.5 rounded-full shadow-lg z-10">
          <Pin size={12} className="fill-current" />
        </div>
      )}
      {/* Project card header with menu */}
      <div className="flex justify-between items-start mb-3">
        <h3
          onClick={onClick}
          className={`font-semibold text-lg cursor-pointer hover:text-gray-400 transition-colors ${darkMode ? 'text-white' : 'text-black'}`}
        >
          {project.name}
        </h3>

        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${getStatusColor(project.status)}`}>
            {project.status}
          </span>

          {/* Actions menu */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(!showMenu);
              }}
              className={`p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all ${darkMode ? 'hover:bg-[#171717] text-gray-300' : 'hover:bg-gray-200/50 text-gray-400'
                } ${showMenu ? 'opacity-100' : ''}`}
            >
              <MoreVertical size={16} />
            </button>

            {showMenu && (
              <div
                className={`absolute right-0 mt-2 w-40 rounded-lg shadow-lg border z-10 ${darkMode ? 'bg-dark-secondary border-[#171717]' : 'bg-white border-gray-200'
                  }`}
              >
                {/* Pin/Unpin option */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMenu(false);
                    onTogglePin(project.id);
                  }}
                  className={`w-full flex items-center gap-2 px-4 py-2.5 text-sm transition-colors ${darkMode ? 'hover:bg-[#171717] text-amber-400' : 'hover:bg-amber-50 text-amber-600'
                    }`}
                >
                  <Pin size={14} className={isPinned ? 'fill-current' : ''} />
                  {isPinned ? 'Unpin Project' : 'Pin Project'}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMenu(false);
                    onEdit(project);
                  }}
                  className={`w-full flex items-center gap-2 px-4 py-2.5 text-sm transition-colors ${darkMode ? 'hover:bg-[#171717] text-gray-300' : 'hover:bg-gray-200/50 text-gray-400'
                    }`}
                >
                  <Edit3 size={14} />
                  Edit Project
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMenu(false);
                    onDelete(project);
                  }}
                  className={`w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-500 transition-colors ${darkMode ? 'hover:bg-red-500/10' : 'hover:bg-red-50'
                    }`}
                >
                  <Trash2 size={14} />
                  Delete Project
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <p
        onClick={onClick}
        className={`${darkMode ? 'text-gray-300' : 'text-gray-400'} text-sm mb-6 line-clamp-2 flex-grow cursor-pointer`}
      >
        {project.description || 'No description provided'}
      </p>

      <div onClick={onClick} className="mt-auto space-y-4 cursor-pointer">
        <div className="flex items-center gap-2">
          <Users size={14} className={darkMode ? 'text-gray-300' : 'text-gray-400'} />
          <span className={`text-xs ${darkMode ? 'text-gray-300' : 'text-gray-400'}`}>
            {project.member_count} {project.member_count === 1 ? 'member' : 'members'}
          </span>
        </div>

        <div>
          <div className={`flex justify-between text-xs mb-1.5 ${darkMode ? 'text-gray-300' : 'text-gray-400'}`}>
            <span>Progress</span>
            <span className={`font-medium ${darkMode ? 'text-gray-300' : 'text-black'}`}>{progress}%</span>
          </div>
          <div className={`w-full rounded-full h-1.5 ${darkMode ? 'bg-[#171717]' : 'bg-gray-200'}`}>
            <div
              className="bg-[#006239] h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>

        <div className={`pt-3 border-t flex items-center justify-between text-xs ${darkMode ? 'border-[#171717]/50 text-gray-300' : 'border-gray-200 text-gray-400'}`}>
          <div className="flex items-center">
            <Clock size={14} className="mr-1.5" />
            <span>{project.completed_tasks}/{project.total_tasks} tasks</span>
          </div>
          {project.end_date && (
            <span className={`${darkMode ? 'text-gray-300' : 'text-black'}`}>
              {new Date(project.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * MAIN TEAM PAGE COMPONENT
 */
export default function TeamPage() {
  const { isDarkMode } = useOutletContext();
  const { teamId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('created_at');

  // Modal states
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [showCreateProjectModal, setShowCreateProjectModal] = useState(false);
  const [showEditProjectModal, setShowEditProjectModal] = useState(false);
  const [showDeleteProjectModal, setShowDeleteProjectModal] = useState(false);
  const [showInviteMemberModal, setShowInviteMemberModal] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const [projectMenuOpen, setProjectMenuOpen] = useState(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const PROJECTS_PER_PAGE = 6;

  // Pinned projects state (stored in localStorage)
  const [pinnedProjects, setPinnedProjects] = useState(() => {
    try {
      const saved = localStorage.getItem(`team_${teamId}_pinned_projects`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Persist pinned projects to localStorage
  useEffect(() => {
    if (teamId) {
      localStorage.setItem(`team_${teamId}_pinned_projects`, JSON.stringify(pinnedProjects));
    }
  }, [pinnedProjects, teamId]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter]);

  // Toggle pin project handler
  const togglePinProject = (projectId) => {
    setPinnedProjects(prev => {
      if (prev.includes(projectId)) {
        return prev.filter(id => id !== projectId);
      } else {
        return [...prev, projectId];
      }
    });
  };

  // Fetch team data
  const { data: teamData, isLoading: teamLoading, error: teamError } = useQuery({
    queryKey: ['team', teamId],
    queryFn: () => getTeam(teamId),
    enabled: !!teamId,
  });

  // Fetch team projects
  const { data: projectsData, isLoading: projectsLoading } = useQuery({
    queryKey: ['teamProjects', teamId],
    queryFn: () => getTeamProjects(teamId),
    enabled: !!teamId,
  });

  // Fetch team stats
  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['teamStats', teamId],
    queryFn: () => getTeamStats(teamId),
    enabled: !!teamId,
  });

  // Fetch team members
  const { data: membersData, isLoading: membersLoading } = useQuery({
    queryKey: ['teamMembers', teamId],
    queryFn: () => getTeamMembers(teamId),
    enabled: !!teamId,
  });

  // Fetch pending invitations (only for admin/owner)
  const { data: pendingInvitationsData } = useQuery({
    queryKey: ['teamPendingInvitations', teamId],
    queryFn: () => getTeamPendingInvitations(teamId),
    enabled: !!teamId,
  });

  // Real-time: Subscribe to team room for project updates
  useEffect(() => {
    const socket = getSocket();
    if (!socket?.connected || !teamId) return;

    // Join team room
    joinTeam(teamId).catch(err => {
      console.warn('Failed to join team room:', err.message);
    });

    // Subscribe to project events
    const unsubCreated = onProjectCreated((project) => {
      console.log('Project created:', project.name);
      queryClient.invalidateQueries(['teamProjects', teamId]);
      queryClient.invalidateQueries(['teamStats', teamId]);
      toast.success(`New project created: ${project.name}`);
    });

    const unsubUpdated = onProjectUpdated((project) => {
      console.log('Project updated:', project.name);
      queryClient.invalidateQueries(['teamProjects', teamId]);
    });

    const unsubDeleted = onProjectDeleted(({ projectId }) => {
      console.log('Project deleted:', projectId);
      queryClient.invalidateQueries(['teamProjects', teamId]);
      queryClient.invalidateQueries(['teamStats', teamId]);
      toast.success('A project was deleted');
    });

    // Subscribe to member changes
    socket.on('member-joined', (data) => {
      console.log('New member joined:', data);
      if (data.teamId === parseInt(teamId)) {
        queryClient.invalidateQueries(['teamMembers', teamId]);
        queryClient.invalidateQueries(['teamStats', teamId]);
        toast.success(`New member joined the team!`);
      }
    });

    // Cleanup on unmount
    return () => {
      leaveTeamSocket(teamId);
      socket.off('member-joined');
      unsubCreated();
      unsubUpdated();
      unsubDeleted();
    };
  }, [teamId, queryClient]);

  // Revoke invitation mutation
  const revokeInvitationMutation = useMutation({
    mutationFn: (invitationId) => revokeInvitation(teamId, invitationId),
    onSuccess: () => {
      queryClient.invalidateQueries(['teamPendingInvitations', teamId]);
      toast.success('Invitation revoked successfully');
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to revoke invitation');
    },
  });

  // Handler for revoking invitations
  const handleRevokeInvite = (invite) => {
    revokeInvitationMutation.mutate(invite.id);
  };

  // Update team mutation
  const updateTeamMutation = useMutation({
    mutationFn: (updates) => updateTeam(teamId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries(['team', teamId]);
      queryClient.invalidateQueries(['teams']); // Refresh sidebar
    },
  });

  // Delete team mutation
  const deleteTeamMutation = useMutation({
    mutationFn: () => deleteTeam(teamId),
    onSuccess: () => {
      queryClient.invalidateQueries(['teams']); // Refresh sidebar
      navigate('/dashboard'); // Navigate to dashboard
    },
  });

  // Leave team mutation (for non-owners)
  const leaveTeamMutation = useMutation({
    mutationFn: () => leaveTeam(teamId),
    onSuccess: () => {
      queryClient.invalidateQueries(['teams']); // Refresh sidebar
      toast.success('You have left the team');
      navigate('/dashboard'); // Navigate to dashboard
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to leave team');
    },
  });

  // Create project mutation
  const createProjectMutation = useMutation({
    mutationFn: async (projectData) => {
      const { members, ...projectInfo } = projectData;

      // Create the project first
      const result = await createProject(teamId, projectInfo);
      const newProjectId = result.data.id;

      // Add members to the project (creator is already added as lead on backend)
      if (members && members.length > 0) {
        await Promise.all(
          members.map(member =>
            addProjectMember(newProjectId, member.userId, member.role)
          )
        );
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['teamProjects', teamId]);
      queryClient.invalidateQueries(['teamStats', teamId]);
    },
  });

  // Update project mutation
  const updateProjectMutation = useMutation({
    mutationFn: ({ projectId, updates }) => updateProject(teamId, projectId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries(['teamProjects', teamId]);
      queryClient.invalidateQueries(['teamStats', teamId]);
    },
  });

  // Delete project mutation
  const deleteProjectMutation = useMutation({
    mutationFn: (projectId) => deleteProject(teamId, projectId),
    onSuccess: () => {
      queryClient.invalidateQueries(['teamProjects', teamId]);
      queryClient.invalidateQueries(['teamStats', teamId]);
    },
  });

  const cardBg = isDarkMode ? 'bg-dark-secondary/50 border-[#171717]/50' : 'bg-white border-gray-200 shadow-sm';

  // Handle loading state
  if (teamLoading || statsLoading) {
    return (
      <div className="p-6 md:p-8">
        <div className="max-w-7xl mx-auto">
          <div className={`${cardBg} border rounded-xl p-8 text-center`}>
            <div className={`inline-block animate-spin rounded-full h-8 w-8 border-b-2 ${isDarkMode ? 'border-gray-400' : 'border-gray-400'}`}></div>
            <p className={`mt-4 ${isDarkMode ? 'text-gray-300' : 'text-gray-400'}`}>Loading team data...</p>
          </div>
        </div>
      </div>
    );
  }

  // Handle error state
  if (teamError) {
    return (
      <div className="p-6 md:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-8 text-center">
            <AlertCircle size={48} className="text-red-500 mx-auto mb-4" />
            <h2 className="text-red-500 font-bold text-xl mb-2">Error Loading Team</h2>
            <p className={`${isDarkMode ? 'text-red-200/70' : 'text-red-600/70'}`}>
              {teamError.message || 'Failed to load team data. You may not have access to this team.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const team = teamData?.data;
  const projects = projectsData?.data || [];
  const stats = statsData?.data || {};
  const members = membersData?.data || [];
  const pendingInvitations = pendingInvitationsData?.data || [];

  // Filter and sort projects
  const filteredProjects = projects
    .filter(project => {
      // Search filter
      if (searchQuery && !project.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !project.description?.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }

      // Status filter
      if (statusFilter !== 'all' && project.status !== statusFilter) {
        return false;
      }

      return true;
    })
    .sort((a, b) => {
      // PRIORITY: Pinned projects always come first
      const aIsPinned = pinnedProjects.includes(a.id);
      const bIsPinned = pinnedProjects.includes(b.id);

      if (aIsPinned && !bIsPinned) return -1;
      if (!aIsPinned && bIsPinned) return 1;

      // Within same pin status, apply regular sorting
      if (sortBy === 'created_at') {
        return new Date(b.created_at) - new Date(a.created_at);
      } else if (sortBy === 'name') {
        return a.name.localeCompare(b.name);
      } else if (sortBy === 'progress') {
        const progressA = a.total_tasks > 0 ? (a.completed_tasks / a.total_tasks) : 0;
        const progressB = b.total_tasks > 0 ? (b.completed_tasks / b.total_tasks) : 0;
        return progressB - progressA;
      }
      return 0;
    });

  // Pagination calculations
  const totalPages = Math.ceil(filteredProjects.length / PROJECTS_PER_PAGE);
  const paginatedProjects = filteredProjects.slice(
    (currentPage - 1) * PROJECTS_PER_PAGE,
    currentPage * PROJECTS_PER_PAGE
  );

  // Build stats array for display
  const STATS = [
    { label: 'Total Projects', value: stats.total_projects || 0, icon: FolderKanban, color: 'bg-blue-500/10 text-blue-500' },
    { label: 'Active Projects', value: stats.active_projects || 0, icon: CheckCircle2, color: 'bg-green-500/10 text-green-500' },
    { label: 'Total Tasks', value: stats.total_tasks || 0, icon: LayoutDashboard, color: 'bg-amber-500/10 text-amber-500' },
    { label: 'Team Members', value: stats.total_members || 0, icon: Users, color: 'bg-purple-500/10 text-purple-500' },
  ];

  return (
    <div className="p-6 md:p-8">
      <div className="max-w-7xl mx-auto">

        {/* WELCOME */}
        <div className="mb-8 flex items-start justify-between gap-4">
          <div className="flex-1">
            <h1 className={`text-2xl md:text-3xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-black'}`}>
              {team?.name || 'Team Dashboard'}
            </h1>
            <p className={`${isDarkMode ? 'text-gray-300' : 'text-gray-400'}`}>
              {team?.description || "Here's what's happening with team projects today."}
            </p>
          </div>

          {/* Settings Menu */}
          <div className="relative">
            <button
              onClick={() => setShowSettingsMenu(!showSettingsMenu)}
              className={`p-2.5 rounded-lg transition-colors ${isDarkMode ? 'hover:bg-[#171717] text-gray-300' : 'hover:bg-gray-200/50 text-gray-400'
                }`}
              title="Team Settings"
            >
              <Settings size={20} />
            </button>

            {showSettingsMenu && (() => {
              // Find current user's role in this team
              const currentMember = members.find(m => m.user_id === currentUser?.id);
              const isOwner = currentMember?.role === 'owner';

              return (
                <div className={`absolute right-0 mt-2 w-48 rounded-lg shadow-lg border overflow-hidden z-10 ${isDarkMode ? 'bg-dark-secondary border-[#171717]' : 'bg-white border-gray-200'
                  }`}>
                  {isOwner ? (
                    // Owner can Edit and Delete team
                    <>
                      <button
                        onClick={() => { setShowEditModal(true); setShowSettingsMenu(false); }}
                        className={`w-full flex items-center gap-2 px-4 py-2.5 text-sm transition-colors ${isDarkMode ? 'hover:bg-[#171717] text-gray-300' : 'hover:bg-gray-200/30 text-black'
                          }`}
                      >
                        <Edit3 size={14} />
                        Edit Team
                      </button>
                      <button
                        onClick={() => { setShowDeleteModal(true); setShowSettingsMenu(false); }}
                        className={`w-full flex items-center gap-2 px-4 py-2.5 text-sm transition-colors ${isDarkMode ? 'hover:bg-[#171717] text-red-400' : 'hover:bg-gray-200/30 text-red-600'
                          }`}
                      >
                        <Trash2 size={14} />
                        Delete Team
                      </button>
                    </>
                  ) : (
                    // Members and Admins can only Leave team
                    <button
                      onClick={() => {
                        setShowLeaveModal(true);
                        setShowSettingsMenu(false);
                      }}
                      className={`w-full flex items-center gap-2 px-4 py-2.5 text-sm transition-colors ${isDarkMode ? 'hover:bg-[#171717] text-red-400' : 'hover:bg-gray-200/30 text-red-600'
                        }`}
                    >
                      <Trash2 size={14} />
                      Leave Team
                    </button>
                  )}
                </div>
              );
            })()}
          </div>
        </div>

        {/* PENDING INVITATIONS */}
        <PendingInvitationsList
          invitations={pendingInvitations}
          onRevoke={handleRevokeInvite}
          darkMode={isDarkMode}
        />

        {/* TOP ROW: TEAM MEMBERS & TEAM PROGRESS */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">

          {/* TEAM MEMBERS WIDGET */}
          <div className={`${cardBg} border rounded-xl p-5 transition-all`}>
            <div className="flex items-center justify-between mb-4">
              <h3 className={`font-bold ${isDarkMode ? 'text-white' : 'text-black'}`}>Team Members</h3>
              <button
                onClick={() => setShowInviteMemberModal(true)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${isDarkMode
                  ? 'bg-[#006239] hover:bg-[#006239]/80 text-white'
                  : 'bg-[#006239] hover:bg-[#006239]/90 text-white'
                  }`}
                title="Invite a new member"
              >
                <Plus size={14} />
                Invite
              </button>
            </div>

            {membersLoading ? (
              <div className="text-center py-4">
                <div className={`inline-block animate-spin rounded-full h-5 w-5 border-b-2 ${isDarkMode ? 'border-gray-400' : 'border-gray-400'}`}></div>
              </div>
            ) : members.length === 0 ? (
              <p className={`text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-400'}`}>No members found</p>
            ) : (
              <>
                <div className="space-y-3">
                  {members.slice(0, 4).map((member) => (
                    <div key={member.id} className={`flex items-center gap-4 p-2 rounded-lg transition-all ${isDarkMode ? 'hover:bg-[#171717]/50' : 'hover:bg-gray-200/20'}`}>
                      {member.avatar_url ? (
                        <img
                          src={member.avatar_url}
                          alt={member.username}
                          className={`h-10 w-10 rounded-full object-cover border-2 ${isDarkMode ? 'border-[rgb(30,36,30)]' : 'border-gray-100'}`}
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextElementSibling.style.display = 'flex';
                          }}
                        />
                      ) : null}
                      <div
                        className={`h-10 w-10 rounded-full flex items-center justify-center text-sm font-medium ${isDarkMode ? 'bg-[#006239] text-white' : 'bg-gray-200 text-black'}`}
                        style={{ display: member.avatar_url ? 'none' : 'flex' }}
                      >
                        {member.username?.substring(0, 2).toUpperCase() || 'U'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium truncate ${isDarkMode ? 'text-gray-300' : 'text-black'}`}>
                          {member.username}
                        </p>
                        <p className={`text-xs truncate ${isDarkMode ? 'text-gray-300' : 'text-gray-400'}`}>
                          {member.role}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                {members.length > 4 && (
                  <button
                    onClick={() => setShowMembersModal(true)}
                    className={`w-full mt-3 py-2 text-sm font-medium border-t transition-colors ${isDarkMode ? 'text-gray-300 hover:text-white border-[#171717]/50' : 'text-gray-400 hover:text-black border-gray-200'}`}
                  >
                    View All {members.length} Members
                  </button>
                )}
              </>
            )}
          </div>

          {/* TEAM PROGRESS WIDGET */}
          <div className={`${cardBg} border rounded-xl p-5 transition-all`}>
            <h3 className={`font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-black'}`}>Team Progress</h3>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className={`${isDarkMode ? 'bg-[#171717]/50' : 'bg-gray-200/30'} rounded-lg p-4 text-center`}>
                <div className={`text-3xl font-bold mb-1 ${isDarkMode ? 'text-white' : 'text-black'}`}>
                  {stats.total_projects || 0}
                </div>
                <div className={`text-xs font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-400'}`}>
                  Total Projects
                </div>
              </div>
              <div className={`${isDarkMode ? 'bg-[#171717]/50' : 'bg-gray-200/30'} rounded-lg p-4 text-center`}>
                <div className={`text-3xl font-bold mb-1 ${isDarkMode ? 'text-white' : 'text-black'}`}>
                  {stats.total_members || 0}
                </div>
                <div className={`text-xs font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-400'}`}>
                  Team Members
                </div>
              </div>
            </div>

            {/* Progress Bars */}
            <div className="space-y-3">
              <div>
                <div className={`flex justify-between items-center mb-1.5 ${isDarkMode ? 'text-gray-300' : 'text-gray-400'}`}>
                  <span className="text-xs">Tasks Completed</span>
                  <span className={`text-sm font-bold ${isDarkMode ? 'text-gray-300' : 'text-black'}`}>
                    {stats.completed_tasks || 0}/{stats.total_tasks || 0}
                  </span>
                </div>
                <div className={`w-full rounded-full h-2 ${isDarkMode ? 'bg-[#171717]' : 'bg-gray-200'}`}>
                  <div
                    className="bg-green-500 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${stats.total_tasks > 0 ? (stats.completed_tasks / stats.total_tasks * 100) : 0}%` }}
                  ></div>
                </div>
              </div>

              <div>
                <div className={`flex justify-between items-center mb-1.5 ${isDarkMode ? 'text-gray-300' : 'text-gray-400'}`}>
                  <span className="text-xs">In Progress</span>
                  <span className={`text-sm font-bold ${isDarkMode ? 'text-gray-300' : 'text-black'}`}>
                    {stats.in_progress_tasks || 0}
                  </span>
                </div>
                <div className={`w-full rounded-full h-2 ${isDarkMode ? 'bg-[#171717]' : 'bg-gray-200'}`}>
                  <div
                    className="bg-amber-500 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${stats.total_tasks > 0 ? (stats.in_progress_tasks / stats.total_tasks * 100) : 0}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* PROJECTS SECTION - FULL WIDTH */}
        <div className="space-y-6">

          {/* Compact Toolbar - Single Row */}
          <div className={`${cardBg} border rounded-xl p-4`}>
            <div className="flex items-center justify-between gap-4 flex-wrap">

              {/* Left Group: Search + Filter Tabs */}
              <div className="flex items-center gap-3 flex-1 min-w-[300px]">
                {/* Compact Search */}
                <div className="relative w-[380px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input
                    type="text"
                    placeholder="Search projects..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className={`w-full rounded-lg py-2 pl-9 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all ${isDarkMode
                      ? 'bg-dark-secondary text-white border border-[#171717] placeholder:text-gray-500'
                      : 'bg-white text-black border border-gray-200 placeholder:text-gray-400'
                      }`}
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                {/* Status Filter Pills */}
                <div className="flex items-center gap-1.5">
                  <FilterButton active={statusFilter === 'all'} onClick={() => setStatusFilter('all')} darkMode={isDarkMode}>All</FilterButton>
                  <FilterButton active={statusFilter === 'active'} onClick={() => setStatusFilter('active')} darkMode={isDarkMode}>Active</FilterButton>
                  <FilterButton active={statusFilter === 'completed'} onClick={() => setStatusFilter('completed')} darkMode={isDarkMode}>Completed</FilterButton>
                  <FilterButton active={statusFilter === 'archived'} onClick={() => setStatusFilter('archived')} darkMode={isDarkMode}>Archived</FilterButton>
                </div>
              </div>

              {/* Right Group: Sort + Create Button */}
              <div className="flex items-center gap-3">
                {/* Sort Dropdown (compact) */}
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className={`rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all ${isDarkMode
                    ? 'bg-[#171717] text-gray-300 border border-[#171717] hover:bg-gray-700'
                    : 'bg-gray-200/50 text-gray-600 border border-gray-200 hover:bg-gray-200'
                    }`}
                >
                  <option value="created_at">Sort: Newest</option>
                  <option value="name">Sort: Name</option>
                  <option value="progress">Sort: Progress</option>
                </select>

                {/* Create Project Button - Conditionally Rendered */}
                {(() => {
                  const currentMember = members.find(m => m.user_id === currentUser?.id);
                  const canCreateProject = currentMember?.role === 'owner' || currentMember?.role === 'admin';

                  return canCreateProject ? (
                    <button
                      onClick={() => setShowCreateProjectModal(true)}
                      className="flex items-center gap-2 bg-[#006239] hover:bg-[#005230] text-white px-4 py-2 rounded-lg font-semibold shadow-lg shadow-[rgb(119,136,115)]/20 transition-all active:scale-95 whitespace-nowrap"
                    >
                      <Plus size={16} />
                      Create Project
                    </button>
                  ) : null;
                })()}
              </div>

            </div>
          </div>

          {/* Projects Header */}
          <div className="flex items-center justify-between">
            <h2 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-black'}`}>
              Projects
              {!projectsLoading && filteredProjects.length > 0 && (
                <span className={`ml-2 text-sm font-normal ${isDarkMode ? 'text-gray-300' : 'text-gray-400'}`}>
                  ({filteredProjects.length} {filteredProjects.length !== projects.length ? `of ${projects.length}` : ''})
                </span>
              )}
            </h2>
          </div>

          {/* Projects Grid */}
          {projectsLoading ? (
            <div className={`${cardBg} border rounded-xl p-8 text-center`}>
              <div className={`inline-block animate-spin rounded-full h-6 w-6 border-b-2 ${isDarkMode ? 'border-gray-400' : 'border-gray-400'}`}></div>
              <p className={`mt-3 text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-400'}`}>Loading projects...</p>
            </div>
          ) : filteredProjects.length === 0 ? (
            <div className={`${cardBg} border rounded-xl p-8 text-center`}>
              <FolderKanban size={48} className={`mx-auto mb-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-300'}`} />
              <p className={`${isDarkMode ? 'text-gray-300' : 'text-gray-400'}`}>
                {searchQuery || statusFilter !== 'all'
                  ? 'No projects match your filters'
                  : 'No projects yet in this team'}
              </p>
              {(searchQuery || statusFilter !== 'all') && (
                <button
                  onClick={() => { setSearchQuery(''); setStatusFilter('all'); }}
                  className={`mt-4 text-sm font-medium ${isDarkMode ? 'text-gray-300 hover:text-white' : 'text-gray-400 hover:text-black'}`}
                >
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {paginatedProjects.map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    darkMode={isDarkMode}
                    onClick={() => navigate(`/teams/${teamId}/projects/${project.id}`)}
                    onEdit={(proj) => {
                      setSelectedProject(proj);
                      setShowEditProjectModal(true);
                    }}
                    onDelete={(proj) => {
                      setSelectedProject(proj);
                      setShowDeleteProjectModal(true);
                    }}
                    isPinned={pinnedProjects.includes(project.id)}
                    onTogglePin={togglePinProject}
                  />
                ))}
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-6">
                  {/* Previous Button */}
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className={`p-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${isDarkMode ? 'hover:bg-[#171717] text-gray-300' : 'hover:bg-gray-200 text-gray-600'
                      }`}
                  >
                    <ChevronLeft size={20} />
                  </button>

                  {/* Page Numbers */}
                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNum => (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`min-w-[36px] h-9 px-3 rounded-lg text-sm font-medium transition-colors ${currentPage === pageNum
                          ? 'bg-[#006239] text-white'
                          : isDarkMode
                            ? 'hover:bg-[#171717] text-gray-300'
                            : 'hover:bg-gray-200 text-gray-600'
                          }`}
                      >
                        {pageNum}
                      </button>
                    ))}
                  </div>

                  {/* Next Button */}
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className={`p-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${isDarkMode ? 'hover:bg-[#171717] text-gray-300' : 'hover:bg-gray-200 text-gray-600'
                      }`}
                  >
                    <ChevronRight size={20} />
                  </button>

                  {/* Page Info */}
                  <span className={`ml-3 text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    Page {currentPage} of {totalPages}
                  </span>
                </div>
              )}
            </>
          )}
        </div>

      </div>

      {/* MODALS */}
      <EditTeamModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        team={team}
        onSubmit={(updates) => updateTeamMutation.mutateAsync(updates)}
        darkMode={isDarkMode}
        teamId={teamId}
        queryClient={queryClient}
      />

      <InviteMemberModal
        isOpen={showInviteMemberModal}
        onClose={() => setShowInviteMemberModal(false)}
        teamId={team?.id}
        darkMode={isDarkMode}
      />

      <TeamMembersModal
        isOpen={showMembersModal}
        onClose={() => setShowMembersModal(false)}
        teamId={teamId}
        darkMode={isDarkMode}
      />

      <DeleteTeamModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        team={team}
        onConfirm={() => deleteTeamMutation.mutate()}
        darkMode={isDarkMode}
      />

      <LeaveTeamModal
        isOpen={showLeaveModal}
        onClose={() => setShowLeaveModal(false)}
        team={team}
        onConfirm={() => leaveTeamMutation.mutate()}
        darkMode={isDarkMode}
      />

      <CreateProjectModal
        isOpen={showCreateProjectModal}
        onClose={() => setShowCreateProjectModal(false)}
        teamId={teamId}
        teamMembers={members}
        onSubmit={(projectData) => createProjectMutation.mutateAsync(projectData)}
        darkMode={isDarkMode}
        currentUserId={currentUser?.id}
      />

      <EditProjectModal
        isOpen={showEditProjectModal}
        onClose={() => {
          setShowEditProjectModal(false);
          setSelectedProject(null);
        }}
        project={selectedProject}
        onSubmit={(updates) => updateProjectMutation.mutateAsync({ projectId: selectedProject.id, updates })}
        darkMode={isDarkMode}
        teamMembers={membersData?.data}
        teamId={teamData?.data?.id}
        queryClient={queryClient}
      />

      <DeleteProjectModal
        isOpen={showDeleteProjectModal}
        onClose={() => {
          setShowDeleteProjectModal(false);
          setSelectedProject(null);
        }}
        project={selectedProject}
        onConfirm={() => deleteProjectMutation.mutate(selectedProject.id)}
        darkMode={isDarkMode}
      />
    </div>
  );
}


