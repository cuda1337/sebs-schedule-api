import { Request, Response, NextFunction } from 'express';
import { prisma } from '../server';
import { CreateStaffDto, UpdateStaffDto } from '../types';

export const staffController = {
  // Get all staff
  async getAll(req: Request, res: Response): Promise<void> {
    try {
      const staff = await prisma.staff.findMany({
        orderBy: { name: 'asc' }
      });
      res.json(staff);
    } catch (error) {
      console.error('Error fetching staff:', error);
      res.status(500).json({ error: 'Failed to fetch staff' });
    }
  },

  // Get single staff member
  async getById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const staff = await prisma.staff.findUnique({
        where: { id: parseInt(id) },
        include: {
          assignments: {
            include: {
              client: true
            }
          }
        }
      });
      
      if (!staff) {
        return res.status(404).json({ error: 'Staff member not found' });
      }
      
      res.json(staff);
    } catch (error) {
      console.error('Error fetching staff member:', error);
      res.status(500).json({ error: 'Failed to fetch staff member' });
    }
  },

  // Create new staff member
  async create(req: Request, res: Response): Promise<void> {
    try {
      const data: CreateStaffDto = req.body;
      
      const staff = await prisma.staff.create({
        data: {
          name: data.name,
          locations: data.locations,
          availability: data.availability || {},
          role: data.role || 'RBT',
          testDate: data.testDate,
          active: data.active !== undefined ? data.active : true
        }
      });
      
      // Log the change
      await prisma.changeLog.create({
        data: {
          userId: 'system', // TODO: Get from auth
          action: 'CREATE',
          entityType: 'Staff',
          entityId: staff.id,
          newValue: staff
        }
      });
      
      res.status(201).json(staff);
    } catch (error) {
      console.error('Error creating staff:', error);
      res.status(500).json({ error: 'Failed to create staff member' });
    }
  },

  // Update staff member
  async update(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const data: UpdateStaffDto = req.body;
      
      // Get current state for logging
      const oldStaff = await prisma.staff.findUnique({
        where: { id: parseInt(id) }
      });
      
      if (!oldStaff) {
        return res.status(404).json({ error: 'Staff member not found' });
      }
      
      const staff = await prisma.staff.update({
        where: { id: parseInt(id) },
        data: {
          ...(data.name && { name: data.name }),
          ...(data.locations && { locations: data.locations }),
          ...(data.availability && { availability: data.availability }),
          ...(data.role !== undefined && { role: data.role }),
          ...(data.testDate !== undefined && { testDate: data.testDate }),
          ...(data.active !== undefined && { active: data.active })
        }
      });
      
      // Log the change
      await prisma.changeLog.create({
        data: {
          userId: 'system', // TODO: Get from auth
          action: 'UPDATE',
          entityType: 'Staff',
          entityId: staff.id,
          oldValue: oldStaff,
          newValue: staff
        }
      });
      
      res.json(staff);
    } catch (error) {
      console.error('Error updating staff:', error);
      res.status(500).json({ error: 'Failed to update staff member' });
    }
  },

  // Delete staff member
  async delete(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      
      const staff = await prisma.staff.findUnique({
        where: { id: parseInt(id) }
      });
      
      if (!staff) {
        return res.status(404).json({ error: 'Staff member not found' });
      }
      
      await prisma.staff.delete({
        where: { id: parseInt(id) }
      });
      
      // Log the change
      await prisma.changeLog.create({
        data: {
          userId: 'system', // TODO: Get from auth
          action: 'DELETE',
          entityType: 'Staff',
          entityId: parseInt(id),
          oldValue: staff
        }
      });
      
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting staff:', error);
      res.status(500).json({ error: 'Failed to delete staff member' });
    }
  }
};