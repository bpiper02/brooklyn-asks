import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const index = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const mapJs = readFileSync(new URL('../public/map-first.js', import.meta.url), 'utf8');
const mapCss = readFileSync(new URL('../public/map-first.css', import.meta.url), 'utf8');

assert.match(index, /class="nav-tab is-active" data-view="map"/, 'Explore must be the visually active default tab');
assert.match(index, /id="mapView" class="view-panel"(?![^>]*hidden)/, 'Map view must be visible in the initial HTML');
assert.match(index, /id="archiveView" class="view-panel" hidden/, 'Records view must start hidden');
assert.match(mapJs, /activateMapOnce\(\)/, 'Map startup helper must be present');
assert.match(mapJs, /mapButton\?\.click\(\)/, 'Startup must synchronize JS state by clicking the map tab');
assert.match(mapJs, /DOMContentLoaded[\s\S]*activateMapOnce\(\)/, 'Map must initialize on first page load');
assert.match(mapJs, /Loading Brooklyn map/, 'Initial map area must show a loading state instead of an empty box');
assert.match(mapCss, /label::before\{content:none!important;display:none!important\}/, 'Legacy injected map label must be disabled');
assert.doesNotMatch(index, /SHADE MAP BY/, 'Legacy map label must not appear in page markup');
assert.match(mapJs, /Most unresolved responses/, 'Response metric must use wording that matches the underlying grouped statuses');

console.log('ui contract tests passed');
