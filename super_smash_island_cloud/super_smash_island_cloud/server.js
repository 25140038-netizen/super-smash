import 'dotenv/config';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT || 3000);
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const SESSION_SECRET = process.env.SESSION_SECRET || '';
const DATABASE_URL = process.env.DATABASE_URL || '';

if (!DATABASE_URL) {
  console.error('Falta DATABASE_URL. Copia .env.example a .env y configura una base de datos PostgreSQL.');
  process.exit(1);
}
if (IS_PRODUCTION && SESSION_SECRET.length < 32) {
  console.error('En producción, SESSION_SECRET debe ser una cadena privada de al menos 32 caracteres.');
  process.exit(1);
}

const { Pool } = pg;
const pool = new Pool({ connectionString: DATABASE_URL, max: 10, idleTimeoutMillis: 30000, connectionTimeoutMillis: 10000 });
const PgStore = connectPgSimple(session);
const app = express();
app.disable('x-powered-by');
if (IS_PRODUCTION) app.set('trust proxy', 1);

// Keep the CDNs used by the existing game while adding security headers.
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", 'https://cdn.tailwindcss.com', 'https://cdnjs.cloudflare.com', 'https://unpkg.com'],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://cdnjs.cloudflare.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com', 'https://cdnjs.cloudflare.com', 'data:'],
      imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
      connectSrc: ["'self'", 'https:', 'wss:'],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      frameAncestors: ["'none'"]
    }
  },
  crossOriginEmbedderPolicy: false
}));
app.use(express.json({ limit: '32kb' }));
app.use(express.urlencoded({ extended: false, limit: '8kb' }));
app.use(session({
  name: 'ssi.sid',
  store: new PgStore({ pool, tableName: 'ssi_sessions', createTableIfMissing: true, pruneSessionInterval: 60 * 15 }),
  secret: SESSION_SECRET || crypto.randomBytes(48).toString('hex'),
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000,
    path: '/'
  }
}));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 12,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Demasiados intentos. Espera unos minutos e inténtalo otra vez.' }
});
const matchLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 40,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes de partida. Inténtalo de nuevo en un momento.' }
});

const CHARACTER_PRICES = Object.freeze({
  warrior: 0,
  ninja: 100,
  pyro: 200,
  titan: 350,
  cyber: 500,
  gold_warrior: 10000,
  emerald_phantom: 25000,
  ruby_destroyer: 50000,
  void_walker: 100000,
  omega_supreme: 150000
});
const VALID_CHARACTERS = new Set(Object.keys(CHARACTER_PRICES));

function defaultProfile() {
  return {
    coins: 0,
    cups: 0,
    wins: 0,
    unlockedChars: ['warrior'],
    selectedChar: 'warrior',
    keyBindings: {},
    touchPositions: {},
    forceTouch: false
  };
}
function safeProfile(value) {
  const fallback = defaultProfile();
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : fallback;
  const unlocked = Array.isArray(source.unlockedChars)
    ? [...new Set(source.unlockedChars.filter(id => VALID_CHARACTERS.has(id)))].slice(0, VALID_CHARACTERS.size)
    : ['warrior'];
  if (!unlocked.includes('warrior')) unlocked.unshift('warrior');
  return {
    coins: clampInt(source.coins, 0, 2_000_000_000, 0),
    cups: clampInt(source.cups, 0, 2_000_000_000, 0),
    wins: clampInt(source.wins, 0, 2_000_000_000, 0),
    unlockedChars: unlocked,
    selectedChar: VALID_CHARACTERS.has(source.selectedChar) && unlocked.includes(source.selectedChar) ? source.selectedChar : 'warrior',
    keyBindings: sanitizeSmallObject(source.keyBindings, 8_000),
    touchPositions: sanitizeSmallObject(source.touchPositions, 8_000),
    forceTouch: source.forceTouch === true
  };
}
function clampInt(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}
function sanitizeSmallObject(value, maxBytes) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  try {
    const encoded = JSON.stringify(value);
    if (Buffer.byteLength(encoded, 'utf8') > maxBytes) return {};
    const parsed = JSON.parse(encoded);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch { return {}; }
}
function normalizeUsername(value) {
  const username = String(value ?? '').trim();
  if (!/^[A-Za-z0-9_-]{3,16}$/.test(username)) {
    const err = new Error('El nombre debe tener entre 3 y 16 caracteres y usar solo letras, números, guion o guion bajo.');
    err.status = 400;
    throw err;
  }
  return { username, usernameKey: username.toLowerCase() };
}
function normalizePassword(value) {
  const password = String(value ?? '');
  const length = Buffer.byteLength(password, 'utf8');
  if (password.length < 8 || length > 72) {
    const err = new Error('La contraseña debe tener al menos 8 caracteres y como máximo 72 bytes.');
    err.status = 400;
    throw err;
  }
  return password;
}
function publicUser(row) {
  return { id: row.id, username: row.username, profile: safeProfile(row.profile), createdAt: row.created_at };
}
function isDuplicateKey(error) { return error?.code === '23505'; }
function requireAuth(req, res, next) {
  if (!req.session?.userId) return res.status(401).json({ error: 'Inicia sesión para continuar.' });
  next();
}
function saveSession(req) {
  return new Promise((resolve, reject) => req.session.save(error => error ? reject(error) : resolve()));
}
function rotateSession(req) {
  return new Promise((resolve, reject) => req.session.regenerate(error => error ? reject(error) : resolve()));
}
function destroySession(req) {
  return new Promise(resolve => req.session.destroy(() => resolve()));
}
function jsonError(res, error) {
  if (error?.code === '23505') return res.status(409).json({ error: 'Ese nombre de cuenta ya está ocupado. Elige otro.' });
  const status = Number(error?.status) || 500;
  if (status >= 500) console.error(error);
  return res.status(status).json({ error: status >= 500 ? 'Error del servidor. Inténtalo de nuevo.' : error.message });
}
async function fetchUserById(id, client = pool) {
  const result = await client.query('SELECT id, username, profile, created_at FROM ssi_users WHERE id = $1', [id]);
  return result.rows[0] || null;
}
function calcCupDelta(baseWin, baseLoss, currentCups, isWin) {
  const cups = Number(currentCups) || 0;
  if (isWin) {
    let mult = 1;
    if (cups >= 750000) mult = 0.2;
    else if (cups >= 500000) mult = 0.3;
    else if (cups >= 250000) mult = 0.4;
    else if (cups >= 100000) mult = 0.55;
    else if (cups >= 50000) mult = 0.7;
    else if (cups >= 10000) mult = 0.85;
    return Math.max(1, Math.round(baseWin * mult));
  }
  let mult = 0.5;
  if (cups >= 750000) mult = 2.5;
  else if (cups >= 500000) mult = 2;
  else if (cups >= 250000) mult = 1.7;
  else if (cups >= 100000) mult = 1.4;
  else if (cups >= 50000) mult = 1.2;
  else if (cups >= 10000) mult = 1;
  return -Math.round(baseLoss * mult);
}
function zombieCoinsForWaves(waves) {
  let total = 0;
  for (let wave = 1; wave <= waves; wave++) {
    total += wave * 30;
    if (wave <= 200 && wave % 10 === 0) {
      const tier = wave / 10;
      total += tier * 500 + tier * tier * 50;
    }
  }
  return total;
}

app.get('/api/health', async (_req, res) => {
  try { await pool.query('SELECT 1'); res.json({ ok: true, database: 'connected' }); }
  catch { res.status(503).json({ ok: false, database: 'unavailable' }); }
});

app.post('/api/auth/register', authLimiter, async (req, res) => {
  try {
    const { username, usernameKey } = normalizeUsername(req.body?.username);
    const password = normalizePassword(req.body?.password);
    const passwordHash = await bcrypt.hash(password, 12);
    const id = crypto.randomUUID();
    const profile = defaultProfile();
    const result = await pool.query(
      'INSERT INTO ssi_users (id, username, username_key, password_hash, profile) VALUES ($1,$2,$3,$4,$5::jsonb) RETURNING id, username, profile, created_at',
      [id, username, usernameKey, passwordHash, JSON.stringify(profile)]
    );
    await rotateSession(req);
    req.session.userId = result.rows[0].id;
    await saveSession(req);
    res.status(201).json({ user: publicUser(result.rows[0]) });
  } catch (error) { jsonError(res, error); }
});

app.post('/api/auth/login', authLimiter, async (req, res) => {
  try {
    const rawUsername = String(req.body?.username ?? '').trim();
    const password = String(req.body?.password ?? '');
    if (!/^[A-Za-z0-9_-]{3,16}$/.test(rawUsername) || !password || Buffer.byteLength(password, 'utf8') > 72) {
      return res.status(401).json({ error: 'Nombre o contraseña incorrectos.' });
    }
    const result = await pool.query(
      'SELECT id, username, password_hash, profile, created_at FROM ssi_users WHERE username_key = $1',
      [rawUsername.toLowerCase()]
    );
    const row = result.rows[0];
    if (!row || !(await bcrypt.compare(password, row.password_hash))) {
      return res.status(401).json({ error: 'Nombre o contraseña incorrectos.' });
    }
    await rotateSession(req);
    req.session.userId = row.id;
    await saveSession(req);
    res.json({ user: publicUser(row) });
  } catch (error) { jsonError(res, error); }
});

app.get('/api/auth/me', requireAuth, async (req, res) => {
  try {
    const row = await fetchUserById(req.session.userId);
    if (!row) { await destroySession(req); return res.status(401).json({ error: 'La cuenta ya no está disponible. Inicia sesión otra vez.' }); }
    res.json({ user: publicUser(row) });
  } catch (error) { jsonError(res, error); }
});

app.post('/api/auth/logout', async (req, res) => {
  await destroySession(req);
  res.clearCookie('ssi.sid', { httpOnly: true, secure: IS_PRODUCTION, sameSite: 'lax', path: '/' });
  res.json({ ok: true });
});

app.patch('/api/account/username', requireAuth, async (req, res) => {
  try {
    const { username, usernameKey } = normalizeUsername(req.body?.username);
    const result = await pool.query(
      'UPDATE ssi_users SET username=$1, username_key=$2, updated_at=NOW() WHERE id=$3 RETURNING id, username, profile, created_at',
      [username, usernameKey, req.session.userId]
    );
    if (!result.rowCount) return res.status(401).json({ error: 'Inicia sesión otra vez.' });
    res.json({ user: publicUser(result.rows[0]) });
  } catch (error) { jsonError(res, error); }
});

// This endpoint syncs only settings. Currency and unlocks are changed by dedicated server routes.
app.put('/api/profile', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Lock and re-read the row so a settings save cannot overwrite coins/rewards
    // written concurrently by a match finishing on another device.
    const selected = await client.query('SELECT id, username, profile, created_at FROM ssi_users WHERE id=$1 FOR UPDATE', [req.session.userId]);
    if (!selected.rowCount) {
      await client.query('ROLLBACK');
      return res.status(401).json({ error: 'Inicia sesión otra vez.' });
    }
    const row = selected.rows[0];
    const profile = safeProfile(row.profile);
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    if (body.selectedChar && profile.unlockedChars.includes(body.selectedChar) && VALID_CHARACTERS.has(body.selectedChar)) {
      profile.selectedChar = body.selectedChar;
    }
    if (body.keyBindings !== undefined) profile.keyBindings = sanitizeSmallObject(body.keyBindings, 8000);
    if (body.touchPositions !== undefined) profile.touchPositions = sanitizeSmallObject(body.touchPositions, 8000);
    if (body.forceTouch !== undefined) profile.forceTouch = body.forceTouch === true;
    const updated = await client.query(
      'UPDATE ssi_users SET profile=$1::jsonb, updated_at=NOW() WHERE id=$2 RETURNING id, username, profile, created_at',
      [JSON.stringify(profile), req.session.userId]
    );
    await client.query('COMMIT');
    res.json({ user: publicUser(updated.rows[0]) });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    jsonError(res, error);
  } finally { client.release(); }
});

app.post('/api/shop/purchase', requireAuth, async (req, res) => {
  const charId = String(req.body?.characterId || '');
  if (!VALID_CHARACTERS.has(charId)) return res.status(400).json({ error: 'Ese personaje no está disponible.' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const selected = await client.query('SELECT id, username, profile, created_at FROM ssi_users WHERE id=$1 FOR UPDATE', [req.session.userId]);
    if (!selected.rowCount) { await client.query('ROLLBACK'); return res.status(401).json({ error: 'Inicia sesión otra vez.' }); }
    const row = selected.rows[0];
    const profile = safeProfile(row.profile);
    if (profile.unlockedChars.includes(charId)) {
      profile.selectedChar = charId;
    } else {
      const price = CHARACTER_PRICES[charId];
      if (profile.coins < price) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Necesitas ${price.toLocaleString('es-MX')} monedas para comprar este personaje.` });
      }
      profile.coins -= price;
      profile.unlockedChars.push(charId);
      profile.selectedChar = charId;
    }
    const updated = await client.query('UPDATE ssi_users SET profile=$1::jsonb, updated_at=NOW() WHERE id=$2 RETURNING id, username, profile, created_at', [JSON.stringify(profile), row.id]);
    await client.query('COMMIT');
    res.json({ user: publicUser(updated.rows[0]) });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    jsonError(res, error);
  } finally { client.release(); }
});

app.post('/api/matches/start', requireAuth, matchLimiter, async (req, res) => {
  try {
    const mode = String(req.body?.mode || '');
    const difficulty = String(req.body?.difficulty || 'normal');
    if (!['bot', 'zombies', 'multiplayer'].includes(mode)) return res.status(400).json({ error: 'Modo de partida no válido.' });
    if (!['normal', 'hard', 'nightmare'].includes(difficulty)) return res.status(400).json({ error: 'Dificultad no válida.' });
    const matchId = crypto.randomUUID();
    await pool.query('INSERT INTO ssi_matches (id, user_id, mode, difficulty) VALUES ($1,$2,$3,$4)', [matchId, req.session.userId, mode, difficulty]);
    res.status(201).json({ matchId });
  } catch (error) { jsonError(res, error); }
});

app.post('/api/matches/finish', requireAuth, matchLimiter, async (req, res) => {
  const matchId = String(req.body?.matchId || '');
  if (!/^[0-9a-f-]{36}$/i.test(matchId)) return res.status(400).json({ error: 'Partida no válida.' });
  const outcome = req.body?.result === 'win' ? 'win' : req.body?.result === 'loss' ? 'loss' : '';
  if (!outcome) return res.status(400).json({ error: 'Resultado de partida no válido.' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const found = await client.query('SELECT * FROM ssi_matches WHERE id=$1 AND user_id=$2 FOR UPDATE', [matchId, req.session.userId]);
    if (!found.rowCount) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'No se encontró esa partida de tu cuenta.' }); }
    const match = found.rows[0];
    if (match.finished_at) { await client.query('ROLLBACK'); return res.status(409).json({ error: 'Esta partida ya recibió su recompensa.' }); }
    const elapsedSeconds = Math.max(0, (Date.now() - new Date(match.started_at).getTime()) / 1000);
    if (elapsedSeconds < 4.25) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'La partida debe empezar y durar un poco más antes de reclamar su resultado.' }); }

    const userResult = await client.query('SELECT id, username, profile, created_at FROM ssi_users WHERE id=$1 FOR UPDATE', [req.session.userId]);
    const row = userResult.rows[0];
    const profile = safeProfile(row.profile);
    let coins = 0, cups = 0, wins = 0;
    if (match.mode === 'zombies') {
      const reportedWaves = clampInt(req.body?.completedWaves, 0, 500, 0);
      // Time-based upper bound reduces accidental or trivially forged giant rewards; a fully authoritative fight simulation would be a separate server feature.
      const timeBound = Math.min(500, Math.floor(elapsedSeconds / 2) + 2);
      const completedWaves = Math.min(reportedWaves, timeBound);
      coins = zombieCoinsForWaves(completedWaves);
    } else {
      const won = outcome === 'win';
      if (match.mode === 'multiplayer') {
        coins = won ? 15 : 0;
        cups = calcCupDelta(50, 30, profile.cups, won);
      } else {
        const config = match.difficulty === 'normal' ? { coins: 50, win: 35, loss: 20 }
          : match.difficulty === 'hard' ? { coins: 120, win: 80, loss: 45 }
          : { coins: 300, win: 200, loss: 90 };
        coins = won ? config.coins : 0;
        cups = calcCupDelta(config.win, config.loss, profile.cups, won);
      }
      wins = won ? 1 : 0;
    }
    profile.coins = Math.min(2_000_000_000, profile.coins + coins);
    const oldCups = profile.cups;
    profile.cups = Math.max(0, Math.min(2_000_000_000, profile.cups + cups));
    cups = profile.cups - oldCups;
    profile.wins = Math.min(2_000_000_000, profile.wins + wins);
    const updated = await client.query('UPDATE ssi_users SET profile=$1::jsonb, updated_at=NOW() WHERE id=$2 RETURNING id, username, profile, created_at', [JSON.stringify(profile), row.id]);
    await client.query('UPDATE ssi_matches SET finished_at=NOW(), result=$1, reward_coins=$2, reward_cups=$3 WHERE id=$4', [outcome, coins, cups, matchId]);
    await client.query('COMMIT');
    res.json({ user: publicUser(updated.rows[0]), reward: { coins, cups, wins } });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    jsonError(res, error);
  } finally { client.release(); }
});

app.get('/api/ranking', requireAuth, async (_req, res) => {
  try {
    const result = await pool.query(`SELECT username, COALESCE((profile->>'cups')::bigint, 0) AS cups FROM ssi_users ORDER BY COALESCE((profile->>'cups')::bigint, 0) DESC, username_key ASC LIMIT 50`);
    res.json({ ranking: result.rows.map(row => ({ username: row.username, cups: Number(row.cups) || 0 })) });
  } catch (error) { jsonError(res, error); }
});

app.use('/api', (_req, res) => res.status(404).json({ error: 'Ruta de API no encontrada.' }));
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'], maxAge: IS_PRODUCTION ? '1h' : 0 }));
app.get(/.*/, (_req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.use((error, _req, res, _next) => {
  if (error?.type === 'entity.too.large') return res.status(413).json({ error: 'La solicitud es demasiado grande.' });
  console.error(error);
  res.status(500).json({ error: 'Error inesperado del servidor.' });
});

async function initializeDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ssi_users (
      id UUID PRIMARY KEY,
      username VARCHAR(16) NOT NULL,
      username_key VARCHAR(16) NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      profile JSONB NOT NULL DEFAULT '{"coins":0,"cups":0,"wins":0,"unlockedChars":["warrior"],"selectedChar":"warrior","keyBindings":{},"touchPositions":{},"forceTouch":false}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS ssi_matches (
      id UUID PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES ssi_users(id) ON DELETE CASCADE,
      mode VARCHAR(20) NOT NULL,
      difficulty VARCHAR(20) NOT NULL,
      started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      finished_at TIMESTAMPTZ,
      result VARCHAR(10),
      reward_coins BIGINT NOT NULL DEFAULT 0,
      reward_cups BIGINT NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS ssi_matches_user_started_idx ON ssi_matches(user_id, started_at DESC);
    DELETE FROM ssi_matches WHERE started_at < NOW() - INTERVAL '30 days';
  `);
}

await initializeDatabase();
const server = app.listen(PORT, '0.0.0.0', () => console.log(`Super Smash Island Cloud activo en el puerto ${PORT}`));
async function shutdown(signal) {
  console.log(`Recibida señal ${signal}; cerrando servidor...`);
  server.close(() => {});
  await pool.end().catch(() => {});
  process.exit(0);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
