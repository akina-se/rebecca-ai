import { createApp } from './app';
import { config } from './config';
import { getAdminFirestore } from './lib/firebase';
import { logger } from './utils/logger';

const app = createApp(getAdminFirestore());
const port = config.server.port;

app.listen(port, () => {
  logger.info(`Dashboard BFF is running on port ${port}`, { port });
  logger.info('Architectural note: Running with Feature-Driven Architecture (Vertical Slicing) + DI + Zero-Trust RBAC.');
});

export default app;
