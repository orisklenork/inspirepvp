import 'dotenv/config';
import { createApiApp } from '../server/apiRouter.ts';

const app = createApiApp();

export default app;
