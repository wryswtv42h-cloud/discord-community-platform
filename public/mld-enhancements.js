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

  function init() {
    setupDrawerSafety();
    setupActiveNavigation();
    setupBackTop();
    setupSectionHints();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();