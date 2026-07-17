import { Router } from 'express';
import { AppDependencies } from '../types';
import { batchAuth } from '../middleware/batchAuth';

import { createMentionsModule } from '../features/mentions';
import { createGlobalDreamingModule } from '../features/dreaming';
import { createGlobalEvolutionModule } from '../features/evolution';
import { createProactiveNewsModule } from '../features/news';
import { createStealthOnboardingModule } from '../features/onboarding';
import { createRandomEngagementModule } from '../features/engagement';

export const createBatchRoutes = (deps: AppDependencies): Router => {
    const router = Router();

    // Secure all /batch endpoints
    router.use(batchAuth);

    router.use('/mentions', createMentionsModule(deps));
    router.use('/dreaming', createGlobalDreamingModule(deps));
    router.use('/evolution', createGlobalEvolutionModule(deps));
    router.use('/news-post', createProactiveNewsModule(deps));
    router.use('/stealth-onboarding', createStealthOnboardingModule(deps));
    router.use('/random-engagement', createRandomEngagementModule(deps));

    return router;
};
