const Joi = require('joi');
const { db } = require('../config/database');
const logger = require('../utils/logger');

// Validation schemas
const createTaskSchema = Joi.object({
  title: Joi.string().min(1).max(200).required(),
  description: Joi.string().max(5000).allow('').optional(),
  status: Joi.string().valid('backlog', 'todo', 'in_progress', 'in_review', 'done').default('backlog'),
  priority: Joi.string().valid('low', 'medium', 'high', 'urgent').default('medium'),
  assigneeId: Joi.string().uuid().optional(),
  projectId: Joi.string().uuid().required(),
  dueDate: Joi.date().optional()
});

const updateTaskSchema = Joi.object({
  title: Joi.string().min(1).max(200).optional(),
  description: Joi.string().max(5000).allow('').optional(),
  status: Joi.string().valid('backlog', 'todo', 'in_progress', 'in_review', 'done').optional(),
  priority: Joi.string().valid('low', 'medium', 'high', 'urgent').optional(),
  assigneeId: Joi.string().uuid().optional(),
  dueDate: Joi.date().optional()
}).min(1);

// Get all tasks for user's organization (v0.3 - excludes soft-deleted)
const getTasks = async (req, res) => {
  try {
    const { status, priority, assignee, projectId, search } = req.query;
    const userOrgId = req.user.organization_id;
    const userRole = req.user.role;
    const userId = req.user.id;

    let query = `
      SELECT t.*, 
             creator.name as created_by_name,
             assignee.name as assignee_name,
             p.name as project_name
      FROM tasks t
      JOIN users creator ON t.created_by = creator.id
      LEFT JOIN users assignee ON t.assignee_id = assignee.id
      JOIN projects p ON t.project_id = p.id
      WHERE p.organization_id = $1 AND t.deleted_at IS NULL
    `;
    
    const params = [userOrgId];
    let paramIndex = 2;

    // Role-based filtering
    if (userRole === 'developer') {
      query += ` AND (t.assignee_id = $${paramIndex} OR t.created_by = $${paramIndex})`;
      params.push(userId);
      paramIndex++;
    }

    // Optional filters
    if (status) {
      query += ` AND t.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (priority) {
      query += ` AND t.priority = $${paramIndex}`;
      params.push(priority);
      paramIndex++;
    }

    if (assignee) {
      query += ` AND t.assignee_id = $${paramIndex}`;
      params.push(assignee);
      paramIndex++;
    }

    if (projectId) {
      query += ` AND t.project_id = $${paramIndex}`;
      params.push(projectId);
      paramIndex++;
    }

    if (search) {
      query += ` AND (t.title ILIKE $${paramIndex} OR t.description ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    query += ` ORDER BY t.created_at DESC`;

    const result = await db.query(query, params);
    
    res.json({
      tasks: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    logger.error({ error: error.message }, 'Get tasks error');
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
};

// Get single task (v0.3 - excludes soft-deleted)
const getTask = async (req, res) => {
  try {
    const { id } = req.params;
    const userOrgId = req.user.organization_id;

    const result = await db.query(
      `SELECT t.*, 
              creator.name as created_by_name,
              assignee.name as assignee_name,
              p.name as project_name,
              p.id as project_id
       FROM tasks t
       JOIN users creator ON t.created_by = creator.id
       LEFT JOIN users assignee ON t.assignee_id = assignee.id
       JOIN projects p ON t.project_id = p.id
       WHERE t.id = $1 AND p.organization_id = $2 AND t.deleted_at IS NULL`,
      [id, userOrgId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json({ task: result.rows[0] });
  } catch (error) {
    logger.error({ error: error.message }, 'Get task error');
    res.status(500).json({ error: 'Failed to fetch task' });
  }
};

// Create new task
const createTask = async (req, res) => {
  try {
    const { error, value } = createTaskSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { title, description, status, priority, assigneeId, projectId, dueDate } = value;
    const createdBy = req.user.id;
    const userOrgId = req.user.organization_id;

    // Verify project exists and belongs to user's organization
    const projectCheck = await db.query(
      'SELECT id FROM projects WHERE id = $1 AND organization_id = $2',
      [projectId, userOrgId]
    );

    if (projectCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // If assignee provided, verify they belong to same org
    if (assigneeId) {
      const assigneeCheck = await db.query(
        'SELECT id FROM users WHERE id = $1 AND organization_id = $2',
        [assigneeId, userOrgId]
      );

      if (assigneeCheck.rows.length === 0) {
        return res.status(400).json({ error: 'Assignee not found in organization' });
      }
    }

    const result = await db.query(
      `INSERT INTO tasks (title, description, status, priority, assignee_id, 
                          project_id, created_by, due_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [title, description || '', status, priority, assigneeId || null, projectId, createdBy, dueDate || null]
    );

    const task = result.rows[0];

    logger.info({ taskId: task.id, createdBy }, 'Task created');

    res.status(201).json({
      message: 'Task created successfully',
      task
    });
  } catch (error) {
    logger.error({ error: error.message }, 'Create task error');
    res.status(500).json({ error: 'Failed to create task' });
  }
};

// Update task
const updateTask = async (req, res) => {
  try {
    const { id } = req.params;
    const { error, value } = updateTaskSchema.validate(req.body);
    
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const updates = value;
    const userOrgId = req.user.organization_id;

    // Check if task exists and user has access
    const taskCheck = await db.query(
      `SELECT t.* FROM tasks t
       JOIN projects p ON t.project_id = p.id
       WHERE t.id = $1 AND p.organization_id = $2`,
      [id, userOrgId]
    );

    if (taskCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Build update query dynamically
    const setClauses = [];
    const params = [];
    let paramIndex = 1;

    if (updates.title !== undefined) {
      setClauses.push(`title = $${paramIndex}`);
      params.push(updates.title);
      paramIndex++;
    }

    if (updates.description !== undefined) {
      setClauses.push(`description = $${paramIndex}`);
      params.push(updates.description);
      paramIndex++;
    }

    if (updates.status !== undefined) {
      setClauses.push(`status = $${paramIndex}`);
      params.push(updates.status);
      paramIndex++;
    }

    if (updates.priority !== undefined) {
      setClauses.push(`priority = $${paramIndex}`);
      params.push(updates.priority);
      paramIndex++;
    }

    if (updates.assigneeId !== undefined) {
      setClauses.push(`assignee_id = $${paramIndex}`);
      params.push(updates.assigneeId);
      paramIndex++;
    }

    if (updates.dueDate !== undefined) {
      setClauses.push(`due_date = $${paramIndex}`);
      params.push(updates.dueDate);
      paramIndex++;
    }

    setClauses.push(`updated_at = NOW()`);

    params.push(id);

    const query = `
      UPDATE tasks 
      SET ${setClauses.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await db.query(query, params);
    const task = result.rows[0];

    logger.info({ taskId: id, updates: Object.keys(updates) }, 'Task updated');

    res.json({
      message: 'Task updated successfully',
      task
    });
  } catch (error) {
    logger.error({ error: error.message }, 'Update task error');
    res.status(500).json({ error: 'Failed to update task' });
  }
};

// Delete task (v0.3 - soft delete implementation)
const deleteTask = async (req, res) => {
  try {
    const { id } = req.params;
    const userOrgId = req.user.organization_id;
    const userRole = req.user.role;

    // Only admins and managers can delete tasks
    if (userRole === 'developer') {
      return res.status(403).json({ error: 'Only admins and managers can delete tasks' });
    }

    // Check if task exists and get current state for audit log
    const taskCheck = await db.query(
      `SELECT t.* FROM tasks t
       JOIN projects p ON t.project_id = p.id
       WHERE t.id = $1 AND p.organization_id = $2 AND t.deleted_at IS NULL`,
      [id, userOrgId]
    );

    if (taskCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const beforeState = taskCheck.rows[0];

    // Soft delete (set deleted_at timestamp)
    await db.query(
      'UPDATE tasks SET deleted_at = NOW() WHERE id = $1',
      [id]
    );

    // Audit log
    await db.query(
      `INSERT INTO audit_logs 
       (event_type, actor_id, actor_ip, resource_type, resource_id, action, before_state, after_state)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        'task.delete',
        req.user.id,
        req.ip,
        'task',
        id,
        'SOFT_DELETE',
        JSON.stringify(beforeState),
        JSON.stringify({ deleted_at: new Date() })
      ]
    );

    logger.info({ taskId: id, deletedBy: req.user.id }, 'Task soft deleted');

    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    logger.error({ error: error.message }, 'Delete task error');
    res.status(500).json({ error: 'Failed to delete task' });
  }
};

module.exports = {
  getTasks,
  getTask,
  createTask,
  updateTask,
  deleteTask
};
