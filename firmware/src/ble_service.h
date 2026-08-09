#ifndef BLE_SERVICE_H
#define BLE_SERVICE_H

#include <Arduino.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include "config.h"
#include "controller.h"

class BleServiceManager : public BLEServerCallbacks, public BLECharacteristicCallbacks {
public:
    BleServiceManager();
    void begin();
    void update(const String& telemetryJson);
    bool isClientConnected() const { return _deviceConnected; }

    // BLEServerCallbacks
    void onConnect(BLEServer* pServer) override;
    void onDisconnect(BLEServer* pServer) override;

    // BLECharacteristicCallbacks (Write commands)
    void onWrite(BLECharacteristic* pCharacteristic) override;

private:
    BLEServer* _pServer;
    BLECharacteristic* _pTelemetryChar;
    BLECharacteristic* _pCommandChar;
    bool _deviceConnected;
    bool _oldDeviceConnected;
    unsigned long _lastNotifyTime;
};

extern BleServiceManager bleManager;

#endif // BLE_SERVICE_H
