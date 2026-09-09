const API_ROWS = 'https://data.cityofnewyork.us/resource/vn4m-mk4t.json?$limit=50000';
const API_META = 'https://data.cityofnewyork.us/api/views/vn4m-mk4t/columns.json';
const OFFICIAL_SOURCE = 'https://data.cityofnewyork.us/d/vn4m-mk4t';
const DISTRICT_GEOJSON = 'https://data.cityofnewyork.us/resource/5crt-au7u.geojson?$where=boro_cd%20between%20301%20and%20318';
const HISTORICAL_FILES = [
  './data/historical-seed.json',
  './data/historical-2019.json',
  './data/historical-2018.json',
  './data/historical-2017.json',
  './data/historical-2016.json'
];

const categoryDefs = {
  transit: { label:'Transit', symbol:'◆', color:'#315b6d' },
  housing: { label:'Housing', symbol:'⌂', color:'#8b3f32' },
  parks: { label:'Parks', symbol:'✦', color:'#47623b' },
  schools: { label:'Schools', symbol:'▣', color:'#6d5a2f' },
  safety: { label:'Public safety', symbol:'●', color:'#7a4b4b' },
  health: { label:'Health', symbol:'+', color:'#7a4d69' },
  infrastructure: { label:'Infrastructure', symbol:'▤', color:'#9a6235' },
  accessibility: { label:'Accessibility', symbol:'↔', color:'#526c8b' },
  services: { label:'Community services', symbol:'◇', color:'#596b3d' },
  other: { label:'Other', symbol:'·', color:'#6b6258' }
};

const state = {
  records: [],
  coverage: [],
  boardMeta: new Map(),
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

function inferCategory(record={}) {
  const t = normalize([record.request, record.detail, record.agency].join(' '));
  if (/(subway|bus|transit|traffic|street|road|bike|bicycle|pedestrian|transportation|commuter van|station|mta|nycta|dot)/.test(t)) return 'transit';
  if (/(housing|affordable|nycha|tenant|residential|hpd|homeless shelter)/.test(t)) return 'housing';
  if (/(park|playground|pool|recreation|green space|tree|parks and recreation)/.test(t)) return 'parks';
  if (/(school|classroom|education|student|sca|college|library)/.test(t)) return 'schools';
  if (/(police|nypd|fire|fdny|crossing guard|public safety|precinct|ems)/.test(t)) return 'safety';
  if (/(health|hospital|clinic|mental health|aging|senior|elder|hospitals corporation)/.test(t)) return 'health';
  if (/(sewer|flood|drain|water|infrastructure|reconstruct|construction|building|facility|capital repair|dep)/.test(t)) return 'infrastructure';
  if (/(accessib|ada|wheelchair|elevator|mobility|universal design)/.test(t)) return 'accessibility';
  if (/(community service|youth|workforce|sanitation|social service|outreach|case management|board budget|staffing)/.test(t)) return 'services';
  return 'other';
}

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
  const record = {
    board, fiscalYear, trackingCode,
    request: clean(get('request',['request'])), detail,
    agency: clean(get('agency',['agency','responsible_agency'])), priority: clean(get('priority',['priority'])),
    response, publicationDate: clean(get('publicationDate',['publication_date','publication date'])),
    sourceUrl: OFFICIAL_SOURCE,
    borough,
    projectKey: '',
    status: classifyResponse(response)
  };
  return {...record, category: inferCategory(record)};
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

async function loadJson(file, fallback=[]) {
  try {
    const res = await fetch(file);
    if (!res.ok) throw new Error(file);
    return await res.json();
  } catch { return fallback; }
}

async function loadData() {
  const [coverage, boardMeta, ...historicalParts] = await Promise.all([
    loadJson('./data/historical-coverage.json'),
    loadJson('./data/board-meta.json'),
    ...HISTORICAL_FILES.map(file => loadJson(file))
  ]);
  state.coverage = coverage.filter(c => c.fiscalYear >= 2016 && c.fiscalYear <= 2026);
  state.boardMeta = new Map(boardMeta.map(item => [Number(item.board), item]));

  let historical = historicalParts.flat().map(r => {
    const record = {...r, status: classifyResponse(r.response)};
    return {...record, category: inferCategory(record)};
  });

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
    state.records = addRecurring(dedupeLatest([...live, ...historical]));
    state.usingLive = true;
    $('#sourceStatus').textContent = `CURRENT NYC OPEN DATA · ${historical.length} EXTRACTED HISTORICAL RECORDS · FY2016–FY2026 SOURCES INDEXED`;
  } catch (err) {
    console.warn('Live API unavailable; using historical data', err);
    state.records = addRecurring(dedupeLatest(historical));
    $('#sourceStatus').textContent = 'PREVIEW MODE · HISTORICAL SOURCES LOADED · LIVE NYC API UNAVAILABLE';
  }
  populateFilters();
  renderCategoryLegend();
  render();
}

function metaForBoard(board) {
  return state.boardMeta.get(Number(board)) || { shortName:`Community Board ${board}`, neighborhoods:[], accent:'#17354a' };
}
function populateFilters() {
  const boardSelect = $('#boardFilter');
  for (let i=1;i<=18;i++) {
    const meta = metaForBoard(i);
    const o = document.createElement('option');
    o.value=String(i);
    o.textContent=`CB ${i} · ${meta.shortName}`;
    boardSelect.appendChild(o);
  }
  const yearSelect = $('#yearFilter');
  const years = state.coverage.length ? state.coverage.map(c=>c.fiscalYear) : Array.from({length:11},(_,i)=>2016+i);
  [...new Set(years)].sort((a,b)=>b-a).forEach(year => {
    const o=document.createElement('option');
    o.value=String(year);
    o.textContent=`FY ${year}`;
    yearSelect.appendChild(o);
  });
}

function filteredRecords({ignoreBoard=false}={}) {
  const q = normalize($('#search').value);
  const board = $('#boardFilter').value;
  const year = $('#yearFilter').value;
  const category = $('#categoryFilter').value;
  const status = $('#statusFilter').value;
  const repeatOnly = $('#repeatOnly').checked;
  return state.records.filter(r => {
    if (!ignoreBoard && board !== 'all' && String(r.board) !== board) return false;
    if (year !== 'all' && String(r.fiscalYear) !== year) return false;
    if (category !== 'all' && r.category !== category) return false;
    if (status !== 'all' && r.status !== status) return false;
    if (repeatOnly && !(r.recurringTheme || r.repeatedProject)) return false;
    const meta = metaForBoard(r.board);
    if (q && !normalize([r.request,r.detail,r.agency,r.response,r.trackingCode,`cb ${r.board}`,meta.shortName,...(meta.neighborhoods||[])].join(' ')).includes(q)) return false;
    return true;
  }).sort((a,b) => {
    if ((b.repeatedProject?1:0)!==(a.repeatedProject?1:0)) return (b.repeatedProject?1:0)-(a.repeatedProject?1:0);
    if ((b.recurringTheme?1:0)!==(a.recurringTheme?1:0)) return (b.recurringTheme?1:0)-(a.recurringTheme?1:0);
    return new Date(b.publicationDate||0)-new Date(a.publicationDate||0);
  });
}

function selectedCoverage() {
  const year = $('#yearFilter').value;
  return year === 'all' ? null : state.coverage.find(c => String(c.fiscalYear) === year);
}
function coverageMessage(records) {
  const year = $('#yearFilter').value;
  const item = selectedCoverage();
  if (year === 'all') return `${records.length.toLocaleString()} matching extracted records across FY2016–FY2026`;
  if (records.length) return `${records.length.toLocaleString()} matching extracted records · FY ${year}`;
  if (item) return `FY ${year} official source set indexed · granular extraction ${item.granularStatus === 'source-indexed' ? 'in progress' : 'partial'}`;
  return `No extracted records for FY ${year}`;
}

function render() {
  const records = filteredRecords();
  const latest = state.records.reduce((m,r)=>Math.max(m,new Date(r.publicationDate||0).valueOf()||0),0);
  $('#requestCount').textContent = records.length.toLocaleString();
  $('#repeatCount').textContent = new Set(records.filter(r=>r.recurringTheme).map(r=>`${r.board}|${normalize(r.request)}`)).size.toLocaleString();
  $('#latestDate').textContent = latest ? new Date(latest).toLocaleDateString('en-US',{month:'short',year:'numeric'}) : '—';
  $('#headerUpdated').textContent = latest ? `UPDATED ${new Date(latest).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}).toUpperCase()}` : 'UPDATED —';
  const boardVal = $('#boardFilter').value;
  const yearVal = $('#yearFilter').value;
  const boardMeta = boardVal === 'all' ? null : metaForBoard(Number(boardVal));
  $('#resultsTitle').textContent = boardVal === 'all'
    ? (yearVal === 'all' ? 'Brooklyn-wide' : `Brooklyn · FY ${yearVal}`)
    : `${boardMeta.shortName}${yearVal === 'all' ? '' : ` · FY ${yearVal}`}`;
  $('#resultMeta').textContent = coverageMessage(records);
  $('#clearSearch').hidden = !$('#search').value;

  const root = $('#results'); root.innerHTML='';
  if (!records.length) {
    const item = selectedCoverage();
    root.innerHTML = item
      ? `<div class="empty"><strong>Official FY ${item.fiscalYear} sources are indexed.</strong><br>${escapeHtml(item.note || 'Granular request extraction is still in progress.')} <a href="${item.sourceUrl}" target="_blank" rel="noopener noreferrer">Open source archive ↗</a></div>`
      : '<div class="empty">No matching requests. Try a broader search or clear a filter.</div>';
    $('#loadMore').hidden=true;
  } else {
    for (const r of records.slice(0,state.visible)) root.appendChild(recordRow(r));
    $('#loadMore').hidden = records.length <= state.visible;
  }

  updateMapHeading(records);
  if (state.view === 'map') refreshMap();
}

function recordRow(r) {
  const node = $('#requestTemplate').content.firstElementChild.cloneNode(true);
  const meta = metaForBoard(r.board);
  node.querySelector('.board-code').textContent=`BK CB ${String(r.board).padStart(2,'0')} · ${meta.shortName}`;
  node.querySelector('.year').textContent=r.fiscalYear ? `FY ${r.fiscalYear} · ${categoryDefs[r.category]?.label || 'Other'}` : 'FY unknown';
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
  if (view === 'map') initMap();
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
function boardRecordMap() {
  const records = filteredRecords({ignoreBoard:true});
  const groups = new Map();
  for (let i=1;i<=18;i++) groups.set(i,[]);
  for (const r of records) groups.get(r.board)?.push(r);
  return groups;
}
function metricValue(records) {
  const metric = $('#mapColorBy').value;
  if (metric === 'recurring') return records.filter(r=>r.recurringTheme || r.repeatedProject).length;
  if (metric === 'uncertain') return records.filter(r=>['uncertain','not_funded','followup','unknown'].includes(r.status)).length;
  return records.length;
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
function topCategories(records, limit=3) {
  return countBy(records,r=>r.category).slice(0,limit).map(([id,count])=>({id,count,def:categoryDefs[id] || categoryDefs.other}));
}
function metricLabel() {
  return {volume:'REQUEST VOLUME',recurring:'RECURRING ASKS',uncertain:'FUNDING UNCLEAR'}[$('#mapColorBy').value] || 'REQUEST VOLUME';
}
function updateMapHeading(records) {
  const year = $('#yearFilter').value;
  $('#mapYearReadout').textContent = year === 'all' ? 'FY 2016–2026' : `FY ${year}`;
  $('#mapTitle').textContent = year === 'all' ? 'Brooklyn asks, across the decade.' : `Brooklyn asks · FY ${year}`;
  $('#legendMetric').textContent = metricLabel();
  const item = selectedCoverage();
  $('#mapCoverageNote').textContent = year !== 'all' && !records.length && item
    ? `Official FY ${year} source set is indexed; granular request extraction is still in progress.`
    : 'Community District shading reflects the selected metric, not need severity.';
}
function renderCategoryLegend() {
  const root = $('#categoryLegend');
  root.innerHTML = Object.entries(categoryDefs).filter(([id])=>id!=='other').map(([id,def]) =>
    `<span data-category="${id}"><i style="--category-color:${def.color}">${def.symbol}</i>${def.label}</span>`
  ).join('');
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
  const grouped=boardRecordMap();
  const values=[...grouped.values()].map(metricValue);
  const max=Math.max(1,...values);
  const selectedFilter=$('#boardFilter').value;
  const year=$('#yearFilter').value;

  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.setAttribute('class','atlas-svg');
  svg.setAttribute('viewBox',`0 0 ${W} ${H}`);
  svg.setAttribute('aria-labelledby','atlasTitle atlasDesc');
  svg.innerHTML=`<title id="atlasTitle">Brooklyn Community District decade atlas</title><desc id="atlasDesc">Community District shading reflects ${metricLabel().toLowerCase()} for ${year==='all'?'fiscal years 2016 through 2026':`fiscal year ${year}`}.</desc><text class="atlas-kicker" x="28" y="28">BROOKLYN COMMUNITY DISTRICTS · ${year==='all'?'FY2016–FY2026':`FY${year}`} · ${metricLabel()}</text>`;

  for (const feature of features) {
    const board=boardFromFeature(feature);
    const records=grouped.get(board)||[];
    const value=metricValue(records);
    const ratio=value/max;
    const meta=metaForBoard(board);
    const path=document.createElementNS('http://www.w3.org/2000/svg','path');
    path.setAttribute('d',pathForFeature(feature));
    path.setAttribute('class','atlas-district');
    if (state.selectedBoard===board || String(board)===selectedFilter) path.classList.add('is-selected');
    path.setAttribute('fill','#17354a');
    path.setAttribute('fill-opacity',String(records.length ? .08+ratio*.66 : .035));
    path.setAttribute('tabindex','0');
    path.setAttribute('role','button');
    path.setAttribute('aria-label',`Community Board ${board}, ${meta.shortName}, ${records.length} matching records`);
    const choose=()=>{state.selectedBoard=board;renderDossier(board);drawDistricts();};
    path.addEventListener('click',choose);
    path.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();choose();}});
    const title=document.createElementNS('http://www.w3.org/2000/svg','title');
    title.textContent=`CB ${String(board).padStart(2,'0')} · ${meta.shortName} · ${records.length} matching records`;
    path.appendChild(title);
    svg.appendChild(path);

    const polys=geometryRings(feature);
    const largest=[...polys].sort((a,b)=>(b[0]?.length||0)-(a[0]?.length||0))[0];
    if (largest) {
      const [cx,cy]=project(polygonCentroid(largest));
      const marker=document.createElementNS('http://www.w3.org/2000/svg','circle');
      marker.setAttribute('cx',cx.toFixed(1)); marker.setAttribute('cy',(cy-10).toFixed(1)); marker.setAttribute('r','5');
      marker.setAttribute('fill',meta.accent || '#17354a'); marker.setAttribute('class','board-accent-dot');
      svg.appendChild(marker);

      const label=document.createElementNS('http://www.w3.org/2000/svg','text');
      label.setAttribute('x',cx.toFixed(1)); label.setAttribute('y',(cy+3).toFixed(1));
      label.setAttribute('text-anchor','middle'); label.setAttribute('class','atlas-label atlas-label-name');
      const top=document.createElementNS('http://www.w3.org/2000/svg','tspan');
      top.setAttribute('x',cx.toFixed(1)); top.textContent=`CB ${String(board).padStart(2,'0')}`;
      const second=document.createElementNS('http://www.w3.org/2000/svg','tspan');
      second.setAttribute('x',cx.toFixed(1)); second.setAttribute('dy','12');
      second.setAttribute('class','atlas-neighborhood-label'); second.textContent=meta.shortName.split(' / ').slice(0,2).join(' / ');
      label.append(top,second); svg.appendChild(label);

      const cats=topCategories(records,3);
      cats.forEach((cat,index)=>{
        const gx=cx + (index-(cats.length-1)/2)*14;
        const gy=cy+31;
        const circle=document.createElementNS('http://www.w3.org/2000/svg','circle');
        circle.setAttribute('cx',gx.toFixed(1)); circle.setAttribute('cy',gy.toFixed(1)); circle.setAttribute('r','5.5');
        circle.setAttribute('fill',cat.def.color); circle.setAttribute('class','category-dot'); svg.appendChild(circle);
        const glyph=document.createElementNS('http://www.w3.org/2000/svg','text');
        glyph.setAttribute('x',gx.toFixed(1)); glyph.setAttribute('y',(gy+.5).toFixed(1)); glyph.setAttribute('text-anchor','middle'); glyph.setAttribute('dominant-baseline','central'); glyph.setAttribute('class','category-glyph'); glyph.textContent=cat.def.symbol; svg.appendChild(glyph);
      });
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
  const uncertain = records.filter(r=>['uncertain','not_funded','followup','unknown'].includes(r.status)).length;
  const agencies = countBy(records,r=>r.agency).slice(0,5);
  const categories = countBy(records,r=>r.category).slice(0,5);
  const recurringTopics = countBy(recurring,r=>r.request).slice(0,5);
  const year = $('#yearFilter').value;
  const meta = board ? metaForBoard(board) : null;

  $('#mapDossier h3').textContent = board ? `CB ${String(board).padStart(2,'0')} · ${meta.shortName}` : 'Brooklyn-wide';
  $('#dossierNeighborhoods').textContent = board && meta.neighborhoods?.length ? meta.neighborhoods.join(' · ') : '';
  $('.dossier-intro').textContent = board
    ? `A ${year==='all'?'decade':`FY ${year}`} snapshot of the records matching your current filters.`
    : 'Choose a Community District on the map to inspect its request volume, recurring themes, agencies, categories, and response mix.';

  const item = selectedCoverage();
  const sourceOnly = year !== 'all' && !records.length && item;
  const body = $('#dossierBody');
  if (sourceOnly) {
    body.innerHTML = `<section class="source-only-map"><span class="section-label">FY ${year} · SOURCE INDEXED</span><h4>Official source set located.</h4><p>${escapeHtml(item.note || 'Granular extraction is still in progress.')}</p><a href="${item.sourceUrl}" target="_blank" rel="noopener noreferrer">Open FY ${year} source archive ↗</a></section>`;
    return;
  }

  body.innerHTML = `
    <div class="dossier-statline">
      <div><strong>${records.length.toLocaleString()}</strong><span>matching records</span></div>
      <div><strong>${recurring.length.toLocaleString()}</strong><span>recurring records</span></div>
      <div><strong>${funded.toLocaleString()}</strong><span>funded/completed responses</span></div>
      <div><strong>${uncertain.toLocaleString()}</strong><span>funding unclear / unavailable</span></div>
    </div>
    <section class="dossier-section">
      <h4>TOP TOPICS</h4>
      <ul class="dossier-list category-list">${categories.length ? categories.map(([id,n])=>{const d=categoryDefs[id]||categoryDefs.other;return `<li><i style="--category-color:${d.color}">${d.symbol}</i>${escapeHtml(d.label)}<small>${n} record${n===1?'':'s'}</small></li>`;}).join('') : '<li>No matching topic records.</li>'}</ul>
    </section>
    <section class="dossier-section">
      <h4>TOP AGENCIES</h4>
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

['search','yearFilter','boardFilter','categoryFilter','statusFilter','repeatOnly'].forEach(id => {
  $('#'+id).addEventListener(id==='search'?'input':'change',()=>{
    state.visible=24;
    if (id==='boardFilter') state.selectedBoard = $('#boardFilter').value === 'all' ? null : Number($('#boardFilter').value);
    render();
  });
});
$('#mapColorBy').addEventListener('change',()=>{ updateMapHeading(filteredRecords()); refreshMap(); });
$('#clearSearch').addEventListener('click',()=>{$('#search').value='';state.visible=24;render();$('#search').focus();});
$('#loadMore').addEventListener('click',()=>{state.visible+=24;render();});
$$('.nav-tab').forEach(button => button.addEventListener('click',()=>switchView(button.dataset.view)));

loadData();

export { normalize, parseTracking, classifyResponse, dedupeLatest, addRecurring, boardFromFeature, inferCategory };