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

  function cleanText(el) { return (el?.textContent || '').trim().toLowerCase(); }

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
        const friendly = statusMap[cleanText(status)] || status.textContent;
        status.textContent = friendly;
        status.insertAdjacentHTML('beforebegin','<span class="field-name">What the city said</span>');
      }
    }
    const repeat = row.querySelector('.repeat-mark');
    if (repeat && !repeat.hidden) repeat.textContent = /project/i.test(repeat.textContent) ? 'ASKED AGAIN' : 'STILL COMING BACK';
    const summary = row.querySelector('.record-details summary');
    if (summary) summary.textContent = 'See the city response + official source';
  }

  function enhanceArchive() {
    document.querySelectorAll('.record-row').forEach(enhanceRecord);
  }

  function enhanceMap() {
    const title = document.querySelector('#mapTitle');
    const year = document.querySelector('#yearFilter')?.value;
    if (title) title.textContent = year && year !== 'all' ? `What was still showing up in FY ${year}?` : 'Where does Brooklyn keep getting stuck?';
    const note = document.querySelector('#mapCoverageNote');
    if (note && !/official/i.test(note.textContent)) note.textContent = 'Darker areas have more matching issues under your filters. Topic symbols show what each neighborhood raised most often.';
    const metric = document.querySelector('#legendMetric');
    if (metric) {
      const t = metric.textContent.toLowerCase();
      metric.textContent = t.includes('recurring') ? 'ISSUES THAT CAME BACK' : t.includes('funding') ? 'ISSUES WITH UNCLEAR FUNDING' : 'ISSUES RAISED';
    }
    const dossier = document.querySelector('#mapDossier');
    if (dossier) {
      const label = dossier.querySelector('.section-label');
      if (label) label.textContent = 'NEIGHBORHOOD BRIEF';
      dossier.querySelectorAll('span').forEach(span => {
        const t = cleanText(span);
        if (t === 'matching records') span.textContent = 'issues in view';
        if (t === 'recurring records') span.textContent = 'still coming back';
        if (t === 'funded/completed responses') span.textContent = 'city says funded / completed';
        if (t === 'funding unclear / unavailable') span.textContent = 'funding unclear / unresolved';
      });
      dossier.querySelectorAll('h4').forEach(h => {
        if (/top topics/i.test(h.textContent)) h.textContent = 'BIGGEST ISSUES';
        if (/top agencies/i.test(h.textContent)) h.textContent = 'AGENCIES INVOLVED';
        if (/recurring request types/i.test(h.textContent)) h.textContent = 'WHAT KEPT COMING BACK';
        if (/official source set located/i.test(h.textContent)) h.textContent = 'Official records found for this year.';
      });
      dossier.querySelectorAll('.section-label').forEach(el => {
        if (/source indexed/i.test(el.textContent)) el.textContent = el.textContent.replace(/SOURCE INDEXED/i,'OFFICIAL RECORDS FOUND');
      });
    }
  }

  function enhanceHistory() {
    document.querySelectorAll('.coverage-year').forEach(card => {
      const span = card.querySelector('span');
      if (!span) return;
      const txt = span.textContent;
      if (/extracted/i.test(txt)) span.textContent = txt.replace(/extracted/i,'searchable issues');
      if (/source indexed/i.test(txt)) span.textContent = 'official records found';
    });
    document.querySelectorAll('.source-year-card').forEach(card => {
      card.querySelectorAll('.section-label').forEach(el => { el.textContent = el.textContent.replace(/SOURCE INDEXED/i,'OFFICIAL RECORDS FOUND').replace(/PARTIAL EXTRACTION/i,'SEARCHABLE NOW'); });
      const h = card.querySelector('h3'); if (h) h.textContent = 'The official records are here. Detailed browsing is coming next.';
    });
  }

  const observer = new MutationObserver(() => { enhanceArchive(); enhanceMap(); enhanceHistory(); });
  observer.observe(document.documentElement,{childList:true,subtree:true,characterData:true});
  document.addEventListener('change', () => setTimeout(() => { enhanceArchive(); enhanceMap(); enhanceHistory(); },0));
  window.addEventListener('load', () => { enhanceArchive(); enhanceMap(); enhanceHistory(); });
})();