import { Request, Response } from 'express';
import { StealthOnboardingUseCase } from './usecase';

/**
 * Controller for handling stealth onboarding HTTP requests.
 * Responsible for receiving requests and delegating to the StealthOnboardingUseCase.
 */
export class StealthOnboardingController {
    /**
     * Initializes the controller with the necessary use case.
     * 
     * @param useCase The use case to execute for stealth onboarding.
     */
    constructor(private useCase: StealthOnboardingUseCase) {}

    /**
     * Handles the HTTP request for stealth onboarding.
     * 
     * @param req The Express Request object.
     * @param res The Express Response object.
     * @returns A promise that resolves when the response is sent.
     */
    handle = async (req: Request, res: Response): Promise<void> => {
        try {
            const result = await this.useCase.execute();
            res.status(200).json(result);
        } catch (e) {
            console.error("onboarding error:", e);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    };
}