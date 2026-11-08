import { Request, Response } from 'express';
import { CopilotUseCase } from './usecase';
import { logger } from '../../utils/logger';

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
    const { message, currentContext, history, language } = req.body;
    if (!message || typeof message !== 'string') {
      res.status(400).json({ error: 'Message is required' });
      return;
    }

    const boundedMessage = message.slice(0, 2000);
    const boundedHistory = Array.isArray(history)
      ? history.slice(-20).map((item: { role?: string; text?: string }) => ({
          role: item?.role === 'model' ? ('model' as const) : ('user' as const),
          text: typeof item?.text === 'string' ? item.text.slice(0, 2000) : '',
        }))
      : history;

    try {
      const response = await this.useCase.processChat({
        message: boundedMessage,
        currentContext,
        history: boundedHistory,
        ...(language !== undefined ? { language } : {}),
      });
      res.json(response);
    } catch (err) {
      logger.error('Failed to process chat', err);
      res.status(500).json({ error: 'Failed to process chat' });
    }
  }
}
