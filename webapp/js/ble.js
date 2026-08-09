/**
 * Tweed Boulevard / Route 9W Water System
 * Web Bluetooth (BLE) Manager
 */

const BLE_CONFIG = {
  serviceUUID: "a7b30001-9f2d-43c2-a89e-01a7d65b1200",
  telemetryCharUUID: "a7b30002-9f2d-43c2-a89e-01a7d65b1200",
  commandCharUUID: "a7b30003-9f2d-43c2-a89e-01a7d65b1200"
};

class BleManager {
  constructor(onTelemetryCallback, onConnectionChangeCallback) {
    this.onTelemetry = onTelemetryCallback;
    this.onConnectionChange = onConnectionChangeCallback;
    
    this.device = null;
    this.server = null;
    this.telemetryChar = null;
    this.commandChar = null;
    this.isConnected = false;
  }

  isSupported() {
    return (navigator.bluetooth && typeof navigator.bluetooth.requestDevice === 'function');
  }

  async connect() {
    if (!this.isSupported()) {
      alert("Web Bluetooth is not supported on this browser. Please use Chrome, Edge, or Bluefy on iOS.");
      return false;
    }

    try {
      console.log("[BLE] Requesting Bluetooth Device...");
      this.device = await navigator.bluetooth.requestDevice({
        filters: [
          { name: "Tweed-PumpHouse" },
          { services: [BLE_CONFIG.serviceUUID] }
        ],
        optionalServices: [BLE_CONFIG.serviceUUID]
      });

      this.device.addEventListener('gattserverdisconnected', () => this.handleDisconnection());

      console.log("[BLE] Connecting to GATT Server...");
      this.server = await this.device.gatt.connect();

      console.log("[BLE] Getting Primary Service...");
      const service = await this.server.getPrimaryService(BLE_CONFIG.serviceUUID);

      console.log("[BLE] Getting Characteristics...");
      this.telemetryChar = await service.getCharacteristic(BLE_CONFIG.telemetryCharUUID);
      this.commandChar = await service.getCharacteristic(BLE_CONFIG.commandCharUUID);

      // Start Telemetry Notifications
      await this.telemetryChar.startNotifications();
      this.telemetryChar.addEventListener('characteristicvaluechanged', (event) => {
        const decoder = new TextDecoder('utf-8');
        const jsonStr = decoder.decode(event.target.value);
        try {
          const data = JSON.parse(jsonStr);
          if (this.onTelemetry) this.onTelemetry(data, "bluetooth");
        } catch (e) {
          console.warn("[BLE] Failed to parse JSON packet:", jsonStr);
        }
      });

      this.isConnected = true;
      if (this.onConnectionChange) this.onConnectionChange(true, "Direct Bluetooth (BLE)");
      console.log("[BLE] Connected successfully to Tweed-PumpHouse!");
      return true;
    } catch (err) {
      console.error("[BLE] Connection error:", err);
      this.isConnected = false;
      if (this.onConnectionChange) this.onConnectionChange(false, "Disconnected");
      return false;
    }
  }

  async sendCommand(commandObj) {
    if (!this.isConnected || !this.commandChar) {
      console.warn("[BLE] Cannot send command: Not connected via BLE.");
      return false;
    }

    try {
      const jsonStr = JSON.stringify(commandObj);
      const encoder = new TextEncoder();
      const data = encoder.encode(jsonStr);
      await this.commandChar.writeValue(data);
      console.log("[BLE] Command sent successfully:", jsonStr);
      return true;
    } catch (err) {
      console.error("[BLE] Error sending command:", err);
      return false;
    }
  }

  disconnect() {
    if (this.device && this.device.gatt.connected) {
      this.device.gatt.disconnect();
    }
    this.handleDisconnection();
  }

  handleDisconnection() {
    this.isConnected = false;
    this.server = null;
    this.telemetryChar = null;
    this.commandChar = null;
    if (this.onConnectionChange) this.onConnectionChange(false, "Disconnected");
    console.log("[BLE] Disconnected from Bluetooth device.");
  }
}
