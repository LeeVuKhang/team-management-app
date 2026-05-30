import * as ProjectModel from '../models/project.model.js';

/**
 * Project Controller
 * Handles business logic and HTTP responses for project-related operations
 * Security: Relies on model's built-in RBAC and IDOR prevention
 */

/**
 * Get project details by ID
 * @route GET /api/v1/projects/:projectId
 */
export const getProject = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const userId = req.user.id; // From auth middleware (to be implemented)

    const project = await ProjectModel.getProjectById(projectId, userId);

    if (!project) {
      return res.status(404).json({
        success: false,
        message: 'Project not found or you do not have access',
      });
    }

    res.status(200).json({
      success: true,
      data: project,
    });
  } catch (error) {
    // Security: Do not expose internal errors to client
    if (error.message.includes('not a member')) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You are not a member of this project',
      });
    }
    next(error); // Pass to centralized error handler
  }
};

/**
 * Get all members of a project
 * @route GET /api/v1/projects/:projectId/members
 */
export const getProjectMembers = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const userId = req.user.id;

    const members = await ProjectModel.getProjectMembers(projectId, userId);

    res.status(200).json({
      success: true,
      data: members,
    });
  } catch (error) {
    if (error.message.includes('not a member')) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You are not a member of this project',
      });
    }
    next(error);
  }
};

/**
 * Get all tasks for a project
 * @route GET /api/v1/projects/:projectId/tasks
 */
export const getProjectTasks = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const userId = req.user.id;

    const tasks = await ProjectModel.getProjectTasks(projectId, userId);

    res.status(200).json({
      success: true,
      data: tasks,
    });
  } catch (error) {
    if (error.message.includes('not a member')) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You are not a member of this project',
      });
    }
    next(error);
  }
};

/**
 * Get project statistics (task counts by status)
 * @route GET /api/v1/projects/:projectId/stats
 */
export const getProjectStats = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const userId = req.user.id;

    const stats = await ProjectModel.getProjectStats(projectId, userId);

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    if (error.message.includes('not a member')) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You are not a member of this project',
      });
    }
    next(error);
  }
};

/**
 * Create a new task in a project
 * @route POST /api/v1/projects/:projectId/tasks
 * @body {title, description?, status?, priority?, assignee_ids?, due_date?}
 */
export const createTask = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const userId = req.user.id;
    const taskData = req.body; // Already validated by Zod middleware

    const newTask = await ProjectModel.createTask(projectId, userId, taskData);

    // Real-time: Broadcast task-created to all project members
    const io = req.app.get('io');
    if (io) {
      io.to(`project:${projectId}`).emit('task-created', newTask);
    }

    res.status(201).json({
      success: true,
      message: 'Task created successfully',
      data: newTask,
    });
  } catch (error) {
    // Handle specific business logic errors with appropriate HTTP codes
    if (error.message.includes('not a member')) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You are not a member of this project',
      });
    }

    if (error.message.includes('Only lead or editor')) {
      return res.status(403).json({
        success: false,
        message: 'Permission denied: Only project leads and editors can create tasks',
      });
    }

    if (error.message.includes('All assignees must be project members')) {
      return res.status(400).json({
        success: false,
        message: 'Invalid assignees: All users must be project members',
      });
    }

    next(error);
  }
};

/**
 * Update an existing task
 * @route PUT /api/v1/projects/:projectId/tasks/:taskId
 * @body {title?, description?, status?, priority?, assignee_ids?, due_date?}
 */
export const updateTask = async (req, res, next) => {
  try {
    const { projectId, taskId } = req.params;
    const userId = req.user.id;
    const updates = req.body; // Already validated by Zod middleware

    const updatedTask = await ProjectModel.updateTask(taskId, projectId, userId, updates);

    if (!updatedTask) {
      return res.status(404).json({
        success: false,
        message: 'Task not found or does not belong to this project',
      });
    }

    // Real-time: Broadcast task-updated to all project members
    const io = req.app.get('io');
    if (io) {
      io.to(`project:${projectId}`).emit('task-updated', updatedTask);
    }

    res.status(200).json({
      success: true,
      message: 'Task updated successfully',
      data: updatedTask,
    });
  } catch (error) {
    if (error.message.includes('not a member')) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You are not a member of this project',
      });
    }

    if (error.message.includes('Only lead or editor')) {
      return res.status(403).json({
        success: false,
        message: 'Permission denied: Only project leads and editors can update tasks',
      });
    }

    if (error.message.includes('does not belong to this project')) {
      return res.status(403).json({
        success: false,
        message: 'IDOR Attack Prevented: Task does not belong to this project',
      });
    }

    if (error.message.includes('All assignees must be project members')) {
      return res.status(400).json({
        success: false,
        message: 'Invalid assignees: All users must be project members',
      });
    }

    next(error);
  }
};

/**
 * Delete a task
 * @route DELETE /api/v1/projects/:projectId/tasks/:taskId
 */
export const deleteTask = async (req, res, next) => {
  try {
    const { projectId, taskId } = req.params;
    const userId = req.user.id;

    const success = await ProjectModel.deleteTask(taskId, projectId, userId);

    if (!success) {
      return res.status(404).json({
        success: false,
        message: 'Task not found or does not belong to this project',
      });
    }

    // Real-time: Broadcast task-deleted to all project members
    const io = req.app.get('io');
    if (io) {
      io.to(`project:${projectId}`).emit('task-deleted', { taskId: parseInt(taskId) });
    }

    res.status(200).json({
      success: true,
      message: 'Task deleted successfully',
    });
  } catch (error) {
    if (error.message.includes('not a member')) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You are not a member of this project',
      });
    }

    if (error.message.includes('Only lead and editor')) {
      return res.status(403).json({
        success: false,
        message: 'Permission denied: Only project leads and editors can delete tasks',
      });
    }

    if (error.message.includes('does not belong to this project')) {
      return res.status(403).json({
        success: false,
        message: 'IDOR Attack Prevented: Task does not belong to this project',
      });
    }

    next(error);
  }
};

/**
 * Create a new project
 * @route POST /api/v1/teams/:teamId/projects
 */
export const createProject = async (req, res, next) => {
  try {
    const { teamId } = req.params;
    const userId = req.user.id;
    const projectData = req.body;

    const newProject = await ProjectModel.createProject(teamId, userId, projectData);

    // Real-time: Broadcast project-created to all team members
    const io = req.app.get('io');
    if (io) {
      io.to(`team:${teamId}`).emit('project-created', newProject);
    }

    res.status(201).json({
      success: true,
      message: 'Project created successfully',
      data: newProject,
    });
  } catch (error) {
    if (error.message.includes('not a member of this team')) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You are not a member of this team',
      });
    }

    if (error.message.includes('Only team owner or admin')) {
      return res.status(403).json({
        success: false,
        message: 'Permission denied: Only team owner or admin can create projects',
      });
    }

    next(error);
  }
};

/**
 * Update a project
 * @route PUT /api/v1/teams/:teamId/projects/:projectId
 */
export const updateProject = async (req, res, next) => {
  try {
    const { teamId, projectId } = req.params;
    const userId = req.user.id;
    const updates = req.body;

    const updatedProject = await ProjectModel.updateProject(projectId, teamId, userId, updates);

    // Real-time: Broadcast project-updated to all team members
    const io = req.app.get('io');
    if (io) {
      io.to(`team:${teamId}`).emit('project-updated', updatedProject);
    }

    res.status(200).json({
      success: true,
      message: 'Project updated successfully',
      data: updatedProject,
    });
  } catch (error) {
    if (error.message.includes('not a member of this project or team')) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You are not a member of this project or team',
      });
    }

    if (error.message.includes('Only project lead, team owner, or team admin')) {
      return res.status(403).json({
        success: false,
        message: 'Permission denied: Only project lead, team owner, or team admin can update projects',
      });
    }

    if (error.message.includes('Project not found')) {
      return res.status(404).json({
        success: false,
        message: 'Project not found in this team',
      });
    }

    next(error);
  }
};

/**
 * Delete a project
 * @route DELETE /api/v1/teams/:teamId/projects/:projectId
 */
export const deleteProject = async (req, res, next) => {
  try {
    const { teamId, projectId } = req.params;
    const userId = req.user.id;

    await ProjectModel.deleteProject(projectId, teamId, userId);

    // Real-time: Broadcast project-deleted to all team members
    const io = req.app.get('io');
    if (io) {
      io.to(`team:${teamId}`).emit('project-deleted', { projectId: parseInt(projectId) });
    }

    res.status(200).json({
      success: true,
      message: 'Project deleted successfully. All related tasks and members were also removed.',
    });
  } catch (error) {
    if (error.message.includes('not a member of this project or team')) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You are not a member of this project or team',
      });
    }

    if (error.message.includes('Only project lead, team owner, or team admin')) {
      return res.status(403).json({
        success: false,
        message: 'Permission denied: Only project lead, team owner, or team admin can delete projects',
      });
    }

    if (error.message.includes('Project not found')) {
      return res.status(404).json({
        success: false,
        message: 'Project not found in this team',
      });
    }

    next(error);
  }
};

/**
 * Add a member to a project
 * @route POST /api/v1/projects/:projectId/members
 */
export const addProjectMember = async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const requesterId = req.user.id;
    const { userId, role } = req.body;

    const newMember = await ProjectModel.addProjectMember(projectId, requesterId, userId, role);

    res.status(201).json({
      success: true,
      message: 'Member added to project successfully',
      data: newMember,
    });
  } catch (error) {
    if (error.message.includes('Access denied')) {
      return res.status(403).json({
        success: false,
        message: error.message,
      });
    }

    if (error.message.includes('must be a team member')) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    if (error.message.includes('already a member')) {
      return res.status(409).json({
        success: false,
        message: error.message,
      });
    }

    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    next(error);
  }
};

/**
 * Remove a member from a project
 * @route DELETE /api/v1/projects/:projectId/members/:userId
 */
export const removeProjectMember = async (req, res, next) => {
  try {
    const { projectId, userId } = req.params;
    const requesterId = req.user.id;
    const { forceRemove } = req.query;

    const result = await ProjectModel.removeProjectMember(
      projectId,
      requesterId,
      parseInt(userId),
      forceRemove === 'true'
    );

    // If member has tasks and forceRemove is not set
    if (!result.canRemove) {
      return res.status(409).json({
        success: false,
        message: result.message,
        data: {
          assignedTaskCount: result.assignedTaskCount,
          assignedTasks: result.assignedTasks,
        },
      });
    }

    res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    if (error.message.includes('Access denied')) {
      return res.status(403).json({
        success: false,
        message: error.message,
      });
    }

    if (error.message.includes('only project lead')) {
      return res.status(403).json({
        success: false,
        message: error.message,
      });
    }

    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    next(error);
  }
};

/**
 * Update project member role
 * @route PATCH /api/v1/projects/:projectId/members/:userId
 */
export const updateProjectMemberRole = async (req, res, next) => {
  try {
    const { projectId, userId } = req.params;
    const requesterId = req.user.id;
    const { role } = req.body;

    const updatedMember = await ProjectModel.updateProjectMemberRole(
      projectId,
      requesterId,
      parseInt(userId),
      role
    );

    res.status(200).json({
      success: true,
      message: 'Member role updated successfully',
      data: updatedMember,
    });
  } catch (error) {
    if (error.message.includes('Access denied')) {
      return res.status(403).json({
        success: false,
        message: error.message,
      });
    }

    if (error.message.includes('only project lead')) {
      return res.status(403).json({
        success: false,
        message: error.message,
      });
    }

    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    next(error);
  }
};
