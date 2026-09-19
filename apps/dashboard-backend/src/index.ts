import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { createApp } from './app';
import { config } from './config';

if (!getApps().length) {
  initializeApp({
    projectId: process.env.GCP_PROJECT_ID || process.env.GCLOUD_PROJECT || config.gcp.projectId || 'rebecca-ai-gal-local',
  });
}

const firestore = getFirestore();
const app = createApp(firestore);
const port = config.server.port;

app.listen(port, () => {
  console.log(`Dashboard BFF is running on port ${port}`);
  console.log(`Architectural note: Running with Feature-Driven Architecture (Vertical Slicing) + DI + Zero-Trust RBAC.`);
});

export default app;
