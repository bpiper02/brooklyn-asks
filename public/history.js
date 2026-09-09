(() => {
  const q = (s) => document.querySelector(s);
  const normalize = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const PAGE_SIZE = 28;
  let records = [];
  let coverage = [];
  let boardMeta = new Map();
  let visible = PAGE_SIZE;

  function metaForBoard(board) {
    return boardMeta.get(Number(board)) || { shortName:`Community Board ${board}` };
  }

  async function loadJson(file, fallback=[]) {
    try {
      const response = await fetch(file);
      if (!response.ok) throw new Error(`${file}: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.warn('Historical data source unavailable', error);
      return fallback;
    }
  }

  function addRecurring(items) {
    const yearsByIssue = new Map();
    for (const r of items) {
      const key = `${r.board}|${normalize(r.request)}`;
      if (!yearsByIssue.has(key)) yearsByIssue.set(key, new Set());
      if (r.fiscalYear) yearsByIssue.get(key).add(Number(r.fiscalYear));
    }
    return items.map(r => {
      const years = [...(yearsByIssue.get(`${r.board}|${normalize(r.request)}`) || [])].sort((a,b) => a-b);
      return {...r, recurrenceYears: years, recurringTheme: years.length >= 2};
    });
  }

  function addOptions() {
    const boards = Array.from(new Set(records.map(r => Number(r.board)).filter(Boolean))).sort((a,b) => a-b);
    const years = coverage.map(r => Number(r.fiscalYear)).filter(Boolean).sort((a,b) => b-a);
    for (const board of boards) {
      const option = document.createElement('option');
      option.value = String(board);
      option.textContent = `${metaForBoard(board).shortName} · CB ${board}`;
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
    const selectedYear = q('#historyYear')?.value || 'all';
    root.replaceChildren();

    for (const item of [...coverage].sort((a,b) => a.fiscalYear-b.fiscalYear)) {
      const button = document.createElement('button');
      const count = records.filter(r => Number(r.fiscalYear) === Number(item.fiscalYear)).length;
      const selected = String(item.fiscalYear) === selectedYear;
      button.type = 'button';
      button.className = `coverage-year ${item.granularStatus || ''}${selected ? ' is-selected' : ''}`;
      button.dataset.year = String(item.fiscalYear);
      button.setAttribute('aria-pressed', selected ? 'true' : 'false');
      button.setAttribute('aria-label', count
        ? `Show fiscal year ${item.fiscalYear}, ${count} searchable records`
        : `Show fiscal year ${item.fiscalYear}, official source found`);
      button.innerHTML = `<strong>${item.fiscalYear}</strong><span>${count ? `${count} searchable` : 'Source found'}</span>`;
      button.addEventListener('click', () => {
        q('#historyYear').value = String(item.fiscalYear);
        visible = PAGE_SIZE;
        renderCoverage();
        render();
        q('.history-controls')?.scrollIntoView({behavior:'smooth', block:'start'});
      });
      root.appendChild(button);
    }
  }

  function sourceOnlyCard(item, constrained=false) {
    const article = document.createElement('article');
    article.className = 'source-year-card';
    const title = constrained
      ? 'This filter cannot be verified from the searchable data yet.'
      : 'Official records found. Detailed browsing is still being added.';
    const note = constrained
      ? `Brooklyn Asks has the official FY ${item.fiscalYear} source set, but not enough request-level data yet to confirm this neighborhood or search.`
      : (item.note || `Official FY ${item.fiscalYear} records have been located.`);
    article.innerHTML = `<div><span class="section-label">FY ${item.fiscalYear}</span><h3>${title}</h3><p>${note}</p></div><a href="${item.sourceUrl}" target="_blank" rel="noopener noreferrer">Open official source ↗</a>`;
    return article;
  }

  function formatPriority(priority='') {
    const value = String(priority || '').trim();
    if (!value) return '';
    if (/historical/i.test(value)) return 'Historical need';
    return `Board rank ${value.replace(/^priority\s*/i,'')}`;
  }

  function isRealResponse(response='') {
    const text = String(response || '').trim();
    return Boolean(text) && !text.toLowerCase().includes('historical source');
  }

  function currentFilteredRecords() {
    const board = q('#historyBoard').value;
    const year = q('#historyYear').value;
    const search = normalize(q('#historySearch').value);
    return records.filter(r => {
      if (board !== 'all' && String(r.board) !== board) return false;
      if (year !== 'all' && String(r.fiscalYear) !== year) return false;
      if (search && !normalize([r.request, r.detail, r.agency, r.priority, metaForBoard(r.board).shortName].join(' ')).includes(search)) return false;
      return true;
    }).sort((a,b) => (b.fiscalYear-a.fiscalYear) || (a.board-b.board) || String(a.request).localeCompare(String(b.request)));
  }

  function updateHeading(filtered) {
    const board = q('#historyBoard').value;
    const year = q('#historyYear').value;
    const selectedCoverage = year === 'all' ? null : coverage.find(c => String(c.fiscalYear) === year);
    const boardName = board === 'all' ? null : metaForBoard(Number(board)).shortName;

    if (boardName && year !== 'all') q('#historyTitle').textContent = `${boardName} · FY ${year}`;
    else if (boardName) q('#historyTitle').textContent = `${boardName} across the decade`;
    else if (year !== 'all') q('#historyTitle').textContent = `What Brooklyn raised in FY ${year}`;
    else q('#historyTitle').textContent = 'Issues across the decade';

    const searchableYears = new Set(records.map(r => r.fiscalYear)).size;
    q('#historyMeta').textContent = year === 'all'
      ? `${filtered.length.toLocaleString()} searchable records · ${searchableYears} searchable years · ${coverage.length} years sourced`
      : filtered.length
        ? `${filtered.length.toLocaleString()} searchable record${filtered.length === 1 ? '' : 's'}`
        : selectedCoverage
          ? 'Official records found · detailed browsing not ready'
          : 'No searchable records';
  }

  function renderRow(r) {
    const article = document.createElement('article');
    article.className = 'history-row';

    const index = document.createElement('div');
    index.className = 'history-index';
    const boardCode = document.createElement('strong');
    boardCode.textContent = `CB ${String(r.board).padStart(2,'0')}`;
    const neighborhood = document.createElement('span');
    neighborhood.textContent = metaForBoard(r.board).shortName;
    const year = document.createElement('span');
    year.textContent = `FY ${r.fiscalYear}`;
    index.append(boardCode, neighborhood, year);
    const priorityText = formatPriority(r.priority);
    if (priorityText) {
      const priority = document.createElement('span');
      priority.textContent = priorityText;
      index.appendChild(priority);
    }
    if (r.recurringTheme) {
      const repeat = document.createElement('span');
      repeat.className = 'history-repeat';
      repeat.textContent = `Came back in ${r.recurrenceYears.length} years`;
      index.appendChild(repeat);
    }

    const body = document.createElement('div');
    const title = document.createElement('h3');
    title.textContent = r.request || 'Untitled request';
    body.appendChild(title);
    if (r.detail) {
      const detail = document.createElement('p');
      detail.textContent = r.detail;
      body.appendChild(detail);
    }
    const agency = document.createElement('p');
    agency.className = 'history-agency';
    agency.textContent = r.agency || 'Agency unavailable';
    body.appendChild(agency);

    const source = document.createElement('div');
    source.className = 'history-source';
    if (isRealResponse(r.response)) {
      const responseLabel = document.createElement('span');
      responseLabel.className = 'history-source-label';
      responseLabel.textContent = 'City response';
      const response = document.createElement('span');
      response.className = 'history-response';
      response.textContent = r.response;
      source.append(responseLabel, response);
    } else {
      const sourceLabel = document.createElement('span');
      sourceLabel.className = 'history-source-label';
      sourceLabel.textContent = 'Source';
      source.appendChild(sourceLabel);
    }
    if (r.sourceUrl) {
      const link = document.createElement('a');
      link.href = r.sourceUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = 'Official record ↗';
      source.appendChild(link);
    }

    article.append(index, body, source);
    return article;
  }

  function render() {
    const board = q('#historyBoard').value;
    const year = q('#historyYear').value;
    const search = normalize(q('#historySearch').value);
    const filtered = currentFilteredRecords();
    const selectedCoverage = year === 'all' ? null : coverage.find(c => String(c.fiscalYear) === year);
    updateHeading(filtered);

    const root = q('#historyResults');
    root.replaceChildren();

    if (!filtered.length && selectedCoverage) {
      root.appendChild(sourceOnlyCard(selectedCoverage, board !== 'all' || Boolean(search)));
      q('#historyLoadMore').hidden = true;
      return;
    }
    if (!filtered.length) {
      const empty = document.createElement('p');
      empty.className = 'empty';
      empty.textContent = 'No searchable records match these filters.';
      root.appendChild(empty);
      q('#historyLoadMore').hidden = true;
      return;
    }

    for (const r of filtered.slice(0, visible)) root.appendChild(renderRow(r));
    q('#historyLoadMore').hidden = filtered.length <= visible;
  }

  const dataFiles = [
    './data/historical-seed.json',
    './data/historical-2019.json',
    './data/historical-2018.json',
    './data/historical-2017.json',
    './data/historical-2016.json'
  ];

  Promise.all([
    loadJson('./data/historical-coverage.json'),
    loadJson('./data/board-meta.json'),
    ...dataFiles.map(file => loadJson(file))
  ]).then(([coverageData, boardData, ...parts]) => {
    coverage = coverageData.filter(c => c.fiscalYear >= 2016 && c.fiscalYear <= 2026);
    boardMeta = new Map(boardData.map(item => [Number(item.board), item]));
    const seen = new Set();
    const raw = parts.flat().filter(r => r.fiscalYear >= 2016 && r.fiscalYear <= 2026).filter(r => {
      const key = r.trackingCode || `${r.board}|${r.fiscalYear}|${normalize(r.request)}|${normalize(r.detail)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    records = addRecurring(raw);

    addOptions();
    renderCoverage();
    q('#historySearch').addEventListener('input', () => { visible = PAGE_SIZE; render(); });
    q('#historyYear').addEventListener('change', () => { visible = PAGE_SIZE; renderCoverage(); render(); });
    q('#historyBoard').addEventListener('change', () => { visible = PAGE_SIZE; render(); });
    q('#historyLoadMore').addEventListener('click', () => { visible += PAGE_SIZE; render(); });
    render();
  }).catch((error) => {
    console.error(error);
    q('#historyMeta').textContent = 'Could not load the decade';
    q('#historyResults').innerHTML = '<p class="empty">Historical records could not be loaded.</p>';
  });
})();
