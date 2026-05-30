import db from '../utils/db.js';

/**
 * Get all tasks assigned to a specific user
 * @param {number} userId - The user ID
 * @returns {Promise<Array>} Array of tasks with project info
 */
export async function getMyTasks(userId) {
  const tasks = await db`
    SELECT 
      t.id,
      t.title,
      t.description,
      t.status,
      t.priority,
      t.due_date,
      t.created_at,
      t.updated_at,
      p.name as project_name,
      p.id as project_id
    FROM tasks t
    INNER JOIN task_assignees ta ON t.id = ta.task_id
    LEFT JOIN projects p ON t.project_id = p.id
    WHERE ta.user_id = ${userId}
    ORDER BY 
      CASE 
        WHEN t.due_date IS NULL THEN 1
        ELSE 0
      END,
      t.due_date ASC,
      t.created_at DESC
  `;
  
  return tasks;
}