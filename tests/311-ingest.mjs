import assert from 'node:assert/strict';
import {
  parseBrooklynBoard,
  fiscalYearForMonth,
  normalizeAggregateRow,
  mergeNormalizedRows,
  validateSnapshot,
  buildAggregateQuery
} from '../scripts/311-lib.mjs';

assert.equal(parseBrooklynBoard('02 BROOKLYN'), 2);
assert.equal(parseBrooklynBoard('2 Brooklyn'), 2);
assert.equal(parseBrooklynBoard('BROOKLYN 18'), 18);
assert.equal(parseBrooklynBoard('Unspecified BROOKLYN'), null);
assert.equal(parseBrooklynBoard('19 BROOKLYN'), null);
assert.equal(parseBrooklynBoard('02 MANHATTAN'), null);
assert.equal(parseBrooklynBoard(''), null);

assert.equal(fiscalYearForMonth(2025, 6), 2025);
assert.equal(fiscalYearForMonth(2025, 7), 2026);
assert.equal(fiscalYearForMonth(2025, 12), 2026);
assert.equal(fiscalYearForMonth(2026, 1), 2026);
assert.equal(fiscalYearForMonth(2026, 13), null);

const good = normalizeAggregateRow({
  year:'2026', month:'8', community_board:'13 BROOKLYN', complaint_type:'Street Flooding', agency:'DEP', count:'12'
}, 'erm2-nwe9');
assert.equal(good.ok, true);
assert.deepEqual(good.value, {
  year:2026, month:8, fiscalYear:2027, board:13, problem:'Street Flooding', agency:'DEP', count:12, sourceDataset:'erm2-nwe9'
});

for (const [row,reason] of [
  [{year:'2026',month:'8',community_board:'Unspecified BROOKLYN',complaint_type:'Noise',agency:'NYPD',count:'1'},'invalid_board'],
  [{year:'x',month:'8',community_board:'01 BROOKLYN',complaint_type:'Noise',agency:'NYPD',count:'1'},'invalid_year'],
  [{year:'2026',month:'0',community_board:'01 BROOKLYN',complaint_type:'Noise',agency:'NYPD',count:'1'},'invalid_month'],
  [{year:'2026',month:'8',community_board:'01 BROOKLYN',complaint_type:'Noise',agency:'NYPD',count:'0'},'invalid_count'],
  [{year:'2026',month:'8',community_board:'01 BROOKLYN',complaint_type:' ',agency:'NYPD',count:'1'},'missing_problem']
]) {
  const result = normalizeAggregateRow(row,'x');
  assert.equal(result.ok,false);
  assert.equal(result.reason,reason);
}

const merged = mergeNormalizedRows([
  {...good.value,count:4},
  {...good.value,count:6},
  {...good.value,agency:'DEP',problem:'Noise',count:2}
]);
assert.equal(merged.length,2);
assert.equal(merged.find(r=>r.problem==='Street Flooding').count,10);

const query = buildAggregateQuery({startDate:'2016-01-01',endDate:'2020-01-01',limit:100,offset:200});
assert.match(query.$where,/borough='BROOKLYN'/);
assert.match(query.$where,/created_date >= '2016-01-01T00:00:00.000'/);
assert.equal(query.$limit,'100');
assert.equal(query.$offset,'200');
assert.match(query.$group,/community_board/);
assert.match(query.$order,/complaint_type,agency/);

const snapshot = {sources:[{dataset:'erm2-nwe9'}],rows:merged};
assert.equal(validateSnapshot(snapshot),true);
assert.throws(()=>validateSnapshot({sources:[],rows:[]}),/sources/);
assert.throws(()=>validateSnapshot({sources:[{}],rows:[{...good.value,board:99}]}),/invalid board/);
assert.throws(()=>validateSnapshot({sources:[{}],rows:[good.value,{...good.value}]}),/duplicate aggregate row/);

console.log('311 ingestion tests passed');
