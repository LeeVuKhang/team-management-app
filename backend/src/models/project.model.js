import db from '../utils/db.js';

/**
 * Project Model
 * Security: All queries validate user permissions (RBAC)
 * Never expose sensitive data like password_hash
 */

/**
 * Get project by ID with member validation
 * Security: Ensures user has access to this project
 */
export async function getProjectById(projectId, userId) {
    try {
      const [project] = await db`
        SELECT 
          p.id,
          p.team_id,
          p.name,
          p.description,
          p.status,
          p.start_date,
          p.end_date,
          p.created_at,
          pm.role as user_role
        FROM projects p
        INNER JOIN project_members pm ON p.id = pm.project_id
        WHERE p.id = ${projectId}
          AND pm.user_id = ${userId}
      `;

      return project || null;
    } catch (error) {
      console.error('Error fetching project:', error);
      throw error;
    }
}

/**
 * Get all project members
 * Security: Only returns if requester is a project member
 */
export async function getProjectMembers(projectId, userId) {
    try {
      // First verify user has access to this project
      const hasAccess = await db`
        SELECT 1 FROM project_members
        WHERE project_id = ${projectId} AND user_id = ${userId}
      `;

      if (hasAccess.length === 0) {
        throw new Error('Access denied: User not a member of this project');
      }

      const members = await db`
        SELECT 
          pm.id,
          pm.user_id,
          u.username,
          u.avatar_url,
          pm.role,
          pm.added_at
        FROM project_members pm
        INNER JOIN users u ON pm.user_id = u.id
        WHERE pm.project_id = ${projectId}
        ORDER BY 
          CASE pm.role
            WHEN 'lead' THEN 1
            WHEN 'editor' THEN 2
            WHEN 'viewer' THEN 3
          END,
          pm.added_at ASC
      `;

      return members;
    } catch (error) {
      console.error('Error fetching project members:', error);
      throw error;
    }
}

/**
 * Get all tasks for a project
 * Security: Validates user is project member
 */
export async function getProjectTasks(projectId, userId) {
    try {
      // Verify user has access
      const hasAccess = await db`
        SELECT 1 FROM project_members
        WHERE project_id = ${projectId} AND user_id = ${userId}
      `;

      if (hasAccess.length === 0) {
        throw new Error('Access denied: User not a member of this project');
      }

      const tasks = await db`
        SELECT 
          t.id,
          t.project_id,
          t.title,
          t.description,
          t.status,
          t.priority,
          t.due_date,
          t.created_at,
          t.updated_at,
          COALESCE(
            json_agg(
              json_build_object(
                'user_id', u.id,
                'username', u.username,
                'avatar_url', u.avatar_url
              )
            ) FILTER (WHERE u.id IS NOT NULL),
            '[]'
          ) as assignees,
          COALESCE(
            (SELECT COUNT(*) FROM messages m 
             INNER JOIN channels c ON m.channel_id = c.id 
             WHERE c.project_id = t.project_id), 
            0
          ) as comments_count,
          0 as attachments_count
        FROM tasks t
        LEFT JOIN task_assignees ta ON t.id = ta.task_id
        LEFT JOIN users u ON ta.user_id = u.id
        WHERE t.project_id = ${projectId}
        GROUP BY t.id
        ORDER BY 
          CASE t.priority
            WHEN 'urgent' THEN 1
            WHEN 'high' THEN 2
            WHEN 'medium' THEN 3
            WHEN 'low' THEN 4
          END,
          t.due_date ASC NULLS LAST
      `;

      return tasks;
    } catch (error) {
      console.error('Error fetching project tasks:', error);
      throw error;
    }
}

/**
 * Create a new task
 * Security: Only 'lead' and 'editor' roles can create tasks
 */
export async function createTask(projectId, userId, taskData) {
    try {
      // Verify user has permission (lead or editor)
      const [userRole] = await db`
        SELECT role FROM project_members
        WHERE project_id = ${projectId} AND user_id = ${userId}
      `;

      if (!userRole || (userRole.role !== 'lead' && userRole.role !== 'editor')) {
        throw new Error('Access denied: Only lead or editor can create tasks');
      }

      // Validate all assignees are project members (if provided)
      if (taskData.assignee_ids && taskData.assignee_ids.length > 0) {
        const assigneeCheck = await db`
          SELECT user_id FROM project_members
          WHERE project_id = ${projectId} AND user_id = ANY(${taskData.assignee_ids})
        `;

        if (assigneeCheck.length !== taskData.assignee_ids.length) {
          throw new Error('All assignees must be project members');
        }
      }

      // Create task
      const [newTask] = await db`
        INSERT INTO tasks (
          project_id,
          title,
          description,
          status,
          priority,
          due_date
        ) VALUES (
          ${projectId},
          ${taskData.title},
          ${taskData.description || null},
          ${taskData.status || 'todo'},
          ${taskData.priority || 'medium'},
          ${taskData.due_date || null}
        )
        RETURNING *
      `;

      // Insert assignees into task_assignees table
      if (taskData.assignee_ids && taskData.assignee_ids.length > 0) {
        await db`
          INSERT INTO task_assignees (task_id, user_id)
          SELECT ${newTask.id}, user_id
          FROM unnest(${taskData.assignee_ids}::int[]) AS user_id
        `;
      }

      return newTask;
    } catch (error) {
      console.error('Error creating task:', error);
      throw error;
    }
}

/**
 * Update a task
 * Security: Only 'lead' and 'editor' roles can update tasks
 */
export async function updateTask(taskId, projectId, userId, updates) {
    try {
      // Verify user has permission
      const [userRole] = await db`
        SELECT role FROM project_members
        WHERE project_id = ${projectId} AND user_id = ${userId}
      `;

      if (!userRole || (userRole.role !== 'lead' && userRole.role !== 'editor')) {
        throw new Error('Access denied: Only lead or editor can update tasks');
      }

      // Verify task belongs to project (prevent IDOR)
      const [taskExists] = await db`
        SELECT 1 FROM tasks
        WHERE id = ${taskId} AND project_id = ${projectId}
      `;

      if (!taskExists) {
        throw new Error('Task not found or does not belong to this project');
      }

      // Build dynamic update query
      const updateFields = [];
      const values = [];
      
      if (updates.title !== undefined) {
        updateFields.push('title');
        values.push(updates.title);
      }
      if (updates.description !== undefined) {
        updateFields.push('description');
        values.push(updates.description);
      }
      if (updates.status !== undefined) {
        updateFields.push('status');
        values.push(updates.status);
      }
      if (updates.priority !== undefined) {
        updateFields.push('priority');
        values.push(updates.priority);
      }
      if (updates.due_date !== undefined) {
        updateFields.push('due_date');
        values.push(updates.due_date);
      }

      // Handle assignees separately (in task_assignees table)
      if (updates.assignee_ids !== undefined) {
        // Validate all assignees are project members
        if (updates.assignee_ids.length > 0) {
          const assigneeCheck = await db`
            SELECT user_id FROM project_members
            WHERE project_id = ${projectId} AND user_id = ANY(${updates.assignee_ids})
          `;

          if (assigneeCheck.length !== updates.assignee_ids.length) {
            throw new Error('All assignees must be project members');
          }
        }

        // Delete existing assignees and insert new ones
        await db`DELETE FROM task_assignees WHERE task_id = ${taskId}`;
        
        if (updates.assignee_ids.length > 0) {
          await db`
            INSERT INTO task_assignees (task_id, user_id)
            SELECT ${taskId}, user_id
            FROM unnest(${updates.assignee_ids}::int[]) AS user_id
          `;
        }
      }

      updateFields.push('updated_at');
      values.push(new Date());

      if (updateFields.length === 1) { // Only updated_at
        throw new Error('No fields to update');
      }

      const [updatedTask] = await db`
        UPDATE tasks
        SET ${db(Object.fromEntries(updateFields.map((field, i) => [field, values[i]])))}
        WHERE id = ${taskId}
        RETURNING *
      `;

      return updatedTask;
    } catch (error) {
      console.error('Error updating task:', error);
      throw error;
    }
}

/**
 * Delete a task
 * Security: Only 'lead' and 'editor' roles can delete tasks
 */
export async function deleteTask(taskId, projectId, userId) {
    try {
      // Verify user has permission
      const [userRole] = await db`
        SELECT role FROM project_members
        WHERE project_id = ${projectId} AND user_id = ${userId}
      `;

      if (!userRole || (userRole.role !== 'lead' && userRole.role !== 'editor')) {
        throw new Error('Access denied: Only lead or editor can delete tasks');
      }

      // Verify task belongs to project (prevent IDOR)
      const [taskExists] = await db`
        SELECT 1 FROM tasks
        WHERE id = ${taskId} AND project_id = ${projectId}
      `;

      if (!taskExists) {
        throw new Error('Task not found or does not belong to this project');
      }

      await db`
        DELETE FROM tasks
        WHERE id = ${taskId}
      `;

      return { message: 'Task deleted successfully' };
    } catch (error) {
      console.error('Error deleting task:', error);
      throw error;
    }
}

/**
 * Get task statistics for a project
 */
export async function getProjectStats(projectId, userId) {
    try {
      // Verify access
      const hasAccess = await db`
        SELECT 1 FROM project_members
        WHERE project_id = ${projectId} AND user_id = ${userId}
      `;

      if (hasAccess.length === 0) {
        throw new Error('Access denied');
      }

      const [stats] = await db`
        SELECT 
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'todo') as todo,
          COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress,
          COUNT(*) FILTER (WHERE status = 'review') as review,
          COUNT(*) FILTER (WHERE status = 'done') as done,
          COUNT(*) FILTER (WHERE due_date < NOW() AND status != 'done') as overdue
        FROM tasks
        WHERE project_id = ${projectId}
      `;

      return {
        total: parseInt(stats.total) || 0,
        todo: parseInt(stats.todo) || 0,
        in_progress: parseInt(stats.in_progress) || 0,
        review: parseInt(stats.review) || 0,
        done: parseInt(stats.done) || 0,
        overdue: parseInt(stats.overdue) || 0,
      };
    } catch (error) {
      console.error('Error fetching project stats:', error);
      throw error;
    }
}

/**
 * Create a new project
 * SECURITY: Only team owner/admin can create projects
 * Auto-adds creator as project lead
 */
export async function createProject(teamId, userId, projectData) {
  try {
    // SECURITY: Verify user is team owner or admin
    const [membership] = await db`
      SELECT role FROM team_members
      WHERE team_id = ${teamId} AND user_id = ${userId}
    `;

    if (!membership) {
      throw new Error('Access denied: You are not a member of this team');
    }

    if (membership.role !== 'owner' && membership.role !== 'admin') {
      throw new Error('Access denied: Only team owner or admin can create projects');
    }

    // Create project and add creator as lead in a transaction-like manner
    const [newProject] = await db`
      INSERT INTO projects (team_id, name, description, status, start_date, end_date)
      VALUES (
        ${teamId},
        ${projectData.name},
        ${projectData.description || null},
        ${projectData.status || 'active'},
        ${projectData.start_date || null},
        ${projectData.end_date || null}
      )
      RETURNING *
    `;

    // Auto-add creator as project lead
    await db`
      INSERT INTO project_members (project_id, user_id, role)
      VALUES (${newProject.id}, ${userId}, 'lead')
    `;

    return newProject;
  } catch (error) {
    console.error('Error creating project:', error);
    throw error;
  }
}

/**
 * Update a project
 * SECURITY: Only project lead, team owner, or team admin can update
 */
export async function updateProject(projectId, teamId, userId, updates) {
  try {
    // SECURITY: Verify user has permission to update
    const [projectMember] = await db`
      SELECT pm.role as project_role
      FROM project_members pm
      WHERE pm.project_id = ${projectId} AND pm.user_id = ${userId}
    `;

    const [teamMember] = await db`
      SELECT tm.role as team_role
      FROM team_members tm
      INNER JOIN projects p ON tm.team_id = p.team_id
      WHERE p.id = ${projectId} AND tm.user_id = ${userId}
    `;

    if (!projectMember && !teamMember) {
      throw new Error('Access denied: You are not a member of this project or team');
    }

    // Check if user has update permission (lead, team owner, or team admin)
    const isProjectLead = projectMember?.project_role === 'lead';
    const isTeamOwner = teamMember?.team_role === 'owner';
    const isTeamAdmin = teamMember?.team_role === 'admin';

    if (!isProjectLead && !isTeamOwner && !isTeamAdmin) {
      throw new Error('Access denied: Only project lead, team owner, or team admin can update projects');
    }

    // Verify project belongs to the specified team (IDOR prevention)
    const [projectCheck] = await db`
      SELECT id FROM projects WHERE id = ${projectId} AND team_id = ${teamId}
    `;

    if (!projectCheck) {
      throw new Error('Project not found in this team');
    }

    // Build dynamic update query
    const updateFields = [];
    const updateValues = [];

    if (updates.name !== undefined) {
      updateFields.push('name');
      updateValues.push(updates.name);
    }
    if (updates.description !== undefined) {
      updateFields.push('description');
      updateValues.push(updates.description);
    }
    if (updates.status !== undefined) {
      updateFields.push('status');
      updateValues.push(updates.status);
    }
    if (updates.start_date !== undefined) {
      updateFields.push('start_date');
      updateValues.push(updates.start_date);
    }
    if (updates.end_date !== undefined) {
      updateFields.push('end_date');
      updateValues.push(updates.end_date);
    }

    if (updateFields.length === 0) {
      throw new Error('No valid fields to update');
    }

    const setClause = updateFields.map((field, idx) => `${field} = $${idx + 1}`).join(', ');
    
    const [updatedProject] = await db.unsafe(
      `UPDATE projects SET ${setClause} WHERE id = $${updateFields.length + 1} AND team_id = $${updateFields.length + 2} RETURNING *`,
      [...updateValues, projectId, teamId]
    );

    if (!updatedProject) {
      throw new Error('Project not found');
    }

    return updatedProject;
  } catch (error) {
    console.error('Error updating project:', error);
    throw error;
  }
}

/**
 * Delete a project
 * SECURITY: Only project lead, team owner, or team admin can delete
 * CASCADE: Database will automatically delete all related tasks, channels, etc.
 */
export async function deleteProject(projectId, teamId, userId) {
  try {
    // SECURITY: Same permission check as update
    const [projectMember] = await db`
      SELECT pm.role as project_role
      FROM project_members pm
      WHERE pm.project_id = ${projectId} AND pm.user_id = ${userId}
    `;

    const [teamMember] = await db`
      SELECT tm.role as team_role
      FROM team_members tm
      INNER JOIN projects p ON tm.team_id = p.team_id
      WHERE p.id = ${projectId} AND tm.user_id = ${userId}
    `;

    if (!projectMember && !teamMember) {
      throw new Error('Access denied: You are not a member of this project or team');
    }

    const isProjectLead = projectMember?.project_role === 'lead';
    const isTeamOwner = teamMember?.team_role === 'owner';
    const isTeamAdmin = teamMember?.team_role === 'admin';

    if (!isProjectLead && !isTeamOwner && !isTeamAdmin) {
      throw new Error('Access denied: Only project lead, team owner, or team admin can delete projects');
    }

    // Verify project belongs to the specified team (IDOR prevention)
    const [projectCheck] = await db`
      SELECT id FROM projects WHERE id = ${projectId} AND team_id = ${teamId}
    `;

    if (!projectCheck) {
      throw new Error('Project not found in this team');
    }

    // Delete project (CASCADE will handle related data)
    const result = await db`
      DELETE FROM projects
      WHERE id = ${projectId} AND team_id = ${teamId}
      RETURNING id
    `;

    if (result.length === 0) {
      throw new Error('Project not found');
    }

    return { success: true, message: 'Project deleted successfully' };
  } catch (error) {
    console.error('Error deleting project:', error);
    throw error;
  }
}

/**
 * Add a member to a project
 * SECURITY: Only project lead, team owner, or team admin can add members
 * VALIDATION: User must be a team member first
 */
export async function addProjectMember(projectId, requesterId, userIdToAdd, role = 'viewer') {
  try {
    // Get project's team_id
    const [project] = await db`
      SELECT team_id FROM projects WHERE id = ${projectId}
    `;

    if (!project) {
      throw new Error('Project not found');
    }

    const teamId = project.team_id;

    // SECURITY: Verify requester has permission
    const [projectMember] = await db`
      SELECT pm.role as project_role
      FROM project_members pm
      WHERE pm.project_id = ${projectId} AND pm.user_id = ${requesterId}
    `;

    const [teamMember] = await db`
      SELECT tm.role as team_role
      FROM team_members tm
      WHERE tm.team_id = ${teamId} AND tm.user_id = ${requesterId}
    `;

    if (!projectMember && !teamMember) {
      throw new Error('Access denied: You are not a member of this project or team');
    }

    const isProjectLead = projectMember?.project_role === 'lead';
    const isTeamOwner = teamMember?.team_role === 'owner';
    const isTeamAdmin = teamMember?.team_role === 'admin';

    if (!isProjectLead && !isTeamOwner && !isTeamAdmin) {
      throw new Error('Access denied: Only project lead, team owner, or team admin can add members');
    }

    // VALIDATION: Check if user to add is a team member
    const [isTeamMember] = await db`
      SELECT 1 FROM team_members
      WHERE team_id = ${teamId} AND user_id = ${userIdToAdd}
    `;

    if (!isTeamMember) {
      throw new Error('User must be a team member before being added to project');
    }

    // Check if already a project member
    const [existingMember] = await db`
      SELECT 1 FROM project_members
      WHERE project_id = ${projectId} AND user_id = ${userIdToAdd}
    `;

    if (existingMember) {
      throw new Error('User is already a member of this project');
    }

    // Add member
    const [newMember] = await db`
      INSERT INTO project_members (project_id, user_id, role)
      VALUES (${projectId}, ${userIdToAdd}, ${role})
      RETURNING *
    `;

    return newMember;
  } catch (error) {
    console.error('Error adding project member:', error);
    throw error;
  }
}

/**
 * Remove a member from a project
 * SECURITY: Only project lead, team owner, or team admin can remove members
 * VALIDATION: Check if member has assigned tasks - provide options
 */
export async function removeProjectMember(projectId, requesterId, userIdToRemove, forceRemove = false) {
  try {
    // Get project's team_id
    const [project] = await db`
      SELECT team_id FROM projects WHERE id = ${projectId}
    `;

    if (!project) {
      throw new Error('Project not found');
    }

    const teamId = project.team_id;

    // SECURITY: Verify requester has permission
    const [projectMember] = await db`
      SELECT pm.role as project_role
      FROM project_members pm
      WHERE pm.project_id = ${projectId} AND pm.user_id = ${requesterId}
    `;

    const [teamMember] = await db`
      SELECT tm.role as team_role
      FROM team_members tm
      WHERE tm.team_id = ${teamId} AND tm.user_id = ${requesterId}
    `;

    if (!projectMember && !teamMember) {
      throw new Error('Access denied: You are not a member of this project or team');
    }

    const isProjectLead = projectMember?.project_role === 'lead';
    const isTeamOwner = teamMember?.team_role === 'owner';
    const isTeamAdmin = teamMember?.team_role === 'admin';

    if (!isProjectLead && !isTeamOwner && !isTeamAdmin) {
      throw new Error('Access denied: Only project lead, team owner, or team admin can remove members');
    }

    // Cannot remove yourself if you're the only lead
    if (userIdToRemove === requesterId) {
      const leadCount = await db`
        SELECT COUNT(*) as count FROM project_members
        WHERE project_id = ${projectId} AND role = 'lead'
      `;
      
      if (parseInt(leadCount[0].count) <= 1) {
        throw new Error('Cannot remove yourself as the only project lead');
      }
    }

    // VALIDATION: Check for assigned tasks
    const assignedTasks = await db`
      SELECT t.id, t.title
      FROM task_assignees ta
      INNER JOIN tasks t ON ta.task_id = t.id
      WHERE ta.user_id = ${userIdToRemove} AND t.project_id = ${projectId}
    `;

    if (assignedTasks.length > 0 && !forceRemove) {
      // Return task information for client to decide
      return {
        canRemove: false,
        assignedTaskCount: assignedTasks.length,
        assignedTasks: assignedTasks.slice(0, 5), // First 5 tasks
        message: `User has ${assignedTasks.length} assigned task(s). Use forceRemove=true to unassign and remove.`
      };
    }

    // If forceRemove, unassign all tasks first
    if (assignedTasks.length > 0 && forceRemove) {
      await db`
        DELETE FROM task_assignees
        WHERE user_id = ${userIdToRemove}
        AND task_id IN (
          SELECT id FROM tasks WHERE project_id = ${projectId}
        )
      `;
    }

    // Remove member
    const result = await db`
      DELETE FROM project_members
      WHERE project_id = ${projectId} AND user_id = ${userIdToRemove}
      RETURNING id
    `;

    if (result.length === 0) {
      throw new Error('Member not found in this project');
    }

    return {
      canRemove: true,
      message: assignedTasks.length > 0 
        ? `Member removed and unassigned from ${assignedTasks.length} task(s)`
        : 'Member removed successfully'
    };
  } catch (error) {
    console.error('Error removing project member:', error);
    throw error;
  }
}

/**
 * Update project member role
 * SECURITY: Only project lead, team owner, or team admin can update roles
 */
export async function updateProjectMemberRole(projectId, requesterId, userIdToUpdate, newRole) {
  try {
    // Get project's team_id
    const [project] = await db`
      SELECT team_id FROM projects WHERE id = ${projectId}
    `;

    if (!project) {
      throw new Error('Project not found');
    }

    const teamId = project.team_id;

    // SECURITY: Verify requester has permission
    const [projectMember] = await db`
      SELECT pm.role as project_role
      FROM project_members pm
      WHERE pm.project_id = ${projectId} AND pm.user_id = ${requesterId}
    `;

    const [teamMember] = await db`
      SELECT tm.role as team_role
      FROM team_members tm
      WHERE tm.team_id = ${teamId} AND tm.user_id = ${requesterId}
    `;

    if (!projectMember && !teamMember) {
      throw new Error('Access denied: You are not a member of this project or team');
    }

    const isProjectLead = projectMember?.project_role === 'lead';
    const isTeamOwner = teamMember?.team_role === 'owner';
    const isTeamAdmin = teamMember?.team_role === 'admin';

    if (!isProjectLead && !isTeamOwner && !isTeamAdmin) {
      throw new Error('Access denied: Only project lead, team owner, or team admin can update roles');
    }

    // Cannot demote yourself if you're the only lead
    if (userIdToUpdate === requesterId && newRole !== 'lead') {
      const leadCount = await db`
        SELECT COUNT(*) as count FROM project_members
        WHERE project_id = ${projectId} AND role = 'lead'
      `;
      
      if (parseInt(leadCount[0].count) <= 1) {
        throw new Error('Cannot change your role as the only project lead');
      }
    }

    // Update role
    const [updatedMember] = await db`
      UPDATE project_members
      SET role = ${newRole}
      WHERE project_id = ${projectId} AND user_id = ${userIdToUpdate}
      RETURNING *
    `;

    if (!updatedMember) {
      throw new Error('Member not found in this project');
    }

    return updatedMember;
  } catch (error) {
    console.error('Error updating project member role:', error);
    throw error;
  }
}
