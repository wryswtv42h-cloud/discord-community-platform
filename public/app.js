const DEFAULT_CONFIG = {
  name: 'ملاذ',
  owner: 'فهد المطيري',
  avatar: '/server-avatar.svg',
  banner: '/server-banner.svg',
  welcome: 'حياكم الله في ملاذ — مجتمعكم الآمن للعب والتجمع والاستمتاع.'
};

const state = {
  token: localStorage.getItem('token') || '',
  me: null,
  publicData: null,
  memberQuery: ''
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }[char]));
}

function getConfig() {
  return { ...DEFAULT_CONFIG, ...(window.SITE_CONFIG || {}) };
}

function renderConfig() {
  const cfg = getConfig();
  document.title = `${cfg.name} | Community Hub`;
  $('#serverName').textContent = cfg.name;
  $('#serverWelcome').textContent = cfg.welcome;
  $('#heroOwner').textContent = `المنشئ: ${cfg.owner}`;
  const avatar = $('#serverAvatar');
  if (avatar) avatar.src = cfg.avatar || DEFAULT_CONFIG.avatar;
  const hero = $('.heroShell');
  if (hero) hero.style.background = `linear-gradient(180deg, rgba(10,12,20,0.35), rgba(10,12,20,0.7)), url("${cfg.banner || DEFAULT_CONFIG.banner}") center/cover no-repeat`;
}

async function api(path, options = {}) {
  const headers = {
    Accept: 'application/json',
    ...(options.headers || {})
  };

  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  if (state.token) {
    headers.Authorization = `Bearer ${state.token}`;
  }

  const response = await fetch(`/api${path}`, {
    ...options,
    headers,
    body: options.body && !(options.body instanceof FormData) ? JSON.stringify(options.body) : options.body
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'حدث خطأ أثناء العملية');
  }
  return data;
}

function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'emptyState';
  toast.style.position = 'fixed';
  toast.style.bottom = '24px';
  toast.style.left = '50%';
  toast.style.transform = 'translateX(-50%)';
  toast.style.zIndex = '120';
  toast.style.padding = '12px 18px';
  toast.style.background = 'rgba(14, 20, 28, 0.94)';
  toast.style.borderColor = 'rgba(255,255,255,0.12)';
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2400);
}

function toggleSidebar(force) {
  const sidebar = $('#sidebar');
  const main = $('#main');
  if (typeof force === 'boolean') {
    sidebar.classList.toggle('open', force);
    main.classList.toggle('expanded', force);
    return;
  }
  const shouldOpen = !sidebar.classList.contains('open');
  sidebar.classList.toggle('open', shouldOpen);
  main.classList.toggle('expanded', shouldOpen);
}

function renderAuth() {
  const authNav = $('#authNav');
  if (!state.me) {
    authNav.innerHTML = `
      <button class="btn ghost" type="button" data-auth="login">دخول</button>
      <button class="btn" type="button" data-auth="register">إنشاء حساب</button>
    `;
    $('#sidebarAuthLink').innerHTML = '<span>🔐</span><span>تسجيل الدخول</span>';
    return;
  }

  authNav.innerHTML = `
    <span class="liveDot">${escapeHtml(state.me.username)} · ${state.me.points || 0} نقاط</span>
    <button class="btn ghost" type="button" id="logoutBtn">خروج</button>
  `;

  $('#sidebarAuthLink').innerHTML = '<span>👤</span><span>' + escapeHtml(state.me.username) + '</span>';
  $('#logoutBtn')?.addEventListener('click', logout);
  $$('[data-auth]').forEach((el) => el.onclick = null);
}

function openModal(content) {
  const modal = $('#authModal');
  $('#modalContent').innerHTML = content;
  modal.classList.add('open');
}

function closeModal() {
  $('#authModal').classList.remove('open');
}

function openAuth(mode = 'login') {
  const isLogin = mode === 'login';
  openModal(`
    <form class="modalForm" id="authForm">
      <h2>${isLogin ? 'تسجيل الدخول' : 'إنشاء حساب'}</h2>
      <p class="subtext">${isLogin ? 'أدخل بياناتك للدخول إلى القروبات والألعاب.' : 'أنشئ حسابك الآن للانضمام إلى المجتمع.'}</p>
      <input id="authUser" type="text" placeholder="اسم المستخدم" required />
      <input id="authPass" type="password" placeholder="كلمة المرور" required />
      <button class="btn" type="submit">${isLogin ? 'دخول' : 'إنشاء الحساب'}</button>
      <div class="switchLink" data-auth-switch="${isLogin ? 'register' : 'login'}">${isLogin ? 'مستخدم جديد؟ إنشاء حساب' : 'لديك حساب؟ تسجيل الدخول'}</div>
    </form>
  `);

  $('#authForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const username = $('#authUser').value.trim();
    const password = $('#authPass').value;

    try {
      const result = await api(`/auth/${mode}`, { method: 'POST', body: { username, password } });
      state.token = result.token;
      state.me = result.user;
      localStorage.setItem('token', result.token);
      renderAuth();
      closeModal();
      if (window.location.hash === '#games' || window.location.hash === '#groups') {
        loadPublicData();
      }
      showToast('تم تسجيل الدخول بنجاح');
    } catch (error) {
      showToast(error.message);
    }
  });

  $('[data-auth-switch]')?.addEventListener('click', () => openAuth($('[data-auth-switch]').dataset.authSwitch));
}

function logout() {
  state.token = '';
  state.me = null;
  localStorage.removeItem('token');
  renderAuth();
  loadPublicData();
}

function renderMemberList(items = []) {
  const list = $('#memberList');
  if (!list) return;
  const query = state.memberQuery.trim().toLowerCase();
  const filtered = items.filter((name) => name.toLowerCase().includes(query)).slice(0, 10);

  if (!filtered.length) {
    list.innerHTML = '<div class="emptyState">لا توجد نتائج لهذا البحث</div>';
    return;
  }

  list.innerHTML = filtered.map((name) => `
    <div class="memberCard">
      <div class="memberAvatar">${escapeHtml(String(name).charAt(0).toUpperCase())}</div>
      <div class="memberText">
        <b>${escapeHtml(name)}</b>
        <small>عضو متصل</small>
      </div>
      <span class="memberStatus">●</span>
    </div>
  `).join('');
}

function renderGroups(groups = []) {
  const list = $('#groupsList');
  if (!list) return;
  if (!groups.length) {
    list.innerHTML = '<div class="emptyState">لا توجد قروبات بعد</div>';
    return;
  }

  list.innerHTML = groups.map((group) => {
    const members = Array.isArray(group.members) ? group.members : [];
    return `
      <div class="groupCard">
        <span class="cardPill">👥 ${members.length} عضو</span>
        <h3>${escapeHtml(group.name)}</h3>
        <p>${escapeHtml(group.description || 'قروب جديد في المجتمع')}</p>
        <div class="cardMeta">
          ${members.slice(0, 3).map((user) => `<span>${escapeHtml(user)}</span>`).join('') || '<span>لا يوجد أعضاء</span>'}
        </div>
        <div class="cardActions">
          <button class="btn" type="button" data-group-join="${group.id}">طلب انضمام</button>
          <button class="btn ghost" type="button" data-group-view="${group.id}">تفاصيل</button>
        </div>
      </div>
    `;
  }).join('');

  $$('[data-group-join]').forEach((button) => {
    button.addEventListener('click', () => joinGroup(button.dataset.groupJoin));
  });

  $$('[data-group-view]').forEach((button) => {
    button.addEventListener('click', () => viewGroup(button.dataset.groupView));
  });
}

function renderGames(games = []) {
  const list = $('#gamesList');
  if (!list) return;
  if (!games.length) {
    list.innerHTML = '<div class="emptyState">لا توجد ألعاب الآن</div>';
    return;
  }

  list.innerHTML = games.map((game) => {
    const playerCount = Array.isArray(game.players) ? game.players.length : 0;
    const canJoin = playerCount < (game.max || 4);
    return `
      <div class="gameCard">
        <span class="cardPill">🎮 ${game.visibility === 'private' ? 'خاص' : 'عام'}</span>
        <h3>${escapeHtml(game.title)}</h3>
        <p>اللاعبون ${playerCount}/${game.max || 4} · الحد الأدنى ${game.min || 2}</p>
        <div class="cardMeta">
          ${Array.isArray(game.players) ? game.players.slice(0, 2).map((u) => `<span>${escapeHtml(u)}</span>`).join('') : '<span>لا يوجد لاعبين</span>'}
        </div>
        <div class="cardActions">
          <button class="btn" type="button" data-game-join="${game.id}">${canJoin ? 'انضمام' : 'ممتلئة'}</button>
        </div>
      </div>
    `;
  }).join('');

  $$('[data-game-join]').forEach((button) => {
    button.disabled = !button.textContent.includes('انضمام');
    button.addEventListener('click', () => joinGame(button.dataset.gameJoin));
  });
}

function renderRatings(ratings = []) {
  const list = $('#ratingsList');
  if (!list) return;
  if (!ratings.length) {
    list.innerHTML = '<div class="emptyState">لا توجد تقييمات حتى الآن</div>';
    return;
  }

  list.innerHTML = ratings.slice(0, 6).map((rating) => `
    <div class="ratingCard">
      <div class="ratingStars">${'★'.repeat(Number(rating.value || 5))}${'☆'.repeat(5 - Number(rating.value || 5))}</div>
      <p>${escapeHtml(rating.text || 'تجربة رائعة!')}</p>
      <div class="cardMeta">
        <span>${escapeHtml(rating.user || 'مستخدم')}</span>
      </div>
    </div>
  `).join('');
}

function renderLeaderboard(games = []) {
  const list = $('#leaderboardList');
  if (!list) return;

  const top = [
    { name: 'قمة الأبطال', score: 98 },
    { name: 'مستوى القسام', score: 94 },
    { name: 'السرعة', score: 92 },
    { name: 'المتنوع', score: 89 }
  ];

  list.innerHTML = top.map((entry, index) => `
    <div class="leaderCard">
      <div>
        <span class="cardPill">#${index + 1}</span>
        <h3>${escapeHtml(entry.name)}</h3>
      </div>
      <strong>${entry.score}</strong>
    </div>
  `).join('');
}

async function addRating() {
  if (!state.token) return openAuth('login');
  const text = prompt('اكتب تقييمك عن السيرفر', 'موقع ممتاز وواجهة قوية!');
  if (text === null) return;
  const value = Number(prompt('التقييم من 1 إلى 5', '5'));
  if (!value || value < 1 || value > 5) {
    showToast('التقييم يجب أن يكون بين 1 و 5');
    return;
  }

  try {
    await api('/ratings', { method: 'POST', body: { value, text } });
    showToast('تم إرسال التقييم');
    await loadPublicData();
  } catch (error) {
    showToast(error.message);
  }
}

async function createGroup() {
  if (!state.token) return openAuth('login');
  const name = prompt('اسم القروب', 'قروب جديد');
  if (!name) return;
  const description = prompt('وصف القروب', 'مجتمع مميز للتفاعل');
  if (description === null) return;

  try {
    await api('/groups', { method: 'POST', body: { name, description } });
    showToast('تم إنشاء القروب');
    await loadPublicData();
  } catch (error) {
    showToast(error.message);
  }
}

async function createGame() {
  if (!state.token) return openAuth('login');
  const title = prompt('اسم اللعبة', 'جلسة جديدة');
  if (!title) return;
  const min = Number(prompt('الحد الأدنى للعب', '2')) || 2;
  const max = Number(prompt('الحد الأقصى للعب', '4')) || 4;

  try {
    await api('/games', { method: 'POST', body: { title, min, max, visibility: 'public' } });
    showToast('تم فتح الجلسة');
    await loadPublicData();
  } catch (error) {
    showToast(error.message);
  }
}

async function joinGroup(groupId) {
  if (!state.token) return openAuth('login');
  try {
    await api(`/groups/${groupId}/join`, { method: 'POST' });
    showToast('تم إرسال طلب الانضمام');
    closeModal();
    await loadPublicData();
  } catch (error) {
    showToast(error.message);
  }
}

async function joinGame(gameId) {
  if (!state.token) return openAuth('login');
  try {
    const result = await api(`/games/${gameId}/join`, { method: 'POST' });
    showToast(result.botAdded ? 'لعبت مع البوت لأن الجلسة لم تكتمل' : 'تم الانضمام للجلسة');
    await loadPublicData();
  } catch (error) {
    showToast(error.message);
  }
}

function viewGroup(groupId) {
  const groups = state.publicData?.groups || [];
  const group = groups.find((entry) => entry.id === groupId);
  if (!group) return;

  const members = Array.isArray(group.members) ? group.members : [];
  openModal(`
    <div class="modalForm">
      <h2>${escapeHtml(group.name)}</h2>
      <p class="subtext">${escapeHtml(group.description || 'قروب جديد في المجتمع')}</p>
      <div class="cardMeta">
        <span>الأعضاء: ${members.length}</span>
      </div>
      <div class="memberGrid">
        ${members.length ? members.map((member) => `
          <div class="memberCard">
            <div class="memberAvatar">${escapeHtml(String(member).charAt(0).toUpperCase())}</div>
            <div class="memberText">
              <b>${escapeHtml(member)}</b>
              <small>عضو</small>
            </div>
          </div>
        `).join('') : '<div class="emptyState">لا يوجد أعضاء</div>'}
      </div>
      <button class="btn" type="button" data-group-join-modal="${group.id}">طلب انضمام</button>
    </div>
  `);

  const joinBtn = $('[data-group-join-modal]');
  if (joinBtn) joinBtn.addEventListener('click', () => joinGroup(group.id));
}

async function loadPublicData() {
  try {
    if (state.token) {
      state.me = (await api('/me')).user;
    }

    await api('/visit', { method: 'POST' });
    const data = await api('/public');
    state.publicData = data;

    $('#visitCount').textContent = data.visits || 0;
    $('#heroVisits').textContent = `◈ ${data.visits || 0} زيارات`;
    $('#memberCount').textContent = (data.onlineMembers || []).length;
    $('#heroOnline').textContent = `● ${(data.onlineMembers || []).length} أعضاء متصلين`;
    $('#groupsCount').textContent = (data.groups || []).length;
    $('#gamesCount').textContent = (data.games || []).length;

    renderMemberList(data.onlineMembers || []);
    renderGroups(data.groups || []);
    renderGames(data.games || []);
    renderRatings(data.ratings || []);
    renderLeaderboard(data.games || []);
    renderAuth();
  } catch (error) {
    showToast(error.message);
  }
}

function bindEvents() {
  $('#searchMemberBtn').addEventListener('click', () => {
    state.memberQuery = $('#memberSearchInput').value;
    renderMemberList(state.publicData?.onlineMembers || []);
  });

  $('#memberSearchInput').addEventListener('input', (event) => {
    state.memberQuery = event.target.value;
    renderMemberList(state.publicData?.onlineMembers || []);
  });

  $('#newGroupBtn').addEventListener('click', createGroup);
  $('#createGroupBtn').addEventListener('click', createGroup);
  $('#newGameBtn').addEventListener('click', createGame);
  $('#addRatingBtn').addEventListener('click', addRating);

  $('#closeModalBtn').addEventListener('click', closeModal);
  $('#authModal').addEventListener('click', (event) => {
    if (event.target === $('#authModal')) closeModal();
  });

  $$('[data-auth]').forEach((element) => {
    element.addEventListener('click', () => openAuth(element.dataset.auth));
  });

  $('.mobileMenu').addEventListener('click', () => {
    if (window.innerWidth <= 900) {
      toggleSidebar();
    } else {
      const sidebar = $('#sidebar');
      const main = $('#main');
      sidebar.classList.toggle('collapsed');
      main.classList.toggle('expanded');
    }
  });

  $$('nav a').forEach((link) => {
    link.addEventListener('click', () => {
      $$('nav a').forEach((item) => item.classList.remove('active'));
      link.classList.add('active');
      if (window.innerWidth <= 900) toggleSidebar(false);
    });
  });

  $('#sidebarAuthLink').addEventListener('click', (event) => {
    event.preventDefault();
    if (!state.token) openAuth('login');
  });
}

async function init() {
  renderConfig();
  bindEvents();
  renderAuth();
  await loadPublicData();
}

init();
