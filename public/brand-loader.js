/* Load the server-specific launch skin even when the host page was cached. */
(function () {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = '/launch.css?v=maladh';
  document.head.appendChild(link);
  const configScript = document.createElement('script');
  configScript.src = '/site-config.js?v=maladh';
  configScript.onload = () => {
    const config = window.SITE_CONFIG || {};
    document.title = `${config.name || 'ملاذ'} | Community Hub`;
    const card = document.querySelector('.serverCard');
    if (card) {
      const avatar = card.querySelector('.serverAvatar');
      if (avatar && config.avatar) avatar.innerHTML = `<img src="${config.avatar}" alt="${config.name || 'ملاذ'}">`;
      const name = card.querySelector('b');
      if (name) name.textContent = config.name || 'ملاذ';
    }
    const hero = document.querySelector('#home .welcome');
    if (hero && !document.querySelector('.serverHero')) {
      const section = document.createElement('div');
      section.className = 'serverHero';
      section.style.setProperty('--server-banner', `url("${config.banner || ''}")`);
      section.innerHTML = `<div class="serverHeroContent"><img class="serverHeroAvatar" src="${config.avatar || ''}" alt=""><div><span class="eyebrow">OFFICIAL COMMUNITY</span><h1>${config.name || 'ملاذ'}</h1><p>${config.welcome || ''}</p><div class="serverMeta"><span>المنشئ: ${config.owner || 'فهد المطيري'}</span><span>● الأعضاء المتصلين</span><span>◈ زيارات الموقع</span></div></div></div>`;
      hero.parentNode.insertBefore(section, hero);
    }
  };
  document.head.appendChild(configScript);
})();
