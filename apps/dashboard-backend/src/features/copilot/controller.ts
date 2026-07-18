import { Request, Response } from 'express';
import { CopilotUseCase } from './usecase';

/**
 * Controller for handling Copilot-related requests.
 */
export class CopilotController {
  /**
   * Creates an instance of CopilotController.
   * 
   * @param useCase - The copilot use case instance.
   */
  constructor(private useCase: CopilotUseCase) {}

  /**
   * Handles Copilot chat interactions.
   * 
   * @param req - The Express Request object containing message and context.
   * @param res - The Express Response object.
   * @returns A promise that resolves when the response is sent.
   */
  async chat(req: Request, res: Response): Promise<void> {
    const { message, currentContext } = req.body;
    if (!message) {
      res.status(400).json({ error: 'Message is required' });
      return;
    }

    try {
      const response = await this.useCase.processChat({ message, currentContext });
      res.json(response);
    } catch (err) {
      console.error('Failed to process chat:', err);
      res.status(500).json({ error: 'Failed to process chat' });
    }
  }
}
