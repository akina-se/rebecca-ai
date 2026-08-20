import { Firestore } from '@google-cloud/firestore';
import { createApp } from './app';
import { config } from './config';

/**
 * Application entry point for the Dashboard Backend (BFF).
 * Initializes Firestore and starts the HTTP server using createApp.
 */
const firestore = new Firestore({
  projectId: config.gcp.projectId,
});

const app = createApp(firestore);
const port = config.server.port;

app.listen(port, () => {
  console.log(`Dashboard BFF is running on port ${port}`);
  console.log(`Architectural note: Running with Feature-Driven Architecture (Vertical Slicing) + DI + Zero-Trust RBAC.`);
});

export default app;
