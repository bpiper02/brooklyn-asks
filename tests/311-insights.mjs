import assert from 'node:assert/strict';
import {
  monthOrdinal, latestCompleteMonth, classify311Problem, commonTopicFor311,
  safePercentChange, buildBoardInsight, buildAllBoardInsights
} from '../scripts/311-insight-lib.mjs';

assert.equal(monthOrdinal(2026,1), 2026*12);
assert.equal(monthOrdinal(2026,12), 2026*12+11);
assert.equal(monthOrdinal(2026,13), null);
assert.deepEqual(latestCompleteMonth('2026-09-09T22:00:00Z'), {year:2026,month:8});
assert.deepEqual(latestCompleteMonth('2026-01-01T00:00:00Z'), {year:2025,month:12});
assert.throws(()=>latestCompleteMonth('nope'), /invalid generatedAt/);

assert.equal(classify311Problem('Noise - Residential'),'noise');
assert.equal(classify311Problem('Street Flooding'),'water');
assert.equal(classify311Problem('HEAT/HOT WATER'),'housing');
assert.equal(classify311Problem('Missed Collection'),'sanitation');
assert.equal(classify311Problem('Street Condition'),'streets_transit');
assert.equal(classify311Problem('Illegal Parking'),'streets_transit');
assert.equal(classify311Problem('Damaged Tree'),'parks');
assert.equal(classify311Problem('Park Maintenance'),'parks');
assert.equal(commonTopicFor311('water'),'infrastructure');
assert.equal(commonTopicFor311('noise'),null);

assert.equal(safePercentChange(120,100),20);
assert.equal(safePercentChange(10,0),null);
assert.equal(safePercentChange(10,5),null);

const rows=[];
function add(year,month,board,problem,count,agency='X') { rows.push({year,month,board,problem,count,agency}); }
for (let m=9;m<=12;m++) add(2024,m,1,'Street Flooding',10);
for (let m=1;m<=8;m++) add(2025,m,1,'Street Flooding',10);
for (let m=9;m<=12;m++) add(2025,m,1,'Street Flooding',20);
for (let m=1;m<=8;m++) add(2026,m,1,'Street Flooding',20);
for (let m=9;m<=12;m++) add(2025,m,1,'Noise - Residential',5);
for (let m=1;m<=8;m++) add(2026,m,1,'Noise - Residential',5);
for (let board=2;board<=18;board++) {
  for (let m=9;m<=12;m++) { add(2025,m,board,'Street Flooding',2); add(2025,m,board,'Noise - Residential',18); }
  for (let m=1;m<=8;m++) { add(2026,m,board,'Street Flooding',2); add(2026,m,board,'Noise - Residential',18); }
}

const insight=buildBoardInsight(rows,1,'2026-09-09T22:00:00Z');
assert.equal(insight.total,300);
assert.equal(insight.priorTotal,120);
assert.equal(insight.changePct,150);
assert.equal(insight.topProblems[0].problem,'Street Flooding');
assert.equal(insight.topProblems[0].count,240);
assert.equal(insight.topProblems[0].monthsActive,12);
assert.equal(insight.topProblems[0].changePct,100);
assert.ok(insight.topProblems[0].overIndex > 1);
assert.deepEqual(insight.persistentProblems,['Street Flooding','Noise - Residential']);
assert.equal(insight.topics.find(x=>x.topic==='water').count,240);
assert.equal(buildAllBoardInsights(rows,'2026-09-09T22:00:00Z').length,18);

const empty=buildBoardInsight([],7,'2026-09-09T22:00:00Z');
assert.equal(empty.total,0);
assert.equal(empty.changePct,null);
assert.deepEqual(empty.topProblems,[]);

console.log('311 insight tests passed');
