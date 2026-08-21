import { runStealthOnboardingBatch } from '../src/core/onboarding';

(async () => {
    try {
        console.log("Running Stealth Onboarding manually...");
        const result = await runStealthOnboardingBatch();
        console.log(result);
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
})();
