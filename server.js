import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(root, 'data');
const dbFile = path.join(dataDir, 'store.json');
fs.mkdirSync(dataDir, { recursive: true });
const defaults = { users: [], groups: [], games: [], ratings: [], logs: [], applications: [], tickets: [], privateMessages: [], stats: { visits: 0 }, seed: false };
let db = fs.existsSync(dbFile) ? JSON.parse(fs.readFileSync(dbFile, 'utf8')) : structuredClone(defaults);
for (const key of Object.keys(defaults)) if (db[key] === undefined) db[key] = structuredClone(defaults[key]);
const save = () => fs.writeFileSync(dbFile, JSON.stringify(db, null, 2));
const id = () => crypto.randomUUID();
const now = () => new Date().toISOString();
const secret = process.env.JWT_SECRET || 'change-this-in-railway';
const app = express();
app.disable('x-powered-by');
app.use(cors()); app.use(express.json({ limit: '1mb' })); app.use(express.static(path.join(root, 'public')));
function safeUser(u) { return { id: u.id, username: u.username, points: u.points || 0, role: u.role || 'user', createdAt: u.createdAt }; }
function audit(action, actorId, data = {}, visibility = 'admin') { db.logs.unshift({ id: id(), action, actorId, data, visibility, at: now() }); db.logs = db.logs.slice(0, 5000); save(); }
function auth(req, res, next) { try { req.user = jwt.verify((req.headers.authorization || '').replace(/^Bearer\s+/i, ''), secret); next(); } catch { res.status(401).json({ error: 'يجب تسجيل الدخول' }); } }
function allow(...roles) { return (req, res, next) => roles.includes(req.user?.role) ? next() : res.status(403).json({ error: 'ليس لديك صلاحية' }); }
function token(u) { return jwt.sign({ id: u.id, username: u.username, role: u.role }, secret, { expiresIn: '30d' }); }
if (!db.seed) { const u = { id: id(), username: process.env.ADMIN_USERNAME || 'admin', password: bcrypt.hashSync(process.env.ADMIN_PASSWORD || 'change-me-now', 10), role: 'owner', points: 0, createdAt: now() }; db.users.push(u); db.seed = true; save(); }

app.post('/api/auth/register', (req, res) => { const username = String(req.body.username || '').trim(); const password = String(req.body.password || ''); if (!/^[\w\u0600-\u06ff-]{3,24}$/u.test(username) || password.length < 6) return res.status(400).json({ error: 'اليوزر 3-24 حرفاً والرمز 6 أحرف على الأقل' }); if (db.users.some(u => u.username.toLowerCase() === username.toLowerCase())) return res.status(409).json({ error: 'اسم المستخدم مستخدم' }); const u = { id: id(), username, password: bcrypt.hashSync(password, 10), role: 'user', points: 0, createdAt: now() }; db.users.push(u); save(); audit('register', u.id, { username }, 'owner'); res.json({ token: token(u), user: safeUser(u) }); });
app.post('/api/auth/login', (req, res) => { const u = db.users.find(x => x.username.toLowerCase() === String(req.body.username || '').toLowerCase()); if (!u || !bcrypt.compareSync(String(req.body.password || ''), u.password)) return res.status(401).json({ error: 'بيانات الدخول غير صحيحة' }); audit('login', u.id, {}, 'owner'); res.json({ token: token(u), user: safeUser(u) }); });
app.get('/api/me', auth, (req, res) => { const u = db.users.find(x => x.id === req.user.id); res.json({ user: safeUser(u) }); });
app.post('/api/visit', (req, res) => { db.stats.visits++; save(); res.json({ visits: db.stats.visits }); });
app.get('/api/public', (req, res) => res.json({ visits: db.stats.visits, ratings: db.ratings.slice(0, 12), groups: db.groups.filter(g => g.status === 'open').map(g => ({ ...g, members: g.memberIds.map(uid => db.users.find(u => u.id === uid)?.username).filter(Boolean) })), games: db.games.filter(g => g.status === 'waiting'), onlineMembers: ['w4px', 'زاجل', 'M7MD', 'Layan', 'Faisal', 'Rakan', 'Sultan', 'Noura'] }));
app.post('/api/ratings', auth, (req, res) => { const value = Number(req.body.value); if (!Number.isInteger(value) || value < 1 || value > 5) return res.status(400).json({ error: 'تقييم غير صالح' }); db.ratings.unshift({ id: id(), user: req.user.username, value, text: String(req.body.text || '').slice(0, 300), at: now() }); save(); audit('rating', req.user.id, { value }, 'owner'); res.json({ ok: true }); });
app.post('/api/groups', auth, (req, res) => { const name = String(req.body.name || '').trim(); if (name.length < 2) return res.status(400).json({ error: 'اكتب اسم القروب' }); const g = { id: id(), name, description: String(req.body.description || '').slice(0, 300), ownerId: req.user.id, memberIds: [req.user.id], requests: [], status: 'open', createdAt: now() }; db.groups.push(g); save(); audit('group.create', req.user.id, { groupId: g.id }, 'owner'); res.json(g); });
app.post('/api/groups/:id/join', auth, (req, res) => { const g = db.groups.find(x => x.id === req.params.id); if (!g) return res.status(404).json({ error: 'القروب غير موجود' }); if (db.groups.some(x => x.memberIds.includes(req.user.id))) return res.status(400).json({ error: 'لا يمكنك دخول أكثر من قروب' }); if (!g.requests.includes(req.user.id)) g.requests.push(req.user.id); save(); audit('group.request', req.user.id, { groupId: g.id }, 'admin'); res.json({ ok: true }); });
app.post('/api/games', auth, (req, res) => { const min = Math.max(1, Number(req.body.min || 2)); const max = Math.max(min, Number(req.body.max || 4)); const g = { id: id(), title: String(req.body.title || 'جلسة جديدة').trim(), min, max, hostId: req.user.id, players: [req.user.id], visibility: req.body.visibility === 'private' ? 'private' : 'public', status: 'waiting', createdAt: now() }; db.games.unshift(g); save(); audit('game.create', req.user.id, { gameId: g.id }, 'owner'); res.json(g); });
app.post('/api/games/:id/join', auth, (req, res) => { const g = db.games.find(x => x.id === req.params.id); if (!g || g.status !== 'waiting') return res.status(404).json({ error: 'الجلسة غير متاحة' }); if (g.players.length >= g.max) return res.status(400).json({ error: 'الجلسة ممتلئة' }); if (!g.players.includes(req.user.id)) g.players.push(req.user.id); const botAdded = g.players.length < g.min; save(); res.json({ ...g, botAdded }); });

app.post('/api/applications', (req, res) => { const discordUsername = String(req.body.discordUsername || '').trim(); if (!discordUsername) return res.status(400).json({ error: 'اكتب يوزر Discord' }); const a = { id: id(), discordUsername, answers: req.body.answers || {}, status: 'pending', assignedTo: null, createdAt: now(), updatedAt: now() }; db.applications.unshift(a); save(); audit('application.created', null, { applicationId: a.id, discordUsername }, 'admin'); res.status(201).json({ id: a.id, status: a.status }); });
app.get('/api/admin/applications', auth, allow('owner', 'admin'), (req, res) => res.json(db.applications.filter(a => req.user.role === 'owner' || !a.assignedTo || a.assignedTo === req.user.id)));
app.post('/api/admin/applications/:id/claim', auth, allow('owner', 'admin'), (req, res) => { const a = db.applications.find(x => x.id === req.params.id); if (!a) return res.status(404).json({ error: 'التقديم غير موجود' }); if (a.assignedTo && a.assignedTo !== req.user.id && req.user.role !== 'owner') return res.status(409).json({ error: 'التقديم مستلم' }); a.assignedTo = req.user.id; a.updatedAt = now(); save(); audit('application.claimed', req.user.id, { applicationId: a.id }, 'admin'); res.json(a); });
app.post('/api/admin/applications/:id/decision', auth, allow('owner', 'admin'), (req, res) => { const a = db.applications.find(x => x.id === req.params.id); if (!a) return res.status(404).json({ error: 'التقديم غير موجود' }); if (req.user.role !== 'owner' && a.assignedTo !== req.user.id) return res.status(403).json({ error: 'استلم التقديم أولاً' }); a.status = req.body.accept ? 'accepted' : 'rejected'; a.decisionBy = req.user.id; a.updatedAt = now(); save(); audit(`application.${a.status}`, req.user.id, { applicationId: a.id }, 'admin'); res.json(a); });

app.post('/api/tickets', auth, (req, res) => { const subject = String(req.body.subject || '').trim(); const message = String(req.body.message || '').trim(); if (!subject || !message) return res.status(400).json({ error: 'بيانات التذكرة غير صحيحة' }); const t = { id: id(), subject, status: 'open', creatorId: req.user.id, assignedTo: null, messages: [{ id: id(), authorId: req.user.id, message, at: now() }], createdAt: now(), updatedAt: now() }; db.tickets.unshift(t); save(); audit('ticket.created', req.user.id, { ticketId: t.id }, 'admin'); res.status(201).json(t); });
app.get('/api/admin/tickets', auth, allow('owner', 'admin'), (req, res) => res.json(db.tickets.filter(t => req.user.role === 'owner' || !t.assignedTo || t.assignedTo === req.user.id)));
app.post('/api/admin/tickets/:id/claim', auth, allow('owner', 'admin'), (req, res) => { const t = db.tickets.find(x => x.id === req.params.id); if (!t) return res.status(404).json({ error: 'التذكرة غير موجودة' }); if (t.assignedTo && t.assignedTo !== req.user.id && req.user.role !== 'owner') return res.status(409).json({ error: 'التذكرة مستلمة' }); t.assignedTo = req.user.id; t.updatedAt = now(); save(); audit('ticket.claimed', req.user.id, { ticketId: t.id }, 'admin'); res.json(t); });
app.post('/api/admin/tickets/:id/reply', auth, allow('owner', 'admin'), (req, res) => { const t = db.tickets.find(x => x.id === req.params.id); const message = String(req.body.message || '').trim(); if (!t) return res.status(404).json({ error: 'التذكرة غير موجودة' }); if (!message) return res.status(400).json({ error: 'اكتب الرد' }); if (req.user.role !== 'owner' && t.assignedTo !== req.user.id) return res.status(403).json({ error: 'استلم التذكرة أولاً' }); t.messages.push({ id: id(), authorId: req.user.id, message, at: now() }); t.updatedAt = now(); save(); audit('ticket.reply', req.user.id, { ticketId: t.id }, 'admin'); res.json(t); });
app.post('/api/admin/tickets/:id/close', auth, allow('owner', 'admin'), (req, res) => { const t = db.tickets.find(x => x.id === req.params.id); if (!t) return res.status(404).json({ error: 'التذكرة غير موجودة' }); t.status = 'closed'; t.updatedAt = now(); save(); audit('ticket.closed', req.user.id, { ticketId: t.id }, 'admin'); res.json(t); });

// Private website messages: owner-only visibility. The message body is never included in admin logs.
app.post('/api/private-messages', auth, allow('owner'), (req, res) => { const recipientId = String(req.body.recipientId || '').trim(); const message = String(req.body.message || '').trim(); if (!recipientId || !message || message.length > 3000) return res.status(400).json({ error: 'بيانات الرسالة غير صحيحة' }); const m = { id: id(), senderId: req.user.id, senderUsername: req.user.username, recipientId, recipientUsername: String(req.body.recipientUsername || ''), title: String(req.body.title || 'رسالة خاصة'), message, status: 'queued', createdAt: now() }; db.privateMessages.unshift(m); save(); audit('private.message.queued', req.user.id, { messageId: m.id, recipientId, recipientUsername: m.recipientUsername }, 'owner'); res.status(201).json({ id: m.id, status: m.status }); });
app.get('/api/owner/private-messages', auth, allow('owner'), (req, res) => res.json(db.privateMessages));
app.get('/api/owner/logs', auth, allow('owner'), (req, res) => res.json(db.logs));

app.get('/api/owner/admins', auth, allow('owner'), (req, res) => res.json(db.users.filter(u => u.role === 'admin').map(safeUser)));
app.post('/api/owner/admins', auth, allow('owner'), (req, res) => { const u = db.users.find(x => x.username.toLowerCase() === String(req.body.username || '').trim().toLowerCase()); if (!u) return res.status(404).json({ error: 'المستخدم غير موجود؛ اجعله ينشئ حساباً أولاً' }); u.role = 'admin'; save(); audit('admin.granted', req.user.id, { targetUserId: u.id, username: u.username }, 'owner'); res.json(safeUser(u)); });
app.delete('/api/owner/admins/:id', auth, allow('owner'), (req, res) => { const u = db.users.find(x => x.id === req.params.id); if (!u || u.role !== 'admin') return res.status(404).json({ error: 'الإداري غير موجود' }); u.role = 'user'; save(); audit('admin.revoked', req.user.id, { targetUserId: u.id }, 'owner'); res.json({ ok: true }); });
app.get('/api/admin/logs', auth, allow('owner', 'admin'), (req, res) => res.json(req.user.role === 'owner' ? db.logs : db.logs.filter(x => x.visibility === 'admin')));
app.get('/api/health', (req, res) => res.json({ ok: true, at: now() }));
app.get('*', (req, res) => res.sendFile(path.join(root, 'public', 'index.html')));
app.listen(process.env.PORT || 3000, () => console.log('Maladh platform running'));
