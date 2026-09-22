import { createApp } from './app';
import { config } from './config';
import { getAdminFirestore } from './lib/firebase';

const app = createApp(getAdminFirestore());
const port = config.server.port;

app.listen(port, () => {
  console.log(`Dashboard BFF is running on port ${port}`);
  console.log(`Architectural note: Running with Feature-Driven Architecture (Vertical Slicing) + DI + Zero-Trust RBAC.`);
});

export default app;
