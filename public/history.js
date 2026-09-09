(() => {
  const q = (s) => document.querySelector(s);
  const normalize = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  let records = [];

  function addOptions() {
    const boards = Array.from(new Set(records.map(r => r.board))).sort((a,b) => a-b);
    const years = Array.from(new Set(records.map(r => r.fiscalYear))).sort((a,b) => b-a);
    for (const board of boards) {
      const option = document.createElement('option');
      option.value = String(board);
      option.textContent = `Brooklyn CB ${board}`;
      q('#historyBoard').appendChild(option);
    }
    for (const year of years) {
      const option = document.createElement('option');
      option.value = String(year);
      option.textContent = `FY ${year}`;
      q('#historyYear').appendChild(option);
    }
  }

  function render() {
    const board = q('#historyBoard').value;
    const year = q('#historyYear').value;
    const search = normalize(q('#historySearch').value);
    const filtered = records.filter(r => {
      if (board !== 'all' && String(r.board) !== board) return false;
      if (year !== 'all' && String(r.fiscalYear) !== year) return false;
      if (search && !normalize([r.request, r.detail, r.agency, r.priority].join(' ')).includes(search)) return false;
      return true;
    }).sort((a,b) => (b.fiscalYear-a.fiscalYear) || (a.board-b.board));

    q('#historyMeta').textContent = `${filtered.length.toLocaleString()} sourced historical records`;
    const root = q('#historyResults');
    root.replaceChildren();

    if (!filtered.length) {
      const empty = document.createElement('p');
      empty.className = 'empty';
      empty.textContent = 'No historical records match these filters.';
      root.appendChild(empty);
      return;
    }

    for (const r of filtered) {
      const article = document.createElement('article');
      article.className = 'history-row';

      const index = document.createElement('div');
      index.className = 'history-index';
      const boardEl = document.createElement('strong');
      boardEl.textContent = `BK CB ${String(r.board).padStart(2,'0')}`;
      const yearEl = document.createElement('span');
      yearEl.textContent = `FY ${r.fiscalYear}`;
      const priorityEl = document.createElement('span');
      priorityEl.textContent = r.priority ? `Priority ${r.priority}` : '';
      index.append(boardEl, yearEl, priorityEl);

      const body = document.createElement('div');
      const title = document.createElement('h3');
      title.textContent = r.request || 'Untitled request';
      const detail = document.createElement('p');
      detail.textContent = r.detail || '';
      const agency = document.createElement('p');
      agency.className = 'history-agency';
      agency.textContent = r.agency || 'Agency unavailable';
      body.append(title, detail, agency);

      const source = document.createElement('div');
      source.className = 'history-source';
      const response = document.createElement('span');
      response.textContent = r.response && !String(r.response).toLowerCase().includes('historical')
        ? r.response
        : 'Historical source does not include an agency response.';
      const link = document.createElement('a');
      link.href = r.sourceUrl || '#';
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = 'Official source ↗';
      source.append(response, link);

      article.append(index, body, source);
      root.appendChild(article);
    }
  }

  Promise.all([
    fetch('./data/historical-seed.json').then(r => r.json()),
    fetch('./data/historical-2018.json').then(r => r.json())
  ]).then(parts => {
    const seen = new Set();
    records = parts.flat().filter(r => r.fiscalYear && r.fiscalYear < 2027).filter(r => {
      const key = r.trackingCode || `${r.board}|${r.fiscalYear}|${normalize(r.request)}|${normalize(r.detail)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    addOptions();
    for (const selector of ['#historyBoard','#historyYear','#historySearch']) {
      q(selector).addEventListener('input', render);
    }
    render();
  }).catch(() => {
    q('#historyResults').textContent = 'Historical records could not be loaded.';
  });
})();
