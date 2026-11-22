# SV Rota

Aplicativo Android experimental de navegação para carro e moto em São Vicente.

## Compilar APK
Abra a aba **Actions** e execute **Build Android APK** (ou aguarde o build no push). Após concluir, abra a execução e baixe o artefato `SV-Rota-debug-apk`. No celular, extraia o ZIP e instale o APK.

## Recursos
- GPS do aparelho com permissão explícita
- Mapa OpenStreetMap (Leaflet)
- Pesquisa de destino por endereço via Nominatim
- Rotas para carro e moto usando OSRM (perfil de automóvel; **não há roteamento especializado para motocicleta**)
- Recalcular rota, distância e duração estimadas

**Atenção:** protótipo dependente de serviços públicos de terceiros, sem informações de trânsito em tempo real e sem instruções por voz. Não use a tela enquanto dirige. Serviços públicos têm limites de uso e não oferecem garantia de disponibilidade. Para publicação comercial, substitua os endpoints por serviços com contrato e chave adequados.
