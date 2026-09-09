import assert from 'node:assert/strict';

function normalize(s) { return String(s ?? '').trim().toLowerCase().replace(/&/g,'and').replace(/[^a-z0-9]+/g,' ').replace(/\s+/g,' ').trim(); }
function parseTracking(code='') { const m=String(code).trim().match(/^(\d)(\d{2})(\d{4})(\d{2})(C|E|CS)$/i); if(!m)return{}; return {boroughCode:+m[1],board:+m[2],fiscalYear:+m[3],sequence:+m[4],type:m[5].toUpperCase()}; }
function classifyResponse(text='') { const t=normalize(text); if(!t||t.includes('historical district needs record'))return'unknown'; if(/(already been funded|already been completed|request has been completed|has been funded)/.test(t))return'funded'; if(/(supports and can accommodate|support and can accommodate|will try to accommodate)/.test(t))return'supported'; if(/(availability of funds is uncertain|funding.*uncertain|recommends funding)/.test(t))return'uncertain'; if(/(supports but cannot accommodate|support but cannot accommodate|unfunded request)/.test(t))return'not_funded'; if(/(does not support and cannot accommodate|not recommended for funding|does not support)/.test(t))return'not_supported'; if(/(further investigation|further study|more information is needed|requires more clarification|contact the agency|please contact)/.test(t))return'followup'; return'unknown'; }

assert.deepEqual(parseTracking('209202718C'), {boroughCode:2,board:9,fiscalYear:2027,sequence:18,type:'C'});
assert.deepEqual(parseTracking('213202703CS'), {boroughCode:2,board:13,fiscalYear:2027,sequence:3,type:'CS'});
assert.equal(classifyResponse('This request has already been funded.'),'funded');
assert.equal(classifyResponse('Agency supports but cannot accommodate; resubmit request'),'not_funded');
assert.equal(classifyResponse('The agency recommends funding this budget request, but at this time the availability of funds is uncertain.'),'uncertain');
assert.equal(classifyResponse('Further investigation is required. Contact the agency.'),'followup');
assert.equal(normalize('Traffic & Pedestrian Safety!'),'traffic and pedestrian safety');
console.log('core tests passed');
