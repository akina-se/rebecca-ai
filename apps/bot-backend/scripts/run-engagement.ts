import { runRandomEngagementBatch } from '../src/core/randomEngagement';

(async () => {
    try {
        console.log("Running Random Engagement manually...");
        const result = await runRandomEngagementBatch();
        console.log(result);
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
})();
