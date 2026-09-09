import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../public/history.html', import.meta.url), 'utf8');
const js = readFileSync(new URL('../public/history.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../public/history.css', import.meta.url), 'utf8');
const clarityJs = readFileSync(new URL('../public/clarity.js', import.meta.url), 'utf8');
const clarityCss = readFileSync(new URL('../public/clarity.css', import.meta.url), 'utf8');

assert.match(html, /history\.css/, 'Decade page must load its dedicated stylesheet');
assert.match(html, /id="historyLoadMore"/, 'Decade page must progressively load long result sets');
assert.match(html, /aria-current="page">Decade/, 'Decade nav item must identify the current page');
assert.doesNotMatch(html, /plain-key/, 'Decade page should not repeat a large terminology key before the records');

assert.match(js, /button\.dataset\.year/, 'Timeline years must be local filter controls');
assert.match(js, /q\('#historyYear'\)\.value = String\(item\.fiscalYear\)/, 'Clicking a year must select that year in Brooklyn Asks');
assert.match(js, /sourceOnlyCard\(selectedCoverage, board !== 'all' \|\| Boolean\(search\)\)/, 'Source-only years must distinguish constrained filters');
assert.match(js, /recurrenceYears/, 'Decade records must expose recurrence context');
assert.match(js, /Came back in \$\{r\.recurrenceYears\.length\} years/, 'Recurring rows must visibly show recurrence');
assert.match(js, /PAGE_SIZE = 28/, 'Long history results must use progressive loading');
assert.match(js, /async function loadJson/, 'Each historical source must fail independently');
assert.match(js, /if \(!response\.ok\)/, 'Historical fetches must check HTTP status before parsing JSON');
assert.match(js, /No historical data sources loaded/, 'Total source failure must surface as an error instead of an empty decade');
assert.match(js, /historySearch'\)\.addEventListener\('input'/, 'Search should update on input');
assert.match(js, /historyYear'\)\.addEventListener\('change'/, 'Year select should use change events');
assert.match(js, /historyBoard'\)\.addEventListener\('change'/, 'Neighborhood select should use change events');

assert.match(css, /grid-template-columns:repeat\(6,minmax\(120px,1fr\)\)/, 'Desktop year cards should be readable rather than squeezed into 11 tiny columns');
assert.match(css, /\.history-repeat/, 'Recurring issue badge must have dedicated styling');
assert.match(css, /\.history-load-more/, 'Progressive loading control must be styled');
assert.doesNotMatch(clarityJs, /enhanceHistory|coverage-year|source-year-card/, 'clarity.js must not rewrite the Decade page');
assert.doesNotMatch(clarityCss, /history-value|coverage-year|source-year-card/, 'clarity.css must not own Decade page layout');

console.log('decade contract tests passed');
