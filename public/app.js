const DEFAULT_CONFIG = {
  name: 'ملاذ',
  owner: 'فهد المطيري',
  avatar: 'https://cdn.discordapp.com/attachments/1398447508463550578/1550544040401829888/IMG_0577.jpg',
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
    $('#adminNavLink')?.setAttribute('hidden','');
    $('#drawerAdminLink')?.setAttribute('hidden','');
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
      loadPublicData();
      showToast('تم تسجيل الدخول بنجاح');
    } catch (error) {
      showToast(error.message);
    }
  });

  $('[data-auth-switch]')?.addEventListener('click', () => {
    const switchTo = $('[data-auth-switch]').dataset.authSwitch;
    openAuth(switchTo);
  });
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
  const filtered = items.filter((member) => { const name = typeof member === 'string' ? member : (member.name || member.username || ''); return name.toLowerCase().includes(query); }).slice(0, 30);

  if (!filtered.length) {
    list.innerHTML = '<div class="emptyState">لا توجد نتائج لهذا البحث</div>';
    return;
  }

  list.innerHTML = filtered.map((member) => { const m = typeof member === 'string' ? { name: member } : member; const name = m.name || m.username || 'عضو'; return `
    <div class="memberCard">
      <img class="memberAvatar memberAvatarImg" src="${escapeHtml(m.avatar || '/server-avatar.svg')}" alt="" onerror="this.src='/server-avatar.svg'">
      <div class="memberText"><b>${escapeHtml(name)}</b><small>@${escapeHtml(m.username || name)}</small></div>
      <span class="memberStatus">●</span>
    </div>`; }).join('');
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
  if (!games.length) { list.innerHTML = '<div class="emptyState">لا توجد جلسات الآن — افتح أول جلسة!</div>'; return; }
  const labels={uno:'UNO',ludo:'لودو',baloot:'بلوت',qawsar:'قوسر',custom:'مخصصة'};
  list.innerHTML=games.map(game=>{
    const count=Array.isArray(game.players)?game.players.length:0;
    const status=game.status==='playing'?'🔥 قيد اللعب':game.status==='full'?'ممتلئة':'انتظار';
    const join=count<(game.max||4)&&game.status!=='playing';
    return `<div class="gameCard"><span class="cardPill">🎮 ${escapeHtml(labels[game.type]||game.type||'جلسة')} · ${status}</span><h3>${escapeHtml(game.title)}</h3><p>اللاعبون ${count}/${game.max||4} · الحد الأدنى ${game.min||2}</p><div class="cardMeta">${(game.players||[]).map(u=>`<span>${escapeHtml(u)}</span>`).join('')||'<span>بانتظار اللاعبين</span>'}</div><div class="cardActions">${join?`<button class="btn" data-game-join="${game.id}">انضمام</button>`:''}${state.me&&game.createdBy===state.me.id&&game.status!=='playing'?`<button class="btn ghost" data-game-start="${game.id}">بدء</button>`:''}${state.me&&(game.players||[]).includes(state.me.username)&&game.status==='playing'?'<button class="btn ghost" data-game-move="'+game.id+'">حركة</button>':''}</div></div>`;
  }).join('');
  $('[data-game-join]').forEach(b=>b.onclick=()=>joinGame(b.dataset.gameJoin));
  $('[data-game-start]').forEach(b=>b.onclick=async()=>{try{await api('/games/'+b.dataset.gameStart+'/start',{method:'POST'});showToast('بدأت اللعبة');loadPublicData()}catch(e){showToast(e.message)}});
  $('[data-game-move]').forEach(b=>b.onclick=async()=>{const move=prompt('اكتب الحركة');if(!move)return;try{await api('/games/'+b.dataset.gameMove+'/move',{method:'POST',body:{move}});loadPublicData()}catch(e){showToast(e.message)}});
}

async function sendPrivateMessage(){
  if(!state.token)return openAuth('login');
  const recipient=$('#privateRecipient')?.value.trim(), message=$('#privateText')?.value.trim();
  if(!recipient||!message)return showToast('اكتب المستلم والرسالة');
  try{await api('/private-messages',{method:'POST',body:{recipientId:recipient,title:'رسالة من ملاذ',message}});$('#privateText').value='';showToast('تم إرسال الرسالة');loadPrivateMessages()}catch(e){showToast(e.message)}
}
async function sendAnonymousMessage(){
  if(!state.token)return openAuth('login');
  const recipient=$('#anonymousRecipient')?.value.trim(), message=$('#anonymousText')?.value.trim();
  if(!recipient||!message)return showToast('اكتب المستلم والرسالة');
  try{await api('/anonymous-messages',{method:'POST',body:{recipientId:recipient,message}});$('#anonymousText').value='';showToast('تم إرسال الرسالة المجهولة');}catch(e){showToast(e.message)}
}
async function loadPrivateMessages(){
  if(!state.token)return;
  try{
    const d=await api('/private-messages');
    const items=d.items||d.messages||d||[];
    const el=$('#privateMessagesList'); if(!el)return;
    el.innerHTML=items.length?items.slice(0,50).map(x=>'<div class="ratingCard"><b>'+escapeHtml(x.senderUsername||x.senderId||'مستخدم')+'</b><p>'+escapeHtml(x.message)+'</p><small>'+escapeHtml(x.createdAt||'')+'</small></div>').join(''):'<div class="emptyState">لا توجد رسائل</div>';
  }catch{}
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

function renderLeaderboard(data = []) {
  const list = $('#leaderboardList');
  if (!list) return;
  const top = Array.isArray(data) && data.length && data[0]?.username
    ? data : [];
  if (!top.length) {
    list.innerHTML = '<div class="emptyState">لا توجد نقاط مسجلة بعد</div>';
    return;
  }
  list.innerHTML = top.slice(0, 10).map((entry,index) => `
    <div class="leaderCard"><div><span class="cardPill">#${index+1}</span><h3>${escapeHtml(entry.username)}</h3></div><strong>${Number(entry.points||0)}</strong></div>
  `).join('');
}

async function openCinema() {
  const list=$('#cinemaCatalog'); if(!list)return;
  list.innerHTML='<div class="emptyState">جاري تحميل السينما...</div>';
  try {
    const data=await api('/cinema/catalog');
    list.innerHTML=(data.items||[]).slice(0,24).map(item=>`
      <article class="cinemaCard"><img src="${escapeHtml(item.thumbnail||'/server-banner.svg')}" alt="" onerror="this.src='/server-banner.svg'"><div class="cinemaCardBody"><span class="cardPill">${escapeHtml(item.genre||'فيلم')}</span><h3>${escapeHtml(item.titleAr||item.title)}</h3><p>${escapeHtml(item.description||'')}</p><div class="cardActions"><a class="btn" target="_blank" rel="noopener" href="${escapeHtml(item.sourceUrl)}">المصدر</a><button class="btn ghost" data-cinema="${escapeHtml(item.id)}">طلب جلسة</button></div></div></article>`).join('')||'<div class="emptyState">لا يوجد محتوى متاح الآن</div>';
    $('[data-cinema]').forEach(b=>b.onclick=async()=>{if(!state.token)return openAuth('login');const channelId=prompt('معرّف روم الصوت في Discord');if(!channelId)return;try{await api('/cinema/sessions',{method:'POST',body:{itemId:b.dataset.cinema,channelId}});showToast('تم إرسال طلب جلسة السينما');}catch(e){showToast(e.message)}});
  } catch(e){list.innerHTML='<div class="emptyState">'+escapeHtml(e.message)+'</div>'}
}
async function submitDownload(event){
  event.preventDefault(); if(!state.token)return openAuth('login');
  const url=$('#mediaUrl')?.value.trim(),format=$('#mediaFormat')?.value||'video'; if(!url)return;
  try{await api('/control/downloads',{method:'POST',body:{url,format}});$('#downloadStatus').textContent='تمت إضافة مهمة التحميل إلى قائمة الانتظار.';event.target.reset();}catch(e){showToast(e.message)}
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
  if (!state.me?.discordId) {
    const discordId=prompt('اربط حساب Discord\nأدخل Discord User ID الخاص بك:');
    if (!discordId) return;
    try {
      const linked=await api('/auth/discord-link',{method:'POST',body:{discordId}});
      state.me=linked.user;
      showToast('تم ربط حساب Discord');
    } catch(error) { return showToast(error.message); }
  }
  const name=prompt('اسم القروب','قروب جديد');
  if(!name) return;
  const description=prompt('وصف القروب','مجتمع مميز للتفاعل');
  if(description===null)return;
  try {
    const result=await api('/groups',{method:'POST',body:{name,description,discordId:state.me.discordId}});
    showToast(result.message||'تم إرسال طلب إنشاء القروب إلى Discord');
    await loadPublicData();
  } catch(error){showToast(error.message);}
}

async function createGame() {
  if (!state.token) return openAuth('login');

  const title = prompt('اسم اللعبة', 'جلسة جديدة');
  if (!title) return;
  const typeInput=prompt('نوع اللعبة: uno / ludo / baloot / qawsar / custom','uno')||'custom';
  const type=['uno','ludo','baloot','qawsar','custom'].includes(typeInput.toLowerCase())?typeInput.toLowerCase():'custom';
  const min = Number(prompt('الحد الأدنى للعب', '2')) || 2;
  const max = Number(prompt('الحد الأقصى للعب', '4')) || 4;
  try {
    await api('/games', { method: 'POST', body: { title, type, min, max, visibility: 'public' } });
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
    $('#memberCount').textContent = (data.members || data.onlineMembers || []).length;
    $('#heroOnline').textContent = `● ${(data.onlineMembers || []).length} أعضاء متصلين`;
    $('#groupsCount').textContent = (data.groups || []).length;
    $('#gamesCount').textContent = (data.games || []).length;

    renderMemberList(data.members || data.onlineMembers || []);
    renderGroups(data.groups || []);
    renderGames(data.games || []);
    renderRatings(data.ratings || []);
    renderLeaderboard(data.leaderboard || []);
    renderAuth();
    const isStaff = ['owner','admin'].includes(state.me?.role);
    const controlLink = state.me?.role === 'owner' ? '/owner' : '/admin';
    $('#adminNavLink')?.toggleAttribute('hidden', !isStaff);
    $('#drawerAdminLink')?.toggleAttribute('hidden', !isStaff);
    if (isStaff) {
      if ($('#adminNavLink')) $('#adminNavLink').href = controlLink;
      if ($('#drawerAdminLink')) $('#drawerAdminLink').href = controlLink;
      if ($('#adminNavLink span')) $('#adminNavLink span').textContent = state.me.role === 'owner' ? 'لوحة الـOwner' : 'لوحة الإدارة';
      if ($('#drawerAdminLink')) $('#drawerAdminLink').innerHTML = state.me.role === 'owner' ? '👑 لوحة الـOwner' : '⚙️ لوحة الإدارة';
    }
  } catch (error) {
    showToast(error.message);
  }
}

function bindEvents() {
  $('#searchMemberBtn').addEventListener('click', () => {
    state.memberQuery = $('#memberSearchInput').value;
    renderMemberList(state.publicData?.members || state.publicData?.onlineMembers || []);
  });

  $('#memberSearchInput').addEventListener('input', (event) => {
    state.memberQuery = event.target.value;
    renderMemberList(state.publicData?.onlineMembers || []);
  });

  $('#newGroupBtn').addEventListener('click', createGroup);
  $('#createGroupBtn').addEventListener('click', createGroup);
  $('#newGameBtn').addEventListener('click', createGame);
  $('#addRatingBtn')?.addEventListener('click', addRating);
  $('#cinemaOpen')?.addEventListener('click', openCinema);
  $('#downloadForm')?.addEventListener('submit', submitDownload);

  $('#closeModalBtn').addEventListener('click', closeModal);
  $('#authModal').addEventListener('click', (event) => {
    if (event.target === $('#authModal')) closeModal();
  });

  $$('[data-auth]').forEach((element) => {
    element.addEventListener('click', () => openAuth(element.dataset.auth));
  });

  $('#platformMenuBtn')?.addEventListener('dblclick', () => toggleSidebar());

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


document.addEventListener('DOMContentLoaded',()=>{ $('#sendPrivateBtn')?.addEventListener('click',sendPrivateMessage); $('#sendAnonymousBtn')?.addEventListener('click',sendAnonymousMessage); loadPrivateMessages(); });
