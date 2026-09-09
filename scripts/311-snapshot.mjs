import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildAggregateQuery, mergeNormalizedRows, normalizeAggregateRow, validateSnapshot } from './311-lib.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'public/data/311-monthly.json');
const PAGE_SIZE = 50000;
const SOURCES = [
  { id:'76ig-c548', label:'311 Service Requests 2010–2019', startDate:'2016-01-01', endDate:'2020-01-01' },
  { id:'erm2-nwe9', label:'311 Service Requests 2020–present', startDate:'2020-01-01', endDate:null }
];

function isoDateUTC(date = new Date()) {
  return date.toISOString().slice(0,10);
}

function endpointFor(id, params) {
  const url = new URL(`https://data.cityofnewyork.us/resource/${id}.json`);
  for (const [key,value] of Object.entries(params)) url.searchParams.set(key,value);
  return url;
}

async function fetchJsonWithRetry(url, {attempts=4}={}) {
  let lastError;
  for (let attempt=1; attempt<=attempts; attempt++) {
    try {
      const res = await fetch(url, { headers:{accept:'application/json'} });
      if (res.ok) return await res.json();
      const retryable = res.status === 429 || res.status >= 500;
      const body = await res.text().catch(()=> '');
      if (!retryable) throw new Error(`NYC Open Data ${res.status}: ${body.slice(0,180)}`);
      lastError = new Error(`NYC Open Data ${res.status}`);
    } catch (error) {
      lastError = error;
    }
    if (attempt < attempts) await new Promise(r => setTimeout(r, 750 * 2 ** (attempt-1)));
  }
  throw lastError || new Error('311 request failed');
}

async function fetchSource(source, today) {
  const endDate = source.endDate || today;
  const accepted = [];
  const skipped = {};
  let offset = 0;

  while (true) {
    const query = buildAggregateQuery({startDate:source.startDate,endDate,limit:PAGE_SIZE,offset});
    const page = await fetchJsonWithRetry(endpointFor(source.id, query));
    if (!Array.isArray(page)) throw new Error(`${source.id} returned a non-array payload`);

    for (const raw of page) {
      const normalized = normalizeAggregateRow(raw, source.id);
      if (normalized.ok) accepted.push(normalized.value);
      else skipped[normalized.reason] = (skipped[normalized.reason] || 0) + 1;
    }

    if (page.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return {accepted, skipped, endDate};
}

async function main() {
  const today = isoDateUTC();
  const parts = [];
  const sourceStats = [];

  for (const source of SOURCES) {
    const result = await fetchSource(source, today);
    parts.push(...result.accepted);
    sourceStats.push({
      dataset:source.id,
      label:source.label,
      startDate:source.startDate,
      endDate:result.endDate,
      acceptedAggregates:result.accepted.length,
      skipped:result.skipped
    });
  }

  const rows = mergeNormalizedRows(parts);
  const snapshot = {
    schemaVersion:1,
    generatedAt:new Date().toISOString(),
    grain:'community board x calendar month x complaint type x agency',
    geography:'Brooklyn Community Boards 1–18',
    notes:[
      'Counts are 311 service requests, not unique people or verified incidents.',
      'Rows without a valid Brooklyn Community Board are excluded from board-level analysis.',
      'Fiscal year is derived locally: July through December belong to the following NYC fiscal year.'
    ],
    sources:sourceStats,
    rows
  };

  validateSnapshot(snapshot);
  await mkdir(dirname(OUT), {recursive:true});
  await writeFile(OUT, `${JSON.stringify(snapshot)}\n`, 'utf8');
  console.log(`311 snapshot written: ${rows.length.toLocaleString()} aggregate rows -> ${OUT}`);
  for (const source of sourceStats) {
    console.log(`${source.dataset}: ${source.acceptedAggregates.toLocaleString()} accepted aggregates; skipped ${JSON.stringify(source.skipped)}`);
  }
}

main().catch(error => {
  console.error(error?.stack || error);
  process.exitCode = 1;
});
