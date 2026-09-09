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
    1:[0,0], 2:[14,2], 3:[10,-10], 4:[16,-3], 5:[20,4], 6:[22,2],
    7:[16,0], 8:[0,16], 9:[0,10], 10:[36,-6], 11:[25,-3], 12:[10,-7],
    13:[5,-12], 14:[12,-8], 15:[7,-18], 16:[18,8], 17:[12,7], 18:[12,-5]
  };

  const SVG_NS = 'http://www.w3.org/2000/svg';
  let scheduled = false;
  let mapStarted = false;

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
      const shift = text.getAttribute('transform') || '';
      group.setAttribute('transform',`${shift} translate(${(x-4.2).toFixed(1)} ${(y-4.2).toFixed(1)}) scale(.35)`.trim());
      group.innerHTML = iconMarkup[category];
      text.after(group);
    });
  }

  function syncDossier() {
    const dossier = document.querySelector('#mapDossier');
    const heading = dossier?.querySelector('h3');
    if (!dossier || !heading) return;
    const empty = /brooklyn[- ]wide|pick a neighborhood/i.test(heading.textContent || '');
    dossier.classList.toggle('is-empty', empty);
    if (empty) {
      setText(heading,'Pick a neighborhood');
      setText(dossier.querySelector('.dossier-intro'),'Click the map for a quick local brief.');
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
    setText(title, year === 'all' ? 'What keeps coming back across Brooklyn?' : `What showed up in ${year}?`);

    const note = document.querySelector('#mapCoverageNote');
    if (note && !/official/i.test(note.textContent || '')) setText(note,'Darker means more matching issues. Click any neighborhood.');

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
    replaceLegendIcons();
    replaceDossierIcons();
    replaceMapIcons();
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
  document.addEventListener('change',scheduleRefresh);
  window.addEventListener('DOMContentLoaded',() => {
    showStartupMessage();
    activateMapOnce();
    scheduleRefresh();
  });
})();