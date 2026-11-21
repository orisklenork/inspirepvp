import 'dotenv/config';
import express from 'express';
import { attachApiRoutes } from '../server/apiRouter.ts';

const app = express();

// Restore original /api/<route> path if Vercel's rewrite sent /api/index?__path=...
app.use((req, _res, next) => {
  if (req.url.startsWith('/api/index')) {
    const urlObj = new URL(req.url, 'http://localhost');
    const rewrittenPath = urlObj.searchParams.get('__path');
    if (rewrittenPath !== null) {
      urlObj.searchParams.delete('__path');
      const cleaned = rewrittenPath.replace(/^\/+/, '');
      const qs = urlObj.searchParams.toString();
      req.url = `/api/${cleaned}${qs ? `?${qs}` : ''}`;
    }
  }
  next();
});

attachApiRoutes(app);

export default app;
