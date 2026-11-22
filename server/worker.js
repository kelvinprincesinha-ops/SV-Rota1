// SV Rota1 TomTom proxy — Cloudflare Worker. Never embed the TomTom key in the APK.
// Secret: TOMTOM_API_KEY. Optional: ALLOWED_ORIGIN for a hosted web frontend.
const BASE = 'https://api.tomtom.com';
const routes = [
  { prefix: '/api/traffic/flow/', path: '/traffic/map/4/tile/flow/relative0/' },
  { prefix: '/api/traffic/incidents/', path: '/traffic/map/4/tile/incidents/s3/' }
];
const headers = {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET, OPTIONS','Access-Control-Allow-Headers':'Content-Type'};
function respond(body,status=200,extra={}){return new Response(body,{status,headers:{...headers,...extra}})}
export default {
 async fetch(request,env){
  if(request.method==='OPTIONS')return respond(null,204);
  if(request.method!=='GET')return respond('Method not allowed',405);
  if(!env.TOMTOM_API_KEY)return respond('Service not configured',503);
  const url=new URL(request.url),p=url.pathname;
  if(p==='/health')return respond(JSON.stringify({status:'ok'}),200,{'Content-Type':'application/json'});
  let target;
  if(p==='/api/route'){
   const coords=['fromLat','fromLon','toLat','toLon'].map(k=>Number(url.searchParams.get(k)));
   if(coords.some(n=>!Number.isFinite(n))||Math.abs(coords[0])>90||Math.abs(coords[2])>90||Math.abs(coords[1])>180||Math.abs(coords[3])>180)return respond('Invalid coordinates',400);
   target=new URL(BASE+'/routing/1/calculateRoute/'+coords[0]+','+coords[1]+':'+coords[2]+','+coords[3]+'/json');
   target.searchParams.set('traffic','true');target.searchParams.set('routeType','fastest');target.searchParams.set('travelMode','car');
  }else if(p==='/api/traffic/check'){
   const lat=Number(url.searchParams.get('lat')),lon=Number(url.searchParams.get('lon'));
   if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180)return respond('Invalid coordinates',400);
   target=new URL(BASE+'/traffic/services/4/flowSegmentData/relative0/10/json');target.searchParams.set('point',lat+','+lon);
  }else{
   const tile=routes.find(r=>p.startsWith(r.prefix));
   if(!tile)return respond('Not found',404);
   const suffix=p.slice(tile.prefix.length);
   if(!/^\d{1,2}\/\d+\/\d+\.png$/.test(suffix))return respond('Invalid tile',400);
   target=new URL(BASE+tile.path+suffix);
  }
  target.searchParams.set('key',env.TOMTOM_API_KEY);
  try{
   const upstream=await fetch(target.toString(),{headers:{'Accept':'application/json,image/png'}});
   const type=upstream.headers.get('content-type')||'application/octet-stream';
   // Do not expose upstream URLs, credentials or provider error bodies.
   if(!upstream.ok)return respond(JSON.stringify({error:'Provider unavailable',status:upstream.status}),upstream.status,{'Content-Type':'application/json'});
   return new Response(upstream.body,{status:200,headers:{...headers,'Content-Type':type,'Cache-Control':p.includes('/tile/')||p.startsWith('/api/traffic/flow/')||p.startsWith('/api/traffic/incidents/')?'public, max-age=45':'no-store'}});
  }catch{return respond('Upstream unavailable',502)}
 }
};
