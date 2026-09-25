import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, 'data');
const dbFile = path.join(dataDir, 'store.json');
fs.mkdirSync(dataDir, { recursive: true });
const defaults = { users: [], groups: [], games: [], ratings: [], logs: [], stats: { visits: 0 }, seed: false };
let db = fs.existsSync(dbFile) ? JSON.parse(fs.readFileSync(dbFile, 'utf8')) : defaults;
const save = () => fs.writeFileSync(dbFile, JSON.stringify(db, null, 2));
const id = () => crypto.randomUUID();
const now = () => new Date().toISOString();
const secret = process.env.JWT_SECRET || 'change-this-in-railway';
const app = express();
app.use(cors()); app.use(express.json({ limit: '1mb' })); app.use(express.static(path.join(__dirname, 'public')));
function log(action, userId = null, meta = {}) { db.logs.unshift({ id: id(), action, userId, meta, at: now() }); db.logs = db.logs.slice(0, 2000); save(); }
function auth(req, res, next) { const token = (req.headers.authorization || '').replace('Bearer ', ''); try { req.user = jwt.verify(token, secret); next(); } catch { res.status(401).json({ error: 'يجب تسجيل الدخول' }); } }
function optional(req, _res, next) { const token = (req.headers.authorization || '').replace('Bearer ', ''); try { req.user = jwt.verify(token, secret); } catch {} next(); }
function safeUser(u) { return { id: u.id, username: u.username, points: u.points, role: u.role, createdAt: u.createdAt }; }
function seed() { if (db.seed) return; const adminName = process.env.ADMIN_USERNAME || 'admin'; const adminPass = process.env.ADMIN_PASSWORD || 'change-me-now'; db.users.push({ id: id(), username: adminName, password: bcrypt.hashSync(adminPass, 10), role: 'admin', points: 0, createdAt: now() }); db.seed = true; save(); console.log(`Admin account: ${adminName}`); }
seed();
app.post('/api/auth/register', (req,res) => { const username = String(req.body.username||'').trim(); const password = String(req.body.password||''); if (!/^[\w\u0600-\u06ff-]{3,24}$/u.test(username) || password.length < 6) return res.status(400).json({error:'اليوزر 3-24 حرفاً والرمز 6 أحرف على الأقل'}); if (db.users.some(x=>x.username.toLowerCase()===username.toLowerCase())) return res.status(409).json({error:'اسم المستخدم مستخدم'}); const u={id:id(),username,password:bcrypt.hashSync(password,10),role:'user',points:0,createdAt:now()}; db.users.push(u); save(); log('register',u.id); res.json({token:jwt.sign({id:u.id,username:u.username,role:u.role},secret),user:safeUser(u)}); });
app.post('/api/auth/login', (req,res) => { const u=db.users.find(x=>x.username.toLowerCase()===String(req.body.username||'').toLowerCase()); if(!u||!bcrypt.compareSync(String(req.body.password||''),u.password)) return res.status(401).json({error:'بيانات الدخول غير صحيحة'}); log('login',u.id); res.json({token:jwt.sign({id:u.id,username:u.username,role:u.role},secret),user:safeUser(u)}); });
app.get('/api/me',auth,(req,res)=>{ const u=db.users.find(x=>x.id===req.user.id); res.json({user:safeUser(u)}); });
app.post('/api/visit',(req,res)=>{db.stats.visits++;save();res.json({visits:db.stats.visits});});
app.get('/api/public',(req,res)=>res.json({visits:db.stats.visits, ratings:db.ratings.slice(0,12), groups:db.groups.filter(g=>g.status==='open').map(g=>({...g,members:g.memberIds.map(x=>db.users.find(u=>u.id===x)?.username).filter(Boolean)})), games:db.games.filter(g=>g.status==='waiting')}));
app.post('/api/ratings',auth,(req,res)=>{const value=Math.max(1,Math.min(5,Number(req.body.value))); if(!Number.isInteger(value))return res.status(400).json({error:'تقييم غير صالح'}); db.ratings.unshift({id:id(),user:req.user.username,value,text:String(req.body.text||'').slice(0,300),at:now()});save();log('rating',req.user.id,{value});res.json({ok:true});});
app.post('/api/groups',auth,(req,res)=>{const name=String(req.body.name||'').trim();if(name.length<2)return res.status(400).json({error:'اكتب اسم القروب'});if(db.groups.some(g=>g.name.toLowerCase()===name.toLowerCase()))return res.status(409).json({error:'القروب موجود'});const g={id:id(),name,description:String(req.body.description||'').slice(0,200),ownerId:req.user.id,memberIds:[req.user.id],requests:[],status:'open',createdAt:now()};db.groups.push(g);save();log('group.create',req.user.id,{group:g.id});res.json(g);});
app.post('/api/groups/:id/join',auth,(req,res)=>{const g=db.groups.find(x=>x.id===req.params.id);if(!g)return res.status(404).json({error:'القروب غير موجود'});if(db.groups.some(x=>x.memberIds.includes(req.user.id)))return res.status(400).json({error:'لا يمكنك دخول أكثر من قروب'});if(!g.requests.includes(req.user.id))g.requests.push(req.user.id);save();log('group.request',req.user.id,{group:g.id});res.json({ok:true,message:'تم إرسال الطلب للمالك'});});
app.post('/api/groups/:id/decision',auth,(req,res)=>{const g=db.groups.find(x=>x.id===req.params.id);if(!g||g.ownerId!==req.user.id)return res.status(403).json({error:'أنت لست مالك القروب'});const uid=String(req.body.userId), accept=Boolean(req.body.accept);g.requests=g.requests.filter(x=>x!==uid);if(accept&&!g.memberIds.includes(uid))g.memberIds.push(uid);save();log('group.decision',req.user.id,{group:g.id,uid,accept});res.json(g);});
app.post('/api/groups/:id/leave',auth,(req,res)=>{const g=db.groups.find(x=>x.id===req.params.id);if(!g)return res.status(404).json({error:'غير موجود'});g.memberIds=g.memberIds.filter(x=>x!==req.user.id);save();log('group.leave',req.user.id,{group:g.id});res.json({ok:true});});
app.post('/api/games',auth,(req,res)=>{const title=String(req.body.title||'').trim()||'جلسة جديدة';const min=Math.max(1,Number(req.body.min||2)),max=Math.max(min,Number(req.body.max||4));const game={id:id(),title,min,max,hostId:req.user.id,players:[req.user.id],visibility:req.body.visibility==='private'?'private':'public',status:'waiting',createdAt:now()};db.games.unshift(game);save();log('game.create',req.user.id,{game:game.id});res.json(game);});
app.post('/api/games/:id/join',auth,(req,res)=>{const g=db.games.find(x=>x.id===req.params.id);if(!g||g.status!=='waiting')return res.status(404).json({error:'الجلسة غير متاحة'});if(g.players.length<g.max&&!g.players.includes(req.user.id))g.players.push(req.user.id);save();res.json(g);});
app.get('/api/admin/logs',auth,(req,res)=>{if(req.user.role!=='admin')return res.status(403).json({error:'ممنوع'});res.json(db.logs);});
app.get('/api/admin/users',auth,(req,res)=>{if(req.user.role!=='admin')return res.status(403).json({error:'ممنوع'});res.json(db.users.map(safeUser));});
app.get('/api/health',(req,res)=>res.json({ok:true,at:now()}));
app.get('*',(req,res)=>res.sendFile(path.join(__dirname,'public','index.html')));
const port=process.env.PORT||3000;app.listen(port,()=>console.log(`Platform running on :${port}`));
