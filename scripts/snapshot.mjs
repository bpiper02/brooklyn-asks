import fs from 'node:fs/promises';

const ROWS='https://data.cityofnewyork.us/resource/vn4m-mk4t.json?$limit=50000';
const META='https://data.cityofnewyork.us/api/views/vn4m-mk4t/columns.json';
const OUT=new URL('../public/data/official-snapshot.json', import.meta.url);
const norm=s=>String(s??'').toLowerCase().replace(/&/g,'and').replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim();
const parseTracking=code=>{const m=String(code??'').trim().match(/^(\d)(\d{2})(\d{4})(\d{2})(C|E|CS)$/i);return m?{board:+m[2],fiscalYear:+m[3]}:{};};

const [columns,rows]=await Promise.all([
  fetch(META).then(r=>{if(!r.ok)throw new Error(`metadata ${r.status}`);return r.json()}),
  fetch(ROWS).then(r=>{if(!r.ok)throw new Error(`rows ${r.status}`);return r.json()})
]);
const byName=new Map(columns.map(c=>[norm(c.name),c.fieldName]));
const field=(...names)=>names.map(n=>byName.get(norm(n))).find(Boolean);
const map={
  date:field('Publication Date'),borough:field('Borough'),board:field('C Board','Community Board'),priority:field('Priority'),
  tracking:field('Tracking Code'),request:field('Request'),agency:field('Agency','Responsible Agency'),response:field('Response','Agency Response','Budget Response'),
  explanation:field('Explanation','Request Explanation','Reason'),location:field('Location','Site Address','Address')
};
const value=(r,k)=>map[k]?r[map[k]]:'';
const normalized=rows.map(r=>{
  const trackingCode=String(value(r,'tracking')??'').trim();
  const p=parseTracking(trackingCode);
  return {
    board:Number(value(r,'board')||p.board||0), fiscalYear:p.fiscalYear||null, trackingCode,
    request:String(value(r,'request')??'').trim(), detail:String(value(r,'explanation')||value(r,'location')||'').trim(),
    agency:String(value(r,'agency')??'').trim(), priority:String(value(r,'priority')??'').trim(),
    response:String(value(r,'response')??'').trim(), publicationDate:String(value(r,'date')??'').trim(),
    sourceUrl:'https://data.cityofnewyork.us/d/vn4m-mk4t'
  };
}).filter(r=>r.board>=1&&r.board<=18 && (!map.borough || norm(value(rows.find(x=>String(value(x,'tracking')??'').trim()===r.trackingCode)||{},'borough')).includes('brooklyn')));

await fs.writeFile(OUT, JSON.stringify(normalized,null,2));
console.log(`wrote ${normalized.length} Brooklyn records to ${OUT.pathname}`);
