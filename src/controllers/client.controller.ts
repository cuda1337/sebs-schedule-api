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
      
      const client = await prisma.client.findUnique({
        where: { id: parseInt(id) }
      });
      
      if (!client) {
        return res.status(404).json({ error: 'Client not found' });
      }
      
      await prisma.client.delete({
        where: { id: parseInt(id) }
      });
      
      // Log the change
      await prisma.changeLog.create({
        data: {
          userId: 'system',
          action: 'DELETE',
          entityType: 'Client',
          entityId: parseInt(id),
          oldValue: client
        }
      });
      
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting client:', error);
      res.status(500).json({ error: 'Failed to delete client' });
    }
  }
};