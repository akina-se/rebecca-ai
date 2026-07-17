import { Request, Response } from 'express';
import { UsersUseCase } from './usecase';

export class UsersController {
  constructor(private useCase: UsersUseCase) {}

  async getAll(req: Request, res: Response): Promise<void> {
    try {
      const users = await this.useCase.getAllUsers();
      res.json(users);
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch users' });
    }
  }

  async getById(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    try {
      const user = await this.useCase.getUserById(id as string);
      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }
      res.json(user);
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch user details' });
    }
  }

  async updateMemory(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const { coreProfile } = req.body;
    await this.useCase.updateUserMemory(id as string, coreProfile);
    res.json({ success: true });
  }

  async bulkUpdateStatus(req: Request, res: Response): Promise<void> {
    const { ids, status } = req.body;
    if (!Array.isArray(ids) || !status) {
      res.status(400).json({ error: 'Invalid parameters' });
      return;
    }
    await this.useCase.bulkUpdateStatus(ids, status);
    res.json({ success: true });
  }
}
