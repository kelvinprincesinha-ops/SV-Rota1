import SwiftUI
import WebKit
import CoreLocation
import AVFoundation

@main
struct SVRotaApp: App {
    var body: some Scene {
        WindowGroup {
            NavigationScreen()
                .ignoresSafeArea()
        }
    }
}

struct NavigationScreen: UIViewRepresentable {
    func makeCoordinator() -> Coordinator { Coordinator() }
    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.defaultWebpagePreferences.allowsContentJavaScript = true
        configuration.allowsInlineMediaPlayback = true
        configuration.userContentController.add(context.coordinator, name: "svrota")
        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.isOpaque = false
        webView.scrollView.isScrollEnabled = false
        webView.navigationDelegate = context.coordinator
        context.coordinator.webView = webView
        context.coordinator.startLocation()
        if let url = Bundle.main.url(forResource: "index", withExtension: "html") {
            webView.loadFileURL(url, allowingReadAccessTo: url.deletingLastPathComponent())
        }
        return webView
    }
    func updateUIView(_ uiView: WKWebView, context: Context) {}

    final class Coordinator: NSObject, WKNavigationDelegate, WKScriptMessageHandler, CLLocationManagerDelegate, AVSpeechSynthesizerDelegate {
        weak var webView: WKWebView?
        private let location = CLLocationManager()
        private let synthesizer = AVSpeechSynthesizer()
        private var lastFix: CLLocation?

        func startLocation() {
            location.delegate = self
            location.desiredAccuracy = kCLLocationAccuracyBestForNavigation
            location.distanceFilter = 2
            location.requestWhenInUseAuthorization()
            if location.authorizationStatus == .authorizedWhenInUse || location.authorizationStatus == .authorizedAlways {
                location.startUpdatingLocation()
            }
        }

        func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
            if manager.authorizationStatus == .authorizedWhenInUse || manager.authorizationStatus == .authorizedAlways {
                manager.startUpdatingLocation()
            }
        }

        func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
            guard let fix = locations.last, fix.horizontalAccuracy >= 0 else { return }
            lastFix = fix
            sendFix(fix)
        }

        private func sendFix(_ fix: CLLocation) {
            let bearing = fix.course >= 0 ? String(fix.course) : "null"
            let speed = fix.speed >= 0 ? String(fix.speed) : "null"
            let js = "window.onNativeLocation && window.onNativeLocation(\(fix.coordinate.latitude),\(fix.coordinate.longitude),\(bearing),\(speed));"
            webView?.evaluateJavaScript(js, completionHandler: nil)
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            let bridge = """
            window.SVRota = {
              requestLocation: function(){ window.webkit.messageHandlers.svrota.postMessage({type:'location'}); },
              speak: function(text){ window.webkit.messageHandlers.svrota.postMessage({type:'speak',text:String(text)}); },
              stopSpeaking: function(){ window.webkit.messageHandlers.svrota.postMessage({type:'stopSpeaking'}); }
            };
            """
            webView.evaluateJavaScript(bridge, completionHandler: nil)
            if let fix = lastFix { sendFix(fix) }
        }

        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            guard let body = message.body as? [String: Any], let type = body["type"] as? String else { return }
            switch type {
            case "location":
                startLocation()
                location.requestLocation()
            case "speak":
                guard let text = body["text"] as? String else { return }
                synthesizer.stopSpeaking(at: .immediate)
                let utterance = AVSpeechUtterance(string: text)
                utterance.voice = AVSpeechSynthesisVoice(language: "pt-BR")
                utterance.rate = 0.48
                synthesizer.speak(utterance)
            case "stopSpeaking":
                synthesizer.stopSpeaking(at: .immediate)
            default: break
            }
        }

        func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
            print("SV Rota GPS: \(error.localizedDescription)")
        }
    }
}
