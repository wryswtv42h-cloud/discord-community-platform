(() => {
  const escapeHtml = (value) =>
    String(value ?? '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    }[char]));

  async function api(path, options = {}) {
    const headers = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };

    const token = localStorage.getItem('token');

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`/api${path}`, {
      ...options,
      headers,
      body:
        options.body && typeof options.body !== 'string'
          ? JSON.stringify(options.body)
          : options.body
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || 'تعذر تنفيذ العملية');
    }

    return data;
  }

  function installDrawer() {
    const button = document.querySelector('#platformMenuBtn');
    const drawer = document.querySelector('#platformDrawer');

    if (!button || !drawer) return;

    button.addEventListener('click', () => {
      drawer.classList.add('open');
    });

    document
      .querySelector('#closePlatformMenu')
      ?.addEventListener('click', () => {
        drawer.classList.remove('open');
      });

    drawer.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => {
        drawer.classList.remove('open');
      });
    });
  }

  function installDownloads() {
    const form = document.querySelector('#downloadForm');
    const status = document.querySelector('#downloadStatus');

    if (!form || !status) return;

    form.addEventListener('submit', async (event) => {
      event.preventDefault();

      const url = document.querySelector('#mediaUrl')?.value.trim();
      const format = document.querySelector('#mediaFormat')?.value || 'video';

      if (!url) {
        status.textContent = 'أدخل الرابط أولًا';
        return;
      }

      try {
        const result = await api('/control/downloads', {
          method: 'POST',
          body: { url, format }
        });

        status.textContent =
          `تم إنشاء الطلب ${result.id || ''} وهو قيد المراجعة`;
      } catch (error) {
        status.textContent = error.message;
      }
    });
  }

  function installCinema() {
    const openButton = document.querySelector('#cinemaOpen');
    const catalog = document.querySelector('#cinemaCatalog');

    if (!openButton || !catalog) return;

    openButton.addEventListener('click', async () => {
      catalog.innerHTML =
        '<div class="emptyState">جاري تحميل القائمة...</div>';

      try {
        const data = await api('/cinema/catalog');
        const items = Array.isArray(data.items) ? data.items : [];

        if (!items.length) {
          catalog.innerHTML =
            '<div class="emptyState">لا توجد أفلام مضافة حاليًا</div>';
          return;
        }

        catalog.innerHTML = items.map((item) => `
          <article class="cinemaCard">
            ${item.thumbnail ? `<img src="${escapeHtml(item.thumbnail)}" alt="">` : ''}
            <div class="cinemaCardBody">
              <span class="cardPill">🎬 ${escapeHtml(item.genre || 'محتوى')}</span>
              <h3>${escapeHtml(item.title)}</h3>
              <p>${escapeHtml(item.description || '')}</p>
              <button class="btn" type="button" data-cinema-id="${escapeHtml(item.id)}">
                اختيار
              </button>
            </div>
          </article>
        `).join('');

        catalog.querySelectorAll('[data-cinema-id]').forEach((button) => {
          button.addEventListener('click', () => {
            openCinemaForm(button.dataset.cinemaId);
          });
        });

      } catch (error) {
        catalog.innerHTML = `<div class="emptyState">${escapeHtml(error.message)}</div>`;
      }
    });
  }

  function openCinemaForm(itemId) {
    const modal = document.querySelector('#authModal');
    const content = document.querySelector('#modalContent');

    if (!modal || !content) return;

    content.innerHTML = `
      <form class="modalForm" id="cinemaForm">
        <h2>تشغيل في السينما</h2>

        <input
          id="cinemaChannel"
          placeholder="معرف روم الصوت"
          required
        />

        <button class="btn" type="submit">
          إرسال طلب التشغيل
        </button>

        <small>
          لا تستخدم إلا محتوى تملك حق عرضه.
        </small>
      </form>
    `;

    modal.classList.add('open');

    document.querySelector('#cinemaForm')?.addEventListener('submit', async (event) => {
      event.preventDefault();

      try {
        await api('/cinema/sessions', {
          method: 'POST',
          body: {
            itemId,
            channelId: document.querySelector('#cinemaChannel')?.value.trim()
          }
        });

        modal.classList.remove('open');
        alert('تم إرسال طلب التشغيل للبوت');
      } catch (error) {
        alert(error.message);
      }
    });
  }

  function init() {
    installDrawer();
    installDownloads();
    installCinema();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
