import { Router } from 'express';
import { StealthOnboardingController } from './controller';

/**
 * Creates the router for stealth onboarding endpoints.
 * 
 * @param controller The controller to handle stealth onboarding requests.
 * @returns The Express Router configured with stealth onboarding routes.
 */
export const createStealthOnboardingRouter = (controller: StealthOnboardingController): Router => {
    const router = Router();
    router.post('/', controller.handle);
    router.get('/', controller.handle);
    return router;
};