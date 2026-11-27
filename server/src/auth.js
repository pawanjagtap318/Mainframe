import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'crypto';

export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 32).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  const [salt, hash] = String(stored || '').split(':');
  if (!salt || !hash) return false;
  const next = scryptSync(password, salt, 32);
  const prev = Buffer.from(hash, 'hex');
  if (next.length !== prev.length) return false;
  return timingSafeEqual(next, prev);
}

export function signToken(payload, secret) {
  const body = Buffer.from(JSON.stringify({
    ...payload,
    exp: Date.now() + 12 * 60 * 60 * 1000
  })).toString('base64url');
  const sig = createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function readToken(token, secret) {
  if (!token || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  const expected = createHmac('sha256', secret).update(body).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!data.exp || data.exp < Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}

export function requireAuth(secret) {
  return (req, res, next) => {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    const data = readToken(token, secret);
    if (!data) {
      res.status(401).json({ ok: false, code: 'E13', message: 'Sign-on has expired. Sign on again.' });
      return;
    }
    req.user = {
      userId: data.userId,
      name: data.name,
      role: data.role,
      custId: data.custId || ''
    };
    next();
  };
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        ok: false,
        code: 'E08',
        message: 'This sign-on cannot open that desk.',
        trace: ['CHANNEL REJECTED THE REQUEST BEFORE A CICS TRANSACTION STARTED']
      });
      return;
    }
    next();
  };
}
