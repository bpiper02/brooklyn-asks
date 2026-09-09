(() => {
  const $ = (s) => document.querySelector(s);
  const norm = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  let records = [];

  function render() {
    const board = $('#historyBoard').value;
    const year = $('#historyYear').value;
    const q = norm($('#historySearch').value);
    const filtered = records.filter(r => {
      if (board !== 'all' && String(r.board) !== board) return false;
      if (year !== 'all' && String(r.fiscalYear) !== year) return false;
      if (q && !norm([r.request, r.detail, r.agency, r.priority].join(' ')).includes(q)) return false;
      return true;
    }).sort((a,b) => (b.fiscalYear-a.fiscalYear) || (a.board-b.board));

    $('#historyMeta').textContent = `${filtered.length.toLocaleString()} sourced historical records`;
    const root = $('#historyResults');
    root.innerHTML = filtered.map(r => `
      <article class="history-row">
        <div class="history-index"><strong>BK CB ${String(r.board).padStart(2,'0')}</strong><span>FY ${r.fiscalYear}</span><span>${r.priority ? `Priority ${escapeHtml(r.priority)}` : ''}</span></div>
        <div><h3>${escapeHtml(r.request)}</h3>${r.detail ? `<p>${escapeHtml(r.detail)}</p>` : ''}<p class="history-agency">${escapeHtml(r.agency || 'Agency unavailable')}</p></div>
        <div class="history-source"><span>${r.response && !r.response.toLowerCase().includes('historical district-needs') ? escapeHtml(r.response) : 'Historical source does not include an agency response.'}</span><a href="${escapeAttr(r.sourceUrl)}" target="_blank" rel="noopener noreferrer">Official source ↗</a></div>
      </article>`).join('') || '<p class="empty">No historical records match these filters.</p>';
  }

  function escapeHtml(value='') { return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function escapeAttr(value='') { return escapeHtml(value); }

  fetch('./data/historical-seed.json').then(r => r.json()).then(data => {
    records = data.filter(r => r.fiscalYear && r.fiscalYear < 2027);
    const boards = [...new Set(records.map(r => r.board))].sort((a,b)=>a-b);
    const years = [...new Set(records.map(r => r.fiscalYear))].sort((a,b)=>b-a);
    boards.forEach(v => $('#historyBoard').insertAdjacentHTML('beforeend', `<option value="${v}">Brooklyn CB ${v}</option>`));
    years.forEach(v => $('#historyYear').insertAdjacentHTML('beforeend', `<option value="${v}">FY ${v}</option>`));
    ['#historyBoard','#historyYear','#historySearch'].forEach(s => $(s).addEventListener('input', render));
    render();
  }).catch(() => { $('#historyResults').innerHTML = '<p class="empty">Historical records could not be loaded.</p>'; });
})();
