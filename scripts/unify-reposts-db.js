/**
 * Firestore Migration Script: Standardize timeline_history metrics to `reposts`
 *
 * Scans all documents in `timeline_history`:
 * 1. If legacy `retweets` exists and is greater than `reposts`, backfills `reposts = retweets`.
 * 2. Deletes the legacy `retweets` field via FieldValue.delete().
 *
 * Usage:
 *   Dry run (default, read-only):
 *     node scripts/unify-reposts-db.js
 *
 *   Execute migration:
 *     node scripts/unify-reposts-db.js --execute
 */

const { Firestore, FieldValue } = require('@google-cloud/firestore');

const isExecute = process.argv.includes('--execute');
const isDryRun = !isExecute;

async function run() {
  console.log(`[Migration] Starting Firestore timeline_history repost unification...`);
  console.log(`[Migration] Mode: ${isDryRun ? 'DRY-RUN (No changes will be written)' : 'EXECUTE (Writing changes to Firestore)'}\n`);

  const projectId = process.env.GCP_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || 'rebecca-ai-gal';
  const db = new Firestore({ projectId });

  const snapshot = await db.collection('timeline_history').get();
  console.log(`[Migration] Total documents scanned in timeline_history: ${snapshot.size}`);

  let needUpdateCount = 0;
  let alreadyCompliantCount = 0;
  const updates = [];

  snapshot.forEach(doc => {
    const data = doc.data();
    const hasRetweetsField = data.retweets !== undefined;
    const currentReposts = typeof data.reposts === 'number' ? data.reposts : 0;
    const legacyRetweets = typeof data.retweets === 'number' ? data.retweets : 0;

    if (hasRetweetsField || typeof data.reposts !== 'number') {
      const targetReposts = Math.max(currentReposts, legacyRetweets);
      const updatePayload = {
        reposts: targetReposts,
      };

      if (hasRetweetsField) {
        updatePayload.retweets = FieldValue.delete();
      }

      updates.push({
        id: doc.id,
        before: { reposts: data.reposts, retweets: data.retweets },
        after: { reposts: targetReposts, retweets: '[DELETED]' },
        payload: updatePayload
      });
      needUpdateCount++;
    } else {
      alreadyCompliantCount++;
    }
  });

  console.log(`[Migration] Scan results:`);
  console.log(`  - Already compliant: ${alreadyCompliantCount}`);
  console.log(`  - Needing update:    ${needUpdateCount}\n`);

  if (updates.length > 0) {
    console.log(`[Migration] Sample modifications (first 5):`);
    updates.slice(0, 5).forEach((u, i) => {
      console.log(`  ${i + 1}. Doc ID: ${u.id}`);
      console.log(`     Before: ${JSON.stringify(u.before)}`);
      console.log(`     After:  ${JSON.stringify(u.after)}`);
    });
    console.log('');
  }

  if (isDryRun) {
    console.log(`[Migration] DRY-RUN complete. No data was modified.`);
    console.log(`[Migration] To apply these changes, run with: node scripts/unify-reposts-db.js --execute`);
    return;
  }

  // Execute in batches of 400 (Firestore limit is 500)
  const batchSize = 400;
  let committedCount = 0;

  for (let i = 0; i < updates.length; i += batchSize) {
    const chunk = updates.slice(i, i + batchSize);
    const batch = db.batch();

    chunk.forEach(u => {
      const docRef = db.collection('timeline_history').doc(u.id);
      batch.update(docRef, u.payload);
    });

    await batch.commit();
    committedCount += chunk.length;
    console.log(`[Migration] Committed batch: ${committedCount} / ${updates.length}`);
  }

  console.log(`\n[Migration] Successfully unified all ${committedCount} documents in timeline_history!`);
}

run().catch(err => {
  console.error('[Migration] Failed with error:', err);
  process.exit(1);
});
