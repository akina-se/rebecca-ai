import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
import { Firestore } from '@google-cloud/firestore';
import {
  importFollowersFromArchive,
  parseFollowerArchiveContent,
  parseImportCliArgs,
} from '../src/features/onboarding/archiveImporter';

dotenv.config({ path: path.join(__dirname, '../.env') });

async function main(): Promise<void> {
  const args = parseImportCliArgs(process.argv.slice(2));
  const resolvedPath = path.resolve(process.cwd(), args.filePath);
  const rawContent = fs.readFileSync(resolvedPath, 'utf-8');
  const followerIds = parseFollowerArchiveContent(rawContent);

  const firestore = new Firestore({
    projectId: process.env.GCP_PROJECT_ID,
  });

  const result = await importFollowersFromArchive(firestore, followerIds, {
    dryRun: args.dryRun,
    timestamp: args.timestamp,
  });

  console.log(
    JSON.stringify(
      {
        mode: result.dryRun ? 'dry-run' : 'apply',
        file: resolvedPath,
        timestamp: args.timestamp,
        ...result,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error('Failed to import followers archive:', err);
  process.exit(1);
});
