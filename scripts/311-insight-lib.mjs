export function monthOrdinal(year, month) {
  const y = Number(year), m = Number(month);
  if (!Number.isInteger(y) || !Number.isInteger(m) || m < 1 || m > 12) return null;
  return y * 12 + (m - 1);
}

export function latestCompleteMonth(generatedAt) {
  const d = new Date(generatedAt);
  if (Number.isNaN(d.valueOf())) throw new Error('invalid generatedAt');
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  if (m === 1) return {year:y-1,month:12};
  return {year:y,month:m-1};
}

export function classify311Problem(problem='') {
  const t = String(problem).toLowerCase();
  if (/noise/.test(t)) return 'noise';
  if (/(rodent|\brat\b|\bmouse\b|\bmice\b|garbage|sanitation|dirty|litter|recycling|missed collection|derelict vehicle)/.test(t)) return 'sanitation';
  if (/(heat|hot water|housing|tenant|apartment|building|elevator|construction|plumbing|paint|mold)/.test(t)) return 'housing';
  if (/(flood|sewer|water system|catch basin|hydrant|water leak)/.test(t)) return 'water';
  if (/(park|\btree\b|playground|recreation)/.test(t)) return 'parks';
  if (/(school|education)/.test(t)) return 'schools';
  if (/(street|sidewalk|pothole|traffic|parking|bike|bicycle|bus|subway|signal|streetlight|road|bridge|highway)/.test(t)) return 'streets_transit';
  if (/(police|public safety|illegal fireworks|drug activity)/.test(t)) return 'safety';
  if (/(health|mental|homeless|senior|social service|food|animal)/.test(t)) return 'services';
  return 'other';
}

export function commonTopicFor311(topic) {
  return ({
    streets_transit:'transit', housing:'housing', parks:'parks', schools:'schools', safety:'safety',
    water:'infrastructure', sanitation:'services', services:'services'
  })[topic] || null;
}

function rowsInWindow(rows, endOrdinal, months) {
  const start = endOrdinal - months + 1;
  return rows.filter(r => {
    const ord = monthOrdinal(r.year,r.month);
    return ord != null && ord >= start && ord <= endOrdinal;
  });
}

function countRows(rows) {
  return rows.reduce((sum,r)=>sum + Number(r.count || 0),0);
}

function countMonths(rows) {
  return new Set(rows.map(r=>monthOrdinal(r.year,r.month)).filter(v=>v!=null)).size;
}

export function safePercentChange(current, prior, {minBaseline=20}={}) {
  const c = Number(current), p = Number(prior);
  if (!Number.isFinite(c) || !Number.isFinite(p) || p < minBaseline) return null;
  return Math.round(((c-p)/p)*1000)/10;
}

export function buildBoardInsight(rows, board, generatedAt, {months=12, topN=5}={}) {
  const end = latestCompleteMonth(generatedAt);
  const endOrd = monthOrdinal(end.year,end.month);
  const currentAll = rowsInWindow(rows,endOrd,months);
  const priorAll = rowsInWindow(rows,endOrd-months,months);
  const currentBoard = currentAll.filter(r=>r.board===board);
  const priorBoard = priorAll.filter(r=>r.board===board);
  const currentTotal = countRows(currentBoard);
  const priorTotal = countRows(priorBoard);
  const brooklynTotal = countRows(currentAll);

  const byProblem = new Map();
  for (const row of currentBoard) {
    const key = row.problem;
    if (!byProblem.has(key)) byProblem.set(key,[]);
    byProblem.get(key).push(row);
  }
  const priorByProblem = new Map();
  for (const row of priorBoard) priorByProblem.set(row.problem,(priorByProblem.get(row.problem)||0)+row.count);
  const brooklynByProblem = new Map();
  for (const row of currentAll) brooklynByProblem.set(row.problem,(brooklynByProblem.get(row.problem)||0)+row.count);

  const topProblems = [...byProblem.entries()].map(([problem,problemRows])=>{
    const count = countRows(problemRows);
    const prior = priorByProblem.get(problem)||0;
    const boardShare = currentTotal ? count/currentTotal : 0;
    const bkCount = brooklynByProblem.get(problem)||0;
    const bkShare = brooklynTotal ? bkCount/brooklynTotal : 0;
    const overIndex = count >= 25 && bkCount >= 100 && bkShare > 0 ? Math.round((boardShare/bkShare)*10)/10 : null;
    return {
      problem,
      topic:classify311Problem(problem),
      count,
      sharePct:Math.round(boardShare*1000)/10,
      monthsActive:countMonths(problemRows),
      changePct:safePercentChange(count,prior),
      brooklynSharePct:Math.round(bkShare*1000)/10,
      overIndex
    };
  }).sort((a,b)=>b.count-a.count || a.problem.localeCompare(b.problem)).slice(0,topN);

  const topicMap = new Map();
  for (const row of currentBoard) {
    const topic = classify311Problem(row.problem);
    topicMap.set(topic,(topicMap.get(topic)||0)+row.count);
  }
  const topics = [...topicMap.entries()]
    .map(([topic,count])=>({topic,count,sharePct:currentTotal?Math.round((count/currentTotal)*1000)/10:0}))
    .sort((a,b)=>b.count-a.count);

  return {
    board,
    period:{months,endYear:end.year,endMonth:end.month},
    total:currentTotal,
    priorTotal,
    changePct:safePercentChange(currentTotal,priorTotal,{minBaseline:100}),
    topProblems,
    topics,
    persistentProblems:topProblems.filter(p=>p.monthsActive >= Math.min(9,months) && p.count >= 24).map(p=>p.problem)
  };
}

export function buildAllBoardInsights(rows, generatedAt, options={}) {
  return Array.from({length:18},(_,i)=>buildBoardInsight(rows,i+1,generatedAt,options));
}
