import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const PORT=Number(process.env.PORT||3000);
const API='https://api.tomtom.com';
const buckets=new Map();
// Experimental community reports: ephemeral and unverified; production needs moderation and durable storage.
const communityReports=[];const reportCooldown=new Map();
const reportTypes=new Set(['Acidente','Trânsito parado','Obras','Radar observado','Perigo na via','Alagamento observado','Buraco na pista','Via interditada']);
function purgeReports(){const cutoff=Date.now()-45*60*1000;while(communityReports.length&&communityReports[0].created<cutoff)communityReports.shift()}

function allowed(ip,isTile){const now=Date.now(),key=(isTile?'tile:':'api:')+ip,entry=buckets.get(key)||{count:0,reset:now+60000};if(now>entry.reset){entry.count=0;entry.reset=now+60000}entry.count++;buckets.set(key,entry);if(buckets.size>10000)for(const [k,v] of buckets)if(now>v.reset)buckets.delete(k);return entry.count<=Number(isTile?(process.env.TILE_RATE_LIMIT_PER_MINUTE||600):(process.env.RATE_LIMIT_PER_MINUTE||90))}
const coord=(x,max)=>x!==null&&x!==''&&Number.isFinite(Number(x))&&Math.abs(Number(x))<=max;
const sendManifest=res=>{res.writeHead(200,{'Content-Type':'application/manifest+json; charset=utf-8','Cache-Control':'public,max-age=3600'});res.end(JSON.stringify({name:'SV Rota',short_name:'SV Rota',start_url:'/app',scope:'/',display:'standalone',background_color:'#0b2034',theme_color:'#0b2034',description:'Navegação SV Rota para iPhone e Android',icons:[{src:'/icon.svg',sizes:'any',type:'image/svg+xml',purpose:'any maskable'}]}))};
const send=(res,status,body)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Access-Control-Allow-Origin':'*'});res.end(JSON.stringify(body))};
http.createServer(async(req,res)=>{
 const u=new URL(req.url||'/', 'http://localhost');
 if(req.method==='OPTIONS'){res.writeHead(204,{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type'});return res.end()}
 if(u.pathname==='/api/reports'){
  const ip=String(req.headers['x-forwarded-for']||req.socket.remoteAddress||'unknown').split(',')[0].trim();
  purgeReports();
  if(req.method==='GET'){
   const lat=Number(u.searchParams.get('lat')),lon=Number(u.searchParams.get('lon'));
   if(!coord(u.searchParams.get('lat'),90)||!coord(u.searchParams.get('lon'),180))return send(res,400,{error:'invalid_coordinates'});
   const near=communityReports.filter(r=>Math.abs(r.lat-lat)<.07&&Math.abs(r.lon-lon)<.07).slice(-80).map(({ip:_,...r})=>r);
   return send(res,200,{reports:near,verified:false,temporary:true});
  }
  if(req.method==='POST'){
   if(Date.now()-(reportCooldown.get(ip)||0)<60000)return send(res,429,{error:'report_cooldown'});
   let raw='';try{for await(const chunk of req){raw+=chunk.toString();if(raw.length>1024)return send(res,413,{error:'too_large'})}
    const data=JSON.parse(raw),lat=Number(data.lat),lon=Number(data.lon);
    if(!reportTypes.has(data.type)||!coord(String(data.lat),90)||!coord(String(data.lon),180))return send(res,400,{error:'invalid_report'});
    reportCooldown.set(ip,Date.now());communityReports.push({id:String(Date.now())+'-'+Math.floor(Math.random()*10000),type:data.type,lat,lon,created:Date.now(),ip});
    if(communityReports.length>1000)communityReports.shift();
    return send(res,201,{ok:true,temporary:true,verified:false});
   }catch(e){return send(res,400,{error:'invalid_json'})}
  }
  return send(res,405,{error:'method_not_allowed'});
 }
 if(req.method!=='GET')return send(res,405,{error:'method_not_allowed'});
 if(u.pathname==='/health')return send(res,200,{status:'ok',service:'SV Rota1',trafficConfigured:!!process.env.TOMTOM_API_KEY});
 if(u.pathname==='/'||u.pathname==='/app'||u.pathname==='/app/'){
  try{const html=await readFile(resolve(root,'app/src/main/assets/index.html'));res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-cache'});return res.end(html)}catch(e){return send(res,503,{error:'web_app_unavailable'})}
 }
 if(u.pathname==='/manifest.webmanifest')return sendManifest(res);
 if(u.pathname==='/icon.svg'){res.writeHead(200,{'Content-Type':'image/svg+xml; charset=utf-8','Cache-Control':'public,max-age=86400'});return res.end('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192"><rect width="192" height="192" rx="40" fill="#0b2034"/><circle cx="96" cy="96" r="65" fill="none" stroke="#22a7ff" stroke-width="9"/><path d="M96 38 132 145 96 123 60 145Z" fill="#65c8ff" stroke="white" stroke-width="5" stroke-linejoin="round"/></svg>')}

 if(u.pathname==='/sw.js'){res.writeHead(200,{'Content-Type':'application/javascript; charset=utf-8','Cache-Control':'no-cache'});return res.end("self.addEventListener('install',()=>self.skipWaiting());self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));")}

 if(!u.pathname.startsWith('/api/'))return send(res,404,{error:'not_found'});
 if(!process.env.TOMTOM_API_KEY)return send(res,503,{error:'traffic_service_not_configured'});
 const ip=String(req.headers['x-forwarded-for']||req.socket.remoteAddress||'unknown').split(',')[0].trim();
 const isTile=/^\/api\/traffic\/(flow|incidents)\/\d{1,2}\/\d+\/\d+\.png$/.test(u.pathname);
 if(!allowed(ip,isTile))return send(res,429,{error:'rate_limited',category:isTile?'traffic_tiles':'api_requests'});
 let upstream;
 if(u.pathname==='/api/traffic/check'){
  if(!coord(u.searchParams.get('lat'),90)||!coord(u.searchParams.get('lon'),180))return send(res,400,{error:'invalid_coordinates'});
  upstream=new URL(API+'/traffic/services/4/flowSegmentData/relative0/10/json');
  upstream.searchParams.set('point',u.searchParams.get('lat')+','+u.searchParams.get('lon'));
 }else if(u.pathname==='/api/route'){
  const names=['fromLat','fromLon','toLat','toLon'];
  if(names.some((k,i)=>!coord(u.searchParams.get(k),i%2===0?90:180)))return send(res,400,{error:'invalid_coordinates'});
  upstream=new URL(API+'/routing/1/calculateRoute/'+names.map(k=>u.searchParams.get(k)).slice(0,2).join(',')+':'+names.map(k=>u.searchParams.get(k)).slice(2).join(',')+'/json');
  upstream.searchParams.set('traffic','true');upstream.searchParams.set('routeType',u.searchParams.get('routeType')==='shortest'?'shortest':'fastest');upstream.searchParams.set('travelMode','car');if(u.searchParams.get('avoidTolls')==='true')upstream.searchParams.set('avoid','tollRoads');
 }else if(u.pathname.startsWith('/api/search/')){
  const query=decodeURIComponent(u.pathname.slice('/api/search/'.length));
  if(query.length<2||query.length>160)return send(res,400,{error:'invalid_query'});
  upstream=new URL(API+'/search/2/search/'+encodeURIComponent(query)+'.json');
  for(const k of ['limit','countrySet','language','typeahead','lat','lon','radius'])if(u.searchParams.has(k))upstream.searchParams.set(k,u.searchParams.get(k));
  upstream.searchParams.set('limit','8');upstream.searchParams.set('countrySet','BR');
 }else{
  const match=u.pathname.match(/^\/api\/traffic\/(flow|incidents)\/(\d{1,2})\/(\d+)\/(\d+)\.png$/);
  if(!match)return send(res,404,{error:'not_found'});
  const z=Number(match[2]),x=Number(match[3]),y=Number(match[4]);
  if(z>22||x>=2**z||y>=2**z)return send(res,400,{error:'invalid_tile'});
  upstream=new URL(API+'/traffic/map/4/tile/'+(match[1]==='flow'?'flow/relative0':'incidents/s3')+'/'+z+'/'+x+'/'+y+'.png');
 }
 upstream.searchParams.set('key',process.env.TOMTOM_API_KEY);
 try{
  const response=await fetch(upstream,{signal:AbortSignal.timeout(10000)});
  if(!response.ok)return send(res,response.status>=500?502:response.status,{error:'provider_error',status:response.status});
  const type=response.headers.get('content-type')||'application/octet-stream';
  res.writeHead(200,{'Content-Type':type,'Access-Control-Allow-Origin':'*','Cache-Control':u.pathname.endsWith('.png')?'public,max-age=30':'no-store'});
  for await(const chunk of response.body)res.write(chunk);
  res.end();
 }catch(e){if(!res.headersSent)send(res,502,{error:'upstream_unavailable'});else res.end()}
}).listen(PORT,'0.0.0.0',()=>console.log('SV Rota1 API listening on '+PORT));
