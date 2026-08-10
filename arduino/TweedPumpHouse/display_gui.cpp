#include "display_gui.h"

DisplayGUI displayGui;

LGFX_WT32_SC01::LGFX_WT32_SC01() {
    // 1. Configure SPI Bus for ST7796
    {
        auto cfg = _bus_instance.config();
        cfg.spi_host = VSPI_HOST;
        cfg.spi_mode = 0;
        cfg.freq_write = 40000000;
        cfg.freq_read = 16000000;
        cfg.spi_3wire = false;
        cfg.use_lock = true;
        cfg.dma_channel = 1;
        cfg.pin_sclk = 14;
        cfg.pin_mosi = 13;
        cfg.pin_miso = 12;
        cfg.pin_dc = 21;
        _bus_instance.config(cfg);
        _panel_instance.setBus(&_bus_instance);
    }

    // 2. Configure Panel (ST7796 320x480)
    {
        auto cfg = _panel_instance.config();
        cfg.pin_cs = 15;
        cfg.pin_rst = 22;
        cfg.pin_busy = -1;
        cfg.panel_width = 320;
        cfg.panel_height = 480;
        cfg.offset_x = 0;
        cfg.offset_y = 0;
        cfg.offset_rotation = 0;
        cfg.dummy_read_pixel = 8;
        cfg.dummy_read_bits = 1;
        cfg.readable = false;
        cfg.invert = false;
        cfg.rgb_order = false;
        cfg.dlen_16bit = false;
        cfg.bus_shared = false;
        _panel_instance.config(cfg);
    }

    // 3. Configure Backlight
    {
        auto cfg = _light_instance.config();
        cfg.pin_bl = 23;
        cfg.invert = false;
        cfg.freq = 44100;
        cfg.pwm_channel = 7;
        _light_instance.config(cfg);
        _panel_instance.setLight(&_light_instance);
    }

    // 4. Configure FT6336U Capacitive Touch
    {
        auto cfg = _touch_instance.config();
        cfg.x_min = 0;
        cfg.x_max = 319;
        cfg.y_min = 0;
        cfg.y_max = 479;
        cfg.pin_int = 39;
        cfg.bus_shared = false;
        cfg.offset_rotation = 0;
        cfg.i2c_port = 1;
        cfg.i2c_addr = 0x38;
        cfg.pin_sda = 18;
        cfg.pin_scl = 19;
        cfg.freq = 400000;
        _touch_instance.config(cfg);
        _panel_instance.setTouch(&_touch_instance);
    }

    setPanel(&_panel_instance);
}

DisplayGUI::DisplayGUI() : _sprite(&_lcd), _lastRenderTime(0), _touchPressed(false), _touchX(0), _touchY(0) {
    // Landscape Layout Buttons (480 x 320)
    _btnSilenceAlarm  = { 12,  260, 105, 48 };
    _btnResetPump     = { 128, 260, 110, 48 };
    _btnValveOverride = { 248, 260, 105, 48 };
    _btnPumpOverride  = { 364, 260, 105, 48 };
}

void DisplayGUI::begin() {
    _lcd.init();
    _lcd.setRotation(1); // Landscape 480 x 320
    _lcd.setBrightness(255);
    _lcd.fillScreen(TFT_BLACK);

    _sprite.setColorDepth(8); // 8-bit depth for smooth fast rendering with PSRAM
    _sprite.createSprite(480, 320);
}

void DisplayGUI::handleTouchInput() {
    uint16_t tx, ty;
    if (_lcd.getTouch(&tx, &ty)) {
        if (!_touchPressed) {
            _touchPressed = true;
            _touchX = tx;
            _touchY = ty;

            // Silence Alarm Button
            if (_touchX >= _btnSilenceAlarm.x && _touchX <= (_btnSilenceAlarm.x + _btnSilenceAlarm.w) &&
                _touchY >= _btnSilenceAlarm.y && _touchY <= (_btnSilenceAlarm.y + _btnSilenceAlarm.h)) {
                systemController.silenceAlarm();
            }
            // Reset Pump Timeout Button
            else if (_touchX >= _btnResetPump.x && _touchX <= (_btnResetPump.x + _btnResetPump.w) &&
                     _touchY >= _btnResetPump.y && _touchY <= (_btnResetPump.y + _btnResetPump.h)) {
                systemController.resetPumpTimeout();
            }
            // Valve Override Cycle (Auto -> Force Open -> Force Close -> Auto)
            else if (_touchX >= _btnValveOverride.x && _touchX <= (_btnValveOverride.x + _btnValveOverride.w) &&
                     _touchY >= _btnValveOverride.y && _touchY <= (_btnValveOverride.y + _btnValveOverride.h)) {
                OverrideMode current = systemController.getTelemetry().valveOverride;
                OverrideMode next = (current == MODE_AUTO) ? MODE_FORCE_ON : ((current == MODE_FORCE_ON) ? MODE_FORCE_OFF : MODE_AUTO);
                systemController.setLineValveOverride(next);
            }
            // Pump Override Cycle (Auto -> Force On -> Force Off -> Auto)
            else if (_touchX >= _btnPumpOverride.x && _touchX <= (_btnPumpOverride.x + _btnPumpOverride.w) &&
                     _touchY >= _btnPumpOverride.y && _touchY <= (_btnPumpOverride.y + _btnPumpOverride.h)) {
                OverrideMode current = systemController.getTelemetry().pumpOverride;
                OverrideMode next = (current == MODE_AUTO) ? MODE_FORCE_ON : ((current == MODE_FORCE_ON) ? MODE_FORCE_OFF : MODE_AUTO);
                systemController.setPumpOverride(next);
            }
        }
    } else {
        _touchPressed = false;
    }
}

void DisplayGUI::drawHeader(bool wifiConnected, bool bleConnected) {
    _sprite.fillRect(0, 0, 480, 32, 0x18C3); // Dark slate header
    _sprite.setTextColor(TFT_WHITE, 0x18C3);
    _sprite.setTextSize(1);
    _sprite.drawString("TWEED BLVD / RT-9W WATER SYSTEM", 12, 10);

    // Network Badges
    _sprite.drawString(wifiConnected ? "WIFI: OK" : "WIFI: OFF", 320, 10);
    _sprite.drawString(bleConnected ? "BLE: ON" : "BLE: RDY", 410, 10);
}

void DisplayGUI::drawTankGraphic(const SystemTelemetry& telemetry) {
    // Tank Outline (Left side: x=12, y=40, w=150, h=210)
    int tx = 12, ty = 40, tw = 150, th = 210;
    _sprite.fillRoundRect(tx, ty, tw, th, 8, 0x2124);
    _sprite.drawRoundRect(tx, ty, tw, th, 8, 0x632C);

    _sprite.setTextColor(TFT_WHITE, 0x2124);
    _sprite.drawString("TWEED HOLDING TANK", tx + 12, ty + 8);

    // Water level animation
    int waterHeight = 20;
    if (!telemetry.tankHigh) {
        waterHeight = 160; // FULL
    } else if (!telemetry.tankLow) {
        waterHeight = 100; // MEDIUM
    } else if (!telemetry.tankEmpty) {
        waterHeight = 45;  // LOW
    } else {
        waterHeight = 10;  // EMPTY
    }

    int waterY = ty + th - 10 - waterHeight;
    _sprite.fillRect(tx + 6, waterY, tw - 12, waterHeight, 0x03FF); // Bright Cyan Water

    // Float Switch Indicators
    // 1. Tank High Switch (Top: y = ty + 35)
    bool highFull = !telemetry.tankHigh;
    _sprite.fillCircle(tx + 22, ty + 42, 7, highFull ? TFT_GREEN : 0x7BEF);
    _sprite.setTextColor(highFull ? TFT_GREEN : TFT_LIGHTGRAY, 0x2124);
    _sprite.drawString(highFull ? "HIGH (FULL)" : "HIGH (OFF)", tx + 36, ty + 38);

    // 2. Tank Low Switch (Middle: y = ty + 105)
    bool lowActive = telemetry.tankLow;
    _sprite.fillCircle(tx + 22, ty + 110, 7, lowActive ? TFT_YELLOW : TFT_GREEN);
    _sprite.setTextColor(lowActive ? TFT_YELLOW : TFT_GREEN, 0x2124);
    _sprite.drawString(lowActive ? "LOW (DEMAND)" : "LOW (OK)", tx + 36, ty + 106);

    // 3. Tank Empty Switch (Bottom: y = ty + 175)
    bool emptyActive = telemetry.tankEmpty;
    _sprite.fillCircle(tx + 22, ty + 180, 7, emptyActive ? TFT_RED : TFT_GREEN);
    _sprite.setTextColor(emptyActive ? TFT_RED : TFT_GREEN, 0x2124);
    _sprite.drawString(emptyActive ? "EMPTY (ALARM!)" : "EMPTY (OK)", tx + 36, ty + 176);
}

void DisplayGUI::drawActuatorsAndClimate(const SystemTelemetry& telemetry) {
    // Actuators & Status Card (Right side: x=172, y=40, w=296, h=210)
    int cx = 172, cy = 40, cw = 296, ch = 210;
    _sprite.fillRoundRect(cx, cy, cw, ch, 8, 0x2124);
    _sprite.drawRoundRect(cx, cy, cw, ch, 8, 0x632C);

    // 1. Line Valve Status (cy + 8)
    _sprite.setTextColor(TFT_LIGHTGRAY, 0x2124);
    _sprite.drawString("LINE VALVE:", cx + 10, cy + 8);
    _sprite.setTextColor(telemetry.lineValve ? TFT_GREEN : 0x7BEF, 0x2124);
    _sprite.drawString(telemetry.lineValve ? "OPEN (ENERGIZED)" : "CLOSED", cx + 115, cy + 8);

    // 2. Water Pump Status (cy + 28)
    _sprite.setTextColor(TFT_LIGHTGRAY, 0x2124);
    _sprite.drawString("WATER PUMP:", cx + 10, cy + 28);
    if (telemetry.pumpOvercurrentTrip) {
        _sprite.setTextColor(TFT_RED, 0x2124);
        _sprite.drawString("OVERLOAD TRIP!", cx + 115, cy + 28);
    } else if (telemetry.pumpUndercurrentTrip) {
        _sprite.setTextColor(TFT_YELLOW, 0x2124);
        _sprite.drawString("DRY RUN TRIP!", cx + 115, cy + 28);
    } else if (telemetry.pumpTimingState == PUMP_STATE_RUNNING || telemetry.pump) {
        _sprite.setTextColor(TFT_CYAN, 0x2124);
        _sprite.drawString("RUNNING (ASSIST)", cx + 115, cy + 28);
    } else if (telemetry.pumpTimingState == PUMP_STATE_COOLDOWN) {
        _sprite.setTextColor(TFT_YELLOW, 0x2124);
        _sprite.drawString("TIMED OUT (COOLDOWN)", cx + 115, cy + 28);
    } else {
        _sprite.setTextColor(0x7BEF, 0x2124);
        _sprite.drawString("OFF / STANDBY", cx + 115, cy + 28);
    }

    // 3. Pump On-Time / Timers (cy + 48)
    _sprite.setTextColor(TFT_LIGHTGRAY, 0x2124);
    _sprite.drawString("PUMP TIMER:", cx + 10, cy + 48);

    char timerStr[54];
    if (telemetry.pumpTimingState == PUMP_STATE_RUNNING || telemetry.pump) {
        unsigned long elapsedSec = telemetry.pumpRunElapsedMs / 1000UL;
        snprintf(timerStr, sizeof(timerStr), "ON: %02lu:%02lu / 25:00", elapsedSec / 60, elapsedSec % 60);
        _sprite.setTextColor(TFT_CYAN, 0x2124);
    } else if (telemetry.pumpTimingState == PUMP_STATE_COOLDOWN) {
        unsigned long remSec = telemetry.pumpCooldownRemainingMs / 1000UL;
        unsigned long ranSec = telemetry.pumpLastRunDurationMs / 1000UL;
        snprintf(timerStr, sizeof(timerStr), "RAN %02lum | CD %02luh%02lum", ranSec / 60, remSec / 3600, (remSec % 3600) / 60);
        _sprite.setTextColor(TFT_YELLOW, 0x2124);
    } else if (telemetry.pumpLastRunDurationMs > 0) {
        unsigned long lastSec = telemetry.pumpLastRunDurationMs / 1000UL;
        snprintf(timerStr, sizeof(timerStr), "IDLE (Last: %02lum %02lus)", lastSec / 60, lastSec % 60);
        _sprite.setTextColor(TFT_GREEN, 0x2124);
    } else {
        snprintf(timerStr, sizeof(timerStr), "STANDBY (READY)");
        _sprite.setTextColor(TFT_GREEN, 0x2124);
    }
    _sprite.drawString(timerStr, cx + 115, cy + 48);

    // 4. Overcurrent Sensor Status (cy + 68)
    _sprite.setTextColor(TFT_LIGHTGRAY, 0x2124);
    _sprite.drawString("OVERCURRENT:", cx + 10, cy + 68);
    if (telemetry.pumpOvercurrentTrip || telemetry.pumpOvercurrent) {
        _sprite.setTextColor(TFT_RED, 0x2124);
        _sprite.drawString(telemetry.pumpOvercurrentTrip ? "FAULT (TRIPPED)" : "ACTIVE (> LIMIT)", cx + 115, cy + 68);
    } else {
        _sprite.setTextColor(TFT_GREEN, 0x2124);
        _sprite.drawString("NORMAL (< LIMIT)", cx + 115, cy + 68);
    }

    // 5. Undercurrent Sensor Status (cy + 88)
    _sprite.setTextColor(TFT_LIGHTGRAY, 0x2124);
    _sprite.drawString("UNDERCURRENT:", cx + 10, cy + 88);
    if (telemetry.pumpUndercurrentTrip || telemetry.pumpUndercurrent) {
        _sprite.setTextColor(TFT_YELLOW, 0x2124);
        _sprite.drawString(telemetry.pumpUndercurrentTrip ? "DRY RUN (TRIPPED)" : "DRY RUN DETECTED", cx + 115, cy + 88);
    } else {
        _sprite.setTextColor(TFT_GREEN, 0x2124);
        _sprite.drawString("NORMAL (PRIME OK)", cx + 115, cy + 88);
    }

    // 6. Freeze Sensor Switch (<40°F) (cy + 108)
    _sprite.setTextColor(TFT_LIGHTGRAY, 0x2124);
    _sprite.drawString("FREEZE SENSOR:", cx + 10, cy + 108);
    if (telemetry.freezeSensor) {
        _sprite.setTextColor(TFT_RED, 0x2124);
        _sprite.drawString("< 40F DANGER (CLOSED)", cx + 115, cy + 108);
    } else {
        _sprite.setTextColor(TFT_GREEN, 0x2124);
        _sprite.drawString(">= 40F NORMAL", cx + 115, cy + 108);
    }

    // 7. DHT11 Ambient Sensors (cy + 128)
    _sprite.setTextColor(TFT_LIGHTGRAY, 0x2124);
    _sprite.drawString("PUMP ROOM:", cx + 10, cy + 128);
    char dhtStr[32];
    if (telemetry.dhtValid) {
        snprintf(dhtStr, sizeof(dhtStr), "%.1f F  |  %.0f%% RH", telemetry.temperatureF, telemetry.humidity);
    } else {
        snprintf(dhtStr, sizeof(dhtStr), "SENSOR INIT...");
    }
    _sprite.setTextColor(TFT_WHITE, 0x2124);
    _sprite.drawString(dhtStr, cx + 115, cy + 128);

    // 8. Alarm / Trip Status Banner (cy + 152, height 48)
    uint16_t bannerBg = 0x0BC4;
    if (telemetry.pumpOvercurrentTrip) {
        bannerBg = TFT_RED;
    } else if (telemetry.pumpUndercurrentTrip) {
        bannerBg = 0xFD20;
    } else if (telemetry.alarm) {
        bannerBg = TFT_RED;
    } else if (telemetry.alarmSilenced) {
        bannerBg = 0x7380;
    } else if (telemetry.pumpTimingState == PUMP_STATE_COOLDOWN) {
        bannerBg = 0x8400;
    }

    _sprite.fillRoundRect(cx + 8, cy + 152, cw - 16, 48, 6, bannerBg);
    _sprite.setTextColor(TFT_WHITE, bannerBg);
    if (telemetry.pumpOvercurrentTrip) {
        _sprite.drawString("! CRITICAL: MOTOR OVERLOAD TRIP !", cx + 16, cy + 162);
        _sprite.drawString("Pump disabled. Press RESET to clear.", cx + 16, cy + 178);
    } else if (telemetry.pumpUndercurrentTrip) {
        _sprite.drawString("! WARNING: DRY RUN / SUCTION TRIP !", cx + 16, cy + 162);
        _sprite.drawString("Pump stopped. Press RESET to clear.", cx + 16, cy + 178);
    } else if (telemetry.alarm) {
        _sprite.drawString("! CRITICAL: TANK EMPTY ALARM SOUNDING !", cx + 16, cy + 168);
    } else if (telemetry.alarmSilenced) {
        _sprite.drawString("TANK EMPTY (ALARM MUTED BY USER)", cx + 22, cy + 168);
    } else if (telemetry.pumpTimingState == PUMP_STATE_COOLDOWN) {
        _sprite.drawString("PUMP TIMED OUT: 2HR COOLDOWN ACTIVE", cx + 16, cy + 168);
    } else {
        _sprite.drawString("SYSTEM NORMAL - HOLDING TANK SECURE", cx + 18, cy + 168);
    }
}

void DisplayGUI::drawControlButtons(const SystemTelemetry& telemetry) {
    // 1. Silence Alarm Button
    uint16_t silenceColor = (telemetry.alarm || telemetry.pumpOvercurrentTrip) ? TFT_RED : 0x39E7;
    _sprite.fillRoundRect(_btnSilenceAlarm.x, _btnSilenceAlarm.y, _btnSilenceAlarm.w, _btnSilenceAlarm.h, 6, silenceColor);
    _sprite.setTextColor(TFT_WHITE, silenceColor);
    _sprite.drawString("SILENCE", _btnSilenceAlarm.x + 24, _btnSilenceAlarm.y + 10);
    _sprite.drawString("ALARM", _btnSilenceAlarm.x + 28, _btnSilenceAlarm.y + 26);

    // 2. Reset Pump & Fault Button
    bool hasFaultOrTimeout = (telemetry.pumpTimingState == PUMP_STATE_COOLDOWN || telemetry.pumpOvercurrentTrip || telemetry.pumpUndercurrentTrip);
    uint16_t resetColor = hasFaultOrTimeout ? 0xFD20 : 0x2144;
    _sprite.fillRoundRect(_btnResetPump.x, _btnResetPump.y, _btnResetPump.w, _btnResetPump.h, 6, resetColor);
    _sprite.setTextColor(TFT_WHITE, resetColor);
    _sprite.drawString("RESET PUMP", _btnResetPump.x + 18, _btnResetPump.y + 10);
    _sprite.drawString(hasFaultOrTimeout ? "FAULT/RESET" : "TIMEOUT", _btnResetPump.x + 16, _btnResetPump.y + 26);

    // 3. Valve Override Cycle Button
    uint16_t valveColor = (telemetry.valveOverride == MODE_AUTO) ? 0x1B2E : 0x632C;
    _sprite.fillRoundRect(_btnValveOverride.x, _btnValveOverride.y, _btnValveOverride.w, _btnValveOverride.h, 6, valveColor);
    _sprite.setTextColor(TFT_WHITE, valveColor);
    _sprite.drawString("VALVE MODE", _btnValveOverride.x + 14, _btnValveOverride.y + 10);
    const char* vModeStr = (telemetry.valveOverride == MODE_AUTO) ? "AUTO" : ((telemetry.valveOverride == MODE_FORCE_ON) ? "FORCE OPEN" : "FORCE CLS");
    _sprite.drawString(vModeStr, _btnValveOverride.x + 18, _btnValveOverride.y + 26);

    // 4. Pump Override Cycle Button
    uint16_t pumpColor = (telemetry.pumpOverride == MODE_AUTO) ? 0x1B2E : 0x632C;
    _sprite.fillRoundRect(_btnPumpOverride.x, _btnPumpOverride.y, _btnPumpOverride.w, _btnPumpOverride.h, 6, pumpColor);
    _sprite.setTextColor(TFT_WHITE, pumpColor);
    _sprite.drawString("PUMP MODE", _btnPumpOverride.x + 16, _btnPumpOverride.y + 10);
    const char* pModeStr = (telemetry.pumpOverride == MODE_AUTO) ? "AUTO" : ((telemetry.pumpOverride == MODE_FORCE_ON) ? "FORCE ON" : "FORCE OFF");
    _sprite.drawString(pModeStr, _btnPumpOverride.x + 18, _btnPumpOverride.y + 26);
}

void DisplayGUI::update(const SystemTelemetry& telemetry, bool wifiConnected, bool bleConnected) {
    handleTouchInput();

    unsigned long now = millis();
    if (now - _lastRenderTime < 100) { // 10 FPS refresh for UI
        return;
    }
    _lastRenderTime = now;

    _sprite.fillScreen(TFT_BLACK);
    drawHeader(wifiConnected, bleConnected);
    drawTankGraphic(telemetry);
    drawActuatorsAndClimate(telemetry);
    drawControlButtons(telemetry);

    _sprite.pushSprite(0, 0);
}
