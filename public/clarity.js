(() => {
  const statusMap = {
    'funded / completed': 'CITY SAYS FUNDED / COMPLETED',
    'supported': 'CITY SUPPORTS THIS',
    'funding uncertain': 'FUNDING IS UNCLEAR',
    'supported · not accommodated': 'SUPPORTED, BUT NOT ACCOMMODATED',
    'not supported': 'CITY DOESN’T SUPPORT THIS',
    'needs follow-up': 'NEEDS MORE REVIEW',
    'response unclassified': 'CITY RESPONSE AVAILABLE'
  };
  const cleanText = (el) => (el?.textContent || '').trim().toLowerCase();
  const setText = (el, value) => { if (el && el.textContent !== value) el.textContent = value; };

  function enhanceRecord(row) {
    if (!row || row.dataset.clarityReady) return;
    row.dataset.clarityReady = '1';
    const agencyCol = row.querySelector('.record-agency');
    if (agencyCol) {
      const agency = agencyCol.querySelector('.agency');
      const priority = agencyCol.querySelector('.priority');
      const status = agencyCol.querySelector('.status-short');
      if (agency) agency.outerHTML = `<div class="field-group"><span class="field-name">City agency</span><strong class="agency">${agency.textContent}</strong></div>`;
      if (priority) {
        const raw = priority.textContent.replace(/^Priority\s*/i,'').trim();
        priority.outerHTML = `<div class="field-group"><span class="field-name">How high the board ranked it</span><span class="priority">${raw && !/unavailable/i.test(raw) ? `#${raw}` : 'Rank not listed'}</span></div>`;
      }
      if (status) {
        status.textContent = statusMap[cleanText(status)] || status.textContent;
        status.insertAdjacentHTML('beforebegin','<span class="field-name">What the city said</span>');
      }
    }
    const repeat = row.querySelector('.repeat-mark');
    if (repeat && !repeat.hidden) setText(repeat, /project/i.test(repeat.textContent) ? 'ASKED AGAIN' : 'STILL COMING BACK');
    setText(row.querySelector('.record-details summary'), 'See the city response + official source');
  }

  function enhanceArchive() {
    document.querySelectorAll('.record-row').forEach(enhanceRecord);
    const source = document.querySelector('#sourceStatus');
    if (source) {
      if (/CURRENT NYC OPEN DATA/i.test(source.textContent)) setText(source,'OFFICIAL NYC DATA LOADED · HISTORICAL RECORDS INCLUDED · FY2016–FY2026');
      else if (/PREVIEW MODE/i.test(source.textContent)) setText(source,'HISTORICAL RECORDS LOADED · LIVE NYC DATA TEMPORARILY UNAVAILABLE');
    }
  }

  function enhanceMap() {
    const year = document.querySelector('#yearFilter')?.value;
    setText(document.querySelector('#mapTitle'), year && year !== 'all' ? `What was still showing up in FY ${year}?` : 'Where does Brooklyn keep getting stuck?');
    const note = document.querySelector('#mapCoverageNote');
    if (note && !/official/i.test(note.textContent)) setText(note,'Darker areas have more matching issues under your filters. Topic symbols show what each neighborhood raised most often.');
    const metric = document.querySelector('#legendMetric');
    if (metric) {
      const t = metric.textContent.toLowerCase();
      setText(metric, t.includes('recurring') ? 'ISSUES THAT CAME BACK' : t.includes('funding') ? 'ISSUES WITH UNCLEAR FUNDING' : 'ISSUES RAISED');
    }
    const dossier = document.querySelector('#mapDossier');
    if (!dossier) return;
    setText(dossier.querySelector('.section-label'),'NEIGHBORHOOD BRIEF');
    dossier.querySelectorAll('span').forEach(span => {
      const t = cleanText(span);
      if (t === 'matching records') setText(span,'issues in view');
      if (t === 'recurring records') setText(span,'still coming back');
      if (t === 'funded/completed responses') setText(span,'city says funded / completed');
      if (t === 'funding unclear / unavailable') setText(span,'funding unclear / unresolved');
    });
    dossier.querySelectorAll('h4').forEach(h => {
      if (/top topics/i.test(h.textContent)) setText(h,'BIGGEST ISSUES');
      if (/top agencies/i.test(h.textContent)) setText(h,'AGENCIES INVOLVED');
      if (/recurring request types/i.test(h.textContent)) setText(h,'WHAT KEPT COMING BACK');
      if (/official source set located/i.test(h.textContent)) setText(h,'Official records found for this year.');
    });
    dossier.querySelectorAll('.section-label').forEach(el => {
      if (/source indexed/i.test(el.textContent)) setText(el,el.textContent.replace(/SOURCE INDEXED/i,'OFFICIAL RECORDS FOUND'));
    });
  }

  function enhanceHistory() {
    document.querySelectorAll('.coverage-year').forEach(card => {
      const span = card.querySelector('span');
      if (!span) return;
      if (/extracted/i.test(span.textContent)) setText(span,span.textContent.replace(/extracted/i,'searchable issues'));
      if (/source indexed/i.test(span.textContent)) setText(span,'official records found');
    });
    document.querySelectorAll('.source-year-card').forEach(card => {
      card.querySelectorAll('.section-label').forEach(el => {
        const next = el.textContent.replace(/SOURCE INDEXED/i,'OFFICIAL RECORDS FOUND').replace(/PARTIAL EXTRACTION/i,'SEARCHABLE NOW');
        setText(el,next);
      });
      setText(card.querySelector('h3'),'The official records are here. Detailed browsing is coming next.');
    });
  }

  function enhanceAll(){ enhanceArchive(); enhanceMap(); enhanceHistory(); }
  let queued = false;
  const observer = new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; enhanceAll(); });
  });
  observer.observe(document.documentElement,{childList:true,subtree:true});
  document.addEventListener('change', () => setTimeout(enhanceAll,0));
  window.addEventListener('load', enhanceAll);
})();