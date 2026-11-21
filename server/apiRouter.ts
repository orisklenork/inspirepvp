import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import {
  dataAuthenticateUser,
  dataChangePassword,
  dataCheckUsername,
  dataGetAccountBundle,
  dataGetPublicPlayer,
  dataGetRegisteredPlayers,
  dataRecordMatchResult,
  dataRegisterAccount,
  dataRemoveAvatarUpload,
  dataResolveSessionUserId,
  dataRevokeSession,
  dataSaveAvatarUpload,
  dataUnlockWeapon,
  dataUpdateProfile,
} from './dataService.ts';
import { AVATARS_DIR } from './store.ts';
import { isSupabaseConfigured } from './supabaseStore.ts';

const COOKIE_NAME = 'inspiredpvp_session';

interface AuthenticatedRequest extends Request {
  userId?: string;
  sessionToken?: string;
}

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  if (!cookieHeader) {
    return result;
  }
  for (const part of cookieHeader.split(';')) {
    const eqIndex = part.indexOf('=');
    if (eqIndex <= 0) continue;
    const key = part.slice(0, eqIndex).trim();
    const val = part.slice(eqIndex + 1).trim();
    if (key) {
      result[key] = decodeURIComponent(val);
    }
  }
  return result;
}

function extractToken(req: Request): string | undefined {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const bearer = authHeader.slice(7).trim();
    if (bearer) return bearer;
  }
  const cookies = parseCookies(req.headers.cookie);
  return cookies[COOKIE_NAME];
}

function setSessionCookie(res: Response, token: string, maxAgeSec?: number): void {
  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=None',
    'Partitioned',
  ];
  if (typeof maxAgeSec === 'number') {
    parts.push(`Max-Age=${maxAgeSec}`);
  }
  res.setHeader('Set-Cookie', parts.join('; '));
}

function clearSessionCookie(res: Response): void {
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=None; Partitioned`
  );
}

function verifyMutationHeader(req: Request, res: Response, next: NextFunction): void {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    next();
    return;
  }
  const customHeader = req.headers['x-requested-with'];
  if (customHeader === 'XMLHttpRequest') {
    next();
    return;
  }
  const origin = req.headers.origin;
  const host = (req.headers['x-forwarded-host'] as string | undefined) || req.headers.host;
  if (origin && host) {
    try {
      const originUrl = new URL(origin);
      if (originUrl.host === host) {
        next();
        return;
      }
    } catch {
      // fall through
    }
  }
  res.status(403).json({ error: 'Forbidden: Missing request verification header.' });
}

async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = extractToken(req);
    const userId = await dataResolveSessionUserId(token);
    if (!userId) {
      res.status(401).json({ error: 'Authentication required. Please log in.' });
      return;
    }
    req.userId = userId;
    req.sessionToken = token;
    next();
  } catch {
    res.status(401).json({ error: 'Authentication required. Please log in.' });
  }
}

export function attachApiRoutes(app: Express): void {
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '8mb' }));
  app.use('/api', verifyMutationHeader);

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      ok: true,
      backend: isSupabaseConfigured() ? 'supabase' : 'local',
    });
  });

  app.get('/api/auth/check-username', async (req: Request, res: Response) => {
    try {
      const username = String(req.query.username ?? '');
      const token = extractToken(req);
      const currentUserId = (await dataResolveSessionUserId(token)) ?? undefined;
      const result = await dataCheckUsername(username, currentUserId);
      res.json(result);
    } catch (err) {
      res.status(500).json({
        available: false,
        valid: false,
        message: err instanceof Error ? err.message : 'Unable to check username.',
      });
    }
  });

  app.post('/api/auth/register', async (req: Request, res: Response) => {
    try {
      const { username, password, confirmPassword } = req.body ?? {};
      const { bundle, session } = await dataRegisterAccount(username, password, confirmPassword);
      setSessionCookie(res, session.token, session.maxAgeSec);
      res.status(201).json({
        account: bundle,
        token: session.token,
        message: 'Account created and profile initialized. Welcome to InspiredPVP.',
      });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Registration failed.' });
    }
  });

  app.post('/api/auth/login', async (req: Request, res: Response) => {
    try {
      const { username, password, rememberMe } = req.body ?? {};
      const { bundle, session } = await dataAuthenticateUser(
        username,
        password,
        Boolean(rememberMe)
      );
      setSessionCookie(res, session.token, session.maxAgeSec);
      res.json({
        account: bundle,
        token: session.token,
      });
    } catch (err) {
      res.status(401).json({ error: err instanceof Error ? err.message : 'Invalid credentials.' });
    }
  });

  app.post('/api/auth/logout', async (req: Request, res: Response) => {
    try {
      const token = extractToken(req);
      await dataRevokeSession(token);
      clearSessionCookie(res);
      res.json({ ok: true });
    } catch {
      clearSessionCookie(res);
      res.json({ ok: true });
    }
  });

  app.get('/api/auth/me', async (req: Request, res: Response) => {
    try {
      const token = extractToken(req);
      const userId = await dataResolveSessionUserId(token);
      if (!userId) {
        res.status(401).json({ error: 'Not authenticated.' });
        return;
      }
      const account = await dataGetAccountBundle(userId);
      if (!account) {
        res.status(401).json({ error: 'Account not found.' });
        return;
      }
      res.json({ account, token });
    } catch {
      res.status(401).json({ error: 'Not authenticated.' });
    }
  });

  app.patch('/api/profile', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const account = await dataUpdateProfile(req.userId!, req.body ?? {});
      res.json({ account, message: 'Profile changes saved.' });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to update profile.' });
    }
  });

  app.post('/api/profile/avatar', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { imageDataUrl } = req.body ?? {};
      const account = await dataSaveAvatarUpload(req.userId!, imageDataUrl);
      res.json({ account, message: 'Profile picture uploaded.' });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to upload image.' });
    }
  });

  app.delete('/api/profile/avatar', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const account = await dataRemoveAvatarUpload(req.userId!);
      res.json({ account, message: 'Profile picture removed.' });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to remove picture.' });
    }
  });

  app.post(
    '/api/profile/change-password',
    requireAuth,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { currentPassword, newPassword, confirmNewPassword } = req.body ?? {};
        await dataChangePassword(req.userId!, currentPassword, newPassword, confirmNewPassword);
        res.json({ ok: true, message: 'Password updated successfully.' });
      } catch (err) {
        res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to update password.' });
      }
    }
  );

  app.post(
    '/api/profile/unlock-weapon',
    requireAuth,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { weaponId } = req.body ?? {};
        const account = await dataUnlockWeapon(req.userId!, String(weaponId ?? ''));
        res.json({ account, message: 'Weapon unlocked and added to inventory.' });
      } catch (err) {
        res.status(400).json({ error: err instanceof Error ? err.message : 'Unable to unlock weapon.' });
      }
    }
  );

  app.post(
    '/api/matches/record',
    requireAuth,
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const result = await dataRecordMatchResult(req.userId!, req.body ?? {});
        res.json(result);
      } catch (err) {
        res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to record match.' });
      }
    }
  );

  app.get('/api/roster', async (_req: Request, res: Response) => {
    try {
      const players = await dataGetRegisteredPlayers();
      res.json({ players });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load roster.' });
    }
  });

  app.get('/api/players/:playerId', async (req: Request, res: Response) => {
    try {
      const playerId = String(req.params.playerId ?? '');
      if (!/^(IP|SF)-[0-9]{6}$/.test(playerId)) {
        res.status(400).json({ error: 'Invalid player ID format.' });
        return;
      }
      const info = await dataGetPublicPlayer(playerId);
      if (!info) {
        res.status(404).json({ error: 'Player not found.' });
        return;
      }
      res.json({ player: info });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to fetch player.' });
    }
  });

  app.get('/api/storage/avatars/:filename', (req: Request, res: Response) => {
    const filename = String(req.params.filename ?? '');
    if (!/^[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp)$/.test(filename)) {
      res.status(400).send('Invalid file name');
      return;
    }
    const resolved = path.resolve(AVATARS_DIR, filename);
    if (!resolved.startsWith(AVATARS_DIR + path.sep) || !fs.existsSync(resolved)) {
      res.status(404).send('Avatar not found');
      return;
    }
    const ext = path.extname(filename).toLowerCase();
    const contentType =
      ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    fs.createReadStream(resolved).pipe(res);
  });

  app.use('/api', (_req: Request, res: Response) => {
    res.status(404).json({ error: 'API endpoint not found.' });
  });
}

export function createApiApp(): Express {
  const app = express();
  attachApiRoutes(app);
  return app;
}
