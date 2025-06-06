import { Router } from 'express';
import { staffController } from '../controllers/staff.controller';

const router = Router();

// GET /api/staff - Get all staff
router.get('/', staffController.getAll);

// GET /api/staff/:id - Get single staff member
router.get('/:id', staffController.getById);

// POST /api/staff - Create new staff member
router.post('/', staffController.create);

// PUT /api/staff/:id - Update staff member
router.put('/:id', staffController.update);

// DELETE /api/staff/:id - Delete staff member
router.delete('/:id', staffController.delete);

export default router;