import { Request, Response } from 'express';
import { prisma } from '../server';
import { CreateClientDto, UpdateClientDto } from '../types';

export const clientController = {
  // Get all clients
  async getAll(req: Request, res: Response): Promise<void> {
    try {
      const clients = await prisma.client.findMany({
        orderBy: { name: 'asc' }
      });
      res.json(clients);
    } catch (error) {
      console.error('Error fetching clients:', error);
      res.status(500).json({ error: 'Failed to fetch clients' });
    }
  },

  // Get single client
  async getById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const client = await prisma.client.findUnique({
        where: { id: parseInt(id) },
        include: {
          assignments: {
            include: {
              staff: true
            }
          }
        }
      });
      
      if (!client) {
        return res.status(404).json({ error: 'Client not found' });
      }
      
      res.json(client);
    } catch (error) {
      console.error('Error fetching client:', error);
      res.status(500).json({ error: 'Failed to fetch client' });
    }
  },

  // Create new client
  async create(req: Request, res: Response): Promise<void> {
    try {
      const data: CreateClientDto = req.body;
      
      const client = await prisma.client.create({
        data: {
          name: data.name,
          locations: data.locations,
          authorizedHours: data.authorizedHours,
          availability: data.availability || {}
        }
      });
      
      // Log the change
      await prisma.changeLog.create({
        data: {
          userId: 'system',
          action: 'CREATE',
          entityType: 'Client',
          entityId: client.id,
          newValue: client
        }
      });
      
      res.status(201).json(client);
    } catch (error) {
      console.error('Error creating client:', error);
      res.status(500).json({ error: 'Failed to create client' });
    }
  },

  // Update client
  async update(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const data: UpdateClientDto = req.body;
      
      // Get current state for logging
      const oldClient = await prisma.client.findUnique({
        where: { id: parseInt(id) }
      });
      
      if (!oldClient) {
        return res.status(404).json({ error: 'Client not found' });
      }
      
      const client = await prisma.client.update({
        where: { id: parseInt(id) },
        data: {
          ...(data.name && { name: data.name }),
          ...(data.locations && { locations: data.locations }),
          ...(data.authorizedHours !== undefined && { authorizedHours: data.authorizedHours }),
          ...(data.availability && { availability: data.availability })
        }
      });
      
      // Log the change
      await prisma.changeLog.create({
        data: {
          userId: 'system',
          action: 'UPDATE',
          entityType: 'Client',
          entityId: client.id,
          oldValue: oldClient,
          newValue: client
        }
      });
      
      res.json(client);
    } catch (error) {
      console.error('Error updating client:', error);
      res.status(500).json({ error: 'Failed to update client' });
    }
  },

  // Delete client
  async delete(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const clientId = parseInt(id);

      const client = await prisma.client.findUnique({
        where: { id: clientId },
        include: {
          assignments: true,
          groupSessionClients: true,
          lunchGroupClients: true,
          supervisorHistory: true,
          reassignmentsNeeded: true
        }
      });

      if (!client) {
        return res.status(404).json({ error: 'Client not found' });
      }

      console.log(`Deleting client ${clientId} with:`, {
        assignments: client.assignments.length,
        groupSessions: client.groupSessionClients.length,
        lunchGroups: client.lunchGroupClients.length,
        supervisorHistory: client.supervisorHistory.length,
        reassignments: client.reassignmentsNeeded.length
      });

      // Delete client - cascades should handle related records
      await prisma.client.delete({
        where: { id: clientId }
      });

      console.log(`Successfully deleted client ${clientId}`);

      // Log the change
      await prisma.changeLog.create({
        data: {
          userId: 'system',
          action: 'DELETE',
          entityType: 'Client',
          entityId: clientId,
          oldValue: client
        }
      });

      res.status(204).send();
    } catch (error: any) {
      console.error('Error deleting client:', error);
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);
      res.status(500).json({
        error: 'Failed to delete client',
        details: error.message,
        code: error.code
      });
    }
  }
};