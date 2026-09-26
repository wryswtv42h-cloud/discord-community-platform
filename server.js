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

const defaults = {
  users: [],
  groups: [],
  games: [],
  ratings: [],
  logs: [],
  applications: [],
  tickets: [],
  privateMessages: [],
  anonymousMessages: [],
  notifications: [],
  cinemaRequests: [],
  downloadRequests: [],
  cinemaCatalog: [],
  stats: {
    visits: 0
  },
  seed: false
};

let db;

try {
  db = fs.existsSync(dbFile)
    ? JSON.parse(fs.readFileSync(dbFile, 'utf8'))
    : structuredClone(defaults);
} catch {
  db = structuredClone(defaults);
}

for (const key of Object.keys(defaults)) {
  if (db[key] === undefined) {
    db[key] = structuredClone(defaults[key]);
  }
}

const save = () => {
  fs.writeFileSync(dbFile, JSON.stringify(db, null, 2));
};

const id = () => crypto.randomUUID();
const now = () => new Date().toISOString();
const secret = process.env.JWT_SECRET || 'change-this-in-railway';

const app = express();

app.disable('x-powered-by');
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(root, 'public')));

function safeUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    points: user.points || 0,
    role: user.role || 'user',
    avatar: user.avatar || user.avatarUrl || '/server-avatar.svg',
    discordId: user.discordId || null,
    createdAt: user.createdAt
  };
}

function audit(action, actorId, data = {}, visibility = 'admin') {
  db.logs.unshift({
    id: id(),
    action,
    actorId,
    data,
    visibility,
    at: now()
  });

  db.logs = db.logs.slice(0, 5000);
  save();
}

function auth(req, res, next) {
  try {
    const authorization = req.headers.authorization || '';
    const tokenValue = authorization.replace(/^Bearer\s+/i, '');

    if (!tokenValue) {
      return res.status(401).json({
        error: 'يجب تسجيل الدخول أولًا'
      });
    }

    req.user = jwt.verify(tokenValue, secret);
    next();
  } catch {
    res.status(401).json({
      error: 'جلسة الدخول غير صالحة'
    });
  }
}

function optionalAuth(req, res, next) {
  try {
    const authorization = req.headers.authorization || '';
    const tokenValue = authorization.replace(/^Bearer\s+/i, '');

    req.user = tokenValue
      ? jwt.verify(tokenValue, secret)
      : null;
  } catch {
    req.user = null;
  }

  next();
}

function allow(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role)) {
      return res.status(403).json({
        error: 'ليس لديك صلاحية لتنفيذ هذا الإجراء'
      });
    }

    next();
  };
}

function createToken(user) {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      role: user.role
    },
    secret,
    {
      expiresIn: '30d'
    }
  );
}

function getUser(idValue) {
  return db.users.find((user) => user.id === idValue);
}

function getPublicGroup(group) {
  return {
    ...group,
    members: (group.memberIds || [])
      .map((memberId) => getUser(memberId))
      .filter(Boolean)
      .map((user) => user.username)
  };
}

function getPublicGame(game) {
  return {
    ...game,
    players: (game.playerIds || [])
      .map((playerId) => getUser(playerId))
      .filter(Boolean)
      .map((user) => user.username)
  };
}

/*
 * إنشاء حساب المالك أول مرة.
 * بعد أول تشغيل يتم حفظ الحساب داخل store.json.
 */
if (!db.seed) {
  const owner = {
    id: id(),
    username: process.env.ADMIN_USERNAME || 'admin',
    password: bcrypt.hashSync(
      process.env.ADMIN_PASSWORD || 'change-me-now',
      12
    ),
    role: 'owner',
    points: 0,
    createdAt: now()
  };

  db.users.push(owner);
  db.seed = true;
  save();
}

/*
 * القائمة الأساسية تحتوي على روابط Internet Archive.
 * هذه مصادر تعرض مواد Public Domain أو مواد مرخصة حسب صفحة كل عنصر.
 * لا يتم نسخ الملفات إلى مشروعك؛ يتم حفظ بيانات وروابط المصدر فقط.
 */
const fallbackCinemaCatalog = [
  {
    id: 'archive-night-of-the-living-dead',
    title: 'Night of the Living Dead',
    titleAr: 'ليلة الموتى الأحياء',
    description: 'فيلم كلاسيكي متاح عبر Internet Archive.',
    genre: 'رعب',
    year: 1968,
    provider: 'Internet Archive',
    sourceUrl: 'https://archive.org/details/night_of_the_living_dead',
    thumbnail: '',
    legalNote: 'تحقق من ترخيص العنصر في صفحة المصدر قبل العرض.'
  },
  {
    id: 'archive-his-girl-friday',
    title: 'His Girl Friday',
    titleAr: 'فتاته الجمعة',
    description: 'فيلم كلاسيكي متاح عبر Internet Archive.',
    genre: 'كوميديا',
    year: 1940,
    provider: 'Internet Archive',
    sourceUrl: 'https://archive.org/details/his_girl_friday',
    thumbnail: '',
    legalNote: 'تحقق من ترخيص العنصر في صفحة المصدر قبل العرض.'
  },
  {
    id: 'archive-charade',
    title: 'Charade',
    titleAr: 'شاريد',
    description: 'فيلم كلاسيكي متاح عبر Internet Archive.',
    genre: 'غموض',
    year: 1963,
    provider: 'Internet Archive',
    sourceUrl: 'https://archive.org/details/charade_1963',
    thumbnail: '',
    legalNote: 'تحقق من ترخيص العنصر في صفحة المصدر قبل العرض.'
  },
  {
    id: 'archive-sherlock-jr',
    title: 'Sherlock Jr.',
    titleAr: 'شيرلوك جونيور',
    description: 'فيلم صامت كلاسيكي متاح عبر Internet Archive.',
    genre: 'كوميديا',
    year: 1924,
    provider: 'Internet Archive',
    sourceUrl: 'https://archive.org/details/sherlock_jr',
    thumbnail: '',
    legalNote: 'تحقق من ترخيص العنصر في صفحة المصدر قبل العرض.'
  },
  {
    id: 'archive-the-general',
    title: 'The General',
    titleAr: 'الجنرال',
    description: 'فيلم صامت كلاسيكي متاح عبر Internet Archive.',
    genre: 'مغامرة',
    year: 1926,
    provider: 'Internet Archive',
    sourceUrl: 'https://archive.org/details/the_general',
    thumbnail: '',
    legalNote: 'تحقق من ترخيص العنصر في صفحة المصدر قبل العرض.'
  }
];

if (!Array.isArray(db.cinemaCatalog) || !db.cinemaCatalog.length) {
  db.cinemaCatalog = fallbackCinemaCatalog;
  save();
}

/*
 * جلب عناصر إضافية من Internet Archive.
 * يتم تخزين البيانات مؤقتًا في الذاكرة لمدة ساعة.
 */
let archiveCache = {
  items: [],
  updatedAt: 0
};

async function getArchiveCatalog() {
  const cacheAge = Date.now() - archiveCache.updatedAt;

  if (archiveCache.items.length && cacheAge < 60 * 60 * 1000) {
    return archiveCache.items;
  }

  try {
    const query = encodeURIComponent(
      'collection:feature_films AND mediatype:movies'
    );

    const url =
      `https://archive.org/advancedsearch.php?q=${query}` +
      '&fl[]=identifier,title,description,year,creator' +
      '&rows=100' +
      '&page=1' +
      '&output=json';

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error('Internet Archive request failed');
    }

    const result = await response.json();
    const docs = result?.response?.docs || [];

    const items = docs
      .filter((item) => item.identifier && item.title)
      .map((item) => ({
        id: `archive-${item.identifier}`,
        title: item.title,
        titleAr: item.title,
        description:
          typeof item.description === 'string'
            ? item.description.slice(0, 400)
            : 'محتوى متاح عبر Internet Archive',
        genre: 'Public Domain / Licensed',
        year: item.year || '',
        provider: 'Internet Archive',
        sourceUrl: `https://archive.org/details/${encodeURIComponent(item.identifier)}`,
        thumbnail:
          `https://archive.org/services/img/${encodeURIComponent(item.identifier)}`,
        legalNote:
          'تحقق من ترخيص العنصر في صفحة المصدر قبل العرض أو التشغيل.'
      }));

    archiveCache = {
      items,
      updatedAt: Date.now()
    };

    return items;
  } catch (error) {
    console.error('Cinema catalog:', error.message);
    return [];
  }
}

/*
 * المصادقة والحسابات
 */
app.post('/api/auth/register', (req, res) => {
  const username = String(req.body.username || '').trim();
  const password = String(req.body.password || '');

  if (!/^[\w\u0600-\u06ff-]{3,24}$/u.test(username)) {
    return res.status(400).json({
      error: 'اسم المستخدم يجب أن يكون بين 3 و24 حرفًا'
    });
  }

  if (password.length < 6) {
    return res.status(400).json({
      error: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل'
    });
  }

  const exists = db.users.some(
    (user) => user.username.toLowerCase() === username.toLowerCase()
  );

  if (exists) {
    return res.status(409).json({
      error: 'اسم المستخدم مستخدم مسبقًا'
    });
  }

  const user = {
    id: id(),
    username,
    password: bcrypt.hashSync(password, 12),
    role: 'user',
    points: 0,
    createdAt: now()
  };

  db.users.push(user);
  save();

  res.status(201).json({
    token: createToken(user),
    user: safeUser(user)
  });
});

app.post('/api/auth/login', (req, res) => {
  const username = String(req.body.username || '').trim();
  const password = String(req.body.password || '');

  const user = db.users.find(
    (entry) => entry.username.toLowerCase() === username.toLowerCase()
  );

  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({
      error: 'اسم المستخدم أو كلمة المرور غير صحيحة'
    });
  }

  res.json({
    token: createToken(user),
    user: safeUser(user)
  });
});

app.get('/api/me', auth, (req, res) => {
  const user = getUser(req.user.id);

  if (!user) {
    return res.status(404).json({
      error: 'المستخدم غير موجود'
    });
  }

  res.json({
    user: safeUser(user)
  });
});

/*
 * البيانات العامة
 */
app.post('/api/visit', (req, res) => {
  db.stats.visits += 1;
  save();

  res.json({
    visits: db.stats.visits
  });
});

app.get('/api/public', async (req, res) => {
  const publicGroups = db.groups.filter((group) => group.status === 'open').map(getPublicGroup);
  const publicGames = db.games.filter((game) => ['waiting','full','playing'].includes(game.status)).map(getPublicGame);
  let members = [];
  try { members = await (globalThis.mldDiscord?.getMembers?.() || Promise.resolve([])); } catch (error) { console.error('Discord members:', error.message); }
  if (!members.length) members = db.users.map((user) => ({ id:user.id,name:user.username,username:user.username,avatar:user.avatar||'/server-avatar.svg',status:'online',role:user.role }));
  res.json({
    visits: db.stats.visits,
    onlineMembers: members.slice(0,100),
    members: members.slice(0,100),
    groups: publicGroups,
    games: publicGames,
    ratings: db.ratings.slice(0,12),
    leaderboard: db.users.filter(u=>u.role!=='system').sort((a,b)=>(b.points||0)-(a.points||0)).slice(0,20).map(safeUser)
  });
});
app.get('/api/public/members', async (req,res)=>{
  const q=String(req.query.q||'').trim().toLowerCase();
  let members=[];
  try { members=await (globalThis.mldDiscord?.getMembers?.() || Promise.resolve([])); } catch {}
  if (!members.length) members=db.users.map(u=>({id:u.id,name:u.username,username:u.username,avatar:u.avatar||'/server-avatar.svg',status:'online'}));
  if(q) members=members.filter(m=>[m.name,m.username,m.id].filter(Boolean).join(' ').toLowerCase().includes(q));
  res.json({members:members.slice(0,50)});
});

/*
 * التقييمات
 */
app.post('/api/ratings', auth, (req, res) => {
  const value = Number(req.body.value);
  const text = String(req.body.text || '').trim();

  if (!Number.isInteger(value) || value < 1 || value > 5) {
    return res.status(400).json({
      error: 'التقييم يجب أن يكون بين 1 و5'
    });
  }

  const rating = {
    id: id(),
    user: req.user.username,
    value,
    text: text.slice(0, 1000),
    createdAt: now()
  };

  db.ratings.unshift(rating);
  db.ratings = db.ratings.slice(0, 500);
  save();

  res.status(201).json(rating);
});

/*
 * القروبات
 */
app.post('/api/groups', auth, (req, res) => {
  const name = String(req.body.name || '').trim();
  const description = String(req.body.description || '').trim();

  if (name.length < 2 || name.length > 80) {
    return res.status(400).json({
      error: 'اسم القروب غير صحيح'
    });
  }

  const group = {
    id: id(),
    name,
    description: description.slice(0, 500),
    ownerId: req.user.id,
    memberIds: [req.user.id],
    status: 'open',
    createdAt: now()
  };

  db.groups.unshift(group);
  save();
  audit('group_created', req.user.id, { groupId: group.id });

  res.status(201).json(getPublicGroup(group));
});

app.post('/api/groups/:id/join', auth, (req, res) => {
  const group = db.groups.find((entry) => entry.id === req.params.id);

  if (!group || group.status !== 'open') {
    return res.status(404).json({
      error: 'القروب غير موجود'
    });
  }

  if (!group.memberIds.includes(req.user.id)) {
    group.memberIds.push(req.user.id);
    save();
    audit('group_joined', req.user.id, { groupId: group.id });
  }

  res.json(getPublicGroup(group));
});

/*
 * الألعاب
 */
app.post('/api/games', auth, (req, res) => {
  const title = String(req.body.title || '').trim();
  const type = ['uno','ludo','baloot','qawsar','custom'].includes(req.body.type) ? req.body.type : 'custom';
  const min = Math.max(1, Math.min(16, Number(req.body.min || 2)));
  const max = Math.max(min, Math.min(16, Number(req.body.max || 4)));
  const visibility = req.body.visibility === 'private' ? 'private' : 'public';

  if (!title || title.length > 100) {
    return res.status(400).json({
      error: 'اسم اللعبة غير صحيح'
    });
  }

  const game = {
    id: id(),
    title,
    type,
    min,
    max,
    visibility,
    state: { phase:'lobby', turn:null, moves:[] },
    playerIds: [req.user.id],
    status: 'waiting',
    createdBy: req.user.id,
    createdAt: now()
  };

  db.games.unshift(game);
  save();
  audit('game_created', req.user.id, { gameId: game.id });

  res.status(201).json(getPublicGame(game));
});

app.post('/api/games/:id/join', auth, (req, res) => {
  const game = db.games.find((entry) => entry.id === req.params.id);

  if (!game || game.status !== 'waiting') {
    return res.status(404).json({
      error: 'جلسة اللعبة غير موجودة'
    });
  }

  if (!game.playerIds.includes(req.user.id)) {
    if (game.playerIds.length >= game.max) {
      return res.status(409).json({
        error: 'الجلسة ممتلئة'
      });
    }

    game.playerIds.push(req.user.id);
  }

  if (game.playerIds.length >= game.max) {
    game.status = 'full';
  }

  save();
  audit('game_joined', req.user.id, { gameId: game.id });

  res.json({
    ...getPublicGame(game),
    botAdded: false
  });
});

app.post('/api/games/:id/leave',auth,(req,res)=>{const g=db.games.find(x=>x.id===req.params.id);if(!g)return res.status(404).json({error:'جلسة اللعبة غير موجودة'});g.playerIds=(g.playerIds||[]).filter(x=>x!==req.user.id);g.status=g.playerIds.length>=g.max?'full':'waiting';if(!g.playerIds.length)g.status='waiting';save();res.json(getPublicGame(g));});
app.get('/api/games/:id',auth,(req,res)=>{const g=db.games.find(x=>x.id===req.params.id);if(!g)return res.status(404).json({error:'اللعبة غير موجودة'});res.json(getPublicGame(g));});
app.post('/api/games/:id/start',auth,(req,res)=>{
 const g=db.games.find(x=>x.id===req.params.id);
 if(!g)return res.status(404).json({error:'اللعبة غير موجودة'});
 if(g.createdBy!==req.user.id&&!['owner','admin'].includes(req.user.role))return res.status(403).json({error:'ليس لديك صلاحية بدء الجلسة'});
 if((g.playerIds||[]).length<g.min)return res.status(409).json({error:'عدد اللاعبين غير كافٍ'});
 g.status='playing';g.state={...(g.state||{}),phase:'playing',turn:g.playerIds[0],moves:g.state?.moves||[]};save();audit('game_started',req.user.id,{gameId:g.id});res.json(getPublicGame(g));
});
app.post('/api/games/:id/move',auth,(req,res)=>{
 const g=db.games.find(x=>x.id===req.params.id);
 if(!g||g.status!=='playing')return res.status(409).json({error:'اللعبة ليست قيد اللعب'});
 if(!(g.playerIds||[]).includes(req.user.id))return res.status(403).json({error:'أنت لست لاعبًا'});
 if(g.state?.turn&&g.state.turn!==req.user.id)return res.status(409).json({error:'ليس دورك الآن'});
 const move=String(req.body.move||'').trim().slice(0,500);if(!move)return res.status(400).json({error:'الحركة غير صالحة'});
 const i=g.playerIds.indexOf(req.user.id),next=g.playerIds[(i+1)%g.playerIds.length];
 g.state={...(g.state||{}),phase:'playing',turn:next,moves:[...(g.state?.moves||[]),{by:req.user.id,move,at:now()}].slice(-200)};
 save();audit('game_move',req.user.id,{gameId:g.id});res.json(getPublicGame(g));
});
/*
 * التقديمات
 */
app.post('/api/applications', (req, res) => {
  const discordUsername = String(req.body.discordUsername || '').trim();
  const discordId = String(req.body.discordId || '').trim();
  const message = String(req.body.message || '').trim();
  const type = String(req.body.type || 'staff').trim();

  if (!discordUsername && !discordId) {
    return res.status(400).json({
      error: 'اكتب اسم Discord أو معرف Discord'
    });
  }

  if (!message) {
    return res.status(400).json({
      error: 'اكتب تفاصيل التقديم'
    });
  }

  const application = {
    id: id(),
    discordUsername,
    discordId,
    message: message.slice(0, 4000),
    type,
    status: 'pending',
    assignedTo: null,
    createdAt: now()
  };

  db.applications.unshift(application);
  save();

  res.status(201).json(application);
});

app.get(
  '/api/admin/applications',
  auth,
  allow('owner', 'admin'),
  (req, res) => {
    const items = db.applications.filter(
      (application) =>
        req.user.role === 'owner' ||
        !application.assignedTo ||
        application.assignedTo === req.user.id
    );

    res.json(items);
  }
);

app.post(
  '/api/admin/applications/:id/claim',
  auth,
  allow('owner', 'admin'),
  (req, res) => {
    const application = db.applications.find(
      (entry) => entry.id === req.params.id
    );

    if (!application) {
      return res.status(404).json({
        error: 'التقديم غير موجود'
      });
    }

    application.assignedTo = req.user.id;
    save();
    audit('application_claimed', req.user.id, {
      applicationId: application.id
    });

    res.json(application);
  }
);

app.post(
  '/api/admin/applications/:id/decision',
  auth,
  allow('owner', 'admin'),
  (req, res) => {
    const application = db.applications.find(
      (entry) => entry.id === req.params.id
    );

    if (!application) {
      return res.status(404).json({
        error: 'التقديم غير موجود'
      });
    }

    const decision = req.body.decision === 'accepted' || req.body.accept === true ? 'accepted' : 'rejected';

    application.status = decision;
    application.decisionBy = req.user.id;
    application.decisionAt = now();
    application.note = String(req.body.note || '').slice(0, 1000);

    save();
    audit('application_decision', req.user.id, {
      applicationId: application.id,
      decision
    });

    res.json(application);
  }
);

/*
 * التذاكر
 */
app.post('/api/tickets', auth, (req, res) => {
  const subject = String(req.body.subject || '').trim();
  const message = String(req.body.message || '').trim();
  const discordId = String(req.body.discordId || '').trim();

  if (!subject || !message) {
    return res.status(400).json({
      error: 'اكتب عنوان التذكرة والرسالة'
    });
  }

  const ticket = {
    id: id(),
    userId: req.user.id,
    username: req.user.username,
    discordId,
    subject: subject.slice(0, 160),
    messages: [
      {
        id: id(),
        authorId: req.user.id,
        author: req.user.username,
        message: message.slice(0, 4000),
        createdAt: now()
      }
    ],
    status: 'open',
    assignedTo: null,
    createdAt: now(),
    updatedAt: now()
  };

  db.tickets.unshift(ticket);
  save();

  res.status(201).json(ticket);
});

app.get(
  '/api/admin/tickets',
  auth,
  allow('owner', 'admin'),
  (req, res) => {
    const tickets = db.tickets.filter(
      (ticket) =>
        req.user.role === 'owner' ||
        !ticket.assignedTo ||
        ticket.assignedTo === req.user.id
    );

    res.json(tickets);
  }
);

app.post(
  '/api/admin/tickets/:id/claim',
  auth,
  allow('owner', 'admin'),
  (req, res) => {
    const ticket = db.tickets.find(
      (entry) => entry.id === req.params.id
    );

    if (!ticket) {
      return res.status(404).json({
        error: 'التذكرة غير موجودة'
      });
    }

    ticket.assignedTo = req.user.id;
    ticket.updatedAt = now();
    save();

    audit('ticket_claimed', req.user.id, {
      ticketId: ticket.id
    });

    res.json(ticket);
  }
);

app.post(
  '/api/admin/tickets/:id/reply',
  auth,
  allow('owner', 'admin'),
  (req, res) => {
    const ticket = db.tickets.find(
      (entry) => entry.id === req.params.id
    );

    const message = String(req.body.message || '').trim();

    if (!ticket) {
      return res.status(404).json({
        error: 'التذكرة غير موجودة'
      });
    }

    if (!message) {
      return res.status(400).json({
        error: 'اكتب الرد'
      });
    }

    ticket.messages.push({
      id: id(),
      authorId: req.user.id,
      author: req.user.username,
      message: message.slice(0, 4000),
      createdAt: now()
    });

    ticket.updatedAt = now();
    save();

    res.json(ticket);
  }
);

app.post(
  '/api/admin/tickets/:id/close',
  auth,
  allow('owner', 'admin'),
  (req, res) => {
    const ticket = db.tickets.find(
      (entry) => entry.id === req.params.id
    );

    if (!ticket) {
      return res.status(404).json({
        error: 'التذكرة غير موجودة'
      });
    }

    ticket.status = 'closed';
    ticket.closedBy = req.user.id;
    ticket.closedAt = now();
    ticket.updatedAt = now();

    save();
    audit('ticket_closed', req.user.id, {
      ticketId: ticket.id
    });

    res.json(ticket);
  }
);

/*
 * الرسائل الخاصة.
 * المحتوى لا يظهر في لوقات الإداريين العادية.
 */
app.post('/api/private-messages', auth, (req,res)=>{
  const recipientId=String(req.body.recipientId||'').trim(), message=String(req.body.message||'').trim(), title=String(req.body.title||'رسالة خاصة').trim();
  if(!recipientId||!message)return res.status(400).json({error:'حدد المستلم واكتب الرسالة'});
  if(recipientId===req.user.id)return res.status(400).json({error:'لا يمكنك مراسلة نفسك'});
  let recipient=getUser(recipientId);
  if(!recipient) recipient=db.users.find(u=>u.username.toLowerCase()===recipientId.toLowerCase());
  if(!recipient) return res.status(404).json({error:'المستلم غير موجود'});
  recipientId=recipient.id;
  const item={id:id(),recipientId,senderId:req.user.id,senderUsername:req.user.username,recipientUsername:recipient.username,title:title.slice(0,120),message:message.slice(0,4000),createdAt:now(),readAt:null};
  db.privateMessages.unshift(item); db.privateMessages=db.privateMessages.slice(0,5000);
  if(!Array.isArray(db.notifications)) db.notifications=[];
  db.notifications.unshift({id:id(),userId:recipientId,type:'private',messageId:item.id,read:false,createdAt:now()});
  db.notifications=db.notifications.slice(0,5000); save();audit('private_message_sent',req.user.id,{messageId:item.id,recipientId});
  res.status(201).json({id:item.id,title:item.title,createdAt:item.createdAt});
});
app.get('/api/private-messages',auth,(req,res)=>res.json(db.privateMessages.filter(m=>m.senderId===req.user.id||m.recipientId===req.user.id).slice(0,200)));
app.post('/api/private-messages/:id/read',auth,(req,res)=>{const m=db.privateMessages.find(x=>x.id===req.params.id);if(!m||m.recipientId!==req.user.id)return res.status(404).json({error:'الرسالة غير موجودة'});m.readAt=now();save();res.json({ok:true});});
app.post('/api/anonymous-messages',optionalAuth,(req,res)=>{
  let recipientId=String(req.body.recipientId||'').trim();
  let recipientName=String(req.body.recipientName||'').trim();
  const message=String(req.body.message||'').trim();
  if(!message||message.length>4000)return res.status(400).json({error:'اكتب الرسالة بشكل صحيح'});
  if(!recipientId&&!recipientName)return res.status(400).json({error:'حدد المستلم'});
  if(!recipientId && recipientName){
    const found=db.users.find(u=>u.username.toLowerCase()===recipientName.toLowerCase());
    if(found) recipientId=found.id;
  } else if(recipientId){
    const found=db.users.find(u=>u.id===recipientId || u.username.toLowerCase()===recipientId.toLowerCase());
    if(found){ recipientId=found.id; recipientName=found.username; }
  }
  if(!recipientId)return res.status(404).json({error:'المستلم غير موجود'});
  const item={id:id(),recipientId,recipientName:recipientName.slice(0,120),message:message.slice(0,4000),senderId:req.user?.id||null,senderUsername:req.user?.username||null,createdAt:now(),readAt:null,status:'sent'};
  if(!Array.isArray(db.anonymousMessages)) db.anonymousMessages=[];
  db.anonymousMessages.unshift(item); db.anonymousMessages=db.anonymousMessages.slice(0,5000);
  if(item.recipientId){ if(!Array.isArray(db.notifications)) db.notifications=[]; db.notifications.unshift({id:id(),userId:item.recipientId,type:'anonymous',messageId:item.id,read:false,createdAt:now()}); }
  db.notifications=db.notifications.slice(0,5000);
  item.status='queued';
  save();
  audit('anonymous_message_sent',req.user?.id||null,{messageId:item.id,recipientId:item.recipientId});
  try {
    if (globalThis.mldDiscord?.sendDM) {
      await globalThis.mldDiscord.sendDM(recipientId, `📨 رسالة مجهولة عبر ملاذ\\n\\n${item.message}`);
      item.status='delivered';
      item.deliveredAt=now();
    } else {
      item.status='stored';
      item.deliveryError='Discord bot unavailable';
    }
  } catch (error) {
    item.status='stored';
    item.deliveryError=String(error?.message||error).slice(0,500);
    console.warn('[anonymous] Discord DM failed:', item.deliveryError);
  }
  save();
  res.status(201).json({id:item.id,createdAt:item.createdAt,status:item.status});
});
app.get('/api/anonymous-messages',auth,(req,res)=>res.json(db.anonymousMessages.filter(m=>m.recipientId===req.user.id||(m.recipientName&&m.recipientName.toLowerCase()===req.user.username.toLowerCase())).map(m=>({id:m.id,recipientName:m.recipientName,message:m.message,createdAt:m.createdAt,readAt:m.readAt})).slice(0,200)));
app.get('/api/notifications',auth,(req,res)=>{
  const items=(db.notifications||[]).filter(n=>n.userId===req.user.id).slice(0,100);
  res.json({items,unread:items.filter(n=>!n.read).length});
});
app.post('/api/notifications/read-all',auth,(req,res)=>{
  for(const n of (db.notifications||[])) if(n.userId===req.user.id) n.read=true;
  save(); res.json({ok:true});
});
app.get('/api/owner/private-messages',auth,allow('owner'),(req,res)=>res.json(db.privateMessages));
app.get('/api/owner/anonymous-messages',auth,allow('owner'),(req,res)=>res.json(db.anonymousMessages));
app.get('/api/owner/logs',auth,allow('owner'),(req,res)=>res.json(db.logs));

/*
 * إدارة الإداريين
 */
app.get(
  '/api/owner/admins',
  auth,
  allow('owner'),
  (req, res) => {
    res.json(
      db.users
        .filter((user) => user.role === 'admin')
        .map(safeUser)
    );
  }
);

app.post(
  '/api/owner/admins',
  auth,
  allow('owner'),
  (req, res) => {
    const username = String(req.body.username || '').trim();

    const user = db.users.find(
      (entry) => entry.username.toLowerCase() === username.toLowerCase()
    );

    if (!user) {
      return res.status(404).json({
        error: 'المستخدم غير موجود'
      });
    }

    user.role = 'admin';
    save();

    audit('admin_added', req.user.id, {
      userId: user.id
    });

    res.json(safeUser(user));
  }
);

app.delete(
  '/api/owner/admins/:id',
  auth,
  allow('owner'),
  (req, res) => {
    const user = getUser(req.params.id);

    if (!user || user.role !== 'admin') {
      return res.status(404).json({
        error: 'الإداري غير موجود'
      });
    }

    user.role = 'user';
    save();

    audit('admin_removed', req.user.id, {
      userId: user.id
    });

    res.json({
      ok: true
    });
  }
);

app.get('/api/admin/users',auth,allow('owner','admin'),(req,res)=>res.json({users:db.users.filter(u=>u.role!=='system').map(safeUser)}));
app.get('/api/admin/stats',auth,allow('owner','admin'),(req,res)=>res.json({
  users:db.users.length,groups:db.groups.length,games:db.games.length,ratings:db.ratings.length,
  tickets:db.tickets.length,applications:db.applications.length,privateMessages:db.privateMessages.length,
  anonymousMessages:(db.anonymousMessages||[]).length,visits:db.stats.visits
}));
app.get(
  '/api/admin/logs',
  auth,
  allow('owner', 'admin'),
  (req, res) => {
    const logs = req.user.role === 'owner'
      ? db.logs
      : db.logs.filter((entry) => entry.visibility === 'admin');

    res.json(logs);
  }
);

/*
 * السينما
 *
 * يعرض:
 * 1. العناصر المحفوظة داخل store.json.
 * 2. عناصر عامة من Internet Archive عند طلب refresh=1.
 */
app.get('/api/cinema/catalog', async (req, res) => {
  const shouldRefresh = req.query.refresh === '1';

  let items = db.cinemaCatalog;

  if (shouldRefresh || !archiveCache.items.length) {
    const archiveItems = await getArchiveCatalog();

    if (archiveItems.length) {
      const known = new Map(
        db.cinemaCatalog.map((item) => [item.id, item])
      );

      for (const item of archiveItems) {
        known.set(item.id, item);
      }

      items = Array.from(known.values()).slice(0, 500);
    }
  }

  const query = String(req.query.q || '').trim().toLowerCase();
  const genre = String(req.query.genre || '').trim().toLowerCase();

  if (query) {
    items = items.filter((item) =>
      [
        item.title,
        item.titleAr,
        item.description,
        item.genre,
        item.provider
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query)
    );
  }

  if (genre) {
    items = items.filter(
      (item) => String(item.genre || '').toLowerCase() === genre
    );
  }

  res.json({
    items,
    total: items.length,
    source: 'Internet Archive and configured public-domain catalog'
  });
});

app.get('/api/cinema/categories', async (req, res) => {
  const archiveItems = await getArchiveCatalog();
  const allItems = [...db.cinemaCatalog, ...archiveItems];

  const categories = Array.from(
    new Set(allItems.map((item) => item.genre).filter(Boolean))
  );

  res.json({
    categories
  });
});

app.post('/api/cinema/sessions', auth, (req, res) => {
  const itemId = String(req.body.itemId || '').trim();
  const channelId = String(req.body.channelId || '').trim();

  if (!itemId || !channelId) {
    return res.status(400).json({
      error: 'يجب تحديد المحتوى وروم الصوت'
    });
  }

  const allItems = [
    ...db.cinemaCatalog,
    ...(archiveCache.items || [])
  ];

  const item = allItems.find((entry) => entry.id === itemId);

  if (!item) {
    return res.status(404).json({
      error: 'المحتوى غير موجود'
    });
  }

  const request = {
    id: id(),
    itemId,
    title: item.title,
    sourceUrl: item.sourceUrl,
    channelId,
    requestedBy: req.user.id,
    status: 'queued',
    createdAt: now()
  };

  db.cinemaRequests.unshift(request);
  save();

  audit('cinema_requested', req.user.id, {
    requestId: request.id,
    itemId,
    channelId
  });

  res.status(201).json(request);
});

app.get(
  '/api/admin/cinema/sessions',
  auth,
  allow('owner', 'admin'),
  (req, res) => {
    res.json(db.cinemaRequests);
  }
);

/*
 * التحميل.
 * يتم تسجيل الطلب فقط، ولا يتم تجاوز حماية المنصات أو تنزيل محتوى محمي.
 */
app.post('/api/control/downloads', auth, (req, res) => {
  const url = String(req.body.url || '').trim();
  const format = String(req.body.format || 'video').trim();

  if (!url || !/^https?:\/\//i.test(url)) {
    return res.status(400).json({
      error: 'الرابط غير صحيح'
    });
  }

  const request = {
    id: id(),
    url,
    format: format === 'audio' ? 'audio' : 'video',
    requestedBy: req.user.id,
    status: 'queued',
    createdAt: now()
  };

  db.downloadRequests.unshift(request);
  save();

  audit('download_requested', req.user.id, {
    requestId: request.id,
    format: request.format
  });

  res.status(201).json(request);
});

app.get(
  '/api/admin/downloads',
  auth,
  allow('owner', 'admin'),
  (req, res) => {
    res.json(db.downloadRequests);
  }
);

/*
 * الحالة العامة
 */
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    at: now(),
    botsLoaded: Boolean(globalThis.mldDiscord?.clients),
    cinemaItems: db.cinemaCatalog.length,
    pendingCinemaRequests: db.cinemaRequests.length,
    pendingDownloadRequests: db.downloadRequests.length
  });
});

/*
 * يجب أن يكون هذا المسار آخر مسار.
 */
app.get('*', (req, res) => {
  res.sendFile(path.join(root, 'public', 'index.html'));
});

const port = Number(process.env.PORT || 3000);

app.listen(port, () => {
  console.log(`MLD platform running on port ${port}`);
});