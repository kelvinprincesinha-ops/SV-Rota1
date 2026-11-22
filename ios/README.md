# SV Rota para iPhone

Aplicativo iOS nativo SwiftUI com WKWebView que reutiliza o mapa do SV Rota Android. Inclui localização CoreLocation, velocidade em km/h, acompanhamento de rota e voz pt-BR por AVSpeechSynthesizer.

## Compilar
No Mac com Xcode e XcodeGen:
```sh
cd ios
xcodegen generate
open SVRota.xcodeproj
```
Selecione seu time de assinatura em Signing & Capabilities e execute em um iPhone. O identificador do app é br.com.svrota.ios.

O workflow Build iOS no GitHub Actions compila um app **para simulador** (não instalável em iPhone real). Para distribuir no iPhone via TestFlight, é necessária uma conta Apple Developer com assinatura e envio via App Store Connect. Não existe APK de iPhone.

O app carrega a interface HTML compartilhada e requer internet para mapas e a API Railway. A localização é solicitada ao usuário. Esta primeira versão ainda precisa ser validada em iPhone real antes de publicação.
