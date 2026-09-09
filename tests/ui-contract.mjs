import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const index = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const mapJs = readFileSync(new URL('../public/map-first.js', import.meta.url), 'utf8');
const mapCss = readFileSync(new URL('../public/map-first.css', import.meta.url), 'utf8');
const clarityJs = readFileSync(new URL('../public/clarity.js', import.meta.url), 'utf8');
const clarityCss = readFileSync(new URL('../public/clarity.css', import.meta.url), 'utf8');

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
assert.doesNotMatch(clarityJs, /#mapTitle|#mapCoverageNote|#legendMetric|function enhanceMap/, 'Only map-first.js may own map presentation copy');
assert.doesNotMatch(clarityCss, /\.map-toolbar|\.map-legend|\.map-explainer|\.map-year-readout/, 'Only map-first.css may own map presentation styles');
assert.ok(index.indexOf('./app.js') < index.indexOf('./map-first.js'), 'Core app must load before the map-first presentation layer');
assert.match(mapCss, /\.dossier-list\.category-list li\{[^}]*padding:8px 0 8px 34px!important/, 'Topic rows must reserve horizontal space for dossier icons');
assert.match(mapCss, /\.dossier-list\.category-list li i\{[^}]*left:0!important[^}]*top:50%!important/, 'Dossier icons must have a stable position outside the text');
assert.match(mapJs, /function replaceDossierIcons\(\)/, 'Dossier topics must use the same icon conversion layer as the map');
assert.match(mapJs, /replaceDossierIcons\(\)/, 'Dossier icon conversion must run during refresh');

assert.match(index, /id="boardDirectory"/, 'Map must include a Community Board key beside the atlas');
assert.match(index, /id="boardDirectoryList"/, 'Board key must have a dedicated interactive list');
assert.match(index, /Numbers match the map/, 'Board key must explain its relationship to map labels');
assert.match(mapJs, /function boardNameFromPath\(path\)/, 'Board key names must be derived from rendered map metadata');
assert.match(mapJs, /function syncBoardDirectory\(\)/, 'Board directory must synchronize with rendered districts');
assert.match(mapJs, /path\?\.click\(\)/, 'Board key selection must reuse the map district click behavior');
assert.match(mapJs, /setText\(parts\[0\], `CB\$\{String\(Number\(board\)\)\.padStart\('0'?,?2|'2','0'\)/, 'Map labels should collapse to compact Community Board identifiers');
assert.match(mapCss, /\.atlas-neighborhood-label\{display:none!important\}/, 'Long neighborhood names must not compete inside small polygons');
assert.match(mapCss, /\.map-workspace\{display:grid;grid-template-columns:minmax\(0,1fr\) 270px/, 'Desktop atlas must reserve a side rail for the board key');
assert.match(mapCss, /\.map-topic-icon\{[^}]*opacity:0/, 'Topic icons must stay quiet until a district has context');
assert.match(mapCss, /\.category-dot\.is-topic-visible,\.map-topic-icon\.is-topic-visible\{opacity:1\}/, 'Topic icons must reveal on hover or selection');
assert.match(mapJs, /function refreshTopicVisibility\(\)/, 'Topic icon visibility must follow selected or hovered districts');
assert.match(mapCss, /drop-shadow\(0 7px 5px/, 'Selected districts should receive restrained depth rather than a full 3D dependency');
assert.doesNotMatch(index, /mapbox|leaflet/i, 'Modern atlas pass must not introduce external map dependencies');

console.log('ui contract tests passed');
