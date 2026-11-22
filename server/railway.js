import http from 'node:http';
const port=Number(process.env.PORT||3000);
const server=http.createServer(async(req,res)=>{
 const url=new URL(req.url||'/', 'http://localhost');
 const send=(status,data)=>{res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(data));};
 if(req.method!=='GET')return send(405,{error:'method_not_allowed'});
 if(url.pathname==='/health')return send(200,{status:'ok',service:'SV Rota1'});
 // Public API is deliberately disabled until rate limits and secret configuration are ready.
 if(url.pathname.startsWith('/api/'))return send(503,{error:'traffic_service_not_configured'});
 return send(404,{error:'not_found'});
});
server.listen(port,'0.0.0.0',()=>console.log('SV Rota1 server listening on '+port));
