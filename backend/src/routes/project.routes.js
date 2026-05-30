import express from 'express';
import { z } from 'zod';
import * as projectController from '../controllers/project.controller.js';
import { validate } from '../middlewares/validate.js';
import { verifyToken } from '../middlewares/auth.js';
import {
  projectIdSchema,
  teamIdParamSchema,
  createProjectSchema,
  updateProjectSchema,
  createTaskSchema,
  updateTaskSchema,
  projectTaskParamsSchema,
  addProjectMemberSchema,
  updateProjectMemberRoleSchema,
  userIdParamSchema,
} from '../validations/project.validation.js';

const router = express.Router();

/**
 * Project Routes
 * Base: /api/v1/projects
 * Security: JWT authentication required via verifyToken middleware
 */

// Apply JWT authentication to all project routes
router.use(verifyToken);

/**
 * @route   GET /api/v1/projects/:projectId
 * @desc    Get project details
 * @access  Private (Project Members)
 */
router.get(
  '/:projectId',
  validate({ params: projectIdSchema }),
  projectController.getProject
);

/**
 * @route   GET /api/v1/projects/:projectId/members
 * @desc    Get all project members
 * @access  Private (Project Members)
 */
router.get(
  '/:projectId/members',
  validate({ params: projectIdSchema }),
  projectController.getProjectMembers
);

/**
 * @route   GET /api/v1/projects/:projectId/tasks
 * @desc    Get all tasks in a project
 * @access  Private (Project Members)
 */
router.get(
  '/:projectId/tasks',
  validate({ params: projectIdSchema }),
  projectController.getProjectTasks
);

/**
 * @route   GET /api/v1/projects/:projectId/stats
 * @desc    Get project statistics (task counts)
 * @access  Private (Project Members)
 */
router.get(
  '/:projectId/stats',
  validate({ params: projectIdSchema }),
  projectController.getProjectStats
);

/**
 * @route   POST /api/v1/projects/:projectId/tasks
 * @desc    Create a new task
 * @access  Private (Project Lead/Editor only)
 * @body    {title, description?, status?, priority?, assignee_id?, due_date?}
 */
router.post(
  '/:projectId/tasks',
  validate({ params: projectIdSchema, body: createTaskSchema }),
  projectController.createTask
);

/**
 * @route   PUT /api/v1/projects/:projectId/tasks/:taskId
 * @desc    Update an existing task
 * @access  Private (Project Lead/Editor only)
 * @body    {title?, description?, status?, priority?, assignee_id?, due_date?}
 */
router.put(
  '/:projectId/tasks/:taskId',
  validate({ params: projectTaskParamsSchema, body: updateTaskSchema }),
  projectController.updateTask
);

/**
 * @route   DELETE /api/v1/projects/:projectId/tasks/:taskId
 * @desc    Delete a task
 * @access  Private (Project Lead/Editor only)
 */
router.delete(
  '/:projectId/tasks/:taskId',
  validate({ params: projectTaskParamsSchema }),
  projectController.deleteTask
);

/**
 * TEAM-LEVEL PROJECT CRUD ROUTES
 * Mounted on /api/v1/teams/:teamId/projects
 */

/**
 * @route   POST /api/v1/teams/:teamId/projects
 * @desc    Create a new project in a team
 * @access  Private (Team Owner/Admin only)
 * @body    {name, description?, status?, start_date?, end_date?}
 */
export const teamProjectRouter = express.Router({ mergeParams: true });
teamProjectRouter.use(verifyToken);

teamProjectRouter.post(
  '/',
  validate({ params: teamIdParamSchema, body: createProjectSchema }),
  projectController.createProject
);

/**
 * @route   PUT /api/v1/teams/:teamId/projects/:projectId
 * @desc    Update a project
 * @access  Private (Project Lead/Team Owner/Team Admin)
 * @body    {name?, description?, status?, start_date?, end_date?}
 */
teamProjectRouter.put(
  '/:projectId',
  validate({
    params: z.object({
      teamId: teamIdParamSchema.shape.teamId,
      projectId: projectIdSchema.shape.projectId,
    }),
    body: updateProjectSchema,
  }),
  projectController.updateProject
);

/**
 * @route   DELETE /api/v1/teams/:teamId/projects/:projectId
 * @desc    Delete a project
 * @access  Private (Project Lead/Team Owner/Team Admin)
 */
teamProjectRouter.delete(
  '/:projectId',
  validate({
    params: z.object({
      teamId: teamIdParamSchema.shape.teamId,
      projectId: projectIdSchema.shape.projectId,
    }),
  }),
  projectController.deleteProject
);

/**
 * PROJECT MEMBER MANAGEMENT ROUTES
 */

/**
 * @route   POST /api/v1/projects/:projectId/members
 * @desc    Add a member to a project
 * @access  Private (Project Lead/Team Owner/Team Admin)
 * @body    {userId, role?}
 */
router.post(
  '/:projectId/members',
  validate({ params: projectIdSchema, body: addProjectMemberSchema }),
  projectController.addProjectMember
);

/**
 * @route   DELETE /api/v1/projects/:projectId/members/:userId
 * @desc    Remove a member from a project
 * @access  Private (Project Lead/Team Owner/Team Admin)
 * @query   {forceRemove?} - If true, unassign tasks before removing
 */
router.delete(
  '/:projectId/members/:userId',
  validate({
    params: z.object({
      projectId: projectIdSchema.shape.projectId,
      userId: userIdParamSchema.shape.userId,
    }),
  }),
  projectController.removeProjectMember
);

/**
 * @route   PATCH /api/v1/projects/:projectId/members/:userId
 * @desc    Update a project member's role
 * @access  Private (Project Lead/Team Owner/Team Admin)
 * @body    {role}
 */
router.patch(
  '/:projectId/members/:userId',
  validate({
    params: z.object({
      projectId: projectIdSchema.shape.projectId,
      userId: userIdParamSchema.shape.userId,
    }),
    body: updateProjectMemberRoleSchema,
  }),
  projectController.updateProjectMemberRole
);


export default router;
