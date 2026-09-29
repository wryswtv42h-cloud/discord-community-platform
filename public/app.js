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

function gameCatalogData(){return [
{id:'baloot',name:'بلوت',icon:'🃏',desc:'جلسة سعودية كلاسيكية لأربعة لاعبين.',tone:'gold'},
{id:'uno',name:'أونو',icon:'🌈',desc:'ألوان + كروت + تحدي سريع.',tone:'rainbow'},
{id:'jakaro',name:'جاكارو',icon:'🎯',desc:'خطط حركتك وكن أول من يوصل.',tone:'emerald'},
{id:'monopoly',name:'مونوبولي',icon:'💰',desc:'شراء وتداول ومنافسة على اللوحة.',tone:'violet'},
{id:'ludo',name:'لودو',icon:'🎲',desc:'سباق الحظ والحركة مع الربع.',tone:'ruby'},
{id:'maqosar',name:'مقوصر',icon:'👑',desc:'لعبتنا الجديدة — جلسة تنافسية خاصة.',tone:'cyan'}
];}
function renderGames(){
 const list=$('#gamesList'); if(!list)return;
 const games=gameCatalogData();
 const filters=$('#gameFilters');
 if(filters&&!filters.dataset.ready){filters.dataset.ready='1';filters.innerHTML='<button class="gameFilter active" data-game-filter="all">الكل</button>'+games.map(g=>'<button class="gameFilter" data-game-filter="'+g.id+'">'+g.icon+' '+g.name+'</button>').join('');$$('[data-game-filter]').forEach(b=>b.addEventListener('click',()=>{ $$('[data-game-filter]').forEach(x=>x.classList.remove('active'));b.classList.add('active');renderGameCards(b.dataset.gameFilter);}));}
 renderGameCards('all'); loadGameSessions();
 $('#createGameSessionBtn')?.addEventListener('click',openCreateGameSession);
 $('#refreshGameSessionsBtn')?.addEventListener('click',loadGameSessions);
}
function renderGameCards(filter='all'){
 const list=$('#gamesList');if(!list)return;const games=gameCatalogData().filter(g=>filter==='all'||g.id===filter);
 list.innerHTML=games.map(g=>'<article class="gameCard sessionGameCard tone-'+g.tone+'"><div class="gameArt"><span>'+g.icon+'</span><b>LIVE</b></div><span class="cardPill">'+g.icon+' Multiplayer</span><h3>'+g.name+'</h3><p>'+g.desc+'</p><div class="cardMeta"><span>👥 حتى 4</span><span>🎥 مشاهدون</span><span>⚡ مباشر</span></div><div class="cardActions"><button class="btn" type="button" data-create-game="'+g.id+'">إنشاء جلسة</button></div></article>').join('');
 $$('[data-create-game]').forEach(b=>b.addEventListener('click',()=>openCreateGameSession(b.dataset.createGame)));
}
async function loadGameSessions(){
 const el=$('#gameSessionsList');if(!el)return;
 try{const d=await api('/game-sessions');const items=d.items||[];el.innerHTML=items.length?items.map(s=>'<article class="sessionCard"><div class="sessionTop"><span class="cardPill">'+(gameCatalogData().find(g=>g.id===s.game)?.icon||'🎮')+' '+escapeHtml(gameCatalogData().find(g=>g.id===s.game)?.name||s.game)+'</span><span class="sessionStatus">'+(s.status==='playing'?'🔴 يلعب الآن':'🟢 مفتوحة')+'</span></div><h3>'+escapeHtml(s.name)+'</h3><div class="seatRow">'+s.players.map((p,i)=>'<div class="seat filled"><img src="'+escapeHtml(p.avatar||'/server-avatar.svg')+'"><span>'+escapeHtml(p.username)+'</span>'+(i===0?'<small>👑</small>':'')+'</div>').join('')+Array.from({length:Math.max(0,s.maxPlayers-s.players.length)},()=>'<div class="seat empty">＋<span>مقعد فارغ</span></div>').join('')+'</div><div class="cardMeta"><span>👥 '+s.players.length+'/'+s.maxPlayers+'</span><span>👁️ '+s.spectators.length+' مشاهد</span><span>🔑 '+escapeHtml(s.code)+'</span></div><div class="cardActions"><button class="btn" data-join-session="'+s.id+'">دخول</button><button class="btn ghost" data-spectate-session="'+s.id+'">مشاهدة</button></div></article>').join(''):'<div class="emptyState">ما فيه جلسات الآن — كن أول واحد ينشئ جلسة 🔥</div>';
 $$('[data-join-session]').forEach(b=>b.addEventListener('click',()=>joinGameSession(b.dataset.joinSession,false)));
 $$('[data-spectate-session]').forEach(b=>b.addEventListener('click',()=>joinGameSession(b.dataset.spectateSession,true)));
 }catch(e){el.innerHTML='<div class="emptyState">'+escapeHtml(e.message)+'</div>';}
}
function openCreateGameSession(gameId='baloot'){
 if(!state.token)return openAuth('login');
 const games=gameCatalogData();
 openModal('<form class="modalForm gameSessionForm" id="createGameForm"><h2>🎮 إنشاء جلسة</h2><p class="subtext">اختر اللعبة وخل الجلسة تطلع للناس مباشرة.</p><label>اللعبة<select id="sessionGame">'+games.map(g=>'<option value="'+g.id+'" '+(g.id===gameId?'selected':'')+'>'+g.icon+' '+g.name+'</option>').join('')+'</select></label><label>اسم الجلسة<input id="sessionName" maxlength="80" placeholder="مثلاً: بلوت الربع"></label><label>عدد اللاعبين<select id="sessionMax"><option>2</option><option>3</option><option selected>4</option></select></label><button class="btn" type="submit">🚀 نشر الجلسة</button></form>');
 $('#createGameForm').onsubmit=async e=>{e.preventDefault();try{const s=await api('/game-sessions',{method:'POST',body:{game:$('#sessionGame').value,name:$('#sessionName').value,maxPlayers:Number($('#sessionMax').value)}});closeModal();openGameRoom(s.id);loadGameSessions();}catch(err){showToast(err.message)}};
}
async function joinGameSession(id,spectator){
 if(!state.token)return openAuth('login');
 try{await api('/game-sessions/'+id+'/join',{method:'POST',body:{spectator}});openGameRoom(id);loadGameSessions();}catch(e){showToast(e.message)}
}
async function openGameRoom(id){
 try{const s=await api('/game-sessions/'+id);showGameRoom(s);}catch(e){showToast(e.message)}
}
function showGameRoom(s){
 const game=gameCatalogData().find(g=>g.id===s.game)||gameCatalogData()[0];const mine=state.me?.id;const myPlayer=s.players.find(p=>p.id===mine);const isHost=s.hostId===mine;
 openModal('<div class="gameRoom tone-'+game.tone+'"><div class="gameRoomHead"><div><span class="cardPill">'+game.icon+' '+game.name+'</span><h2>'+escapeHtml(s.name)+'</h2><p class="subtext">كود الجلسة: <b>'+escapeHtml(s.code)+'</b></p></div><button class="btn ghost" data-close-game>إغلاق</button></div><div class="roomLayout"><div class="boardStage"><div class="virtualBoard"><div class="boardLogo">'+game.icon+'<small>'+game.name+'</small></div><div class="turnBanner"> '+escapeHtml(s.state.lastAction||'الجلسة جاهزة')+'</div><div class="turnGrid">'+s.players.map((p,i)=>'<div class="turnSeat '+(s.state.turn===i?'current':'')+'"><img src="'+escapeHtml(p.avatar||'/server-avatar.svg')+'"><b>'+escapeHtml(p.username)+'</b><small>'+(s.state.turn===i?'دورك الآن':'انتظر الدور')+'</small></div>').join('')+'</div><div class="boardActions">'+(s.status==='lobby'&&isHost?'<button class="btn" data-start-session>🚀 ابدأ اللعب</button>':'')+(s.status==='playing'&&myPlayer?'<button class="btn" data-game-action="roll">🎲 حركة</button>':'')+'<button class="btn ghost" data-leave-session>خروج</button></div></div></div><aside class="roomSide"><h3>👥 اللاعبين</h3><div class="roomPlayers">'+s.players.map(p=>'<div><img src="'+escapeHtml(p.avatar||'/server-avatar.svg')+'"><span>'+escapeHtml(p.username)+'</span>'+(p.id===s.hostId?'<b>👑</b>':'')+'</div>').join('')+'</div><h3>👁️ المشاهدون</h3><p class="subtext">'+s.spectators.length+' مشاهد</p><div class="roomChat">'+s.chat.map(c=>'<p><b>'+escapeHtml(c.user)+':</b> '+escapeHtml(c.text)+'</p>').join('')+'</div><div class="chatSend"><input id="gameChatText" maxlength="300" placeholder="اكتب في شات الجلسة..."><button class="btn" data-send-game-chat>إرسال</button></div></aside></div></div>');
 $('#closeGame')?.addEventListener('click',closeModal);$('[data-close-game]')?.addEventListener('click',closeModal);
 $('[data-start-session]')?.addEventListener('click',async()=>{try{const x=await api('/game-sessions/'+s.id+'/start',{method:'POST',body:{}});showGameRoom(x);loadGameSessions()}catch(e){showToast(e.message)}});
 $('[data-leave-session]')?.addEventListener('click',async()=>{try{await api('/game-sessions/'+s.id+'/leave',{method:'POST',body:{}});closeModal();loadGameSessions()}catch(e){showToast(e.message)}});
 $('[data-game-action]')?.addEventListener('click',async()=>{try{const x=await api('/game-sessions/'+s.id+'/action',{method:'POST',body:{action:'roll'}});showGameRoom(x);loadGameSessions()}catch(e){showToast(e.message)}});
 $('[data-send-game-chat]')?.addEventListener('click',async()=>{const t=$('#gameChatText')?.value.trim();if(!t)return;try{await api('/game-sessions/'+s.id+'/chat',{method:'POST',body:{text:t}});const x=await api('/game-sessions/'+s.id);showGameRoom(x)}catch(e){showToast(e.message)}});
}

let currentJoke=null,currentStory='';
async function loadJokes(){
 const el=$('#jokesList'),spot=$('#jokeSpotlight');if(!el)return;
 try{const d=await api('/jokes');const items=d.items||[];if(items.length){currentJoke=items[0];renderJokeSpotlight(currentJoke);el.innerHTML=items.slice(0,8).map(j=>'<article class="ratingCard"><span class="cardPill">'+escapeHtml(j.author||'ملاذ')+'</span><p>'+escapeHtml(j.text)+'</p><div class="jokeActions"><button data-joke-react="like" data-joke-id="'+j.id+'">👍 '+(j.likes||0)+'</button><button data-joke-react="dislike" data-joke-id="'+j.id+'">👎 '+(j.dislikes||0)+'</button></div></article>').join('');$$('[data-joke-react]').forEach(b=>b.addEventListener('click',()=>reactJoke(b.dataset.jokeId,b.dataset.jokeReact)));}else renderJokeSpotlight(null);}catch(e){if(spot)spot.innerHTML='<div class="emptyState">'+escapeHtml(e.message)+'</div>';}}
function renderJokeSpotlight(j){const el=$('#jokeSpotlight');if(!el)return;if(!j){el.innerHTML='<div class="emptyState">ما فيه نكت — اضغط غيرها لتوليد واحدة.</div>';return;}el.innerHTML='<div class="jokeCard"><span class="cardPill">✨ '+escapeHtml(j.author||'مولّد ملاذ')+'</span><blockquote>“'+escapeHtml(j.text)+'”</blockquote><div class="jokeActions"><button data-spot-react="like">👍 '+(j.likes||0)+'</button><button data-spot-react="dislike">👎 '+(j.dislikes||0)+'</button><button data-add-joke>✍️ أضف نكتتك</button></div></div>';$$('[data-spot-react]').forEach(b=>b.addEventListener('click',()=>reactJoke(j.id,b.dataset.spotReact)));$('[data-add-joke]')?.addEventListener('click',openAddJoke);}
async function reactJoke(id,type){if(!state.token)return openAuth('login');try{await api('/jokes/'+id+'/react',{method:'POST',body:{type}});loadJokes();}catch(e){showToast(e.message)}}
async function nextJoke(){if(!state.token)return openAuth('login');try{const j=await api('/jokes/generate',{method:'POST',body:{}});currentJoke=j;renderJokeSpotlight(j);loadJokes();}catch(e){showToast(e.message)}}
function openAddJoke(){if(!state.token)return openAuth('login');openModal('<form class="modalForm" id="addJokeForm"><h2>✍️ أضف نكتتك</h2><textarea id="newJokeText" required maxlength="500" placeholder="اكتب نكتتك باللهجة اللي تعجبك..."></textarea><button class="btn" type="submit">نشر النكتة</button></form>');$('#addJokeForm').onsubmit=async e=>{e.preventDefault();try{await api('/jokes',{method:'POST',body:{text:$('#newJokeText').value}});closeModal();showToast('تم نشر النكتة 😂');loadJokes()}catch(err){showToast(err.message)}}}
async function generateStory(){const genre=$('#storyGenre')?.value||'مغامرة',length=$('#storyLength')?.value||'قصيرة',out=$('#storyOutput');if(!out)return;out.innerHTML='<div class="emptyState">جاري التأليف...</div>';try{const s=await api('/stories/generate',{method:'POST',body:{genre,length}});currentStory=s.text;out.innerHTML='<h3>📖 قصة '+escapeHtml(s.genre)+'</h3><p>'+escapeHtml(s.text)+'</p>';}catch(e){out.innerHTML='<div class="emptyState">'+escapeHtml(e.message)+'</div>';}}
function speakStory(){if(!currentStory)return showToast('ولّد قصة أولًا');if(!('speechSynthesis' in window))return showToast('المتصفح لا يدعم القراءة الصوتية');speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(currentStory);u.lang='ar-SA';u.rate=.92;u.pitch=1;speechSynthesis.speak(u);}
function stopStory(){if('speechSynthesis' in window)speechSynthesis.cancel();}
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

  const cards = ratings.slice(0, 12).map((rating) => `
    <div class="ratingCard">
      <div class="ratingStars">${'★'.repeat(Number(rating.value || 5))}${'☆'.repeat(5 - Number(rating.value || 5))}</div>
      <p>${escapeHtml(rating.text || 'تجربة رائعة!')}</p>
      <div class="cardMeta"><span>${escapeHtml(rating.user || 'مستخدم')}</span></div>
    </div>
  `).join('');
  list.innerHTML = `<div class="ratingViewport"><div class="ratingTrack">${cards}${cards}</div></div>`;
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
    const memberTotal = (data.members || data.onlineMembers || []).length;
    const onlineTotal = (data.onlineMembers || []).length;
    $('#memberCount').textContent = memberTotal;
    $('#heroMembers').textContent = `👥 ${memberTotal} أعضاء`;
    $('#heroStatus').textContent = `🟢 الحالة: ${data.serverStatus || 'متصل'}`;
    $('#heroOnline').textContent = `● ${onlineTotal} أعضاء متصلين`;
    $('#groupsCount').textContent = (data.groups || []).length;
    $('#gamesCount').textContent = 6;

    renderMemberList(data.members || data.onlineMembers || []);
    renderGroups(data.groups || []);
    renderGames();
    renderRatings(data.ratings || []);
    renderLeaderboard(data.leaderboard || []);
    renderAuth();
    const isStaff = ['owner','admin'].includes(state.me?.role);
    const controlLink = state.me?.role === 'owner' ? '/owner' : '/admin';
    $('#adminNavLink')?.toggleAttribute('hidden', !isStaff);
    $('#drawerAdminLink')?.toggleAttribute('hidden', !(isStaff && state.me?.role === 'admin'));
    $('#drawerOwnerLink')?.toggleAttribute('hidden', state.me?.role !== 'owner');
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

function openTicketForm() {
  if (!state.token) return openAuth('login');
  openModal(`<form class="modalForm" id="ticketForm"><h2>🎫 فتح تذكرة</h2><p class="subtext">أرسل استفسارك للإدارة.</p><input id="ticketSubject" placeholder="عنوان التذكرة" required><input id="ticketDiscord" placeholder="Discord ID (اختياري)"><textarea id="ticketMessage" placeholder="اكتب تفاصيل المشكلة..." required style="min-height:130px"></textarea><button class="btn" type="submit">إرسال التذكرة</button></form>`);
  $('#ticketForm').onsubmit=async e=>{e.preventDefault();try{await api('/tickets',{method:'POST',body:{subject:$('#ticketSubject').value,message:$('#ticketMessage').value,discordId:$('#ticketDiscord').value}});closeModal();showToast('تم فتح التذكرة');}catch(err){showToast(err.message)}};
}
function openApplicationForm() {
  if (!state.token) return openAuth('login');
  openModal(`<form class="modalForm" id="applicationForm"><h2>📝 التقديم للإدارة</h2><p class="subtext">أرسل طلبك وسيظهر للإدارة للمراجعة.</p><input id="applicationDiscordUser" placeholder="اسم Discord"><input id="applicationDiscordId" placeholder="Discord ID (اختياري)"><textarea id="applicationMessage" placeholder="لماذا تريد الانضمام للإدارة؟" required style="min-height:150px"></textarea><button class="btn" type="submit">إرسال التقديم</button></form>`);
  $('#applicationForm').onsubmit=async e=>{e.preventDefault();try{await api('/admin/applications',{method:'POST',body:{discordUsername:$('#applicationDiscordUser').value,discordId:$('#applicationDiscordId').value,message:$('#applicationMessage').value,type:'staff'}});closeModal();showToast('تم إرسال التقديم للإدارة');}catch(err){showToast(err.message)}};
}
function handleDrawerAction(action){
  if(action==='ticket') return openTicketForm();
  if(action==='application') return openApplicationForm();
  if(action==='auth') return openAuth(state.me?'login':'login');
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
  $('[data-drawer-action]').forEach((el)=>el.addEventListener('click',(e)=>{e.preventDefault();handleDrawerAction(el.dataset.drawerAction);}));
  $('#createGroupBtn').addEventListener('click', createGroup);
    $('#addRatingBtn')?.addEventListener('click', addRating);
  $('#cinemaOpen')?.addEventListener('click', openCinema);
  $('#downloadForm')?.addEventListener('submit', submitDownload);
  $('#nextJokeBtn')?.addEventListener('click',nextJoke);
  $('#generateStoryBtn')?.addEventListener('click',generateStory);
  $('#speakStoryBtn')?.addEventListener('click',speakStory);
  $('#stopStoryBtn')?.addEventListener('click',stopStory);
  loadJokes();

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


document.addEventListener('DOMContentLoaded',()=>{
 $('#sendPrivateBtn')?.addEventListener('click',sendPrivateMessage);
 $('#sendAnonymousBtn')?.addEventListener('click',sendAnonymousMessage);
 $('#nextJokeBtn')?.addEventListener('click',nextJoke);
 $('#generateStoryBtn')?.addEventListener('click',generateStory);
 $('#speakStoryBtn')?.addEventListener('click',speakStory);
 $('#stopStoryBtn')?.addEventListener('click',stopStory);
 $('#jokes')?.addEventListener('click',e=>{if(e.target.matches('[data-add-joke]'))openAddJoke();});
 loadPrivateMessages();
 loadJokes();
});
