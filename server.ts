import 'dotenv/config';
import express, { type NextFunction, type Request, type Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import {
  authenticateUser,
  AVATARS_DIR,
  changePassword,
  getAccountBundle,
  getPublicPlayerByPlayerId,
  getRegisteredPlayers,
  isUsernameAvailable,
  recordMatchResult,
  registerAccount,
  removeAvatarUpload,
  resolveSessionUserId,
  revokeSession,
  saveAvatarUpload,
  unlockWeapon,
  updateProfile,
  validateUsernameFormat,
} from './server/store.ts';

const PORT = 3000;
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

function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const token = extractToken(req);
  const userId = resolveSessionUserId(token);
  if (!userId) {
    res.status(401).json({ error: 'Authentication required. Please log in.' });
    return;
  }
  req.userId = userId;
  req.sessionToken = token;
  next();
}

async function startServer(): Promise<void> {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '8mb' }));
  app.use('/api', verifyMutationHeader);

  app.get('/api/auth/check-username', (req: Request, res: Response) => {
    const username = String(req.query.username ?? '');
    const formatError = validateUsernameFormat(username);
    if (formatError) {
      res.json({ available: false, valid: false, message: formatError });
      return;
    }
    const token = extractToken(req);
    const currentUserId = resolveSessionUserId(token) ?? undefined;
    const available = isUsernameAvailable(username, currentUserId);
    res.json({
      available,
      valid: true,
      message: available ? 'Username is available.' : 'Username is already taken.',
    });
  });

  app.post('/api/auth/register', (req: Request, res: Response) => {
    try {
      const { username, password, confirmPassword } = req.body ?? {};
      const { bundle, session } = registerAccount(username, password, confirmPassword);
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

  app.post('/api/auth/login', (req: Request, res: Response) => {
    try {
      const { username, password, rememberMe } = req.body ?? {};
      const { bundle, session } = authenticateUser(username, password, Boolean(rememberMe));
      setSessionCookie(res, session.token, session.maxAgeSec);
      res.json({
        account: bundle,
        token: session.token,
      });
    } catch (err) {
      res.status(401).json({ error: err instanceof Error ? err.message : 'Invalid credentials.' });
    }
  });

  app.post('/api/auth/logout', (req: Request, res: Response) => {
    const token = extractToken(req);
    revokeSession(token);
    clearSessionCookie(res);
    res.json({ ok: true });
  });

  app.get('/api/auth/me', (req: Request, res: Response) => {
    const token = extractToken(req);
    const userId = resolveSessionUserId(token);
    if (!userId) {
      res.status(401).json({ error: 'Not authenticated.' });
      return;
    }
    const account = getAccountBundle(userId);
    if (!account) {
      res.status(401).json({ error: 'Account not found.' });
      return;
    }
    res.json({ account, token });
  });

  app.patch('/api/profile', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    try {
      const account = updateProfile(req.userId!, req.body ?? {});
      res.json({ account, message: 'Profile changes saved.' });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to update profile.' });
    }
  });

  app.post('/api/profile/avatar', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    try {
      const { imageDataUrl } = req.body ?? {};
      const account = saveAvatarUpload(req.userId!, imageDataUrl);
      res.json({ account, message: 'Profile picture uploaded.' });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to upload image.' });
    }
  });

  app.delete('/api/profile/avatar', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    try {
      const account = removeAvatarUpload(req.userId!);
      res.json({ account, message: 'Profile picture removed.' });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to remove picture.' });
    }
  });

  app.post('/api/profile/change-password', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    try {
      const { currentPassword, newPassword, confirmNewPassword } = req.body ?? {};
      changePassword(req.userId!, currentPassword, newPassword, confirmNewPassword);
      res.json({ ok: true, message: 'Password updated successfully.' });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to update password.' });
    }
  });

  app.post('/api/profile/unlock-weapon', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    try {
      const { weaponId } = req.body ?? {};
      const account = unlockWeapon(req.userId!, String(weaponId ?? ''));
      res.json({ account, message: 'Weapon unlocked and added to inventory.' });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Unable to unlock weapon.' });
    }
  });

  app.post('/api/matches/record', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    try {
      const result = recordMatchResult(req.userId!, req.body ?? {});
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to record match.' });
    }
  });

  app.get('/api/roster', (_req: Request, res: Response) => {
    res.json({ players: getRegisteredPlayers() });
  });

  app.get('/api/players/:playerId', (req: Request, res: Response) => {
    const playerId = String(req.params.playerId ?? '');
    if (!/^(IP|SF)-[0-9]{6}$/.test(playerId)) {
      res.status(400).json({ error: 'Invalid player ID format.' });
      return;
    }
    const info = getPublicPlayerByPlayerId(playerId);
    if (!info) {
      res.status(404).json({ error: 'Player not found.' });
      return;
    }
    res.json({ player: info });
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

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`InspiredPVP server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
