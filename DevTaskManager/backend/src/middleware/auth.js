const { db } = require('../config/database');

// Session-based Authentication Middleware (v0.3)
const authenticate = async (req, res, next) => {
  try {
    // Check if session exists and has userId
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    // Fetch fresh user data from database
    const userResult = await db.query(
      'SELECT id, email, name, role, organization_id FROM users WHERE id = $1 AND is_active = true',
      [req.session.userId]
    );
    
    if (userResult.rows.length === 0) {
      // User not found or deactivated - destroy session
      req.session.destroy();
      return res.status(401).json({ error: 'User not found or deactivated' });
    }
    
    req.user = userResult.rows[0];
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({ error: 'Authentication error' });
  }
};

// Role-based Authorization Middleware
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        required: roles,
        current: req.user.role
      });
    }
    
    next();
  };
};

// Task ownership check middleware (updated for soft delete)
const checkTaskOwnership = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;
    
    // Admins and managers can access any task in their org
    if (userRole === 'admin' || userRole === 'manager') {
      const taskResult = await db.query(
        `SELECT t.* FROM tasks t
         JOIN projects p ON t.project_id = p.id
         WHERE t.id = $1 AND p.organization_id = $2 AND t.deleted_at IS NULL`,
        [id, req.user.organization_id]
      );
      
      if (taskResult.rows.length === 0) {
        return res.status(404).json({ error: 'Task not found' });
      }
      
      req.task = taskResult.rows[0];
      return next();
    }
    
    // Developers can access tasks they're assigned to or created
    const taskResult = await db.query(
      `SELECT t.* FROM tasks t
       JOIN projects p ON t.project_id = p.id
       WHERE t.id = $1 
       AND p.organization_id = $2
       AND (t.assignee_id = $3 OR t.created_by = $3)
       AND t.deleted_at IS NULL`,
      [id, req.user.organization_id, userId]
    );
    
    if (taskResult.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found or access denied' });
    }
    
    req.task = taskResult.rows[0];
    next();
  } catch (error) {
    console.error('Task ownership check error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = {
  authenticate,
  authorize,
  checkTaskOwnership
};
