import * as taskModel from '../models/task.model.js';

/**
 * Get all tasks assigned to the authenticated user
 * @route GET /api/tasks/my-tasks
 * @access Private
 */
export async function getMyTasks(req, res, next) {
  try {
    // Get user ID from authenticated request
    const userId = req.user.id;
    
    // Fetch tasks from model
    const tasks = await taskModel.getMyTasks(userId);
    
    // Return success response
    res.json({
      success: true,
      data: tasks,
    });
  } catch (error) {
    console.error('Error fetching my tasks:', error);
    next(error);
  }
}
