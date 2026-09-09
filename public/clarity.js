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

  let queued = false;
  const observer = new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; enhanceArchive(); });
  });
  observer.observe(document.documentElement,{childList:true,subtree:true});
  window.addEventListener('load', enhanceArchive);
})();
