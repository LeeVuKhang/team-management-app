import React, { useState, useEffect } from 'react';
import { useOutletContext, useParams, useNavigate } from 'react-router-dom';
import * as projectApi from './services/projectApi';
import * as riskReportApi from './services/riskReportApi';
import { RiskReportCard } from './components/RiskReportCard';
import toast from 'react-hot-toast';
import {
  getSocket,
  joinProject,
  leaveProject,
  onTaskCreated,
  onTaskUpdated,
  onTaskDeleted,
} from './services/socketService';
import {
  CheckCircle2,
  Clock,
  MoreVertical,
  AlertCircle,
  ArrowLeft,
  Calendar,
  Circle,
  PlayCircle,
  Eye,
  Edit3,
  Trash2,
  Flag,
  Paperclip,
  Plus,
  FolderKanban,
  Search,
  User,
  MessageSquare,
  Brain,
  ChevronDown,
  Filter,
  Pin,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

/**
 * UTILITY FUNCTIONS
 */
// Note: React automatically escapes text content to prevent XSS.
// This function is kept for additional defense-in-depth, removing angle brackets
// that could be used in HTML injection attempts. For user-generated HTML content,
// consider using a library like DOMPurify.
const sanitizeText = (text) => {
  if (!text) return '';
  return text.replace(/[<>]/g, '');
};

const formatDate = (dateString) => {
  if (!dateString) return 'No deadline';
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return 'Invalid date';
  }
};

const getDaysUntilDue = (dueDateString) => {
  if (!dueDateString) return null;
  const due = new Date(dueDateString);
  const now = new Date();
  const diffTime = due - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

const canEditTasks = (userRole) => {
  return userRole === 'lead' || userRole === 'editor';
};

/**
 * PROJECT-SPECIFIC COMPONENTS
 */
const TaskStatusBadge = ({ status, taskId, onStatusChange, canEdit, darkMode }) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = React.useRef(null);

  const statusConfig = {
    todo: { label: 'To Do', icon: Circle, color: 'text-slate-500 bg-slate-500/10', hoverColor: 'hover:bg-slate-500/20' },
    in_progress: { label: 'In Progress', icon: PlayCircle, color: 'text-blue-500 bg-blue-500/10', hoverColor: 'hover:bg-blue-500/20' },
    review: { label: 'Review', icon: Eye, color: 'text-purple-500 bg-purple-500/10', hoverColor: 'hover:bg-purple-500/20' },
    done: { label: 'Done', icon: CheckCircle2, color: 'text-green-500 bg-green-500/10', hoverColor: 'hover:bg-green-500/20' },
  };

  const config = statusConfig[status] || statusConfig.todo;
  const Icon = config.icon;

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showDropdown]);

  const handleStatusSelect = (newStatus) => {
    if (onStatusChange && newStatus !== status) {
      onStatusChange(taskId, newStatus);
    }
    setShowDropdown(false);
  };

  // If not editable, render as static badge
  if (!canEdit || !onStatusChange) {
    return (
      <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${config.color}`}>
        <Icon size={12} />
        {config.label}
      </span>
    );
  }

  // Editable: render as clickable dropdown trigger
  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wider transition-all cursor-pointer ${config.color} ${config.hoverColor} ring-offset-1 hover:ring-2 hover:ring-current/30`}
        title="Click to change status"
      >
        <Icon size={12} />
        {config.label}
        <ChevronDown size={10} className={`ml-0.5 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Menu */}
      {showDropdown && (
        <div className={`absolute left-0 top-full mt-1 w-40 rounded-lg shadow-xl border overflow-hidden z-20 ${darkMode ? 'bg-dark-secondary border-[#171717]' : 'bg-white border-gray-200'}`}>
          {Object.entries(statusConfig).map(([key, cfg]) => {
            const StatusIcon = cfg.icon;
            const isActive = key === status;
            return (
              <button
                key={key}
                onClick={() => handleStatusSelect(key)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors ${isActive
                  ? darkMode ? 'bg-[#171717]' : 'bg-gray-100'
                  : darkMode ? 'hover:bg-[#171717]' : 'hover:bg-gray-50'
                  } ${cfg.color.split(' ')[0]}`}
              >
                <StatusIcon size={14} />
                <span className="font-medium">{cfg.label}</span>
                {isActive && <CheckCircle2 size={12} className="ml-auto text-green-500" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

const PriorityBadge = ({ priority }) => {
  const priorityConfig = {
    low: { label: 'Low', icon: Flag, color: 'text-slate-500 bg-slate-500/10' },
    medium: { label: 'Medium', icon: Flag, color: 'text-amber-500 bg-amber-500/10' },
    high: { label: 'High', icon: Flag, color: 'text-orange-500 bg-orange-500/10' },
    urgent: { label: 'Urgent', icon: Flag, color: 'text-red-500 bg-red-500/10' },
  };

  const config = priorityConfig[priority] || priorityConfig.medium;
  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${config.color}`}>
      <Icon size={12} />
      {config.label}
    </span>
  );
};

const TaskCard = ({ task, darkMode, userRole, onEdit, onDelete, isPinned, onTogglePin, onStatusChange }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const daysUntilDue = getDaysUntilDue(task.due_date);
  const isOverdue = daysUntilDue !== null && daysUntilDue < 0;
  const isDueSoon = daysUntilDue !== null && daysUntilDue >= 0 && daysUntilDue <= 3;

  const canEdit = canEditTasks(userRole);

  return (
    <div className={`${darkMode ? 'bg-dark-secondary/50 border-[#171717]/50 hover:border-blue-500/50' : 'bg-white border-gray-200 shadow-sm hover:border-blue-500'} ${isPinned ? 'ring-2 ring-amber-500/50' : ''} border rounded-xl p-5 transition-all group relative`}>

      {/* Pinned indicator */}
      {isPinned && (
        <div className="absolute -top-2 -right-2 bg-amber-500 text-white p-1.5 rounded-full shadow-lg z-10">
          <Pin size={12} className="fill-current" />
        </div>
      )}

      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <h3 className={`font-semibold text-lg mb-2 ${darkMode ? 'text-white' : 'text-black'}`}>
            {sanitizeText(task.title)}
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            <TaskStatusBadge
              status={task.status}
              taskId={task.id}
              onStatusChange={onStatusChange}
              canEdit={canEdit}
              darkMode={darkMode}
            />
            <PriorityBadge priority={task.priority} />
          </div>
        </div>

        {canEdit && (
          <div className="relative">
            <button
              onClick={() => setShowActions(!showActions)}
              className={`p-2 rounded-lg transition-colors ${darkMode ? 'hover:bg-[#171717] text-gray-300' : 'hover:bg-gray-100 text-gray-700'}`}
            >
              <MoreVertical size={18} />
            </button>

            {showActions && (
              <div className={`absolute right-0 mt-2 w-48 rounded-lg shadow-lg border overflow-hidden z-10 ${darkMode ? 'bg-dark-secondary border-[#171717]' : 'bg-white border-gray-200'}`}>
                {/* Pin/Unpin option */}
                <button
                  onClick={() => { onTogglePin(task.id); setShowActions(false); }}
                  className={`w-full flex items-center gap-2 px-4 py-2.5 text-sm transition-colors ${darkMode ? 'hover:bg-[#171717] text-amber-400' : 'hover:bg-amber-50 text-amber-600'}`}
                >
                  <Pin size={14} className={isPinned ? 'fill-current' : ''} />
                  {isPinned ? 'Unpin Task' : 'Pin Task'}
                </button>
                <button
                  onClick={() => { onEdit(task); setShowActions(false); }}
                  className={`w-full flex items-center gap-2 px-4 py-2.5 text-sm transition-colors ${darkMode ? 'hover:bg-[#171717] text-gray-300' : 'hover:bg-gray-200/30 text-black'}`}
                >
                  <Edit3 size={14} />
                  Edit Task
                </button>
                <button
                  onClick={() => { onDelete(task); setShowActions(false); }}
                  className={`w-full flex items-center gap-2 px-4 py-2.5 text-sm transition-colors ${darkMode ? 'hover:bg-[#171717] text-red-400' : 'hover:bg-gray-200/30 text-red-600'}`}
                >
                  <Trash2 size={14} />
                  Delete Task
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {task.description && (
        <p className={`${darkMode ? 'text-gray-300' : 'text-gray-400'} text-sm mb-4 ${isExpanded ? '' : 'line-clamp-2'}`}>
          {sanitizeText(task.description)}
        </p>
      )}

      {task.description && task.description.length > 100 && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={`text-xs font-medium mb-3 ${darkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-400 hover:text-black'}`}
        >
          {isExpanded ? 'Show less' : 'Show more'}
        </button>
      )}

      <div className={`space-y-3 pt-3 border-t ${darkMode ? 'border-[#171717]/50' : 'border-gray-200'}`}>

        {/* Assigned To Row */}
        <div className="flex items-center justify-between">
          <span className={`text-xs font-medium ${darkMode ? 'text-gray-300' : 'text-gray-400'}`}>
            Assigned to:
          </span>
          <div className="flex items-center gap-2">
            {(() => {
              // Filter out null/invalid assignees and ensure we have valid data
              const validAssignees = Array.isArray(task.assignees)
                ? task.assignees.filter(a => a && a.user_id)
                : [];

              if (validAssignees.length > 0) {
                return (
                  <>
                    <div className="flex -space-x-2">
                      {validAssignees.slice(0, 3).map((assignee, idx) => (
                        <div key={assignee.user_id || idx} className="relative">
                          {assignee.avatar_url ? (
                            <img
                              src={assignee.avatar_url}
                              alt={assignee.username}
                              className={`h-6 w-6 rounded-full object-cover border-2 ${darkMode
                                ? 'border-[rgb(30,36,30)]'
                                : 'border-white'
                                }`}
                              title={assignee.username}
                              onError={(e) => {
                                e.target.style.display = 'none';
                                e.target.nextElementSibling.style.display = 'flex';
                              }}
                            />
                          ) : null}
                          <div
                            className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-medium border-2 ${darkMode
                              ? 'bg-[#006239] text-white border-[rgb(30,36,30)]'
                              : 'bg-gray-200 text-black border-white'
                              }`}
                            title={assignee.username}
                            style={{ display: assignee.avatar_url ? 'none' : 'flex' }}
                          >
                            {assignee.username ? assignee.username.charAt(0).toUpperCase() : '?'}
                          </div>
                        </div>
                      ))}
                      {validAssignees.length > 3 && (
                        <div
                          className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-medium border-2 ${darkMode
                            ? 'bg-[#171717] text-gray-300 border-[rgb(30,36,30)]'
                            : 'bg-gray-100 text-gray-700 border-white'
                            }`}
                        >
                          +{validAssignees.length - 3}
                        </div>
                      )}
                    </div>
                    <span className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-black'}`}>
                      {validAssignees.length} {validAssignees.length === 1 ? 'person' : 'people'}
                    </span>
                  </>
                );
              } else {
                return (
                  <>
                    <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-medium ${darkMode ? 'bg-[#171717] text-gray-300' : 'bg-gray-100 text-gray-700'
                      }`}>
                      ?
                    </div>
                    <span className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-400'}`}>
                      Unassigned
                    </span>
                  </>
                );
              }
            })()}
          </div>
        </div>

        {/* Due Date Row */}
        <div className="flex items-center justify-between">
          <span className={`text-xs font-medium ${darkMode ? 'text-gray-300' : 'text-gray-400'}`}>
            Due date:
          </span>
          <div className="flex items-center gap-1.5">
            <Clock size={14} className={isOverdue ? 'text-red-500' : isDueSoon ? 'text-amber-500' : (darkMode ? 'text-gray-300' : 'text-gray-400')} />
            <span className={`text-sm font-medium ${isOverdue ? 'text-red-500' : isDueSoon ? 'text-amber-500' : (darkMode ? 'text-gray-300' : 'text-black')}`}>
              {formatDate(task.due_date)}
              {isOverdue && ' (Overdue)'}
              {isDueSoon && !isOverdue && ` (${daysUntilDue}d left)`}
            </span>
          </div>
        </div>

        {/* Updated Date Footer */}
        <div className="flex justify-end pt-1">
          <span className={`text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'} opacity-60`}>
            Updated {formatDate(task.updated_at)}
          </span>
        </div>
      </div>
    </div>
  );
};


const FilterButton = ({ active, children, onClick, darkMode }) => (
  <button
    onClick={onClick}
    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${active
      ? 'bg-[#006239] text-white shadow-md'
      : darkMode
        ? 'bg-dark-secondary/50 text-gray-300 hover:bg-[#171717] hover:text-gray-300'
        : 'bg-white text-gray-400 border border-gray-200 hover:bg-gray-200/30 hover:text-black'
      }`}
  >
    {children}
  </button>
);

/**
 * MODAL COMPONENTS
 */
const Modal = ({ isOpen, onClose, title, children, darkMode }) => {
  if (!isOpen) return null;

  // Prevent body scroll when modal is open
  React.useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    const originalPaddingRight = document.body.style.paddingRight;

    // Prevent scroll
    document.body.style.overflow = 'hidden';

    // Prevent scrollbar shift by adding padding
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.paddingRight = originalPaddingRight;
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-hidden"
      onClick={onClose}
      onWheel={(e) => e.preventDefault()}
      onTouchMove={(e) => e.preventDefault()}
    >
      <div
        className={`w-full max-w-2xl rounded-xl shadow-2xl max-h-[90vh] overflow-hidden ${darkMode ? 'bg-dark-secondary border border-[#171717]' : 'bg-white border border-gray-200'
          }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`flex items-center justify-between p-6 border-b ${darkMode ? 'border-[#171717]' : 'border-gray-200'
          }`}>
          <h2 className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-black'
            }`}>{title}</h2>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg transition-colors ${darkMode ? 'hover:bg-[#171717] text-gray-300' : 'hover:bg-gray-100 text-gray-700'
              }`}
          >
            ✕
          </button>
        </div>
        <div className="p-6 max-h-[calc(90vh-100px)] overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
};

const CreateTaskModal = ({ isOpen, onClose, onSubmit, projectMembers, darkMode }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    status: 'todo',
    priority: 'medium',
    assignee_ids: [],
    due_date: ''
  });
  const [localError, setLocalError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Clear error when modal opens/closes
  React.useEffect(() => {
    if (!isOpen) {
      setLocalError(null);
      setIsSubmitting(false);
    }
  }, [isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError(null);
    setIsSubmitting(true);

    try {
      await onSubmit(formData);
      // Only reset form and close if submission succeeds
      setFormData({ title: '', description: '', status: 'todo', priority: 'medium', assignee_ids: [], due_date: '' });
      onClose();
    } catch (err) {
      // Display error within modal, keep form data
      setLocalError(err.message || 'Failed to create task');
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClass = `w-full rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all ${darkMode ? 'bg-dark-secondary border border-[#171717] text-gray-300' : 'bg-gray-200/30 border border-[rgb(161,188,152)] text-black'
    }`;

  const labelClass = `block text-sm font-bold mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-400'
    }`;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create New Task" darkMode={darkMode}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {localError && (
          <div className={`p-4 rounded-lg border-2 ${darkMode ? 'bg-red-500/10 border-red-500/30' : 'bg-red-50 border-red-200'
            }`}>
            <div className="flex items-start gap-3">
              <AlertCircle className="text-red-500 flex-shrink-0 mt-0.5" size={20} />
              <div className="flex-1">
                <h4 className={`font-bold text-sm mb-1 ${darkMode ? 'text-red-400' : 'text-red-600'
                  }`}>Error Creating Task</h4>
                <p className={`text-sm ${darkMode ? 'text-red-300' : 'text-red-500'
                  }`}>{localError}</p>
              </div>
            </div>
          </div>
        )}

        <div>
          <label className={labelClass}>Title *</label>
          <input
            type="text"
            required
            maxLength={255}
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            className={inputClass}
            placeholder="Enter task title"
          />
        </div>

        <div>
          <label className={labelClass}>Description</label>
          <textarea
            rows={4}
            maxLength={5000}
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className={inputClass}
            placeholder="Enter task description"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Status</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              className={inputClass}
            >
              <option value="todo">To Do</option>
              <option value="in_progress">In Progress</option>
              <option value="review">Review</option>
              <option value="done">Done</option>
            </select>
          </div>

          <div>
            <label className={labelClass}>Priority</label>
            <select
              value={formData.priority}
              onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
              className={inputClass}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Assignees</label>
            <div className={`rounded-lg px-4 py-2 text-sm max-h-32 overflow-y-auto ${inputClass}`}>
              {projectMembers.map(member => (
                <label key={member.user_id} className="flex items-center gap-2 py-1 cursor-pointer hover:opacity-80">
                  <input
                    type="checkbox"
                    checked={formData.assignee_ids.includes(member.user_id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setFormData({ ...formData, assignee_ids: [...formData.assignee_ids, member.user_id] });
                      } else {
                        setFormData({ ...formData, assignee_ids: formData.assignee_ids.filter(id => id !== member.user_id) });
                      }
                    }}
                    className="rounded border-2 border-gray-400"
                  />
                  <span>{member.username}</span>
                </label>
              ))}
              {projectMembers.length === 0 && (
                <span className="text-xs opacity-60">No members available</span>
              )}
            </div>
          </div>

          <div>
            <label className={labelClass}>Due Date *</label>
            <input
              type="date"
              value={formData.due_date}
              onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
              className={inputClass}
            />
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <button
            type="button"
            onClick={onClose}
            className={`flex-1 px-6 py-3 rounded-lg font-semibold transition-all ${darkMode ? 'bg-[#171717] text-gray-300 hover:bg-gray-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 px-6 py-3 bg-[#006239] hover:bg-[#005230] text-white rounded-lg font-semibold shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Creating...' : 'Create Task'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

const EditTaskModal = ({ isOpen, onClose, onSubmit, task, projectMembers, darkMode }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    status: 'todo',
    priority: 'medium',
    assignee_ids: [],
    due_date: ''
  });
  const [localError, setLocalError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Update form when task changes
  React.useEffect(() => {
    if (task) {
      // Extract assignee IDs from assignees array
      const assigneeIds = Array.isArray(task.assignees)
        ? task.assignees.filter(a => a.user_id).map(a => a.user_id)
        : [];

      setFormData({
        title: task.title || '',
        description: task.description || '',
        status: task.status || 'todo',
        priority: task.priority || 'medium',
        assignee_ids: assigneeIds,
        due_date: task.due_date ? task.due_date.split('T')[0] : ''
      });
    }
  }, [task]);

  // Clear error when modal opens/closes
  React.useEffect(() => {
    if (!isOpen) {
      setLocalError(null);
      setIsSubmitting(false);
    }
  }, [isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError(null);
    setIsSubmitting(true);

    try {
      await onSubmit(formData);
      // Only close if submission succeeds
      onClose();
    } catch (err) {
      // Display error within modal, keep form data
      setLocalError(err.message || 'Failed to update task');
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClass = `w-full rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all ${darkMode ? 'bg-dark-secondary border border-[#171717] text-gray-300' : 'bg-gray-200/30 border border-[rgb(161,188,152)] text-black'
    }`;

  const labelClass = `block text-sm font-bold mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-400'
    }`;

  if (!task) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Task" darkMode={darkMode}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {localError && (
          <div className={`p-4 rounded-lg border-2 ${darkMode ? 'bg-red-500/10 border-red-500/30' : 'bg-red-50 border-red-200'
            }`}>
            <div className="flex items-start gap-3">
              <AlertCircle className="text-red-500 flex-shrink-0 mt-0.5" size={20} />
              <div className="flex-1">
                <h4 className={`font-bold text-sm mb-1 ${darkMode ? 'text-red-400' : 'text-red-600'
                  }`}>Error Updating Task</h4>
                <p className={`text-sm ${darkMode ? 'text-red-300' : 'text-red-500'
                  }`}>{localError}</p>
              </div>
            </div>
          </div>
        )}

        <div>
          <label className={labelClass}>Title *</label>
          <input
            type="text"
            required
            maxLength={255}
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass}>Description</label>
          <textarea
            rows={4}
            maxLength={5000}
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className={inputClass}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Status</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              className={inputClass}
            >
              <option value="todo">To Do</option>
              <option value="in_progress">In Progress</option>
              <option value="review">Review</option>
              <option value="done">Done</option>
            </select>
          </div>

          <div>
            <label className={labelClass}>Priority</label>
            <select
              value={formData.priority}
              onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
              className={inputClass}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Assignees</label>
            <div className={`rounded-lg px-4 py-2 text-sm max-h-32 overflow-y-auto ${inputClass}`}>
              {projectMembers.map(member => (
                <label key={member.user_id} className="flex items-center gap-2 py-1 cursor-pointer hover:opacity-80">
                  <input
                    type="checkbox"
                    checked={formData.assignee_ids.includes(member.user_id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setFormData({ ...formData, assignee_ids: [...formData.assignee_ids, member.user_id] });
                      } else {
                        setFormData({ ...formData, assignee_ids: formData.assignee_ids.filter(id => id !== member.user_id) });
                      }
                    }}
                    className="rounded border-2 border-gray-400"
                  />
                  <span>{member.username}</span>
                </label>
              ))}
              {projectMembers.length === 0 && (
                <span className="text-xs opacity-60">No members available</span>
              )}
            </div>
          </div>

          <div>
            <label className={labelClass}>Due Date</label>
            <input
              type="date"
              value={formData.due_date}
              onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
              className={inputClass}
            />
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <button
            type="button"
            onClick={onClose}
            className={`flex-1 px-6 py-3 rounded-lg font-semibold transition-all ${darkMode ? 'bg-[#171717] text-gray-300 hover:bg-gray-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 px-6 py-3 bg-[#006239] hover:bg-[#005230] text-white rounded-lg font-semibold shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

const DeleteTaskModal = ({ isOpen, onClose, onConfirm, task, darkMode }) => {
  const [localError, setLocalError] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Clear error when modal opens/closes
  React.useEffect(() => {
    if (!isOpen) {
      setLocalError(null);
      setIsDeleting(false);
    }
  }, [isOpen]);

  const handleDelete = async () => {
    setLocalError(null);
    setIsDeleting(true);

    try {
      await onConfirm();
      // Only close if deletion succeeds
      onClose();
    } catch (err) {
      // Display error within modal
      setLocalError(err.message || 'Failed to delete task');
    } finally {
      setIsDeleting(false);
    }
  };

  if (!task) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Delete Task" darkMode={darkMode}>
      <div className="space-y-4">
        {localError && (
          <div className={`p-4 rounded-lg border-2 ${darkMode ? 'bg-red-500/10 border-red-500/30' : 'bg-red-50 border-red-200'
            }`}>
            <div className="flex items-start gap-3">
              <AlertCircle className="text-red-500 flex-shrink-0 mt-0.5" size={20} />
              <div className="flex-1">
                <h4 className={`font-bold text-sm mb-1 ${darkMode ? 'text-red-400' : 'text-red-600'
                  }`}>Error Deleting Task</h4>
                <p className={`text-sm ${darkMode ? 'text-red-300' : 'text-red-500'
                  }`}>{localError}</p>
              </div>
            </div>
          </div>
        )}

        <div className={`p-4 rounded-lg border-2 ${darkMode ? 'bg-red-500/10 border-red-500/30' : 'bg-red-50 border-red-200'
          }`}>
          <div className="flex items-start gap-3">
            <AlertCircle className="text-red-500 flex-shrink-0 mt-0.5" size={20} />
            <div>
              <h3 className={`font-bold mb-1 ${darkMode ? 'text-red-400' : 'text-red-600'
                }`}>Are you sure you want to delete this task?</h3>
              <p className={`text-sm ${darkMode ? 'text-red-300' : 'text-red-500'
                }`}>This action cannot be undone.</p>
            </div>
          </div>
        </div>

        <div className={`p-4 rounded-lg ${darkMode ? 'bg-dark-secondary' : 'bg-gray-200/20'
          }`}>
          <p className={`text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-400'
            }`}>Task Details:</p>
          <h4 className={`font-bold text-lg ${darkMode ? 'text-white' : 'text-black'
            }`}>{sanitizeText(task.title)}</h4>
          {task.description && (
            <p className={`text-sm mt-2 ${darkMode ? 'text-gray-300' : 'text-gray-400'
              }`}>{sanitizeText(task.description).substring(0, 100)}...</p>
          )}
        </div>

        <div className="flex gap-3 pt-4">
          <button
            onClick={onClose}
            className={`flex-1 px-6 py-3 rounded-lg font-semibold transition-all ${darkMode ? 'bg-[#171717] text-gray-300 hover:bg-gray-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="flex-1 px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-lg font-semibold shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isDeleting ? 'Deleting...' : 'Delete Task'}
          </button>
        </div>
      </div>
    </Modal>
  );
};

/**
 * MAIN PROJECT PAGE COMPONENT
 */
export default function ProjectPage() {
  const { isDarkMode } = useOutletContext();
  const { teamId, projectId } = useParams();
  const navigate = useNavigate();

  const [tasks, setTasks] = useState([]);
  const [projectData, setProjectData] = useState(null);
  const [projectMembers, setProjectMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [assigneeFilter, setAssigneeFilter] = useState('all');
  const [sortBy, setSortBy] = useState('due_date');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);

  // AI Risk Analysis state
  const [riskReport, setRiskReport] = useState(null);
  const [riskLoading, setRiskLoading] = useState(false);
  const [showRiskCard, setShowRiskCard] = useState(true);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const TASKS_PER_PAGE = 6;

  // Pinned tasks state (stored in localStorage)
  const [pinnedTasks, setPinnedTasks] = useState(() => {
    try {
      const saved = localStorage.getItem(`project_${projectId}_pinned_tasks`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Persist pinned tasks to localStorage
  useEffect(() => {
    if (projectId) {
      localStorage.setItem(`project_${projectId}_pinned_tasks`, JSON.stringify(pinnedTasks));
    }
  }, [pinnedTasks, projectId]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, priorityFilter, assigneeFilter]);

  // Toggle pin task handler
  const togglePinTask = (taskId) => {
    setPinnedTasks(prev => {
      if (prev.includes(taskId)) {
        return prev.filter(id => id !== taskId);
      } else {
        return [...prev, taskId];
      }
    });
  };

  const userRole = projectData?.user_role || 'viewer'; // Get role from API response

  // Fetch project data on component mount
  useEffect(() => {
    async function fetchProjectData() {
      try {
        setLoading(true);
        setError(null);

        // Fetch all data in parallel
        const [projectRes, tasksRes, membersRes] = await Promise.all([
          projectApi.getProject(projectId),
          projectApi.getProjectTasks(projectId),
          projectApi.getProjectMembers(projectId),
        ]);

        if (projectRes.success) {
          setProjectData(projectRes.data);
        }

        if (tasksRes.success) {
          setTasks(tasksRes.data);
        }

        if (membersRes.success) {
          setProjectMembers(membersRes.data);
        }

        // Fetch latest risk report (non-blocking)
        fetchRiskReport();

        setLoading(false);
      } catch (err) {
        console.error('Failed to fetch project data:', err);
        setError(err.message || 'Failed to load project data');
        setLoading(false);
      }
    }

    fetchProjectData();
  }, [projectId]);

  // Real-time: Subscribe to project room for task updates
  useEffect(() => {
    const socket = getSocket();
    if (!socket?.connected || !projectId) return;

    // Join project room
    joinProject(projectId).catch(err => {
      console.warn('Failed to join project room:', err.message);
    });

    // Subscribe to task events
    const unsubCreated = onTaskCreated((newTask) => {
      console.log('Task created:', newTask.title);
      setTasks(prev => [newTask, ...prev]);
      toast.success(`New task created: ${newTask.title}`);
    });

    const unsubUpdated = onTaskUpdated((updatedTask) => {
      console.log('Task updated:', updatedTask.title);
      setTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t));
    });

    const unsubDeleted = onTaskDeleted(({ taskId }) => {
      console.log('Task deleted:', taskId);
      setTasks(prev => prev.filter(t => t.id !== taskId));
      toast.success('A task was deleted');
    });

    // Cleanup on unmount
    return () => {
      leaveProject(projectId);
      unsubCreated();
      unsubUpdated();
      unsubDeleted();
    };
  }, [projectId]);

  // Fetch AI risk report
  const fetchRiskReport = async () => {
    try {
      setRiskLoading(true);
      const response = await riskReportApi.getLatestRiskReport(projectId);
      if (response.success) {
        setRiskReport(response.data);
      }
    } catch (err) {
      console.error('Failed to fetch risk report:', err);
      // Don't show error - risk analysis is optional
    } finally {
      setRiskLoading(false);
    }
  };

  // Force new AI analysis
  const handleRefreshRisk = async () => {
    try {
      setRiskLoading(true);
      const response = await riskReportApi.analyzeProjectRisk(projectId);
      if (response.success) {
        setRiskReport(response.data);
      }
    } catch (err) {
      console.error('Failed to analyze risk:', err);
    } finally {
      setRiskLoading(false);
    }
  };

  // Helper function to refetch tasks after mutations
  const refetchTasks = async () => {
    try {
      const tasksRes = await projectApi.getProjectTasks(projectId);
      if (tasksRes.success) {
        setTasks(tasksRes.data);
      }
    } catch (err) {
      console.error('Failed to refetch tasks:', err);
    }
  };

  // Theme classes (only page-specific)
  const cardBg = isDarkMode ? 'bg-dark-secondary/50 border-[#171717]/50' : 'bg-white border-gray-200 shadow-sm';
  const inputBg = isDarkMode ? 'bg-dark-secondary border-[#171717] text-gray-300 placeholder:text-gray-400' : 'bg-gray-200/30 border-[rgb(161,188,152)] text-black placeholder:text-gray-400';

  // Filter and sort tasks
  const filteredTasks = tasks.filter(task => {
    if (searchQuery && !sanitizeText(task.title.toLowerCase()).includes(sanitizeText(searchQuery.toLowerCase())) &&
      !sanitizeText(task.description?.toLowerCase() || '').includes(sanitizeText(searchQuery.toLowerCase()))) {
      return false;
    }
    if (statusFilter !== 'all' && task.status !== statusFilter) return false;
    if (priorityFilter !== 'all' && task.priority !== priorityFilter) return false;
    if (assigneeFilter !== 'all') {
      if (assigneeFilter === 'unassigned' && task.assignees && task.assignees.length > 0) return false;
      if (assigneeFilter !== 'unassigned' && (!task.assignees || !task.assignees.some(a => a.user_id === parseInt(assigneeFilter)))) return false;
    }
    return true;
  }).sort((a, b) => {
    // PRIORITY: Pinned tasks always come first
    const aIsPinned = pinnedTasks.includes(a.id);
    const bIsPinned = pinnedTasks.includes(b.id);

    if (aIsPinned && !bIsPinned) return -1;
    if (!aIsPinned && bIsPinned) return 1;

    // Within same pin status, apply regular sorting
    switch (sortBy) {
      case 'due_date':
        return new Date(a.due_date || '9999-12-31') - new Date(b.due_date || '9999-12-31');
      case 'priority':
        const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      case 'status':
        const statusOrder = { todo: 0, in_progress: 1, review: 2, done: 3 };
        return statusOrder[a.status] - statusOrder[b.status];
      case 'created_at':
        return new Date(b.created_at) - new Date(a.created_at);
      default:
        return 0;
    }
  });

  // Pagination calculations
  const totalPages = Math.ceil(filteredTasks.length / TASKS_PER_PAGE);
  const paginatedTasks = filteredTasks.slice(
    (currentPage - 1) * TASKS_PER_PAGE,
    currentPage * TASKS_PER_PAGE
  );

  const stats = {
    total: tasks.length,
    todo: tasks.filter(t => t.status === 'todo').length,
    in_progress: tasks.filter(t => t.status === 'in_progress').length,
    review: tasks.filter(t => t.status === 'review').length,
    done: tasks.filter(t => t.status === 'done').length,
    overdue: tasks.filter(t => getDaysUntilDue(t.due_date) !== null && getDaysUntilDue(t.due_date) < 0 && t.status !== 'done').length,
  };

  // Quick status change handler for hover actions
  const handleQuickStatusChange = async (taskId, newStatus) => {
    try {
      const response = await projectApi.updateTask(projectId, taskId, { status: newStatus });
      if (response.success) {
        // Update local state immediately for better UX
        setTasks(prev => prev.map(t =>
          t.id === taskId ? { ...t, status: newStatus } : t
        ));
        toast.success(`Task moved to ${newStatus.replace('_', ' ')}`);
      } else {
        toast.error(response.message || 'Failed to update status');
      }
    } catch (err) {
      console.error('Quick status change error:', err);
      toast.error('Failed to update task status');
    }
  };

  const handleEditTask = (task) => {
    setSelectedTask(task);
    setShowEditModal(true);
  };

  const handleEditSubmit = async (formData) => {
    const updates = { ...formData };
    if (updates.due_date) updates.due_date = new Date(updates.due_date).toISOString();

    const response = await projectApi.updateTask(projectId, selectedTask.id, updates);

    if (response.success) {
      // Refetch tasks to get updated assignees array
      await refetchTasks();
      setSelectedTask(null);
      console.log('Task updated:', response.message);
    } else {
      throw new Error(response.message || 'Failed to update task');
    }
  };

  const handleDeleteTask = (task) => {
    setSelectedTask(task);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    const response = await projectApi.deleteTask(projectId, selectedTask.id);

    if (response.success) {
      setTasks(tasks.filter(t => t.id !== selectedTask.id));
      setSelectedTask(null);
      console.log('Task deleted:', response.message);
    } else {
      throw new Error(response.message || 'Failed to delete task');
    }
  };

  const handleCreateTask = () => {
    setShowCreateModal(true);
  };

  const handleCreateSubmit = async (formData) => {
    const taskData = { ...formData };
    // assignee_ids is already an array of integers from the checkbox handler
    if (taskData.due_date) taskData.due_date = new Date(taskData.due_date).toISOString();

    const response = await projectApi.createTask(projectId, taskData);

    if (response.success) {
      // Refetch tasks to get new task with populated assignees array
      await refetchTasks();
      console.log('Task created:', response.message);
    } else {
      throw new Error(response.message || 'Failed to create task');
    }
  };

  return (
    <>
      <div className="p-6 md:p-8">
        <div className="max-w-7xl mx-auto">

          {/* Back Button */}
          <button
            onClick={() => navigate(`/teams/${teamId}`)}
            className={`flex items-center gap-2 mb-6 ${isDarkMode ? 'text-gray-300 hover:text-gray-300' : 'text-gray-400 hover:text-black'} transition-colors`}
          >
            <ArrowLeft size={20} />
            <span className="font-medium">Back to Teams</span>
          </button>

          {/* Loading State */}
          {loading && (
            <div className={`${cardBg} border rounded-xl p-12 text-center`}>
              <div className="animate-spin w-12 h-12 border-4 border-gray-400 border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className={`text-lg ${isDarkMode ? 'text-gray-300' : 'text-gray-400'}`}>Loading project data...</p>
            </div>
          )}

          {/* Error State */}
          {error && !loading && (
            <div className={`border border-red-500 bg-red-500/10 rounded-xl p-6 text-center`}>
              <AlertCircle size={48} className="text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-red-500 mb-2">Failed to Load Project</h3>
              <p className="text-red-400">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="mt-4 bg-red-500 hover:bg-red-600 text-white px-6 py-2 rounded-lg font-semibold transition-colors"
              >
                Retry
              </button>
            </div>
          )}

          {/* Project Content (Only show when loaded successfully) */}
          {!loading && !error && projectData && (
            <>
              {/* Project Header */}
              <div className={`${cardBg} border rounded-xl p-6 mb-8`}>
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-4">
                  <div className="flex-1">
                    <h1 className={`text-3xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-black'}`}>
                      {sanitizeText(projectData.name)}
                    </h1>
                    <p className={`${isDarkMode ? 'text-gray-300' : 'text-gray-400'} mb-4`}>
                      {sanitizeText(projectData.description)}
                    </p>
                    <div className="flex flex-wrap items-center gap-3">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full uppercase tracking-wider ${projectData.status === 'active' ? 'text-green-500 bg-green-500/10' : projectData.status === 'completed' ? 'text-blue-500 bg-blue-500/10' : 'text-slate-500 bg-slate-500/10'}`}>
                        <CheckCircle2 size={12} />
                        {projectData.status}
                      </span>
                      <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full ${isDarkMode ? 'bg-[#171717] text-gray-300' : 'bg-gray-200 text-gray-400'}`}>
                        <Calendar size={12} />
                        {formatDate(projectData.start_date)} - {formatDate(projectData.end_date)}
                      </span>
                      <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full ${userRole === 'lead' ? 'bg-purple-500/10 text-purple-500' :
                        userRole === 'editor' ? 'bg-blue-500/10 text-blue-500' :
                          'bg-slate-500/10 text-slate-500'
                        }`}>
                        <User size={12} />
                        Your Role: {userRole}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-3">
                    <div className="flex -space-x-2">
                      {projectMembers.map((member) => (
                        <div key={member.id} className="relative group">
                          {member.avatar_url ? (
                            <img
                              src={member.avatar_url}
                              alt={member.username}
                              className={`h-10 w-10 rounded-full object-cover border-2 transition-all cursor-pointer group-hover:scale-110 group-hover:z-10 ${isDarkMode ? 'border-[rgb(30,36,30)]' : 'border-white'}`}
                              onError={(e) => {
                                e.target.style.display = 'none';
                                e.target.nextElementSibling.style.display = 'flex';
                              }}
                            />
                          ) : null}
                          <div
                            className={`h-10 w-10 rounded-full border-2 flex items-center justify-center text-sm font-medium transition-all cursor-pointer group-hover:scale-110 group-hover:z-10 ${isDarkMode ? 'border-[rgb(30,36,30)] bg-[#006239] text-white' : 'border-white bg-gray-200 text-black'}`}
                            style={{ display: member.avatar_url ? 'none' : 'flex' }}
                          >
                            {member.username.charAt(0).toUpperCase()}
                          </div>
                          <div className={`absolute bottom-full mb-2 left-1/2 -translate-x-1/2 px-2 py-1 rounded text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none ${isDarkMode ? 'bg-[#171717] text-white' : 'bg-[rgb(60,68,58)] text-white'}`}>
                            {member.username} ({member.role})
                          </div>
                        </div>
                      ))}
                    </div>
                    <span className={`text-xs ${isDarkMode ? 'text-gray-300' : 'text-gray-400'}`}>
                      {projectMembers.length} team members
                    </span>
                  </div>
                </div>

                <div className={`pt-4 border-t ${isDarkMode ? 'border-[#171717]/50' : 'border-gray-200'}`}>
                  <span className={`inline-flex items-center gap-2 text-xs font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-400'}`}>
                    <User size={14} />
                    Your role: <span className={`font-bold uppercase ${isDarkMode ? 'text-gray-300' : 'text-black'}`}>{userRole}</span>
                    {canEditTasks(userRole) && <span className="text-green-500">(Can edit tasks)</span>}
                  </span>
                </div>
              </div>

              {/* Statistics */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
                {[
                  { label: 'Total', value: stats.total, icon: FolderKanban, color: 'bg-blue-500/10 text-blue-500' },
                  { label: 'To Do', value: stats.todo, icon: Circle, color: 'bg-slate-500/10 text-slate-500' },
                  { label: 'In Progress', value: stats.in_progress, icon: PlayCircle, color: 'bg-blue-500/10 text-blue-500' },
                  { label: 'Review', value: stats.review, icon: Eye, color: 'bg-purple-500/10 text-purple-500' },
                  { label: 'Done', value: stats.done, icon: CheckCircle2, color: 'bg-green-500/10 text-green-500' },
                  { label: 'Overdue', value: stats.overdue, icon: AlertCircle, color: 'bg-red-500/10 text-red-500' },
                ].map((stat, i) => (
                  <div key={i} className={`${cardBg} border p-4 rounded-xl transition-all hover:scale-105 cursor-pointer`}>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-3 ${stat.color}`}>
                      <stat.icon size={16} />
                    </div>
                    <h3 className={`text-2xl font-bold mb-1 ${isDarkMode ? 'text-white' : 'text-black'}`}>{stat.value}</h3>
                    <p className={`text-xs font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-400'}`}>{stat.label}</p>
                  </div>
                ))}
              </div>

              {/* AI Risk Analysis Card */}
              {showRiskCard && (
                <div className="mb-8">
                  <RiskReportCard
                    report={riskReport}
                    loading={riskLoading}
                    onRefresh={handleRefreshRisk}
                    onClose={() => setShowRiskCard(false)}
                    darkMode={isDarkMode}
                  />
                </div>
              )}

              {/* Smart Filter Bar - Single Row */}
              <div className={`${cardBg} border rounded-xl p-4 mb-6`}>
                <div className="flex items-center justify-between gap-3 flex-wrap">

                  {/* Left Group: Search + Filter Dropdowns */}
                  <div className="flex items-center gap-3 flex-1 min-w-[300px]">
                    {/* Compact Search */}
                    <div className="relative w-[350px]">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                      <input
                        type="text"
                        placeholder="Search tasks..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className={`w-full rounded-lg py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all ${inputBg}`}
                      />
                    </div>

                    {/* Status Dropdown */}
                    <div className="relative">
                      <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className={`appearance-none rounded-lg pl-3 pr-8 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all ${statusFilter !== 'all'
                          ? isDarkMode
                            ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                            : 'bg-blue-50 text-blue-600 border border-blue-200'
                          : isDarkMode
                            ? 'bg-[#171717] text-gray-300 border border-[#171717] hover:bg-gray-700'
                            : 'bg-gray-200/50 text-gray-600 border border-gray-200 hover:bg-gray-200'
                          }`}
                      >
                        <option value="all">Status: All</option>
                        <option value="todo">Status: To Do</option>
                        <option value="in_progress">Status: In Progress</option>
                        <option value="review">Status: Review</option>
                        <option value="done">Status: Done</option>
                      </select>
                      <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400" />
                    </div>

                    {/* Priority Dropdown */}
                    <div className="relative">
                      <select
                        value={priorityFilter}
                        onChange={(e) => setPriorityFilter(e.target.value)}
                        className={`appearance-none rounded-lg pl-3 pr-8 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all ${priorityFilter !== 'all'
                          ? priorityFilter === 'urgent'
                            ? isDarkMode
                              ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                              : 'bg-red-50 text-red-600 border border-red-200'
                            : priorityFilter === 'high'
                              ? isDarkMode
                                ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                                : 'bg-orange-50 text-orange-600 border border-orange-200'
                              : isDarkMode
                                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                : 'bg-amber-50 text-amber-600 border border-amber-200'
                          : isDarkMode
                            ? 'bg-[#171717] text-gray-300 border border-[#171717] hover:bg-gray-700'
                            : 'bg-gray-200/50 text-gray-600 border border-gray-200 hover:bg-gray-200'
                          }`}
                      >
                        <option value="all">Priority: All</option>
                        <option value="urgent">Priority: Urgent</option>
                        <option value="high">Priority: High</option>
                        <option value="medium">Priority: Medium</option>
                        <option value="low">Priority: Low</option>
                      </select>
                      <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400" />
                    </div>

                    {/* Assignee Dropdown */}
                    <div className="relative">
                      <select
                        value={assigneeFilter}
                        onChange={(e) => setAssigneeFilter(e.target.value)}
                        className={`appearance-none rounded-lg pl-3 pr-8 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all ${assigneeFilter !== 'all'
                          ? isDarkMode
                            ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                            : 'bg-purple-50 text-purple-600 border border-purple-200'
                          : isDarkMode
                            ? 'bg-[#171717] text-gray-300 border border-[#171717] hover:bg-gray-700'
                            : 'bg-gray-200/50 text-gray-600 border border-gray-200 hover:bg-gray-200'
                          }`}
                      >
                        <option value="all">Assignee: All</option>
                        {projectMembers.map(member => (
                          <option key={member.user_id} value={member.user_id}>{member.username}</option>
                        ))}
                        <option value="unassigned">Unassigned</option>
                      </select>
                      <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400" />
                    </div>
                  </div>

                  {/* Right Group: Sort + Create Button */}
                  <div className="flex items-center gap-3">
                    {/* Sort Dropdown */}
                    <div className="relative">
                      <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                        className={`appearance-none rounded-lg pl-3 pr-8 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all ${isDarkMode
                          ? 'bg-[#171717] text-gray-300 border border-[#171717] hover:bg-gray-700'
                          : 'bg-gray-200/50 text-gray-600 border border-gray-200 hover:bg-gray-200'
                          }`}
                      >
                        <option value="due_date">Sort: Due Date</option>
                        <option value="priority">Sort: Priority</option>
                        <option value="status">Sort: Status</option>
                        <option value="created_at">Sort: Newest</option>
                      </select>
                      <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400" />
                    </div>

                    {/* Create Task Button - Conditionally Rendered */}
                    {canEditTasks(userRole) && (
                      <button
                        onClick={handleCreateTask}
                        className="flex items-center gap-2 bg-[#006239] hover:bg-[#005230] text-white px-4 py-2 rounded-lg font-semibold shadow-lg shadow-green-500/20 transition-all active:scale-95 whitespace-nowrap"
                      >
                        <Plus size={16} />
                        Create Task
                      </button>
                    )}
                  </div>

                </div>
              </div>

              {/* Tasks List */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className={`text-xl font-bold ${isDarkMode ? 'text-white' : 'text-black'}`}>
                    Tasks ({filteredTasks.length})
                  </h2>
                  {filteredTasks.length !== tasks.length && (
                    <button
                      onClick={() => {
                        setSearchQuery('');
                        setStatusFilter('all');
                        setPriorityFilter('all');
                        setAssigneeFilter('all');
                      }}
                      className={`text-sm font-medium ${isDarkMode ? 'text-gray-400 hover:text-gray-300' : 'text-gray-400 hover:text-black'}`}
                    >
                      Clear Filters
                    </button>
                  )}
                </div>

                {filteredTasks.length === 0 ? (
                  <div className={`${cardBg} border rounded-xl p-12 text-center`}>
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${isDarkMode ? 'bg-[#171717]' : 'bg-gray-200'}`}>
                      <Search size={32} className={isDarkMode ? 'text-gray-300' : 'text-gray-400'} />
                    </div>
                    <h3 className={`text-lg font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-black'}`}>No tasks found</h3>
                    <p className={`${isDarkMode ? 'text-gray-300' : 'text-gray-400'}`}>Try adjusting your filters or search query</p>
                  </div>
                ) : (
                  <>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {paginatedTasks.map(task => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          darkMode={isDarkMode}
                          userRole={userRole}
                          onEdit={handleEditTask}
                          onDelete={handleDeleteTask}
                          isPinned={pinnedTasks.includes(task.id)}
                          onTogglePin={togglePinTask}
                          onStatusChange={handleQuickStatusChange}
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
            </>
          )}
        </div>
      </div>

      {/* Modals */}
      <CreateTaskModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreateSubmit}
        projectMembers={projectMembers}
        darkMode={isDarkMode}
      />

      <EditTaskModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setSelectedTask(null);
        }}
        onSubmit={handleEditSubmit}
        task={selectedTask}
        projectMembers={projectMembers}
        darkMode={isDarkMode}
      />

      <DeleteTaskModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setSelectedTask(null);
        }}
        onConfirm={handleDeleteConfirm}
        task={selectedTask}
        darkMode={isDarkMode}
      />
    </>
  );
}




