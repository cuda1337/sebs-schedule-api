import { Router } from 'express';
import { clientController } from '../controllers/client.controller';

const router = Router();

// GET /api/clients - Get all clients
router.get('/', clientController.getAll);

// GET /api/clients/:id - Get single client
router.get('/:id', clientController.getById);

// POST /api/clients - Create new client
router.post('/', clientController.create);

// PUT /api/clients/:id - Update client
router.put('/:id', clientController.update);

// DELETE /api/clients/:id - Delete client
router.delete('/:id', clientController.delete);

export default router;