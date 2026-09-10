import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validate311Insights, periodLabel, changeLabel } from '../public/intelligence.js';

const index = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../public/intelligence.css', import.meta.url), 'utf8');
const js = readFileSync(new URL('../public/intelligence.js', import.meta.url), 'utf8');

assert.match(index, /\.\/intelligence\.css/, '311 intelligence stylesheet must load');
assert.match(index, /id="neighborhoodPulse"/, '311 intelligence region must exist');
assert.match(index, /\.\/intelligence\.js/, '311 intelligence script must load');
assert.ok(index.indexOf('id="boardMap"') < index.indexOf('id="neighborhoodPulse"'), '311 intelligence should follow the map');
assert.ok(index.indexOf('id="neighborhoodPulse"') < index.indexOf('id="mapDossier"'), '311 intelligence should precede the formal board-request brief');
assert.match(js, /311 reports are service requests, not unique people or verified incidents/, 'UI must preserve the 311 interpretation caution');
assert.match(js, /Brooklyn comparison uses complaint share, not raw board volume/, 'UI must explain the safe Brooklyn comparison');
assert.doesNotMatch(js, /city failed|city ignored|ignored by the city|unresolved incident/i, '311 surface must avoid causal accountability claims');
assert.match(js, /response\.ok/, '311 file load must check HTTP status');
assert.match(js, /data\.boards\.length !== 18/, '311 UI must reject incomplete board payloads');
assert.match(js, /Duplicate 311 insight/, '311 UI must reject duplicate board payloads');
assert.match(js, /changePct\) && Math\.abs\(problem\.changePct\) >= 10/, 'Problem-level change callouts must suppress small moves');
assert.match(js, /problem\.overIndex >= 1\.2/, 'Over-index callouts must clear a materiality threshold');
assert.match(css, /grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/, 'Desktop view should keep five concise problem cards in one row');
assert.match(css, /@media\(max-width:700px\)/, '311 intelligence must have a phone layout');

const boards = Array.from({length:18},(_,i)=>({board:i+1,period:{months:12,endYear:2026,endMonth:8},total:0,topProblems:[]}));
assert.equal(validate311Insights({schemaVersion:1,boards}), true);
assert.throws(()=>validate311Insights({schemaVersion:1,boards:boards.slice(0,17)}), /18 Brooklyn boards/);
assert.throws(()=>validate311Insights({schemaVersion:1,boards:[...boards.slice(0,17),{...boards[0]}]}), /Duplicate|18 Brooklyn boards/);
assert.equal(periodLabel({months:12,endYear:2026,endMonth:8}), 'SEP 2025–AUG 2026');
assert.equal(changeLabel(null), 'No reliable prior-year comparison');
assert.equal(changeLabel(0.4), 'About the same as the prior 12 months');
assert.match(changeLabel(12.6), /^up 12\.6%/);
assert.match(changeLabel(-8.2), /^down 8\.2%/);

console.log('311 intelligence UI tests passed');
