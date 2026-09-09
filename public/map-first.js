(() => {
  const symbolToCategory = {
    '◆':'transit', '⌂':'housing', '✦':'parks', '▣':'schools', '●':'safety',
    '+':'health', '▤':'infrastructure', '↔':'accessibility', '◇':'services'
  };

  const iconColor = {
    transit:'#315b6d', housing:'#8b3f32', parks:'#47623b', schools:'#6d5a2f', safety:'#7a4b4b',
    health:'#7a4d69', infrastructure:'#9a6235', accessibility:'#526c8b', services:'#596b3d'
  };

  const iconMarkup = {
    transit:'<rect x="5" y="3" width="14" height="15" rx="3"/><path d="M8 7h8M8 12h8M8 21l2-3M16 18l2 3"/><circle cx="9" cy="15" r="1"/><circle cx="15" cy="15" r="1"/>',
    housing:'<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10M9 20v-6h6v6"/>',
    parks:'<path d="M12 3l-5 7h3l-4 6h5v5h2v-5h5l-4-6h3z"/>',
    schools:'<path d="M3 10l9-6 9 6"/><path d="M5 10v10h14V10M8 14h2M14 14h2M11 20v-5h2v5"/>',
    safety:'<path d="M12 3l8 3v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6z"/><path d="M12 8v7M8.5 11.5h7"/>',
    health:'<path d="M9 4h6v5h5v6h-5v5H9v-5H4V9h5z"/>',
    infrastructure:'<path d="M3 20h18M5 18v-6M19 18v-6M5 12c4-6 10-6 14 0M8 18v-3M16 18v-3"/>',
    accessibility:'<circle cx="12" cy="5" r="2"/><path d="M10 9h4l1 5h3M10 9l-1 6a5 5 0 1 0 6 5M9 14h6"/>',
    services:'<circle cx="8" cy="8" r="3"/><circle cx="16" cy="8" r="3"/><path d="M3 20c.5-4 2.5-6 5-6s4.5 2 5 6M11 20c.5-4 2.5-6 5-6s4.5 2 5 6"/>'
  };

  const labelOffsets = {
    1:[0,-3], 2:[6,0], 3:[3,-5], 4:[6,-2], 5:[8,0], 6:[7,-2],
    7:[6,0], 8:[0,7], 9:[0,4], 10:[11,-2], 11:[8,-2], 12:[4,-3],
    13:[0,-5], 14:[4,-4], 15:[3,-8], 16:[6,2], 17:[5,2], 18:[5,-3]
  };

  const SVG_NS = 'http://www.w3.org/2000/svg';
  let scheduled = false;
  let mapStarted = false;
  let hoverBoard = null;
  let lastSelectedBoard = null;

  function setText(el, value) {
    if (el && el.textContent !== value) el.textContent = value;
  }

  function legendIcon(category) {
    return `<svg viewBox="0 0 24 24" aria-hidden="true">${iconMarkup[category] || ''}</svg>`;
  }

  function replaceLegendIcons() {
    document.querySelectorAll('.category-legend span[data-category]').forEach(span => {
      const category = span.dataset.category;
      const holder = span.querySelector('i');
      if (!holder || holder.dataset.iconReady === '1') return;
      holder.dataset.iconReady = '1';
      holder.innerHTML = legendIcon(category);
    });
  }

  function replaceDossierIcons() {
    document.querySelectorAll('#mapDossier .category-list li i').forEach(holder => {
      if (holder.dataset.iconReady === '1') return;
      const category = symbolToCategory[(holder.textContent || '').trim()];
      if (!category) return;
      holder.dataset.iconReady = '1';
      holder.style.setProperty('--category-color', iconColor[category]);
      holder.innerHTML = legendIcon(category);
    });
  }

  function boardNumberFromPath(path) {
    const match = (path.getAttribute('aria-label') || '').match(/Community Board\s+(\d+)/i);
    return match ? Number(match[1]) : null;
  }

  function boardNameFromPath(path) {
    const label = path.getAttribute('aria-label') || '';
    const match = label.match(/^Community Board\s+\d+,\s*(.*),\s*\d+\s+matching records$/i);
    return match ? match[1].trim() : `Community Board ${boardNumberFromPath(path) || ''}`.trim();
  }

  function pathForBoard(board) {
    return [...document.querySelectorAll('.atlas-district')]
      .find(path => boardNumberFromPath(path) === Number(board));
  }

  function selectedBoardNumber() {
    const filterValue = document.querySelector('#boardFilter')?.value;
    if (filterValue && filterValue !== 'all') return Number(filterValue);
    const path = document.querySelector('.atlas-district.is-selected');
    return path ? boardNumberFromPath(path) : null;
  }

  function selectedBoardName() {
    const board = selectedBoardNumber();
    if (!board) return '';
    const path = pathForBoard(board);
    return path ? boardNameFromPath(path) : `CB${String(board).padStart(2,'0')}`;
  }

  function simplifyMapLabels(svg) {
    svg.querySelectorAll('.atlas-label-name').forEach(label => {
      const parts = label.querySelectorAll('tspan');
      const board = parts[0]?.textContent?.match(/(\d+)/)?.[1];
      if (board) {
        label.dataset.labelBoard = String(Number(board));
        setText(parts[0], `CB${String(Number(board)).padStart(2,'0')}`);
      }
      if (parts[1]) parts[1].style.display = 'none';
    });
  }

  function shiftDistrictLabels(svg) {
    let board = null;
    let iconCount = 0;
    for (const child of [...svg.children]) {
      if (child.classList?.contains('atlas-district')) {
        board = boardNumberFromPath(child);
        iconCount = 0;
        continue;
      }
      if (!board) continue;
      const [dx,dy] = labelOffsets[board] || [0,0];
      const moveable = child.classList?.contains('board-accent-dot') || child.classList?.contains('atlas-label') || child.classList?.contains('category-dot') || child.classList?.contains('category-glyph');
      if (moveable && !child.dataset.mapShifted) {
        child.dataset.mapShifted = '1';
        if (dx || dy) child.setAttribute('transform', `translate(${dx} ${dy})`);
      }
      if (child.classList?.contains('atlas-label')) child.dataset.labelBoard = String(board);
      if (child.classList?.contains('category-dot') || child.classList?.contains('category-glyph')) child.dataset.topicBoard = String(board);
      if (child.classList?.contains('category-glyph')) {
        iconCount += 1;
        if (iconCount > 2) {
          child.style.display = 'none';
          const dot = child.previousElementSibling;
          if (dot?.classList?.contains('category-dot')) dot.style.display = 'none';
        }
      }
    }
  }

  function replaceMapIcons() {
    const svg = document.querySelector('.atlas-svg');
    if (!svg) return;
    simplifyMapLabels(svg);
    shiftDistrictLabels(svg);

    svg.querySelectorAll('.category-glyph').forEach(text => {
      if (text.dataset.iconReady === '1' || text.style.display === 'none') return;
      const category = symbolToCategory[(text.textContent || '').trim()];
      if (!category) return;
      text.dataset.iconReady = '1';
      text.style.display = 'none';

      const x = Number(text.getAttribute('x')) || 0;
      const y = Number(text.getAttribute('y')) || 0;
      const dot = text.previousElementSibling;
      if (dot?.classList?.contains('category-dot')) {
        dot.setAttribute('r','6.4');
        dot.setAttribute('fill','#f4efe4');
        dot.setAttribute('stroke',iconColor[category]);
      }

      const group = document.createElementNS(SVG_NS,'g');
      group.setAttribute('class','map-topic-icon');
      group.setAttribute('style',`color:${iconColor[category]}`);
      group.dataset.topicBoard = text.dataset.topicBoard || '';
      const shift = text.getAttribute('transform') || '';
      group.setAttribute('transform',`${shift} translate(${(x-4.2).toFixed(1)} ${(y-4.2).toFixed(1)}) scale(.35)`.trim());
      group.innerHTML = iconMarkup[category];
      text.after(group);
    });
  }

  function refreshTopicVisibility() {
    const selected = selectedBoardNumber();
    const contextBoard = hoverBoard || selected;
    document.querySelectorAll('[data-topic-board]').forEach(node => {
      const board = Number(node.dataset.topicBoard);
      node.classList.toggle('is-topic-visible', Boolean(board && board === contextBoard));
    });
  }

  function syncBoardStates() {
    const selected = selectedBoardNumber();
    let activeRow = null;

    document.querySelectorAll('.board-directory-row').forEach(row => {
      const board = Number(row.dataset.board);
      const active = board === selected;
      const hovered = board === hoverBoard && board !== selected;
      row.classList.toggle('is-active', active);
      row.classList.toggle('is-hovered', hovered);
      row.setAttribute('aria-pressed', active ? 'true' : 'false');
      if (active) activeRow = row;
    });

    document.querySelectorAll('.atlas-district').forEach(path => {
      const board = boardNumberFromPath(path);
      path.classList.toggle('is-key-hover', board === hoverBoard && board !== selected);
    });

    document.querySelectorAll('.atlas-label[data-label-board]').forEach(label => {
      const board = Number(label.dataset.labelBoard);
      label.classList.toggle('is-label-selected', board === selected);
      label.classList.toggle('is-label-hovered', board === hoverBoard && board !== selected);
    });

    if (selected !== lastSelectedBoard) {
      lastSelectedBoard = selected;
      activeRow?.scrollIntoView({block:'nearest'});
    }

    refreshTopicVisibility();
  }

  function setHoverBoard(board) {
    hoverBoard = board || null;
    syncBoardStates();
  }

  function setBoardFilterValue(board) {
    const select = document.querySelector('#boardFilter');
    if (!select || !board) return false;
    const value = String(board);
    if (select.value === value) return false;
    select.value = value;
    return true;
  }

  function selectBoard(board) {
    const select = document.querySelector('#boardFilter');
    if (!select || !board) return;
    hoverBoard = null;
    const value = String(board);
    const changed = select.value !== value;
    select.value = value;
    if (changed) {
      select.dispatchEvent(new Event('change',{bubbles:true}));
      return;
    }
    syncBoardStates();
    cleanMapCopy();
    syncDossier();
  }

  function installSelectionSync() {
    const root = document.querySelector('#boardMap');
    if (!root || root.dataset.selectionSyncReady === '1') return;
    root.dataset.selectionSyncReady = '1';

    const prepareSelection = event => {
      const path = event.target?.closest?.('.atlas-district');
      if (!path) return;
      const board = boardNumberFromPath(path);
      hoverBoard = null;
      const changed = setBoardFilterValue(board);
      if (!changed) return;
      queueMicrotask(() => {
        const select = document.querySelector('#boardFilter');
        if (select?.value === String(board)) select.dispatchEvent(new Event('change',{bubbles:true}));
      });
    };

    root.addEventListener('click', prepareSelection, true);
    root.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') prepareSelection(event);
    }, true);
  }

  function enhanceDistrictInteractions() {
    document.querySelectorAll('.atlas-district').forEach(path => {
      if (path.dataset.atlasInteractionReady === '1') return;
      path.dataset.atlasInteractionReady = '1';
      const board = boardNumberFromPath(path);
      path.addEventListener('mouseenter', () => setHoverBoard(board));
      path.addEventListener('mouseleave', () => setHoverBoard(null));
      path.addEventListener('focus', () => setHoverBoard(board));
      path.addEventListener('blur', () => setHoverBoard(null));
    });
  }

  function syncBoardDirectory() {
    const root = document.querySelector('#boardDirectoryList');
    if (!root) return;
    const paths = [...document.querySelectorAll('.atlas-district')]
      .map(path => ({path, board:boardNumberFromPath(path), name:boardNameFromPath(path)}))
      .filter(item => item.board)
      .sort((a,b) => a.board-b.board);
    if (!paths.length) return;

    const signature = paths.map(item => `${item.board}:${item.name}`).join('|');
    if (root.dataset.signature !== signature) {
      root.dataset.signature = signature;
      root.replaceChildren();
      for (const item of paths) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'board-directory-row';
        button.dataset.board = String(item.board);
        button.setAttribute('aria-pressed','false');
        button.setAttribute('aria-label',`Community Board ${item.board}: ${item.name}`);
        button.innerHTML = `<span class="board-key-no">${String(item.board).padStart(2,'0')}</span><span class="board-key-name">${item.name}</span>`;
        button.addEventListener('mouseenter', () => setHoverBoard(item.board));
        button.addEventListener('mouseleave', () => setHoverBoard(null));
        button.addEventListener('focus', () => setHoverBoard(item.board));
        button.addEventListener('blur', () => setHoverBoard(null));
        button.addEventListener('click', () => selectBoard(item.board));
        root.appendChild(button);
      }
    }
    syncBoardStates();
  }

  function syncDossier() {
    const dossier = document.querySelector('#mapDossier');
    const heading = dossier?.querySelector('h3');
    if (!dossier || !heading) return;
    const empty = /brooklyn[- ]wide|pick a neighborhood/i.test(heading.textContent || '');
    dossier.classList.toggle('is-empty', empty);
    if (empty) {
      setText(heading,'Pick a neighborhood');
      setText(dossier.querySelector('.dossier-intro'),'Click the map or board key for a quick local brief.');
    }
    dossier.querySelectorAll('.dossier-statline span').forEach(span => {
      const text = (span.textContent || '').trim().toLowerCase();
      if (text === 'matching records') setText(span,'issues in view');
      if (text === 'recurring records') setText(span,'came back');
      if (text === 'funded/completed responses') setText(span,'funded or completed');
      if (text === 'funding unclear / unavailable') setText(span,'unresolved responses');
    });
  }

  function cleanMapCopy() {
    const year = document.querySelector('#yearFilter')?.value || 'all';
    const title = document.querySelector('#mapTitle');
    const boardName = selectedBoardName();
    if (boardName) setText(title, year === 'all' ? `${boardName}: what keeps coming back?` : `${boardName} · ${year}`);
    else setText(title, year === 'all' ? 'What keeps coming back across Brooklyn?' : `What showed up in ${year}?`);

    const note = document.querySelector('#mapCoverageNote');
    if (note && !/official/i.test(note.textContent || '')) setText(note,'Darker = more matching issues. Hover or click a board.');

    const yearReadout = document.querySelector('#mapYearReadout');
    setText(yearReadout, year === 'all' ? '2016 to 2026' : year);

    const mapSelect = document.querySelector('#mapColorBy');
    if (mapSelect) {
      const labels = {volume:'Most issues raised',recurring:'Most issues that came back',uncertain:'Most unresolved responses'};
      [...mapSelect.options].forEach(option => { if (labels[option.value]) setText(option,labels[option.value]); });
    }
    const metric = document.querySelector('#legendMetric');
    if (metric) {
      const value = mapSelect?.value;
      setText(metric,value === 'recurring' ? 'ISSUES THAT CAME BACK' : value === 'uncertain' ? 'UNRESOLVED RESPONSES' : 'ISSUES RAISED');
    }
  }

  function showStartupMessage() {
    const root = document.querySelector('#boardMap');
    if (root && !root.querySelector('.atlas-svg') && !root.querySelector('.map-loading') && !root.querySelector('.map-error')) {
      root.innerHTML = '<div class="map-loading">Loading Brooklyn map…</div>';
    }
  }

  function activateMapOnce() {
    if (mapStarted) return;
    mapStarted = true;
    const mapButton = [...document.querySelectorAll('.nav-tab')].find(button => button.dataset.view === 'map');
    mapButton?.click();
  }

  function refresh() {
    scheduled = false;
    installSelectionSync();
    replaceLegendIcons();
    replaceDossierIcons();
    replaceMapIcons();
    syncBoardDirectory();
    enhanceDistrictInteractions();
    syncBoardStates();
    cleanMapCopy();
    syncDossier();
  }

  function scheduleRefresh() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(refresh);
  }

  const observer = new MutationObserver(scheduleRefresh);
  observer.observe(document.documentElement,{subtree:true,childList:true});
  document.addEventListener('change',event => {
    if (event.target?.id === 'boardFilter') hoverBoard = null;
    scheduleRefresh();
  });
  window.addEventListener('DOMContentLoaded',() => {
    showStartupMessage();
    activateMapOnce();
    scheduleRefresh();
  });
})();