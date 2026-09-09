(() => {
  const q = (s) => document.querySelector(s);
  const normalize = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  let records = [];
  let coverage = [];
  let boardMeta = new Map();

  function metaForBoard(board) {
    return boardMeta.get(Number(board)) || { shortName:`Community Board ${board}` };
  }

  function addOptions() {
    const boards = Array.from(new Set(records.map(r => r.board))).sort((a,b) => a-b);
    const years = coverage.map(r => r.fiscalYear).sort((a,b) => b-a);
    for (const board of boards) {
      const option = document.createElement('option');
      option.value = String(board);
      option.textContent = `CB ${board} · ${metaForBoard(board).shortName}`;
      q('#historyBoard').appendChild(option);
    }
    for (const year of years) {
      const option = document.createElement('option');
      option.value = String(year);
      option.textContent = `FY ${year}`;
      q('#historyYear').appendChild(option);
    }
  }

  function renderCoverage() {
    const root = q('#coverageTimeline');
    if (!root) return;
    root.replaceChildren();
    for (const item of [...coverage].sort((a,b) => a.fiscalYear-b.fiscalYear)) {
      const a = document.createElement('a');
      a.className = `coverage-year ${item.granularStatus}`;
      a.href = item.sourceUrl;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      const count = records.filter(r => r.fiscalYear === item.fiscalYear).length;
      a.innerHTML = `<strong>${item.fiscalYear}</strong><span>${count ? `${count} extracted` : 'source indexed'}</span>`;
      root.appendChild(a);
    }
  }

  function sourceOnlyCard(item) {
    const article = document.createElement('article');
    article.className = 'source-year-card';
    const status = item.granularStatus === 'source-indexed' ? 'SOURCE INDEXED' : 'PARTIAL EXTRACTION';
    article.innerHTML = `<div><span class="section-label">FY ${item.fiscalYear} · ${status}</span><h3>Official Brooklyn source set located.</h3><p>${item.note}</p></div><a href="${item.sourceUrl}" target="_blank" rel="noopener noreferrer">Open official source archive ↗</a>`;
    return article;
  }

  function render() {
    const board = q('#historyBoard').value;
    const year = q('#historyYear').value;
    const search = normalize(q('#historySearch').value);
    const filtered = records.filter(r => {
      if (board !== 'all' && String(r.board) !== board) return false;
      if (year !== 'all' && String(r.fiscalYear) !== year) return false;
      if (search && !normalize([r.request, r.detail, r.agency, r.priority, metaForBoard(r.board).shortName].join(' ')).includes(search)) return false;
      return true;
    }).sort((a,b) => (b.fiscalYear-a.fiscalYear) || (a.board-b.board));

    const selectedCoverage = year === 'all' ? null : coverage.find(c => String(c.fiscalYear) === year);
    q('#historyMeta').textContent = year === 'all'
      ? `${filtered.length.toLocaleString()} extracted records · ${coverage.length} consecutive source years`
      : `${filtered.length.toLocaleString()} extracted records · official FY ${year} source indexed`;

    const root = q('#historyResults');
    root.replaceChildren();

    if (!filtered.length && selectedCoverage) {
      root.appendChild(sourceOnlyCard(selectedCoverage));
      return;
    }
    if (!filtered.length) {
      const empty = document.createElement('p');
      empty.className = 'empty';
      empty.textContent = 'No extracted records match these filters.';
      root.appendChild(empty);
      return;
    }

    for (const r of filtered) {
      const article = document.createElement('article');
      article.className = 'history-row';
      const index = document.createElement('div');
      index.className = 'history-index';
      index.innerHTML = `<strong>BK CB ${String(r.board).padStart(2,'0')}</strong><span>${metaForBoard(r.board).shortName}</span><span>FY ${r.fiscalYear}</span><span>${r.priority ? `Priority ${r.priority}` : ''}</span>`;

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

  const dataFiles = [
    './data/historical-seed.json',
    './data/historical-2019.json',
    './data/historical-2018.json',
    './data/historical-2017.json',
    './data/historical-2016.json'
  ];

  Promise.all([
    fetch('./data/historical-coverage.json').then(r => r.json()),
    fetch('./data/board-meta.json').then(r => r.json()),
    ...dataFiles.map(file => fetch(file).then(r => r.json()))
  ]).then(([coverageData, boardData, ...parts]) => {
    coverage = coverageData.filter(c => c.fiscalYear >= 2016 && c.fiscalYear <= 2026);
    boardMeta = new Map(boardData.map(item => [Number(item.board), item]));
    const seen = new Set();
    records = parts.flat().filter(r => r.fiscalYear >= 2016 && r.fiscalYear <= 2026).filter(r => {
      const key = r.trackingCode || `${r.board}|${r.fiscalYear}|${normalize(r.request)}|${normalize(r.detail)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    addOptions();
    renderCoverage();
    for (const selector of ['#historyBoard','#historyYear','#historySearch']) q(selector).addEventListener('input', render);
    render();
  }).catch((err) => {
    console.error(err);
    q('#historyResults').textContent = 'Historical records could not be loaded.';
  });
})();
