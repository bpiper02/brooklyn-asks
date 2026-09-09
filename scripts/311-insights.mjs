import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateSnapshot } from './311-lib.mjs';
import { buildAllBoardInsights } from './311-insight-lib.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const INPUT = resolve(ROOT, 'public/data/311-monthly.json');
const OUTPUT = resolve(ROOT, 'public/data/311-insights.json');

async function main() {
  const snapshot = JSON.parse(await readFile(INPUT, 'utf8'));
  validateSnapshot(snapshot);

  const boards = buildAllBoardInsights(snapshot.rows, snapshot.generatedAt, {months:12,topN:5});
  const output = {
    schemaVersion:1,
    generatedAt:new Date().toISOString(),
    sourceGeneratedAt:snapshot.generatedAt,
    basis:'Last 12 complete calendar months compared with the prior 12 complete months',
    cautions:[
      '311 counts are service requests, not unique people or verified incidents.',
      'Raw board volumes are not treated as per-capita comparisons.',
      'Brooklyn comparisons use complaint share, not raw count, to reduce size bias.',
      'Percent change is withheld when the prior-period baseline is too small.',
      'Persistence means a complaint type appeared in at least 9 of the last 12 complete months and met the minimum count threshold.'
    ],
    boards
  };

  await writeFile(OUTPUT, `${JSON.stringify(output)}\n`, 'utf8');
  console.log(`311 insights written for ${boards.length} boards -> ${OUTPUT}`);
}

main().catch(error => {
  console.error(error?.stack || error);
  process.exitCode = 1;
});
