#include "ble_service.h"

BleServiceManager bleManager;

BleServiceManager::BleServiceManager() 
    : _pServer(nullptr), 
      _pTelemetryChar(nullptr), 
      _pCommandChar(nullptr), 
      _deviceConnected(false), 
      _oldDeviceConnected(false),
      _lastNotifyTime(0) 
{}

void BleServiceManager::begin() {
    // Initialize BLE Device
    BLEDevice::init(BLE_DEVICE_NAME);

    // Create BLE Server
    _pServer = BLEDevice::createServer();
    _pServer->setCallbacks(this);

    // Create BLE Custom GATT Service
    BLEService* pService = _pServer->createService(BLE_SERVICE_UUID);

    // 1. Telemetry Characteristic (Read / Notify)
    _pTelemetryChar = pService->createCharacteristic(
        BLE_CHAR_TELEMETRY_UUID,
        BLECharacteristic::PROPERTY_READ |
        BLECharacteristic::PROPERTY_NOTIFY
    );
    _pTelemetryChar->addDescriptor(new BLE2902());

    // 2. Command Characteristic (Write)
    _pCommandChar = pService->createCharacteristic(
        BLE_CHAR_COMMAND_UUID,
        BLECharacteristic::PROPERTY_WRITE
    );
    _pCommandChar->setCallbacks(this);

    // Start Service
    pService->start();

    // Start Advertising
    BLEAdvertising* pAdvertising = BLEDevice::getAdvertising();
    pAdvertising->addServiceUUID(BLE_SERVICE_UUID);
    pAdvertising->setScanResponse(true);
    pAdvertising->setMinPreferred(0x06); // functions that help with iPhone connections issue
    pAdvertising->setMinPreferred(0x12);
    BLEDevice::startAdvertising();
    Serial.println("[BLE] GATT Service started and advertising as: " BLE_DEVICE_NAME);
}

void BleServiceManager::onConnect(BLEServer* pServer) {
    _deviceConnected = true;
    Serial.println("[BLE] Client connected.");
}

void BleServiceManager::onDisconnect(BLEServer* pServer) {
    _deviceConnected = false;
    Serial.println("[BLE] Client disconnected.");
}

void BleServiceManager::onWrite(BLECharacteristic* pCharacteristic) {
    std::string value = pCharacteristic->getValue();
    if (value.length() > 0) {
        String cmdStr = String(value.c_str());
        Serial.print("[BLE] Command received: ");
        Serial.println(cmdStr);

        bool success = systemController.processCommandJson(cmdStr);
        if (success) {
            Serial.println("[BLE] Command executed successfully.");
        } else {
            Serial.println("[BLE] Command failed to parse.");
        }
    }
}

void BleServiceManager::update(const String& telemetryJson) {
    // Handle disconnection restart advertising
    if (!_deviceConnected && _oldDeviceConnected) {
        delay(500); // Give the bluetooth stack the chance to get things ready
        _pServer->startAdvertising(); // restart advertising
        Serial.println("[BLE] Restarted advertising.");
        _oldDeviceConnected = _deviceConnected;
    }
    // Handle connecting
    if (_deviceConnected && !_oldDeviceConnected) {
        _oldDeviceConnected = _deviceConnected;
    }

    // Broadcast Telemetry via BLE notification every 1s when connected
    if (_deviceConnected) {
        unsigned long now = millis();
        if (now - _lastNotifyTime >= TELEMETRY_BROADCAST_MS) {
            _pTelemetryChar->setValue(telemetryJson.c_str());
            _pTelemetryChar->notify();
            _lastNotifyTime = now;
        }
    }
}
