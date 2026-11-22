# SV Rota1 — servidor central TomTom (preparação)

O arquivo `worker.js` é um Cloudflare Worker que encaminha solicitações de trânsito e rotas para a TomTom, mantendo a chave em um segredo do servidor. O código é um ponto de partida, **não é um serviço publicado**.

## Publicação
1. Crie um Worker na sua conta Cloudflare e publique o conteúdo de `worker.js`.
2. Em Settings > Variables and Secrets, configure **TOMTOM_API_KEY** como Secret (nunca variável pública, commit ou APK). Gere uma nova chave TomTom antes, pois a antiga foi exposta na conversa.
3. Teste `/health`, `/api/traffic/check?lat=-23.96&lon=-46.39` e `/api/route?fromLat=-23.96&fromLon=-46.39&toLat=-23.97&toLon=-46.38`.
4. Antes de uso público, implementar limitação de requisições por IP/dispositivo, proteção antiabuso, monitoramento de custos e política de acesso. CORS sozinho não protege uma API pública.
5. Somente depois de publicar e testar, configurar a URL HTTPS do servidor no aplicativo, substituir chamadas TomTom diretas pelo proxy e remover a tela de chave de API do build público.

## Rotas disponíveis
- GET `/api/traffic/check?lat=...&lon=...`
- GET `/api/route?fromLat=...&fromLon=...&toLat=...&toLon=...`
- GET `/api/traffic/flow/{z}/{x}/{y}.png`
- GET `/api/traffic/incidents/{z}/{x}/{y}.png`

## Observações
O APK atual **continua usando a chave local**. Este commit não ativa automaticamente o backend e não fornece serviço compartilhado até existir uma implantação HTTPS. Nunca colocar a chave em código fonte, APK ou repositório público.
