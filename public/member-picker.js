(() => {
  const cfg = window.SITE_CONFIG || {};
  const apiBase = (cfg.discord?.apiUrl || '').replace(/\/$/, '');
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' }[c]));
  const siteApi = (path, options = {}) => fetch(`/api${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}), ...(localStorage.getItem('token') ? { Authorization: `Bearer ${localStorage.getItem('token')}` } : {}) }, body: options.body && typeof options.body !== 'string' ? JSON.stringify(options.body) : options.body }).then(async (r) => { const data = await r.json().catch(() => ({})); if (!r.ok) throw Error(data.error || 'تعذر تنفيذ الطلب'); return data; });

  function modal(title, kind) {
    const host = document.querySelector('#modalContent');
    document.querySelector('#authModal')?.classList.add('open');
    host.innerHTML = `<form class="modalForm" id="memberRequestForm"><h2>${title}</h2><p class="subtext">ابحث عن اسمك في أعضاء سيرفر Discord واختر حسابك قبل الإرسال.</p><input id="memberLookup" placeholder="ابحث بالاسم أو اليوزر..." autocomplete="off" required><div id="memberResults" class="memberPickerResults"></div><input id="requestSubject" placeholder="${kind === 'ticket' ? 'عنوان التذكرة' : 'عنوان التقديم'}" required><textarea id="requestMessage" placeholder="اكتب التفاصيل هنا..." required></textarea><button class="btn" type="submit">إرسال</button></form>`;
    let selected = null; let timer;
    const results = document.querySelector('#memberResults');
    const lookup = document.querySelector('#memberLookup');
    async function search() {
      const q = lookup.value.trim(); if (q.length < 2) { results.innerHTML = ''; return; }
      results.innerHTML = '<div class="emptyState">جاري البحث...</div>';
      try {
        const response = await fetch(`${apiBase}/api/public/members?q=${encodeURIComponent(q)}`);
        const data = await response.json();
        const members = (data.members || []).slice(0, 8);
        results.innerHTML = members.length ? members.map((m) => `<button type="button" class="memberPickerItem" data-id="${esc(m.id)}" data-name="${esc(m.name)}" data-username="${esc(m.username || m.name)}"><img src="${esc(m.avatar || '/server-avatar.svg')}" onerror="this.src='/server-avatar.svg'"><span><b>${esc(m.name)}</b><small>@${esc(m.username || '')}</small></span></button>`).join('') : '<div class="emptyState">لم يتم العثور على العضو</div>';
        results.querySelectorAll('.memberPickerItem').forEach((button) => button.onclick = () => { selected = { id: button.dataset.id, name: button.dataset.name, username: button.dataset.username }; lookup.value = `${selected.name} (@${selected.username})`; results.innerHTML = `<div class="cardPill">تم اختيار: ${esc(selected.name)}</div>`; });
      } catch { results.innerHTML = '<div class="emptyState">تعذر الوصول إلى قائمة أعضاء Discord</div>'; }
    }
    lookup.oninput = () => { clearTimeout(timer); timer = setTimeout(search, 250); };
    document.querySelector('#memberRequestForm').onsubmit = async (event) => {
      event.preventDefault();
      if (!selected) return alert('اختر حسابك من قائمة أعضاء Discord أولاً');
      const body = { discordUsername: selected.username, discordMemberId: selected.id, discordDisplayName: selected.name, subject: document.querySelector('#requestSubject').value.trim(), message: document.querySelector('#requestMessage').value.trim(), answers: { subject: document.querySelector('#requestSubject').value.trim(), message: document.querySelector('#requestMessage').value.trim() } };
      try {
        if (kind === 'ticket') { if (!localStorage.getItem('token')) return alert('سجل دخولك بالموقع أولاً لفتح تذكرة'); await siteApi('/tickets', { method: 'POST', body }); }
        else await siteApi('/applications', { method: 'POST', body });
        document.querySelector('#authModal')?.classList.remove('open'); alert('تم الإرسال بنجاح');
      } catch (error) { alert(error.message); }
    };
  }

  function addButtons() {
    const section = document.querySelector('.headerActions'); if (!section || section.dataset.pickerReady) return;
    section.dataset.pickerReady = '1';
    const wrap = document.createElement('div'); wrap.className = 'memberRequestActions';
    wrap.innerHTML = '<button class="btn ghost" type="button" id="openApplicationBtn">تقديم إدارة</button><button class="btn" type="button" id="openTicketBtn">تذكرة</button>';
    section.prepend(wrap);
    document.querySelector('#openApplicationBtn').onclick = () => modal('التقديم على الإدارة', 'application');
    document.querySelector('#openTicketBtn').onclick = () => modal('فتح تذكرة دعم', 'ticket');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', addButtons); else addButtons();
})();
