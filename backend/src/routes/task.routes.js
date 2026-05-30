import express from 'express';
import * as taskController from '../controllers/task.controller.js';
import { verifyToken } from '../middlewares/auth.js';

const router = express.Router();

/**
 * @route   GET /api/tasks/my-tasks
 * @desc    Get all tasks assigned to the authenticated user
 * @access  Private
 */
router.get('/my-tasks', verifyToken, taskController.getMyTasks);

export default router;
