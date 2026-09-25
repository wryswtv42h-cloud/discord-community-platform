import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, 'data');
const dbFile = path.join(dataDir, 'store.json');
fs.mkdirSync(dataDir, { recursive: true });

const defaults = { users: [], groups: [], games: [], ratings: [], logs: [], cinemaSessions: [], downloads: [], stats: { visits: 0 }, seed: false, cinemaCatalog: [
  { id: 'movie-1', title: 'مغامرة في المجهول', type: 'فيلم', year: 2026, image: '#352766' },
  { id: 'movie-2', title: 'ليلة المدينة', type: 'مسلسل', year: 2026, image: '#244d67' },
  { id: 'movie-3', title: 'رحلة النجوم', type: 'فيلم', year: 2025, image: '#63294e' },
  { id: 'movie-4', title: 'The Last Game', type: 'فيلم', year: 2026, image: '#344d39' },
  { id: 'movie-5', title: 'عالم آخر', type: 'مسلسل', year: 2024, image: '#6b4224' }
] };

let db = fs.existsSync(dbFile) ? JSON.parse(fs.readFileSync(dbFile, 'utf8')) : defaults;
for (const key of Object.keys(defaults)) if (db[key] === undefined) db[key] = defaults[key];
const save = () => fs.writeFileSync(dbFile, JSON.stringify(db, null, 2));
const id = () => crypto.randomUUID();
const now = () => new Date().toISOString();
const secret = process.env.JWT_SECRET || 'change-this-in-railway';
const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

function log(action, userId = null, meta = {}) { db.logs.unshift({ id: id(), action, userId, meta, at: now() }); db.logs = db.logs.slice(0, 3000); save(); }
function auth(req, res, next) { const token = (req.headers.authorization || '').replace('Bearer ', ''); try { req.user = jwt.verify(token, secret); next(); } catch { res.status(401).json({ error: 'يجب تسجيل الدخول' }); } }
function safeUser(user) { return { id: user.id, username: user.username, points: user.points, role: user.role, createdAt: user.createdAt }; }
function seed() { if (db.seed) return; const username = process.env.ADMIN_USERNAME || 'admin'; const password = process.env.ADMIN_PASSWORD || 'change-me-now'; db.users.push({ id: id(), username, password: bcrypt.hashSync(password, 10), role: 'admin', points: 0, createdAt: now() }); db.seed = true; save(); console.log(`Admin account: ${username}`); }
seed();

app.post('/api/auth/register', (req, res) => { const username = String(req.body.username || '').trim(); const password = String(req.body.password || ''); if (!/^[\w\u0600-\u06ff-]{3,24}$/u.test(username) || password.length < 6) return res.status(400).json({ error: 'اليوزر 3-24 حرفاً والرمز 6 أحرف على الأقل' }); if (db.users.some((u) => u.username.toLowerCase() === username.toLowerCase())) return res.status(409).json({ error: 'اسم المستخدم مستخدم' }); const user = { id: id(), username, password: bcrypt.hashSync(password, 10), role: 'user', points: 0, createdAt: now() }; db.users.push(user); save(); log('register', user.id); res.json({ token: jwt.sign({ id: user.id, username: user.username, role: user.role }, secret), user: safeUser(user) }); });
app.post('/api/auth/login', (req, res) => { const username = String(req.body.username || '').trim(); const password = String(req.body.password || ''); const user = db.users.find((u) => u.username.toLowerCase() === username.toLowerCase()); if (!user || !bcrypt.compareSync(password, user.password)) return res.status(401).json({ error: 'ب��انات الدخول غير صحيحة' }); log('login', user.id); res.json({ token: jwt.sign({ id: user.id, username: user.username, role: user.role }, secret), user: safeUser(user) }); });
app.get('/api/me', auth, (req, res) => { const user = db.users.find((u) => u.id === req.user.id); if (!user) return res.status(404).json({ error: 'المستخدم غير موجود' }); res.json({ user: safeUser(user) }); });
app.post('/api/visit', (req, res) => { db.stats.visits += 1; save(); res.json({ visits: db.stats.visits }); });
app.get('/api/public', (req, res) => res.json({ visits: db.stats.visits, ratings: db.ratings.slice(0, 12), groups: db.groups.filter((g) => g.status === 'open').map((g) => ({ ...g, members: g.memberIds.map((uid) => db.users.find((u) => u.id === uid)?.username).filter(Boolean) })), games: db.games.filter((g) => g.status === 'waiting'), cinemaCatalog: db.cinemaCatalog, onlineMembers: ['w4px', 'زاجل', 'M7MD', 'Layan', 'Faisal', 'Rakan', 'Sultan', 'Noura'] }));
app.post('/api/ratings', auth, (req, res) => { const value = Number(req.body.value); if (!Number.isInteger(value) || value < 1 || value > 5) return res.status(400).json({ error: 'تقييم غير صالح' }); db.ratings.unshift({ id: id(), user: req.user.username, value, text: String(req.body.text || '').slice(0, 300), at: now() }); save(); log('rating', req.user.id, { value }); res.json({ ok: true }); });
app.post('/api/groups', auth, (req, res) => { const name = String(req.body.name || '').trim(); if (name.length < 2) return res.status(400).json({ error: 'اكتب اسم القروب' }); const group = { id: id(), name, description: String(req.body.description || '').slice(0, 200), ownerId: req.user.id, memberIds: [req.user.id], requests: [], status: 'open', createdAt: now() }; db.groups.push(group); save(); log('group.create', req.user.id, { group: group.id }); res.json(group); });
app.post('/api/groups/:id/join', auth, (req, res) => { const group = db.groups.find((g) => g.id === req.params.id); if (!group) return res.status(404).json({ error: 'القروب غير موجود' }); if (db.groups.some((g) => g.memberIds.includes(req.user.id))) return res.status(400).json({ error: 'لا يمكنك دخول أكثر من قروب' }); if (!group.requests.includes(req.user.id)) group.requests.push(req.user.id); save(); log('group.request', req.user.id, { group: group.id }); res.json({ ok: true, message: 'تم إرسال الطلب للمالك' }); });
app.post('/api/groups/:id/decision', auth, (req, res) => { const group = db.groups.find((g) => g.id === req.params.id); if (!group || group.ownerId !== req.user.id) return res.status(403).json({ error: 'أنت لست مالك القروب' }); const userId = String(req.body.userId || ''); const accept = Boolean(req.body.accept); group.requests = group.requests.filter((uid) => uid !== userId); if (accept && !group.memberIds.includes(userId)) group.memberIds.push(userId); save(); log('group.decision', req.user.id, { group: group.id, userId, accept }); res.json(group); });
app.post('/api/groups/:id/leave', auth, (req, res) => { const group = db.groups.find((g) => g.id === req.params.id); if (!group) return res.status(404).json({ error: 'القروب غير موجود' }); group.memberIds = group.memberIds.filter((uid) => uid !== req.user.id); save(); log('group.leave', req.user.id, { group: group.id }); res.json({ ok: true }); });
app.post('/api/games', auth, (req, res) => { const title = String(req.body.title || 'جلسة جديدة').trim(); const min = Math.max(1, Number(req.body.min || 2)); const max = Math.max(min, Number(req.body.max || 4)); const game = { id: id(), title, min, max, hostId: req.user.id, players: [req.user.id], visibility: req.body.visibility === 'private' ? 'private' : 'public', status: 'waiting', createdAt: now() }; db.games.unshift(game); save(); log('game.create', req.user.id, { game: game.id }); res.json(game); });
app.post('/api/games/:id/join', auth, (req, res) => { const game = db.games.find((g) => g.id === req.params.id); if (!game || game.status !== 'waiting') return res.status(404).json({ error: 'الجلسة غير متاحة' }); if (game.players.length >= game.max) return res.status(400).json({ error: 'الجلسة ممتلئة' }); if (!game.players.includes(req.user.id)) game.players.push(req.user.id); save(); res.json(game); });
app.post('/api/cinema/sessions', auth, (req, res) => { const source = String(req.body.source || '').trim(); if (!source) return res.status(400).json({ error: 'أدخل رابط مصدر مصرح به' }); const session = { id: id(), movie: String(req.body.movie || 'فيلم مختار'), roomId: String(req.body.roomId || 'الروم العام'), source, hostId: req.user.id, status: 'requested', createdAt: now() }; db.cinemaSessions.push(session); save(); log('cinema.request', req.user.id, { session: session.id, room: session.roomId }); res.json({ ok: true, status: 'requested', message: 'تم تسجيل الطلب وسيصل لخدمة بوت السينما' }); });
app.post('/api/control/downloads', auth, (req, res) => { const url = String(req.body.url || '').trim(); if (!/^https?:\/\//i.test(url)) return res.status(400).json({ error: 'الرابط غير صالح' }); const job = { id: id(), url, quality: String(req.body.quality || 'best'), userId: req.user.id, status: 'queued', createdAt: now() }; db.downloads.unshift(job); save(); log('download.request', req.user.id, { job: job.id }); res.json({ ok: true, message: 'تم تحليل الرابط وإضافته للطابور. اربط خدمة التحميل المصرح بها لإنتاج الملف.' }); });
app.get('/api/admin/logs', auth, (req, res) => { if (req.user.role !== 'admin') return res.status(403).json({ error: 'ممنوع' }); res.json(db.logs); });
app.get('/api/admin/users', auth, (req, res) => { if (req.user.role !== 'admin') return res.status(403).json({ error: 'ممنوع' }); res.json(db.users.map(safeUser)); });
app.get('/api/health', (req, res) => res.json({ ok: true, at: now() }));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Platform running on :${port}`));
