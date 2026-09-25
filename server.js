let token = localStorage.getItem('token');
let me = null;

const $ = (selector) => document.querySelector(selector);
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#039;'
}[char]));

function toast(message) {
  const node = document.createElement('div');
  node.className = 'toast';
  node.textContent = message;
  document.body.appendChild(node);
  setTimeout(() => node.remove(), 3500);
}

async function api(url, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const finalOptions = { ...options, headers };
  if (token) finalOptions.headers.Authorization = 'Bearer ' + token;

  const res = await fetch('/api' + url, finalOptions);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'حدث خطأ غير متوقع');
  return data;
}

function openAuth(type) {
  $('#modalBody').innerHTML = `
    <h2>${type === 'login' ? 'تسجيل الدخول' : 'إنشاء حساب'}</h2>
    <p style="color:#8993ad;font-size:12px">${type === 'login' ? 'أهلاً بعودتك إلى مجتمعك' : 'أنشئ حسابك خلال ثواني'}</p>
    <input id="username" placeholder="اسم المستخدم" />
    <input id="password" type="password" placeholder="الرمز السري" />
    <button class="btn" style="width:100%;margin-top:10px" onclick="submitAuth('${type}')">${type === 'login' ? 'دخول' : 'إنشاء الحساب'}</button>
    <p onclick="openAuth('${type === 'login' ? 'register' : 'login'}')" style="color:#a78bfa;text-align:center;font-size:11px;cursor:pointer">
      ${type === 'login' ? 'ما عندك حساب؟ إنشاء حساب' : 'عندك حساب؟ تسجيل الدخول'}
    </p>
  `;
  $('#modal').classList.add('open');
}

function closeModal() {
  $('#modal').classList.remove('open');
}

async function submitAuth(type) {
  try {
    const data = await api('/auth/' + (type === 'login' ? 'login' : 'register'), {
      method: 'POST',
      body: JSON.stringify({
        username: $('#username').value,
        password: $('#password').value
      })
    });

    token = data.token;
    me = data.user;
    localStorage.setItem('token', token);
    closeModal();
    renderAuth();
    toast('تم الدخول بنجاح');
  } catch (error) {
    toast(error.message);
  }
}

function renderAuth() {
  if (!me) {
    $('#authNav').innerHTML = `
      <button class="btn ghost" onclick="openAuth('login')">دخول</button>
      <button class="btn" onclick="openAuth('register')">إنشاء حساب</button>
    `;
    $('#authSide').innerHTML = '';
    return;
  }

  $('#authNav').innerHTML = `
    <span class="liveDot">${esc(me.username)} · ${me.points} نقطة</span>
    <button class="btn ghost" onclick="logout()">خروج</button>
  `;

  $('#authSide').innerHTML = `
    <a class="supportSide" href="#" onclick="logout()">⇥ <span>تسجيل الخروج</span></a>
  `;
}

function logout() {
  token = null;
  me = null;
  localStorage.removeItem('token');
  renderAuth();
  location.reload();
}

function requireLogin(callback) {
  if (!token) return openAuth('login');
  callback();
}

const movies = [
  ['مغامرة في المجهول', '#352766'],
  ['ليلة المدينة', '#244d67'],
  ['رحلة النجوم', '#63294e'],
  ['The Last Game', '#344d39'],
  ['عالم آخر', '#6b4224']
];

function renderMovies() {
  const el = $('#movieList');
  el.innerHTML = movies.map(([title, color], index) => `
    <div class="movie" style="--movie:linear-gradient(135deg,${color},#101321)">
      <b>${esc(title)}</b>
      <small>${index % 2 ? 'مسلسل' : 'فيلم'} · 2026</small>
      <button class="btn" style="margin-top:7px;padding:5px;font-size:10px" onclick="openCinema('${esc(title)}')">اختيار الفيلم</button>
    </div>
  `).join('');
}

function openCinema(movie = '') {
  if (!token) return openAuth('login');

  $('#modalBody').innerHTML = `
    <h2>جلسة السينما</h2>
    <p style="color:#8993ad;font-size:12px">${movie ? `الفيلم المختار: <b>${esc(movie)}</b>` : 'اختار المحتوى المصرح به'}</p>
    <select id="cinemaRoom">
      <option>الروم العام — متصل</option>
      <option>غرفة الأصدقاء — متصل</option>
      <option>الروم الهادئ — متصل</option>
    </select>
    <input id="cinemaSource" placeholder="رابط المصدر المصرح به" />
    <button class="btn" style="width:100%;margin-top:10px" onclick="startCinema('${esc(movie || '')}')">دخول البوت للروم</button>
  `;

  $('#modal').classList.add('open');
}

async function startCinema(movie) {
  try {
    await api('/cinema/sessions', {
      method: 'POST',
      body: JSON.stringify({
        movie: movie || 'فيلم مختار',
        roomId: $('#cinemaRoom').value,
        source: $('#cinemaSource').value
      })
    });

    closeModal();
    toast('تم إرسال طلب السينما للبوت');
  } catch (error) {
    toast(error.message);
  }
}

async function startDownload() {
  const url = $('#downloadUrl').value.trim();
  if (!url) return toast('الصق الرابط أولاً');

  try {
    const result = await api('/control/downloads', {
      method: 'POST',
      body: JSON.stringify({
        url,
        quality: $('#downloadQuality').value
      })
    });
    toast(result.message || 'تمت الإضافة للطلب');
  } catch (error) {
    toast(error.message);
  }
}

async function createGame() {
  const title = prompt('اسم اللعبة أو الجلسة', 'أونو');
  if (!title) return;

  try {
    await api('/games', {
      method: 'POST',
      body: JSON.stringify({ title, min: 2, max: 4, visibility: 'public' })
    });
    toast('تم إنشاء الجلسة');
    load();
  } catch (error) {
    toast(error.message);
  }
}

async function createGroup() {
  const name = prompt('اسم القروب');
  if (!name) return;

  const description = prompt('وصف القروب', 'قروب أصدقاء');

  try {
    await api('/groups', {
      method: 'POST',
      body: JSON.stringify({ name, description })
    });
    toast('تم إنشاء القروب');
    load();
  } catch (error) {
    toast(error.message);
  }
}

async function joinGroup(id) {
  try {
    await api('/groups/' + id + '/join', { method: 'POST' });
    toast('تم إرسال طلبك للمالك');
  } catch (error) {
    toast(error.message);
  }
}

async function joinGame(id) {
  try {
    await api('/games/' + id + '/join', { method: 'POST' });
    toast('انضممت للجلسة');
    load();
  } catch (error) {
    toast(error.message);
  }
}

async function rate() {
  const value = prompt('التقييم من 1 إلى 5', '5');
  const text = prompt('اكتب رأيك', 'منصة رائعة');
  if (!value) return;

  try {
    await api('/ratings', {
      method: 'POST',
      body: JSON.stringify({ value, text })
    });
    toast('شكراً لك');
    load();
  } catch (error) {
    toast(error.message);
  }
}

function renderMembers() {
  const names = ['w4px', 'زاجل', 'M7MD', 'Layan', 'Faisal', 'Rakan', 'Sultan', 'Noura'];
  $('#onlineCount').textContent = names.length;
  $('#membersMetric').textContent = names.length;
  $('#memberList').innerHTML = names.map((name) => `
    <div class="member">
      <span class="memberAvatar">${esc(name[0] || '•')}</span>
      <b>${esc(name)}</b>
      <i></i>
    </div>
  `).join('');
}

async function load() {
  try {
    if (token) {
      const session = await api('/me');
      me = session.user;
      renderAuth();
    } else {
      me = null;
      renderAuth();
    }
  } catch (error) {
    token = null;
    localStorage.removeItem('token');
    me = null;
    renderAuth();
  }

  try {
    await api('/visit', { method: 'POST' });
    const data = await api('/public');

    $('#visits').textContent = data.visits;

    $('#gamesList').innerHTML = data.games.length
      ? data.games.map((game) => `
          <div class="card">
            <span class="eyebrow">${game.visibility === 'private' ? '🔒 خاص' : '● عام'}</span>
            <h3>🎮 ${esc(game.title)}</h3>
            <p>اللاعبون ${game.players.length}/${game.max} · الحد الأدنى ${game.min}</p>
            <button class="btn" onclick="joinGame('${game.id}')">انضمام</button>
          </div>
        `).join('')
      : '<div class="card"><h3>ابدأ أول جلسة</h3><p>كن أول من يفتح لعبة للمجتمع.</p></div>';

    $('#groupsList').innerHTML = data.groups.length
      ? data.groups.map((group) => `
          <div class="card">
            <span class="eyebrow">👥 ${group.members.length} أعضاء</span>
            <h3>${esc(group.name)}</h3>
            <p>${esc(group.description || 'قروب جديد')}</p>
            <p>${group.members.map((member) => esc(member)).join(' · ') || 'لا يوجد أعضاء بعد'}</p>
            <button class="btn" onclick="joinGroup('${group.id}')">طلب انضمام</button>
          </div>
        `).join('')
      : '<div class="card"><h3>لا توجد قروبات بعد</h3><p>أنشئ أول قروب للمجتمع.</p></div>';

    $('#ratings').innerHTML = data.ratings.length
      ? data.ratings.slice(0, 4).map((rating) => `<p>★★★★★<br>${esc(rating.text || 'تجربة رائعة')}</p>`).join('')
      : '<p>كن أول من يقيّم المنصة</p>';

    $('#sessionsMetric').textContent = data.games.length;
  } catch (error) {
    toast(error.message);
  }

  renderMovies();
  renderMembers();
}

document.querySelector('.mobileMenu')?.addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('open');
});

load();
