const { Router } = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const { db } = require('../config/database');
const logger = require('../utils/logger');

const router = Router();

router.use(authenticate);

// Get users in organization (admin/manager only)
router.get('/', authorize('admin', 'manager'), async (req, res) => {
  try {
    const { role, isActive } = req.query;
    const orgId = req.user.organization_id;

    let query = `
      SELECT id, email, name, role, is_active, created_at, last_login
      FROM users
      WHERE organization_id = $1
    `;
    const params = [orgId];
    let paramIndex = 2;

    if (role) {
      query += ` AND role = $${paramIndex}`;
      params.push(role);
      paramIndex++;
    }

    if (isActive !== undefined) {
      query += ` AND is_active = $${paramIndex}`;
      params.push(isActive === 'true');
      paramIndex++;
    }

    query += ` ORDER BY created_at DESC`;

    const result = await db.query(query, params);
    res.json({ users: result.rows });
  } catch (error) {
    logger.error({ error: error.message }, 'Get users error');
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Create user (admin/manager only)
router.post('/', authorize('admin', 'manager'), async (req, res) => {
  try {
    const { email, name, role } = req.body;
    const orgId = req.user.organization_id;

    // Generate random temp password
    const tempPassword = Math.random().toString(36).slice(-12);
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(tempPassword, 12);

    const result = await db.query(
      `INSERT INTO users (email, password_hash, name, role, organization_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, name, role, created_at`,
      [email, hashedPassword, name, role, orgId]
    );

    // In production, send email with temp password
    logger.info({ userId: result.rows[0].id }, 'User created by admin');

    res.status(201).json({
      message: 'User created successfully',
      user: result.rows[0],
      tempPassword: process.env.NODE_ENV === 'development' ? tempPassword : undefined
    });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Email already exists' });
    }
    logger.error({ error: error.message }, 'Create user error');
    res.status(500).json({ error: 'Failed to create user' });
  }
});

module.exports = router;
