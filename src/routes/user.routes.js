const express = require('express');
const bcrypt = require('bcryptjs');
const { authMiddleware, requireRole } = require('../middleware/auth');

const router = express.Router();

// Get all users (admin only)
router.get('/', authMiddleware, requireRole(['admin']), async (req, res) => {
  try {
    const users = await req.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        lastLogin: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Create user (admin only)
router.post('/', authMiddleware, requireRole(['admin']), async (req, res) => {
  try {
    const { email, password, name, role = 'bcba' } = req.body;
    
    // Validation
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password, and name required' });
    }
    
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    
    if (!['admin', 'bcba'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role. Must be admin or bcba' });
    }
    
    // Check if user exists
    const existing = await req.prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });
    
    if (existing) {
      return res.status(400).json({ error: 'Email already registered' });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create user
    const user = await req.prisma.user.create({
      data: {
        email: email.toLowerCase(),
        password: hashedPassword,
        name,
        role
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true
      }
    });
    
    res.status(201).json(user);
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Update user (admin only)
router.put('/:id', authMiddleware, requireRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, role, isActive } = req.body;
    
    console.log('Update user request:', { id, name, role, isActive });
    
    // Build update data
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (role !== undefined) {
      if (!['admin', 'bcba'].includes(role)) {
        console.log('Invalid role provided:', role);
        return res.status(400).json({ error: 'Invalid role. Must be admin or bcba' });
      }
      updateData.role = role;
    }
    if (isActive !== undefined) updateData.isActive = isActive;
    
    console.log('Update data:', updateData);
    
    // Update user
    const user = await req.prisma.user.update({
      where: { id: parseInt(id) },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true
      }
    });
    
    console.log('Updated user:', user);
    res.json(user);
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Delete user (admin only)
router.delete('/:id', authMiddleware, requireRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const userId = parseInt(id);
    
    console.log('Delete user request:', { userId, requesterId: req.user.id });
    
    // Don't allow deleting yourself
    if (userId === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }
    
    // Actually delete the user
    await req.prisma.user.delete({
      where: { id: userId }
    });
    
    console.log('User deleted successfully:', userId);
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// Reset password (admin only)
router.post('/:id/reset-password', authMiddleware, requireRole(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;
    
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // Update password
    await req.prisma.user.update({
      where: { id: parseInt(id) },
      data: { password: hashedPassword }
    });
    
    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Error resetting password:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

module.exports = router;