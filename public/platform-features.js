(() => {
  function applyAvatar() {
    const avatar = document.querySelector('#serverAvatar');
    const configuredAvatar = window.SITE_CONFIG?.avatar;

    if (!avatar || !configuredAvatar) return;

    avatar.src = configuredAvatar;
    avatar.removeAttribute('srcset');
    avatar.loading = 'eager';
    avatar.decoding = 'async';
  }

  function setDrawerState(open) {
    const drawer = document.querySelector('#platformDrawer');
    const button = document.querySelector('#platformMenuBtn');

    if (!drawer || !button) return;

    drawer.classList.toggle('open', open);
    drawer.setAttribute('aria-hidden', String(!open));
    button.setAttribute('aria-expanded', String(open));
    document.body.classList.toggle('drawer-open', open);
  }

  function initDrawer() {
    const button = document.querySelector('#platformMenuBtn');
    const drawer = document.querySelector('#platformDrawer');
    const closeButton = document.querySelector('#closePlatformMenu');

    if (!button || !drawer || button.dataset.bound === 'true') return;

    button.dataset.bound = 'true';

    button.addEventListener('click', () => {
      setDrawerState(!drawer.classList.contains('open'));
    });

    closeButton?.addEventListener('click', () => {
      setDrawerState(false);
    });

    drawer.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => {
        setDrawerState(false);
      });
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        setDrawerState(false);
      }
    });
  }

  function init() {
    applyAvatar();
    initDrawer();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
