const API_ROWS = 'https://data.cityofnewyork.us/resource/vn4m-mk4t.json?$limit=50000';
const API_META = 'https://data.cityofnewyork.us/api/views/vn4m-mk4t/columns.json';
const OFFICIAL_SOURCE = 'https://data.cityofnewyork.us/d/vn4m-mk4t';
const DISTRICT_GEOJSON = 'https://data.cityofnewyork.us/resource/5crt-au7u.geojson?$where=boro_cd%20between%20301%20and%20318';

const state = {
  records: [],
  visible: 24,
  usingLive: false,
  view: 'archive',
  selectedBoard: null,
  districtData: null
};
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

function clean(v) { return String(v ?? '').trim(); }
function normalize(s) {
  return clean(s).toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
}
function humanDate(value) {
  if (!value) return 'date unavailable';
  const d = new Date(value);
  return Number.isNaN(d.valueOf()) ? clean(value) : d.toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric' });
}
function parseTracking(code='') {
  const m = clean(code).match(/^(\d)(\d{2})(\d{4})(\d{2})(C|E|CS)$/i);
  if (!m) return {};
  return { boroughCode:+m[1], board:+m[2], fiscalYear:+m[3], sequence:+m[4], type:m[5].toUpperCase() };
}

function classifyResponse(text='') {
  const t = normalize(text);
  if (!t || t.includes('historical district needs record')) return 'unknown';
  if (/(already been funded|already been completed|request has been completed|has been funded)/.test(t)) return 'funded';
  if (/(supports and can accommodate|support and can accommodate|will try to accommodate)/.test(t)) return 'supported';
  if (/(availability of funds is uncertain|funding.*uncertain|recommends funding)/.test(t)) return 'uncertain';
  if (/(supports but cannot accommodate|support but cannot accommodate|unfunded request)/.test(t)) return 'not_funded';
  if (/(does not support and cannot accommodate|not recommended for funding|does not support)/.test(t)) return 'not_supported';
  if (/(further investigation|further study|more information is needed|requires more clarification|contact the agency|please contact)/.test(t)) return 'followup';
  return 'unknown';
}
const statusLabels = {
  funded:'Funded / completed', supported:'Supported', uncertain:'Funding uncertain',
  not_funded:'Supported · not accommodated', not_supported:'Not supported', followup:'Needs follow-up', unknown:'Response unclassified'
};

function inferFieldMap(columns=[]) {
  const byName = new Map(columns.map(c => [normalize(c.name), c.fieldName]));
  const pick = (...labels) => {
    for (const label of labels) if (byName.has(normalize(label))) return byName.get(normalize(label));
    return null;
  };
  return {
    publicationDate: pick('Publication Date','Publication date'), borough: pick('Borough'), board: pick('C Board','Community Board','Community Board Number'),
    priority: pick('Priority'), trackingCode: pick('Tracking Code'), request: pick('Request'), councilDistrict: pick('Council District'),
    nta: pick('NTA'), agency: pick('Agency','Responsible Agency'), response: pick('Response','Agency Response','Budget Response'),
    explanation: pick('Explanation','Request Explanation','Reason'), location: pick('Location','Site Address','Address')
  };
}
function pickByGuess(obj, guesses) {
  const keys = Object.keys(obj);
  for (const guess of guesses) {
    const exact = keys.find(k => normalize(k) === normalize(guess));
    if (exact) return obj[exact];
  }
  return '';
}
function toRecord(row, map={}) {
  const get = (field, guesses=[]) => (map[field] && row[map[field]] != null) ? row[map[field]] : pickByGuess(row, guesses);
  const trackingCode = clean(get('trackingCode',['tracking_code','tracking code']));
  const parsed = parseTracking(trackingCode);
  const borough = clean(get('borough',['borough']));
  const boardRaw = get('board',['c_board','community_board','c board']);
  const board = Number(boardRaw || parsed.board || 0);
  const fiscalYear = parsed.fiscalYear || Number(pickByGuess(row,['fiscal_year','fiscal year'])) || null;
  const response = clean(get('response',['response','agency_response','agency response','budget_response','budget response']));
  const detail = clean(get('explanation',['explanation','request_explanation','reason']) || get('location',['location','site_address','address']));
  return {
    board, fiscalYear, trackingCode,
    request: clean(get('request',['request'])), detail,
    agency: clean(get('agency',['agency','responsible_agency'])), priority: clean(get('priority',['priority'])),
    response, publicationDate: clean(get('publicationDate',['publication_date','publication date'])),
    sourceUrl: OFFICIAL_SOURCE,
    borough,
    projectKey: '',
    status: classifyResponse(response)
  };
}

function dedupeLatest(records) {
  const groups = new Map();
  for (const r of records) {
    const key = r.trackingCode || `${r.board}|${r.fiscalYear}|${normalize(r.request)}|${normalize(r.detail)}`;
    const old = groups.get(key);
    if (!old || new Date(r.publicationDate || 0) >= new Date(old.publicationDate || 0)) groups.set(key, r);
  }
  return [...groups.values()];
}
function addRecurring(records) {
  const topicYears = new Map();
  const projectYears = new Map();
  for (const r of records) {
    const topic = `${r.board}|${normalize(r.request)}`;
    if (!topicYears.has(topic)) topicYears.set(topic,new Set());
    if (r.fiscalYear) topicYears.get(topic).add(r.fiscalYear);
    if (r.projectKey) {
      if (!projectYears.has(r.projectKey)) projectYears.set(r.projectKey,new Set());
      if (r.fiscalYear) projectYears.get(r.projectKey).add(r.fiscalYear);
    }
  }
  return records.map(r => ({
    ...r,
    recurringTheme: (topicYears.get(`${r.board}|${normalize(r.request)}`)?.size || 0) >= 2,
    repeatedProject: r.projectKey ? (projectYears.get(r.projectKey)?.size || 0) >= 2 : false
  }));
}

async function loadData() {
  let seed = [];
  try { seed = await fetch('./data/historical-seed.json').then(r => r.json()); } catch {}
  seed = seed.map(r => ({...r, status: classifyResponse(r.response)}));
  try {
    const [columns, rows] = await Promise.all([
      fetch(API_META).then(r => { if(!r.ok) throw new Error('metadata'); return r.json(); }),
      fetch(API_ROWS).then(r => { if(!r.ok) throw new Error('rows'); return r.json(); })
    ]);
    const map = inferFieldMap(columns);
    const live = rows.map(r => toRecord(r,map)).filter(r => {
      const b = normalize(r.borough);
      return r.board >= 1 && r.board <= 18 && (!b || b.includes('brooklyn'));
    });
    state.records = addRecurring(dedupeLatest([...live, ...seed]));
    state.usingLive = true;
    $('#sourceStatus').textContent = `CURRENT NYC OPEN DATA · ${seed.length} SOURCED HISTORY RECORDS ALSO INDEXED`;
  } catch (err) {
    console.warn('Live API unavailable; using seed data', err);
    state.records = addRecurring(dedupeLatest(seed));
    $('#sourceStatus').textContent = 'PREVIEW MODE · LIVE NYC API UNAVAILABLE IN THIS SESSION';
  }
  populateBoards();
  render();
}

function populateBoards() {
  const select = $('#boardFilter');
  for (let i=1;i<=18;i++) {
    const o = document.createElement('option'); o.value=String(i); o.textContent=`Brooklyn CB ${i}`; select.appendChild(o);
  }
}
function filteredRecords({ignoreBoard=false}={}) {
  const q = normalize($('#search').value);
  const board = $('#boardFilter').value;
  const status = $('#statusFilter').value;
  const repeatOnly = $('#repeatOnly').checked;
  return state.records.filter(r => {
    if (!ignoreBoard && board !== 'all' && String(r.board) !== board) return false;
    if (status !== 'all' && r.status !== status) return false;
    if (repeatOnly && !(r.recurringTheme || r.repeatedProject)) return false;
    if (q && !normalize([r.request,r.detail,r.agency,r.response,r.trackingCode,`cb ${r.board}`].join(' ')).includes(q)) return false;
    return true;
  }).sort((a,b) => {
    if ((b.repeatedProject?1:0)!==(a.repeatedProject?1:0)) return (b.repeatedProject?1:0)-(a.repeatedProject?1:0);
    if ((b.recurringTheme?1:0)!==(a.recurringTheme?1:0)) return (b.recurringTheme?1:0)-(a.recurringTheme?1:0);
    return new Date(b.publicationDate||0)-new Date(a.publicationDate||0);
  });
}

function render() {
  const records = filteredRecords();
  const latest = state.records.reduce((m,r)=>Math.max(m,new Date(r.publicationDate||0).valueOf()||0),0);
  const maxYear = Math.max(...state.records.map(x=>x.fiscalYear||0));
  $('#requestCount').textContent = state.records.filter(r=>r.fiscalYear === maxYear).length.toLocaleString() || state.records.length.toLocaleString();
  $('#repeatCount').textContent = new Set(state.records.filter(r=>r.recurringTheme).map(r=>`${r.board}|${normalize(r.request)}`)).size.toLocaleString();
  $('#latestDate').textContent = latest ? new Date(latest).toLocaleDateString('en-US',{month:'short',year:'numeric'}) : '—';
  $('#headerUpdated').textContent = latest ? `UPDATED ${new Date(latest).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}).toUpperCase()}` : 'UPDATED —';
  const boardVal = $('#boardFilter').value;
  $('#resultsTitle').textContent = boardVal === 'all' ? 'Brooklyn-wide' : `Brooklyn Community Board ${boardVal}`;
  $('#resultMeta').textContent = `${records.length.toLocaleString()} matching records`;
  $('#clearSearch').hidden = !$('#search').value;

  const root = $('#results'); root.innerHTML='';
  if (!records.length) {
    root.innerHTML='<div class="empty">No matching requests. Try a broader search or clear a filter.</div>';
    $('#loadMore').hidden=true;
  } else {
    for (const r of records.slice(0,state.visible)) root.appendChild(recordRow(r));
    $('#loadMore').hidden = records.length <= state.visible;
  }

  if (state.view === 'map') refreshMap();
}

function recordRow(r) {
  const node = $('#requestTemplate').content.firstElementChild.cloneNode(true);
  node.querySelector('.board-code').textContent=`BK CB ${String(r.board).padStart(2,'0')}`;
  node.querySelector('.year').textContent=r.fiscalYear ? `FY ${r.fiscalYear}` : 'FY unknown';
  const repeat=node.querySelector('.repeat-mark');
  if (r.repeatedProject || r.recurringTheme) {
    repeat.hidden=false;
    repeat.textContent=r.repeatedProject?'Repeated project':'Recurring theme';
  }
  node.querySelector('.request-title').textContent=r.request || 'Untitled request';
  const detail=node.querySelector('.request-detail');
  if(r.detail){ detail.hidden=false; detail.textContent=r.detail; }
  node.querySelector('.agency').textContent=r.agency || 'Agency unavailable';
  node.querySelector('.priority').textContent=r.priority ? `Priority ${r.priority}` : 'Priority unavailable';
  const short=node.querySelector('.status-short');
  short.textContent=statusLabels[r.status] || statusLabels.unknown;
  short.classList.add(r.status.replace('_','-'));
  node.querySelector('.status-label').textContent=statusLabels[r.status] || statusLabels.unknown;
  node.querySelector('.publication-date').textContent=humanDate(r.publicationDate);
  node.querySelector('.response').textContent=r.response || 'No agency response captured in this record.';
  node.querySelector('.tracking').textContent=r.trackingCode ? `TRACKING ${r.trackingCode}` : 'TRACKING CODE UNAVAILABLE';
  const link=node.querySelector('.source-link'); link.href=r.sourceUrl || OFFICIAL_SOURCE;
  return node;
}

function switchView(view) {
  state.view = view;
  $('#archiveView').hidden = view !== 'archive';
  $('#mapView').hidden = view !== 'map';
  $$('.nav-tab').forEach(b => b.classList.toggle('is-active', b.dataset.view === view));
  if (view === 'map') {
    initMap();
  }
}

async function initMap() {
  if (state.districtData) { drawDistricts(); return; }
  const root = $('#boardMap');
  root.innerHTML = '<div class="map-error">Loading official Community District boundaries…</div>';
  try {
    const geo = await fetch(DISTRICT_GEOJSON).then(r => { if(!r.ok) throw new Error('district boundaries'); return r.json(); });
    state.districtData = geo;
    drawDistricts();
  } catch (err) {
    console.warn('District map unavailable', err);
    root.innerHTML='<div class="map-error">Brooklyn Community District boundaries could not be loaded. The Archive remains fully usable; try the map again on the deployed site.</div>';
  }
}

function boardFromFeature(feature) {
  const raw = Number(feature?.properties?.boro_cd || feature?.properties?.BoroCD || 0);
  if (raw >= 301 && raw <= 318) return raw - 300;
  return null;
}
function boardCounts() {
  const records = filteredRecords({ignoreBoard:true});
  const counts = new Map();
  for (let i=1;i<=18;i++) counts.set(i,0);
  for (const r of records) counts.set(r.board,(counts.get(r.board)||0)+1);
  return counts;
}
function geometryRings(feature) {
  const g = feature?.geometry;
  if (!g) return [];
  if (g.type === 'Polygon') return [g.coordinates];
  if (g.type === 'MultiPolygon') return g.coordinates;
  return [];
}
function allCoords(features) {
  const points=[];
  for (const f of features) for (const poly of geometryRings(f)) for (const ring of poly) for (const pt of ring) points.push(pt);
  return points;
}
function polygonCentroid(poly) {
  const ring = poly?.[0] || [];
  if (!ring.length) return [0,0];
  let sx=0, sy=0;
  for (const [x,y] of ring) { sx+=x; sy+=y; }
  return [sx/ring.length, sy/ring.length];
}
function drawDistricts() {
  if (!state.districtData) return;
  const root = $('#boardMap');
  const features = state.districtData.features.filter(f => boardFromFeature(f));
  const pts = allCoords(features);
  if (!pts.length) { root.innerHTML='<div class="map-error">Boundary geometry was unavailable.</div>'; return; }

  const xs=pts.map(p=>p[0]), ys=pts.map(p=>p[1]);
  const minX=Math.min(...xs), maxX=Math.max(...xs), minY=Math.min(...ys), maxY=Math.max(...ys);
  const W=900, H=650, pad=42;
  const xScale=(W-pad*2)/(maxX-minX), yScale=(H-pad*2)/(maxY-minY);
  const scale=Math.min(xScale,yScale);
  const usedW=(maxX-minX)*scale, usedH=(maxY-minY)*scale;
  const xOffset=(W-usedW)/2, yOffset=(H-usedH)/2;
  const project=([x,y])=>[xOffset+(x-minX)*scale, H-(yOffset+(y-minY)*scale)];
  const pathForFeature=(f)=>geometryRings(f).map(poly=>poly.map(ring=>ring.map((pt,i)=>{const [x,y]=project(pt); return `${i?'L':'M'}${x.toFixed(1)},${y.toFixed(1)}`;}).join(' ')+' Z').join(' ')).join(' ');
  const counts=boardCounts();
  const max=Math.max(1,...counts.values());
  const selectedFilter=$('#boardFilter').value;

  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.setAttribute('class','atlas-svg');
  svg.setAttribute('viewBox',`0 0 ${W} ${H}`);
  svg.setAttribute('aria-labelledby','atlasTitle atlasDesc');
  svg.innerHTML='<title id="atlasTitle">Brooklyn Community District record atlas</title><desc id="atlasDesc">Community District shading reflects the number of request records matching the current filters.</desc><text class="atlas-kicker" x="28" y="28">BROOKLYN COMMUNITY DISTRICTS · RECORD INDEX</text>';

  for (const feature of features) {
    const board=boardFromFeature(feature);
    const count=counts.get(board)||0;
    const ratio=count/max;
    const path=document.createElementNS('http://www.w3.org/2000/svg','path');
    path.setAttribute('d',pathForFeature(feature));
    path.setAttribute('class','atlas-district');
    if (state.selectedBoard===board || String(board)===selectedFilter) path.classList.add('is-selected');
    path.setAttribute('fill','#17354a');
    path.setAttribute('fill-opacity',String(.10+ratio*.58));
    path.setAttribute('tabindex','0');
    path.setAttribute('role','button');
    path.setAttribute('aria-label',`Brooklyn Community Board ${board}, ${count} matching records`);
    const choose=()=>{state.selectedBoard=board;renderDossier(board);drawDistricts();};
    path.addEventListener('click',choose);
    path.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();choose();}});
    const title=document.createElementNS('http://www.w3.org/2000/svg','title');
    title.textContent=`BK CB ${String(board).padStart(2,'0')} · ${count} matching records`;
    path.appendChild(title);
    svg.appendChild(path);

    const polys=geometryRings(feature);
    const largest=polys.sort((a,b)=>(b[0]?.length||0)-(a[0]?.length||0))[0];
    if (largest) {
      const [cx,cy]=project(polygonCentroid(largest));
      const label=document.createElementNS('http://www.w3.org/2000/svg','text');
      label.setAttribute('x',cx.toFixed(1)); label.setAttribute('y',cy.toFixed(1));
      label.setAttribute('text-anchor','middle'); label.setAttribute('dominant-baseline','central');
      label.setAttribute('class','atlas-label'); label.textContent=String(board).padStart(2,'0');
      svg.appendChild(label);
    }
  }
  root.replaceChildren(svg);
  renderDossier(state.selectedBoard);
}
function refreshMap() {
  if (state.districtData) drawDistricts();
  else initMap();
}

function countBy(records, getter) {
  const map = new Map();
  for (const r of records) {
    const key = clean(getter(r)) || 'Unknown';
    map.set(key,(map.get(key)||0)+1);
  }
  return [...map.entries()].sort((a,b)=>b[1]-a[1]);
}
function renderDossier(board) {
  const base = filteredRecords({ignoreBoard:true});
  const records = board ? base.filter(r=>r.board===board) : base;
  const recurring = records.filter(r=>r.recurringTheme || r.repeatedProject);
  const funded = records.filter(r=>r.status==='funded').length;
  const uncertain = records.filter(r=>r.status==='uncertain' || r.status==='not_funded').length;
  const agencies = countBy(records,r=>r.agency).slice(0,5);
  const recurringTopics = countBy(recurring,r=>r.request).slice(0,5);

  $('#mapDossier h3').textContent = board ? `Brooklyn CB ${String(board).padStart(2,'0')}` : 'Brooklyn-wide';
  $('.dossier-intro').textContent = board
    ? 'A board-level snapshot of the records matching your current search and response filters.'
    : 'Choose a Community District on the map to inspect its request volume, recurring themes, agencies, and response mix.';

  const body = $('#dossierBody');
  body.innerHTML = `
    <div class="dossier-statline">
      <div><strong>${records.length.toLocaleString()}</strong><span>matching records</span></div>
      <div><strong>${recurring.length.toLocaleString()}</strong><span>recurring records</span></div>
      <div><strong>${funded.toLocaleString()}</strong><span>funded/completed responses</span></div>
      <div><strong>${uncertain.toLocaleString()}</strong><span>funding unclear / unavailable</span></div>
    </div>
    <section class="dossier-section">
      <h4>TOP AGENCIES IN THESE RECORDS</h4>
      <ul class="dossier-list">${agencies.length ? agencies.map(([name,n])=>`<li>${escapeHtml(name)}<small>${n} record${n===1?'':'s'}</small></li>`).join('') : '<li>No matching agency records.</li>'}</ul>
    </section>
    <section class="dossier-section">
      <h4>RECURRING REQUEST TYPES</h4>
      <ul class="dossier-list">${recurringTopics.length ? recurringTopics.map(([name,n])=>`<li>${escapeHtml(name)}<small>${n} recurring record${n===1?'':'s'}</small></li>`).join('') : '<li>No recurring request types in the current filter.</li>'}</ul>
    </section>
    ${board ? '<button class="dossier-action" id="openBoardArchive" type="button">Open this board in the archive →</button>' : ''}
  `;
  $('#openBoardArchive')?.addEventListener('click',()=>{
    $('#boardFilter').value=String(board);
    state.visible=24;
    switchView('archive');
    render();
    $('#archiveView').scrollIntoView({behavior:'smooth',block:'start'});
  });
}
function escapeHtml(value='') {
  return clean(value).replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[ch]));
}

['search','boardFilter','statusFilter','repeatOnly'].forEach(id => {
  $('#'+id).addEventListener(id==='search'?'input':'change',()=>{
    state.visible=24;
    if (id==='boardFilter') state.selectedBoard = $('#boardFilter').value === 'all' ? null : Number($('#boardFilter').value);
    render();
  });
});
$('#clearSearch').addEventListener('click',()=>{$('#search').value='';state.visible=24;render();$('#search').focus();});
$('#loadMore').addEventListener('click',()=>{state.visible+=24;render();});
$$('.nav-tab').forEach(button => button.addEventListener('click',()=>switchView(button.dataset.view)));

loadData();

export { normalize, parseTracking, classifyResponse, dedupeLatest, addRecurring, boardFromFeature };
