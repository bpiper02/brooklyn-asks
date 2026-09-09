import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const index = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const mapJs = readFileSync(new URL('../public/map-first.js', import.meta.url), 'utf8');
const mapCss = readFileSync(new URL('../public/map-first.css', import.meta.url), 'utf8');

assert.match(index, /class="nav-tab is-active" data-view="map"/, 'Explore must be the visually active default tab');
assert.match(index, /id="mapView" class="view-panel"(?![^>]*hidden)/, 'Map view must be visible in the initial HTML');
assert.match(index, /id="archiveView" class="view-panel" hidden/, 'Records view must start hidden');
assert.match(index, /id="boardMap"[\s\S]*Loading Brooklyn map/, 'Initial HTML must show a map loading state');
assert.match(mapJs, /activateMapOnce\(\)/, 'Map startup helper must be present');
assert.match(mapJs, /mapButton\?\.click\(\)/, 'Startup must synchronize JS state by clicking the map tab');
assert.match(mapJs, /DOMContentLoaded[\s\S]*activateMapOnce\(\)/, 'Map must initialize on first page load');
assert.match(mapCss, /label::before\{content:none!important;display:none!important\}/, 'Legacy injected map label must be disabled');
assert.doesNotMatch(index, /SHADE MAP BY/, 'Legacy map label must not appear in page markup');
assert.match(index, /Most unresolved responses/, 'Initial map metric wording must match the rendered UI');
assert.match(mapJs, /Most unresolved responses/, 'Runtime map metric wording must match the initial UI');
assert.ok(index.indexOf('./app.js') < index.indexOf('./map-first.js'), 'Core app must load before the map-first presentation layer');

console.log('ui contract tests passed');
