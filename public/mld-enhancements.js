(() => {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];

  function closeDrawer() {
    const drawer = $('#platformDrawer');
    const btn = $('#platformMenuBtn');
    if (!drawer) return;
    drawer.classList.remove('open');
    drawer.setAttribute('aria-hidden','true');
    btn?.setAttribute('aria-expanded','false');
    document.body.classList.remove('drawer-open');
  }

  function setupDrawerSafety() {
    const drawer = $('#platformDrawer');
    if (!drawer || drawer.dataset.mldEnhanced === '1') return;
    drawer.dataset.mldEnhanced = '1';
    drawer.addEventListener('click', (event) => {
      if (event.target === drawer) closeDrawer();
    });
    drawer.querySelectorAll('a[href^="#"]').forEach((link) => {
      link.addEventListener('click', () => {
        window.setTimeout(closeDrawer, 0);
      });
    });
  }

  function setupActiveNavigation() {
    const links = $$('nav a[href^="#"], .platformDrawer a[href^="#"]');
    const sections = $$('main section[id]');
    if (!links.length || !sections.length) return;

    const setActive = (id) => {
      $$('nav a[href^="#"]').forEach((link) => {
        link.classList.toggle('active', link.getAttribute('href') === '#' + id);
      });
    };

    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter(e => e.isIntersecting)
        .sort((a,b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible) setActive(visible.target.id);
    }, { rootMargin:'-22% 0px -68% 0px', threshold:[0,.15,.35,.6] });

    sections.forEach(section => observer.observe(section));
  }

  function setupBackTop() {
    if ($('#mldBackTop')) return;
    const button = document.createElement('button');
    button.id = 'mldBackTop';
    button.className = 'mldBackTop';
    button.type = 'button';
    button.setAttribute('aria-label','العودة للأعلى');
    button.textContent = '↑';
    document.body.appendChild(button);
    const update = () => button.classList.toggle('show', window.scrollY > 650);
    window.addEventListener('scroll', update, {passive:true});
    button.addEventListener('click', () => window.scrollTo({top:0,behavior:'smooth'}));
    update();
  }

  function setupSectionHints() {
    const hints = {
      members:'تصفح الأعضاء وابحث عن أي عضو بسرعة.',
      groups:'أنشئ قروبك أو انضم للقروبات المتاحة.',
      cinema:'محتوى وترفيه من المصادر المسموحة.',
      downloads:'أرسل مهام تنزيل للمحتوى الذي تملك حقه.',
      leaderboard:'تابع ترتيب ونقاط أعضاء المجتمع.',
      ratings:'آراء المجتمع تتحرك أفقيًا ويمكن إيقافها بالضغط.',
      messages:'مراسلات خاصة داخل المجتمع بعد تسجيل الدخول.',
      anonymous:'أرسل رسالة بدون إظهار هويتك للمستلم.'
    };
    Object.entries(hints).forEach(([id,text]) => {
      const section = document.getElementById(id);
      if (!section || section.querySelector('.mldSectionHint')) return;
      const title = section.querySelector('.sectionTitle');
      if (!title) return;
      const hint = document.createElement('div');
      hint.className = 'mldSectionHint';
      hint.textContent = text;
      title.insertAdjacentElement('afterend', hint);
    });
  }


  const quickItems = [
    ['members','◉','الأعضاء','تصفح وابحث'],
    ['groups','◌','القروبات','تجمعات المجتمع'],
    ['games','◇','الألعاب','جلسات مباشرة'],
    ['cinema','▣','السينما','محتوى وترفيه'],
    ['leaderboard','◆','التوب','النقاط والترتيب'],
    ['ratings','✦','التقييمات','آراء المجتمع']
  ];

  function setupQuickNavigation() {
    if ($('#mldQuickNav')) return;
    const hero = $('#home');
    const target = hero?.nextElementSibling;
    if (!hero || !target) return;
    const wrap = document.createElement('div');
    wrap.id = 'mldQuickNav';
    wrap.className = 'mldQuickNav';
    wrap.setAttribute('aria-label','اختصارات ملاذ');
    wrap.innerHTML = quickItems.map(([id,icon,title,sub]) =>
      '<a class="mldQuickCard" href="#'+id+'"><span class="mldQuickIcon">'+icon+'</span><span><b>'+title+'</b><small>'+sub+'</small></span></a>'
    ).join('');
    target.insertAdjacentElement('beforebegin', wrap);
  }

  function setupLiveBar() {
    if ($('#mldLiveBar')) return;
    const home = $('#home');
    if (!home) return;
    const bar = document.createElement('div');
    bar.id = 'mldLiveBar';
    bar.className = 'mldLiveBar';
    bar.dataset.state = 'ready';
    bar.innerHTML = '<span class="mldLiveState"><i class="mldLiveDot"></i><span id="mldLiveText">المعلومات تتحدث تلقائيًا</span></span><button class="mldRefreshBtn" id="mldRefreshBtn" type="button">تحديث الآن</button>';
    home.insertAdjacentElement('afterend', bar);
    $('#mldRefreshBtn').addEventListener('click', () => window.dispatchEvent(new CustomEvent('mld:refresh')));
  }

  function updateLiveBar(state, text) {
    const bar=$('#mldLiveBar'), label=$('#mldLiveText');
    if (!bar || !label) return;
    bar.dataset.state=state;
    label.textContent=text;
  }

  async function refreshLiveSnapshot() {
    if (document.visibilityState === 'hidden') return;
    const token=localStorage.getItem('mld_token') || localStorage.getItem('token');
    const headers=token ? {Authorization:'Bearer '+token} : {};
    updateLiveBar('loading','جاري سحب أحدث معلومات المجتمع...');
    try {
      const response=await fetch('/api/public',{headers,cache:'no-store'});
      if(!response.ok) throw new Error('تعذر تحديث البيانات');
      const data=await response.json();
      window.dispatchEvent(new CustomEvent('mld:public-data',{detail:data}));
      const members=data.members || data.onlineMembers || [];
      const online=data.onlineMembers || [];
      $('#memberCount') && ($('#memberCount').textContent=members.length);
      $('#heroMembers') && ($('#heroMembers').textContent='👥 '+members.length+' أعضاء');
      $('#heroOnline') && ($('#heroOnline').textContent='● '+online.length+' أعضاء متصلين');
      $('#groupsCount') && ($('#groupsCount').textContent=(data.groups||[]).length);
      $('#visitCount') && ($('#visitCount').textContent=data.visits||0);
      $('#heroVisits') && ($('#heroVisits').textContent='◈ '+(data.visits||0)+' زيارات');
      $('#heroStatus') && ($('#heroStatus').textContent='🟢 الحالة: '+(data.serverStatus||'متصل'));
      updateLiveBar('ready','آخر تحديث: '+new Date().toLocaleTimeString('ar-SA',{hour:'2-digit',minute:'2-digit',second:'2-digit'}));
    } catch(error) {
      updateLiveBar('error','تعذر التحديث اللحظي — سيُعاد المحاولة تلقائيًا');
    }
  }

  function setupLiveRefresh() {
    setupLiveBar();
    window.addEventListener('mld:refresh', refreshLiveSnapshot);
    window.setTimeout(refreshLiveSnapshot, 1200);
    window.setInterval(refreshLiveSnapshot, 10000);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') refreshLiveSnapshot();
    });
  }

  function init() {
    setupDrawerSafety();
    setupActiveNavigation();
    setupBackTop();
    setupSectionHints();
    setupQuickNavigation();
    setupLiveRefresh();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();