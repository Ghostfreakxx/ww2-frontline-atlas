import fs from 'node:fs';
import { geoPath } from 'd3-geo';
import { makeProjection } from '../../src/lib/map/makeProjection.mjs';
const root='./';
const cfg=JSON.parse(fs.readFileSync(root+'src/data/geo/projection.json'));
const proj=makeProjection(cfg); const path=geoPath(proj);
const [territoryDate, frontId, view] = process.argv.slice(2);
const terr=JSON.parse(fs.readFileSync(root+`public/geo/territory-${territoryDate}.json`));
const fronts=JSON.parse(fs.readFileSync(root+'public/geo/fronts.json')).fronts;
const rivers=JSON.parse(fs.readFileSync(root+'public/geo/rivers.json'));
const colors={reich:'#8a8f98','reich-annexed':'#9da2aa','german-occupied':'#b9bcc2',axis:'#c9b9a6','axis-occupied':'#d6cbbd',soviet:'#d9a99a',allied:'#a9bfd6','allied-occupied':'#c3d2e2',neutral:'#ecebe4',vichy:'#d8d1c0',cobelligerent:'#cfc6b0'};
let svg='';
for(const f of terr.features) svg+=`<path d="${path(f)}" fill="${colors[f.properties.status]||'#f0f'}" stroke="#555" stroke-width="0.3"/>`;
for(const f of rivers.features) svg+=`<path d="${path(f)}" fill="none" stroke="#6a8fb0" stroke-width="0.4"/>`;
const fr=fronts.find(x=>x.id===frontId);
if(fr){ if(fr.held) svg+=`<path d="${path({type:'MultiPolygon',coordinates:fr.held})}" fill="rgba(60,60,80,0.35)" stroke="none"/>`;
 for(const pk of fr.pockets) svg+=`<path d="${path({type:'MultiPolygon',coordinates:pk.geometry})}" fill="rgba(200,0,0,0.4)"/>`;
 for(const l of fr.lines) svg+=`<path d="${path({type:'LineString',coordinates:l.coordinates})}" fill="none" stroke="${l.q==='a'?'#c00':l.q==='b'?'#e60':'#999'}" stroke-width="1.6" ${l.q==='c'?'stroke-dasharray="3 3"':''}/>`;}
let vb = [0,0,1600,1000];
if (view) { const [w,s2,e,n]=view.split(',').map(Number); const pts=[[w,s2],[e,s2],[e,n],[w,n],[(w+e)/2,n],[(w+e)/2,s2]].map(c=>proj(c)); const xs=pts.map(p=>p[0]), ys=pts.map(p=>p[1]); vb=[Math.min(...xs),Math.min(...ys),Math.max(...xs)-Math.min(...xs),Math.max(...ys)-Math.min(...ys)]; }
const labels = (process.env.LABELS||'').split(';').filter(Boolean);
svg += `<style>path{vector-effect:non-scaling-stroke}</style>`;
fs.writeFileSync(process.env.OUT || 'preview.svg',`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.join(' ')}" width="${Math.round(1100*vb[2]/vb[3])}" height="1100"><rect x="-1000" y="-1000" width="5000" height="5000" fill="#dfe8ee"/>${svg}</svg>`);
