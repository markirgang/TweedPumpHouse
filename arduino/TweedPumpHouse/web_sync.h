#ifndef WEB_SYNC_H
#define WEB_SYNC_H

#include <Arduino.h>
#include <WiFi.h>
#include <ESPmDNS.h>
#include <ESPAsyncWebServer.h>
#include <HTTPClient.h>
#include "config.h"
#include "controller.h"

class WebSyncManager {
public:
    WebSyncManager();
    void begin();
    void update(const String& telemetryJson);
    bool isWiFiConnected() const { return WiFi.status() == WL_CONNECTED; }
    String getIpAddress() const { return WiFi.localIP().toString(); }

private:
    AsyncWebServer _server;
    unsigned long _lastCloudPushTime;
    void setupRoutes();
    void pushTelemetryToCloud(const String& telemetryJson);
};

extern WebSyncManager webSyncManager;

#endif // WEB_SYNC_H
