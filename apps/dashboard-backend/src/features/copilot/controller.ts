import { Request, Response } from 'express';
import { CopilotUseCase } from './usecase';

export class CopilotController {
  constructor(private useCase: CopilotUseCase) {}

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
      res.status(500).json({ error: 'Failed to process chat' });
    }
  }
}
