#include "web_sync.h"
#include <ArduinoJson.h>

WebSyncManager webSyncManager;

WebSyncManager::WebSyncManager() 
    : _server(HTTP_SERVER_PORT), 
      _lastCloudPushTime(0) 
{}

void WebSyncManager::begin() {
    Serial.println("[WIFI] Connecting to WiFi: " DEFAULT_WIFI_SSID " ...");
    WiFi.mode(WIFI_STA);
    WiFi.begin(DEFAULT_WIFI_SSID, DEFAULT_WIFI_PASS);

    // Non-blocking WiFi connection timeout (5 seconds attempt)
    unsigned long startAttempt = millis();
    while (WiFi.status() != WL_CONNECTED && millis() - startAttempt < 5000) {
        delay(250);
        Serial.print(".");
    }

    if (WiFi.status() == WL_CONNECTED) {
        Serial.println("\n[WIFI] Connected! IP Address: " + WiFi.localIP().toString());
        if (MDNS.begin(MDNS_HOSTNAME)) {
            Serial.println("[MDNS] Responder started: http://" MDNS_HOSTNAME ".local");
        }
    } else {
        Serial.println("\n[WIFI] WiFi not connected. Running standalone & BLE mode.");
    }

    setupRoutes();
    _server.begin();
    Serial.println("[HTTP] Local Web Server started on port 80");
}

void WebSyncManager::setupRoutes() {
    // 1. CORS Preflight & API Status Endpoint
    _server.on("/api/status", HTTP_GET, [](AsyncWebServerRequest *request){
        AsyncWebServerResponse *response = request->beginResponse(200, "application/json", systemController.getTelemetryJson());
        response->addHeader("Access-Control-Allow-Origin", "*");
        response->addHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        response->addHeader("Access-Control-Allow-Headers", "Content-Type");
        request->send(response);
    });

    // 2. Command Endpoint (POST /api/command)
    _server.on("/api/command", HTTP_OPTIONS, [](AsyncWebServerRequest *request){
        AsyncWebServerResponse *response = request->beginResponse(200);
        response->addHeader("Access-Control-Allow-Origin", "*");
        response->addHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        response->addHeader("Access-Control-Allow-Headers", "Content-Type");
        request->send(response);
    });

    _server.on("/api/command", HTTP_POST, [](AsyncWebServerRequest *request){}, NULL, 
        [](AsyncWebServerRequest *request, uint8_t *data, size_t len, size_t index, size_t total){
            String body = "";
            for (size_t i = 0; i < len; i++) {
                body += (char)data[i];
            }
            bool success = systemController.processCommandJson(body);
            AsyncWebServerResponse *response = request->beginResponse(success ? 200 : 400, "application/json", 
                success ? "{\"status\":\"ok\"}" : "{\"status\":\"error\",\"message\":\"invalid command\"}");
            response->addHeader("Access-Control-Allow-Origin", "*");
            request->send(response);
        }
    );

    // 3. Embedded Local Fallback Web Page (GET /)
    _server.on("/", HTTP_GET, [](AsyncWebServerRequest *request){
        String html = "<!DOCTYPE html><html><head><meta charset='utf-8'>"
                      "<meta name='viewport' content='width=device-width,initial-scale=1'>"
                      "<title>Tweed Pump House Controller</title>"
                      "<style>"
                      "body{font-family:sans-serif;background:#0f172a;color:#f8fafc;padding:20px;text-align:center;}"
                      ".card{background:#1e293b;border-radius:12px;padding:20px;max-width:500px;margin:auto;box-shadow:0 8px 16px rgba(0,0,0,0.4);}"
                      "h1{color:#38bdf8;font-size:20px;margin-bottom:15px;}"
                      ".btn{display:inline-block;padding:12px 20px;margin:8px;border-radius:8px;border:none;font-weight:bold;cursor:pointer;color:#fff;}"
                      ".btn-silence{background:#ef4444;}"
                      ".btn-reset{background:#f59e0b;}"
                      ".btn-auto{background:#0284c7;}"
                      "#data{margin-top:15px;background:#0b0f17;padding:12px;border-radius:8px;text-align:left;font-family:monospace;font-size:12px;white-space:pre-wrap;}"
                      "</style></head><body>"
                      "<div class='card'>"
                      "<h1>Tweed Blvd / Rt-9W Water System</h1>"
                      "<p>Local ESP32 Server Active</p>"
                      "<button class='btn btn-silence' onclick='cmd({\"silenceAlarm\":true})'>Silence Alarm</button>"
                      "<button class='btn btn-reset' onclick='cmd({\"resetPumpTimeout\":true})'>Reset Pump Timeout</button><br>"
                      "<button class='btn btn-auto' onclick='cmd({\"setValveOverride\":0})'>Valve AUTO</button>"
                      "<button class='btn btn-auto' onclick='cmd({\"setPumpOverride\":0})'>Pump AUTO</button>"
                      "<div id='data'>Loading telemetry...</div>"
                      "</div>"
                      "<script>"
                      "function update(){fetch('/api/status').then(r=>r.json()).then(d=>{"
                      "document.getElementById('data').innerText = JSON.stringify(d, null, 2);"
                      "});}"
                      "function cmd(b){fetch('/api/command',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)}).then(()=>update());}"
                      "setInterval(update, 2000); update();"
                      "</script></body></html>";
        request->send(200, "text/html", html);
    });
}

void WebSyncManager::pushTelemetryToCloud(const String& telemetryJson) {
    if (!CLOUD_SYNC_ENABLED || WiFi.status() != WL_CONNECTED) {
        return;
    }

    HTTPClient http;
    http.begin(CLOUD_ENDPOINT_URL);
    http.addHeader("Content-Type", "application/json");
    http.setTimeout(2500);

    int httpCode = http.POST(telemetryJson);
    if (httpCode > 0) {
        // Successfully communicated with remote Netlify endpoint / cloud
    }
    http.end();
}

void WebSyncManager::update(const String& telemetryJson) {
    if (WiFi.status() == WL_CONNECTED && CLOUD_SYNC_ENABLED) {
        unsigned long now = millis();
        if (now - _lastCloudPushTime >= CLOUD_SYNC_INTERVAL_MS) {
            pushTelemetryToCloud(telemetryJson);
            _lastCloudPushTime = now;
        }
    }
}
