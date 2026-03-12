const bcrypt = require('bcryptjs');
const Joi = require('joi');
const { db } = require('../config/database');
const logger = require('../utils/logger');

// Validation schemas
const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  name: Joi.string().min(2).max(100).required(),
  organizationName: Joi.string().min(2).max(100).required()
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

// Register new user
const register = async (req, res) => {
  try {
    const { error, value } = registerSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { email, password, name, organizationName } = value;

    // Check if user exists
    const existingUser = await db.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create organization and user in transaction
    await db.transaction(async (client) => {
      // Create organization
      const orgResult = await client.query(
        'INSERT INTO organizations (name) VALUES ($1) RETURNING id',
        [organizationName]
      );
      const organizationId = orgResult.rows[0].id;

      // Create user as admin
      const userResult = await client.query(
        `INSERT INTO users (email, password_hash, name, role, organization_id)
         VALUES ($1, $2, $3, $4, $5) RETURNING id, email, name, role`,
        [email, hashedPassword, name, 'admin', organizationId]
      );

      const user = userResult.rows[0];

      // Create session (v0.3 - replaces JWT)
      req.session.regenerate((err) => {
        if (err) {
          logger.error({ error: err.message }, 'Session regeneration failed');
          return res.status(500).json({ error: 'Registration failed' });
        }

        req.session.userId = user.id;
        req.session.role = user.role;
        req.session.organizationId = organizationId;

        req.session.save((err) => {
          if (err) {
            logger.error({ error: err.message }, 'Session save failed');
            return res.status(500).json({ error: 'Registration failed' });
          }

          logger.info({ userId: user.id, email }, 'User registered');

          res.status(201).json({
            message: 'User registered successfully',
            user: {
              id: user.id,
              email: user.email,
              name: user.name,
              role: user.role
            }
          });
        });
      });
    });
  } catch (error) {
    logger.error({ error: error.message }, 'Registration error');
    res.status(500).json({ error: 'Registration failed' });
  }
};

// Login user
const login = async (req, res) => {
  try {
    const { error, value } = loginSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { email, password } = value;

    // Find user
    const userResult = await db.query(
      `SELECT u.id, u.email, u.password_hash, u.name, u.role, 
              u.organization_id, o.name as organization_name
       FROM users u
       JOIN organizations o ON u.organization_id = o.id
       WHERE u.email = $1 AND u.is_active = true`,
      [email]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = userResult.rows[0];

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Update last login
    await db.query(
      'UPDATE users SET last_login = NOW() WHERE id = $1',
      [user.id]
    );

    // Create session (v0.3 - replaces JWT)
    req.session.regenerate((err) => {
      if (err) {
        logger.error({ error: err.message }, 'Session regeneration failed');
        return res.status(500).json({ error: 'Login failed' });
      }

      req.session.userId = user.id;
      req.session.role = user.role;
      req.session.organizationId = user.organization_id;

      req.session.save((err) => {
        if (err) {
          logger.error({ error: err.message }, 'Session save failed');
          return res.status(500).json({ error: 'Login failed' });
        }

        logger.info({ userId: user.id }, 'User logged in');

        res.json({
          message: 'Login successful',
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            organization: {
              id: user.organization_id,
              name: user.organization_name
            }
          }
        });
      });
    });
  } catch (error) {
    logger.error({ error: error.message }, 'Login error');
    res.status(500).json({ error: 'Login failed' });
  }
};

// Get current user
const getMe = async (req, res) => {
  try {
    const userResult = await db.query(
      `SELECT u.id, u.email, u.name, u.role, u.created_at,
              o.id as organization_id, o.name as organization_name
       FROM users u
       JOIN organizations o ON u.organization_id = o.id
       WHERE u.id = $1`,
      [req.user.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        createdAt: user.created_at,
        organization: {
          id: user.organization_id,
          name: user.organization_name
        }
      }
    });
  } catch (error) {
    logger.error({ error: error.message }, 'Get user error');
    res.status(500).json({ error: 'Failed to fetch user' });
  }
};

module.exports = {
  register,
  login,
  logout,
  getMe
};


// Logout user (v0.3 - new endpoint)
const logout = async (req, res) => {
  try {
    const userId = req.session?.userId;
    
    req.session.destroy((err) => {
      if (err) {
        logger.error({ error: err.message, userId }, 'Logout failed');
        return res.status(500).json({ error: 'Logout failed' });
      }
      
      res.clearCookie('devtask.sid');
      logger.info({ userId }, 'User logged out');
      
      res.json({ message: 'Logout successful' });
    });
  } catch (error) {
    logger.error({ error: error.message }, 'Logout error');
    res.status(500).json({ error: 'Logout failed' });
  }
};

module.exports = {
  register,
  login,
  logout,
  getMe
};
