const BROOKLYN_BOARD_RE = /^(?:0?(\d{1,2})\s+BROOKLYN|BROOKLYN\s+0?(\d{1,2}))$/i;

export function parseBrooklynBoard(value) {
  const text = String(value ?? '').trim();
  const match = text.match(BROOKLYN_BOARD_RE);
  if (!match) return null;
  const board = Number(match[1] || match[2]);
  return Number.isInteger(board) && board >= 1 && board <= 18 ? board : null;
}

export function fiscalYearForMonth(year, month) {
  const y = Number(year);
  const m = Number(month);
  if (!Number.isInteger(y) || !Number.isInteger(m) || m < 1 || m > 12) return null;
  return m >= 7 ? y + 1 : y;
}

export function cleanText(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ');
}

export function normalizeAggregateRow(row, sourceDataset) {
  const board = parseBrooklynBoard(row.community_board);
  const year = Number(row.year);
  const month = Number(row.month);
  const count = Number(row.count);
  const problem = cleanText(row.complaint_type);
  const agency = cleanText(row.agency);

  if (!board) return { ok:false, reason:'invalid_board' };
  if (!Number.isInteger(year) || year < 2010 || year > 2100) return { ok:false, reason:'invalid_year' };
  if (!Number.isInteger(month) || month < 1 || month > 12) return { ok:false, reason:'invalid_month' };
  if (!Number.isFinite(count) || count <= 0) return { ok:false, reason:'invalid_count' };
  if (!problem) return { ok:false, reason:'missing_problem' };

  return {
    ok:true,
    value:{
      year,
      month,
      fiscalYear:fiscalYearForMonth(year, month),
      board,
      problem,
      agency: agency || 'Unknown agency',
      count:Math.trunc(count),
      sourceDataset
    }
  };
}

export function aggregateKey(row) {
  return [row.year,row.month,row.board,row.problem.toLowerCase(),row.agency.toLowerCase()].join('|');
}

export function mergeNormalizedRows(rows) {
  const merged = new Map();
  for (const row of rows) {
    const key = aggregateKey(row);
    const current = merged.get(key);
    if (current) current.count += row.count;
    else merged.set(key, {...row});
  }
  return [...merged.values()].sort((a,b) =>
    a.year-b.year || a.month-b.month || a.board-b.board ||
    a.problem.localeCompare(b.problem) || a.agency.localeCompare(b.agency)
  );
}

export function validateSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') throw new Error('snapshot must be an object');
  if (!Array.isArray(snapshot.rows)) throw new Error('snapshot.rows must be an array');
  if (!Array.isArray(snapshot.sources) || snapshot.sources.length < 1) throw new Error('snapshot.sources must be non-empty');

  const seen = new Set();
  for (const row of snapshot.rows) {
    if (!Number.isInteger(row.board) || row.board < 1 || row.board > 18) throw new Error(`invalid board ${row.board}`);
    if (!Number.isInteger(row.year) || !Number.isInteger(row.month)) throw new Error('invalid year/month');
    if (row.fiscalYear !== fiscalYearForMonth(row.year,row.month)) throw new Error('incorrect fiscal year');
    if (!Number.isInteger(row.count) || row.count <= 0) throw new Error('count must be a positive integer');
    if (!cleanText(row.problem)) throw new Error('problem is required');
    const key = aggregateKey(row);
    if (seen.has(key)) throw new Error(`duplicate aggregate row ${key}`);
    seen.add(key);
  }
  return true;
}

export function buildAggregateQuery({startDate,endDate,limit=50000,offset=0}) {
  const select = [
    'date_extract_y(created_date) as year',
    'date_extract_m(created_date) as month',
    'community_board',
    'complaint_type',
    'agency',
    'count(*) as count'
  ].join(',');
  const where = `borough='BROOKLYN' AND created_date >= '${startDate}T00:00:00.000' AND created_date < '${endDate}T00:00:00.000'`;
  const group = 'year,month,community_board,complaint_type,agency';
  const order = 'year,month,community_board,complaint_type,agency';
  return { '$select':select, '$where':where, '$group':group, '$order':order, '$limit':String(limit), '$offset':String(offset) };
}
