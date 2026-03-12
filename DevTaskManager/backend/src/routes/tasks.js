const { Router } = require('express');
const {
  getTasks,
  getTask,
  createTask,
  updateTask,
  deleteTask
} = require('../controllers/taskController');
const { authenticate, authorize, checkTaskOwnership } = require('../middleware/auth');

const router = Router();

// All routes require authentication
router.use(authenticate);

// Routes accessible to all authenticated users
router.get('/', getTasks);
router.get('/:id', checkTaskOwnership, getTask);
router.post('/', createTask);
router.patch('/:id', checkTaskOwnership, updateTask);

// Only admins and managers can delete
router.delete('/:id', authorize('admin', 'manager'), deleteTask);

module.exports = router;
