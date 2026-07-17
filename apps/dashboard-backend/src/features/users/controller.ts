import { Request, Response } from 'express';
import { UsersUseCase } from './usecase';

/**
 * Controller for handling user management requests.
 */
export class UsersController {
  /**
   * Creates an instance of UsersController.
   * 
   * @param useCase - The users use case instance.
   */
  constructor(private useCase: UsersUseCase) {}

  /**
   * Retrieves all users (leaderboard / list).
   * 
   * @param req - The Express Request object.
   * @param res - The Express Response object.
   * @returns A promise that resolves when the response is sent.
   */
  async getAll(req: Request, res: Response): Promise<void> {
    try {
      const users = await this.useCase.getAllUsers();
      res.json(users);
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch users' });
    }
  }

  /**
   * Retrieves detailed user profile and stats by user ID.
   * 
   * @param req - The Express Request object containing the user ID in params.
   * @param res - The Express Response object.
   * @returns A promise that resolves when the response is sent.
   */
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

  /**
   * Updates the core memory profile for a specific user.
   * 
   * @param req - The Express Request object containing the user ID in params and coreProfile in the body.
   * @param res - The Express Response object.
   * @returns A promise that resolves when the response is sent.
   */
  async updateMemory(req: Request, res: Response): Promise<void> {
    const { id } = req.params;
    const { coreProfile } = req.body;
    await this.useCase.updateUserMemory(id as string, coreProfile);
    res.json({ success: true });
  }

  /**
   * Performs a bulk status update (Active, Blocked, Muted) for multiple users.
   * 
   * @param req - The Express Request object containing an array of user IDs and the new status in the body.
   * @param res - The Express Response object.
   * @returns A promise that resolves when the response is sent.
   */
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
