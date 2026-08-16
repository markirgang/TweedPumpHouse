#include "display_gui.h"
#include "i2s_audio.h"
#include <Wire.h>

DisplayGUI displayGui;

// =========================================================================
// LovyanGFX Driver Implementation for Waveshare ESP32-S3-Touch-LCD-7
// =========================================================================
LGFX_Waveshare_LCD7::LGFX_Waveshare_LCD7() {
    // 1. Configure Panel (ST7262 800x480 RGB Panel)
    {
        auto cfg = _panel_instance.config();
        cfg.memory_width  = 800;
        cfg.memory_height = 480;
        cfg.panel_width   = 800;
        cfg.panel_height  = 480;
        cfg.offset_x      = 0;
        cfg.offset_y      = 0;
        cfg.offset_rotation = 0;
        _panel_instance.config(cfg);
    }
    {
        auto cfg = _panel_instance.config_detail();
        cfg.use_psram = 1;
        _panel_instance.config_detail(cfg);
    }

    // 2. Configure 16-bit Parallel RGB Bus (ST7262 RGB565)
    {
        auto cfg = _bus_instance.config();
        cfg.panel = &_panel_instance;

        // Blue 5-bit bus lines (B0 - B4)
        cfg.pin_d0  = GPIO_NUM_14; // B0
        cfg.pin_d1  = GPIO_NUM_38; // B1
        cfg.pin_d2  = GPIO_NUM_18; // B2
        cfg.pin_d3  = GPIO_NUM_17; // B3
        cfg.pin_d4  = GPIO_NUM_10; // B4

        // Green 6-bit bus lines (G0 - G5)
        cfg.pin_d5  = GPIO_NUM_39; // G0
        cfg.pin_d6  = GPIO_NUM_0;  // G1
        cfg.pin_d7  = GPIO_NUM_45; // G2
        cfg.pin_d8  = GPIO_NUM_48; // G3
        cfg.pin_d9  = GPIO_NUM_47; // G4
        cfg.pin_d10 = GPIO_NUM_21; // G5

        // Red 5-bit bus lines (R0 - R4)
        cfg.pin_d11 = GPIO_NUM_1;  // R0
        cfg.pin_d12 = GPIO_NUM_2;  // R1
        cfg.pin_d13 = GPIO_NUM_42; // R2
        cfg.pin_d14 = GPIO_NUM_41; // R3
        cfg.pin_d15 = GPIO_NUM_40; // R4

        // Synchronization and Timing Signals
        cfg.pin_henable = GPIO_NUM_5;  // DE
        cfg.pin_vsync   = GPIO_NUM_3;  // VSYNC
        cfg.pin_hsync   = GPIO_NUM_46; // HSYNC
        cfg.pin_pclk    = GPIO_NUM_7;  // PCLK

        cfg.freq_write = 14000000;     // 14 MHz Pixel Clock

        // ST7262 Horizontal Timing Porches
        cfg.hsync_polarity    = 0;
        cfg.hsync_front_porch = 40;
        cfg.hsync_pulse_width = 48;
        cfg.hsync_back_porch  = 40;

        // ST7262 Vertical Timing Porches
        cfg.vsync_polarity    = 0;
        cfg.vsync_front_porch = 13;
        cfg.vsync_pulse_width = 3;
        cfg.vsync_back_porch  = 32;

        cfg.pclk_active_neg   = 1;
        cfg.de_idle_high      = 0;
        cfg.pclk_idle_high    = 0;

        _bus_instance.config(cfg);
    }
    _panel_instance.setBus(&_bus_instance);

    // 3. Configure GT911 Capacitive Touch Controller (I2C SDA: GPIO 8, SCL: GPIO 9)
    {
        auto cfg = _touch_instance.config();
        cfg.x_min      = 0;
        cfg.x_max      = 799;
        cfg.y_min      = 0;
        cfg.y_max      = 479;
        cfg.pin_int    = GPIO_NUM_4;  // TP_IRQ
        cfg.bus_shared = true;
        cfg.offset_rotation = 0;
        cfg.i2c_port   = 1;
        cfg.i2c_addr   = 0x5D;        // Default GT911 I2C Address
        cfg.pin_sda    = GPIO_NUM_8;
        cfg.pin_scl    = GPIO_NUM_9;
        cfg.freq       = 400000;
        _touch_instance.config(cfg);
        _panel_instance.setTouch(&_touch_instance);
    }

    setPanel(&_panel_instance);
}

// =========================================================================
// DisplayGUI Core Implementation
// =========================================================================
DisplayGUI::DisplayGUI() 
    : _sprite(&_lcd), 
      _currentPage(PAGE_DASHBOARD), 
      _lastRenderTime(0), 
      _touchPressed(false), 
      _touchX(0), 
      _touchY(0),
      _pinModalActive(false),
      _enteredPin(""),
      _pendingAction(ACT_NONE),
      _unlockedUntil(0),
      _pinError(false)
{
    // 800x480 Header Navigation Tabs & Controls
    _tabDashboard   = { 240, 5, 120, 32 };
    _tabSettings    = { 368, 5, 110, 32 };
    _btnAudioToggle = { 486, 6, 76, 30 };

    // 800x480 Dashboard Bottom Control Bar (Y=406, H=62)
    _btnSilenceAlarm  = { 16,  406, 180, 62 };
    _btnResetPump     = { 208, 406, 180, 62 };
    _btnValveOverride = { 400, 406, 188, 62 };
    _btnPumpOverride  = { 600, 406, 184, 62 };

    // 800x480 Settings Page Buttons (2-Column x 4-Row Grid + Bottom Actions)
    // Left Column (X=16, W=376, H=68)
    _btnSetPump         = { 16, 58,  376, 68 };
    _btnSetHigh         = { 16, 136, 376, 68 };
    _btnSetLow          = { 16, 214, 376, 68 };
    _btnSetEmpty        = { 16, 292, 376, 68 };

    // Right Column (X=408, W=376, H=68)
    _btnSetValve        = { 408, 58,  376, 68 };
    _btnSetOvercurrent  = { 408, 136, 376, 68 };
    _btnSetUndercurrent = { 408, 214, 376, 68 };
    _btnSetFreeze       = { 408, 292, 376, 68 };

    // Bottom Action Buttons
    _btnResetAllAuto    = { 16,  390, 376, 68 };
    _btnBackToDash      = { 408, 390, 376, 68 };

    // PIN Keypad Buttons (Centered Modal at X=220, Y=40, W=360, H=400)
    int startX = 244, startY = 160, btnW = 96, btnH = 48, gapX = 12, gapY = 8;
    for (int row = 0; row < 4; row++) {
        for (int col = 0; col < 3; col++) {
            int idx = row * 3 + col;
            _keypadBtns[idx] = { startX + col * (btnW + gapX), startY + row * (btnH + gapY), btnW, btnH };
        }
    }
}

void DisplayGUI::initIOExpander() {
    // Waveshare ESP32-S3-Touch-LCD-7 uses CH422G I/O Expander on I2C (GPIO 8/9)
    // to control Backlight (EXIO2), Touch Reset (EXIO1), and LCD Reset (EXIO3).
    Wire.begin(PIN_I2C_SDA, PIN_I2C_SCL, 400000);
    delay(20);

    // 1. Send system command to enable CH422G open-drain/push-pull outputs
    Wire.beginTransmission(0x24); // CH422G system address
    Wire.write(0x01);             // Enable output mode
    Wire.endTransmission();
    delay(10);

    // 2. Set EXIO pins: LCD_BL=1 (Backlight ON), TP_RST=1, LCD_RST=1
    Wire.beginTransmission(0x38); // CH422G Set IO output register
    Wire.write(0xFF);             // Set all expanded IO pins HIGH
    Wire.endTransmission();
    delay(20);
}

void DisplayGUI::begin() {
    // 1. Initialize Onboard CH422G I/O expander for backlight & peripheral enable
    initIOExpander();

    // 2. Initialize LovyanGFX RGB & GT911 Touch
    _lcd.init();
    _lcd.setRotation(0); // Landscape 800 x 480
    _lcd.setBrightness(255);
    _lcd.fillScreen(TFT_BLACK);

    // 3. Create 800x480 Double Buffering Sprite in PSRAM
    _sprite.setColorDepth(8); // 8-bit depth in PSRAM for fast 60fps rendering
    _sprite.createSprite(800, 480);
}

void DisplayGUI::requestProtectedAction(PinAction act) {
    if (millis() < _unlockedUntil) {
        // Session already authenticated
        executeAction(act);
    } else {
        // Open PIN Keypad modal
        _pinModalActive = true;
        _enteredPin = "";
        _pinError = false;
        _pendingAction = act;
    }
}

void DisplayGUI::executeAction(PinAction act) {
    switch (act) {
        case ACT_PUMP_OVERRIDE: {
            OverrideMode cur = systemController.getTelemetry().pumpOverride;
            systemController.setPumpOverride((cur == MODE_AUTO) ? MODE_FORCE_ON : ((cur == MODE_FORCE_ON) ? MODE_FORCE_OFF : MODE_AUTO));
            break;
        }
        case ACT_VALVE_OVERRIDE: {
            OverrideMode cur = systemController.getTelemetry().valveOverride;
            systemController.setLineValveOverride((cur == MODE_AUTO) ? MODE_FORCE_ON : ((cur == MODE_FORCE_ON) ? MODE_FORCE_OFF : MODE_AUTO));
            break;
        }
        case ACT_HIGH_OVERRIDE: {
            OverrideMode cur = systemController.getTelemetry().tankHighOverride;
            systemController.setTankHighOverride((cur == MODE_AUTO) ? MODE_FORCE_ON : ((cur == MODE_FORCE_ON) ? MODE_FORCE_OFF : MODE_AUTO));
            break;
        }
        case ACT_LOW_OVERRIDE: {
            OverrideMode cur = systemController.getTelemetry().tankLowOverride;
            systemController.setTankLowOverride((cur == MODE_AUTO) ? MODE_FORCE_ON : ((cur == MODE_FORCE_ON) ? MODE_FORCE_OFF : MODE_AUTO));
            break;
        }
        case ACT_EMPTY_OVERRIDE: {
            OverrideMode cur = systemController.getTelemetry().tankEmptyOverride;
            systemController.setTankEmptyOverride((cur == MODE_AUTO) ? MODE_FORCE_ON : ((cur == MODE_FORCE_ON) ? MODE_FORCE_OFF : MODE_AUTO));
            break;
        }
        case ACT_OVERCURRENT_OVERRIDE: {
            OverrideMode cur = systemController.getTelemetry().overcurrentOverride;
            systemController.setOvercurrentOverride((cur == MODE_AUTO) ? MODE_FORCE_ON : ((cur == MODE_FORCE_ON) ? MODE_FORCE_OFF : MODE_AUTO));
            break;
        }
        case ACT_UNDERCURRENT_OVERRIDE: {
            OverrideMode cur = systemController.getTelemetry().undercurrentOverride;
            systemController.setUndercurrentOverride((cur == MODE_AUTO) ? MODE_FORCE_ON : ((cur == MODE_FORCE_ON) ? MODE_FORCE_OFF : MODE_AUTO));
            break;
        }
        case ACT_FREEZE_OVERRIDE: {
            OverrideMode cur = systemController.getTelemetry().freezeOverride;
            systemController.setFreezeOverride((cur == MODE_AUTO) ? MODE_FORCE_ON : ((cur == MODE_FORCE_ON) ? MODE_FORCE_OFF : MODE_AUTO));
            break;
        }
        case ACT_RESET_ALL_AUTO: {
            systemController.resetAllOverrides();
            break;
        }
        default:
            break;
    }
}

void DisplayGUI::handlePinKeypadTouch() {
    // Check Close / Cancel button (top right of modal: x=530, y=46, w=40, h=36)
    if (_touchX >= 520 && _touchX <= 570 && _touchY >= 40 && _touchY <= 85) {
        _pinModalActive = false;
        _enteredPin = "";
        _pinError = false;
        _pendingAction = ACT_NONE;
        return;
    }

    // Keypad layout:
    // 0:'1', 1:'2', 2:'3'
    // 3:'4', 4:'5', 5:'6'
    // 6:'7', 7:'8', 8:'9'
    // 9:'CLR', 10:'0', 11:'OK'
    const char keyChars[12] = { '1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', 'E' };

    for (int i = 0; i < 12; i++) {
        if (_touchX >= _keypadBtns[i].x && _touchX <= (_keypadBtns[i].x + _keypadBtns[i].w) &&
            _touchY >= _keypadBtns[i].y && _touchY <= (_keypadBtns[i].y + _keypadBtns[i].h)) {
            
            char key = keyChars[i];
            if (key == 'C') {
                _enteredPin = "";
                _pinError = false;
            } else if (key == 'E') {
                // Enter / OK
                if (systemController.verifyPassword(_enteredPin)) {
                    _unlockedUntil = millis() + 60000; // 60s unlock window
                    _pinModalActive = false;
                    _pinError = false;
                    PinAction act = _pendingAction;
                    _pendingAction = ACT_NONE;
                    _enteredPin = "";
                    executeAction(act);
                } else {
                    _pinError = true;
                    _enteredPin = "";
                }
            } else {
                if (_enteredPin.length() < 6) {
                    _enteredPin += key;
                    _pinError = false;
                }
                if (_enteredPin.length() == 4 && systemController.verifyPassword(_enteredPin)) {
                    _unlockedUntil = millis() + 60000;
                    _pinModalActive = false;
                    _pinError = false;
                    PinAction act = _pendingAction;
                    _pendingAction = ACT_NONE;
                    _enteredPin = "";
                    executeAction(act);
                }
            }
            return;
        }
    }
}

void DisplayGUI::handleTouchInput() {
    uint16_t tx, ty;
    if (_lcd.getTouch(&tx, &ty)) {
        if (!_touchPressed) {
            _touchPressed = true;
            _touchX = tx;
            _touchY = ty;

            // Tactile audio feedback on valid touch press
            if (I2S_FEEDBACK_CLICKS_ENABLED) {
                i2sAudio.playChime(CHIME_CLICK);
            }

            // If PIN Keypad modal is active, route all touches to keypad
            if (_pinModalActive) {
                handlePinKeypadTouch();
                return;
            }

            // Global Header Tab Switchers
            if (_touchX >= _tabDashboard.x && _touchX <= (_tabDashboard.x + _tabDashboard.w) &&
                _touchY >= _tabDashboard.y && _touchY <= (_tabDashboard.y + _tabDashboard.h)) {
                _currentPage = PAGE_DASHBOARD;
                return;
            }
            if (_touchX >= _tabSettings.x && _touchX <= (_tabSettings.x + _tabSettings.w) &&
                _touchY >= _tabSettings.y && _touchY <= (_tabSettings.y + _tabSettings.h)) {
                _currentPage = PAGE_SETTINGS;
                return;
            }
            // Header Audio Speaker Mute / Unmute Toggle Button
            if (_touchX >= _btnAudioToggle.x && _touchX <= (_btnAudioToggle.x + _btnAudioToggle.w) &&
                _touchY >= _btnAudioToggle.y && _touchY <= (_btnAudioToggle.y + _btnAudioToggle.h)) {
                systemController.toggleAudioMute();
                return;
            }

            if (_currentPage == PAGE_DASHBOARD) {
                // Silence Alarm Button (Unprotected emergency action)
                if (_touchX >= _btnSilenceAlarm.x && _touchX <= (_btnSilenceAlarm.x + _btnSilenceAlarm.w) &&
                    _touchY >= _btnSilenceAlarm.y && _touchY <= (_btnSilenceAlarm.y + _btnSilenceAlarm.h)) {
                    systemController.silenceAlarm();
                }
                // Reset Pump Timeout Button (Unprotected fault recovery)
                else if (_touchX >= _btnResetPump.x && _touchX <= (_btnResetPump.x + _btnResetPump.w) &&
                         _touchY >= _btnResetPump.y && _touchY <= (_btnResetPump.y + _btnResetPump.h)) {
                    systemController.resetPumpTimeout();
                }
                // Valve Override Cycle (Protected)
                else if (_touchX >= _btnValveOverride.x && _touchX <= (_btnValveOverride.x + _btnValveOverride.w) &&
                         _touchY >= _btnValveOverride.y && _touchY <= (_btnValveOverride.y + _btnValveOverride.h)) {
                    requestProtectedAction(ACT_VALVE_OVERRIDE);
                }
                // Pump Override Cycle (Protected)
                else if (_touchX >= _btnPumpOverride.x && _touchX <= (_btnPumpOverride.x + _btnPumpOverride.w) &&
                         _touchY >= _btnPumpOverride.y && _touchY <= (_btnPumpOverride.y + _btnPumpOverride.h)) {
                    requestProtectedAction(ACT_PUMP_OVERRIDE);
                }
            }
            else if (_currentPage == PAGE_SETTINGS) {
                // 1. Pump Override (Protected)
                if (_touchX >= _btnSetPump.x && _touchX <= (_btnSetPump.x + _btnSetPump.w) &&
                    _touchY >= _btnSetPump.y && _touchY <= (_btnSetPump.y + _btnSetPump.h)) {
                    requestProtectedAction(ACT_PUMP_OVERRIDE);
                }
                // 2. Line Valve Override (Protected)
                else if (_touchX >= _btnSetValve.x && _touchX <= (_btnSetValve.x + _btnSetValve.w) &&
                         _touchY >= _btnSetValve.y && _touchY <= (_btnSetValve.y + _btnSetValve.h)) {
                    requestProtectedAction(ACT_VALVE_OVERRIDE);
                }
                // 3. Tank High Override (Protected)
                else if (_touchX >= _btnSetHigh.x && _touchX <= (_btnSetHigh.x + _btnSetHigh.w) &&
                    _touchY >= _btnSetHigh.y && _touchY <= (_btnSetHigh.y + _btnSetHigh.h)) {
                    requestProtectedAction(ACT_HIGH_OVERRIDE);
                }
                // 4. Tank Low Override (Protected)
                else if (_touchX >= _btnSetLow.x && _touchX <= (_btnSetLow.x + _btnSetLow.w) &&
                         _touchY >= _btnSetLow.y && _touchY <= (_btnSetLow.y + _btnSetLow.h)) {
                    requestProtectedAction(ACT_LOW_OVERRIDE);
                }
                // 5. Tank Empty Override (Protected)
                else if (_touchX >= _btnSetEmpty.x && _touchX <= (_btnSetEmpty.x + _btnSetEmpty.w) &&
                         _touchY >= _btnSetEmpty.y && _touchY <= (_btnSetEmpty.y + _btnSetEmpty.h)) {
                    requestProtectedAction(ACT_EMPTY_OVERRIDE);
                }
                // 6. Overcurrent Override (Protected)
                else if (_touchX >= _btnSetOvercurrent.x && _touchX <= (_btnSetOvercurrent.x + _btnSetOvercurrent.w) &&
                         _touchY >= _btnSetOvercurrent.y && _touchY <= (_btnSetOvercurrent.y + _btnSetOvercurrent.h)) {
                    requestProtectedAction(ACT_OVERCURRENT_OVERRIDE);
                }
                // 7. Undercurrent Override (Protected)
                else if (_touchX >= _btnSetUndercurrent.x && _touchX <= (_btnSetUndercurrent.x + _btnSetUndercurrent.w) &&
                         _touchY >= _btnSetUndercurrent.y && _touchY <= (_btnSetUndercurrent.y + _btnSetUndercurrent.h)) {
                    requestProtectedAction(ACT_UNDERCURRENT_OVERRIDE);
                }
                // 8. Freeze Override (Protected)
                else if (_touchX >= _btnSetFreeze.x && _touchX <= (_btnSetFreeze.x + _btnSetFreeze.w) &&
                         _touchY >= _btnSetFreeze.y && _touchY <= (_btnSetFreeze.y + _btnSetFreeze.h)) {
                    requestProtectedAction(ACT_FREEZE_OVERRIDE);
                }
                // 9. Reset All to Auto (Protected)
                else if (_touchX >= _btnResetAllAuto.x && _touchX <= (_btnResetAllAuto.x + _btnResetAllAuto.w) &&
                         _touchY >= _btnResetAllAuto.y && _touchY <= (_btnResetAllAuto.y + _btnResetAllAuto.h)) {
                    requestProtectedAction(ACT_RESET_ALL_AUTO);
                }
                // 10. Back to Dashboard
                else if (_touchX >= _btnBackToDash.x && _touchX <= (_btnBackToDash.x + _btnBackToDash.w) &&
                         _touchY >= _btnBackToDash.y && _touchY <= (_btnBackToDash.y + _btnBackToDash.h)) {
                    _currentPage = PAGE_DASHBOARD;
                }
            }
        }
    } else {
        _touchPressed = false;
    }
}

void DisplayGUI::drawHeader(bool wifiConnected, bool bleConnected) {
    // 800x42 Dark Slate Header Bar
    _sprite.fillRect(0, 0, 800, 42, 0x18C3);
    _sprite.setTextSize(1);

    // Main Logo & Title
    _sprite.setTextColor(0x03FF, 0x18C3);
    _sprite.drawString("TWEED WATER", 16, 8);
    _sprite.setTextColor(TFT_WHITE, 0x18C3);
    _sprite.drawString("SYSTEM CONTROLLER (7.0\" HMI)", 16, 22);

    // Tab 1: DASHBOARD
    uint16_t dashColor = (_currentPage == PAGE_DASHBOARD) ? 0x03FF : 0x2945;
    uint16_t dashTxtColor = (_currentPage == PAGE_DASHBOARD) ? TFT_BLACK : TFT_WHITE;
    _sprite.fillRoundRect(_tabDashboard.x, _tabDashboard.y, _tabDashboard.w, _tabDashboard.h, 6, dashColor);
    _sprite.setTextColor(dashTxtColor, dashColor);
    _sprite.drawString("DASHBOARD", _tabDashboard.x + 20, _tabDashboard.y + 9);

    // Tab 2: SETTINGS
    uint16_t setBgColor = (_currentPage == PAGE_SETTINGS) ? 0x03FF : 0x2945;
    uint16_t setTxtColor = (_currentPage == PAGE_SETTINGS) ? TFT_BLACK : TFT_WHITE;
    _sprite.fillRoundRect(_tabSettings.x, _tabSettings.y, _tabSettings.w, _tabSettings.h, 6, setBgColor);
    _sprite.setTextColor(setTxtColor, setBgColor);
    _sprite.drawString("SETTINGS", _tabSettings.x + 24, _tabSettings.y + 9);

    // Header Audio Speaker Mute / Status Button
    bool audioMuted = systemController.getTelemetry().audioMuted;
    bool audioPlaying = systemController.getTelemetry().audioPlaying;
    uint16_t audioBg = audioMuted ? 0x9800 : (audioPlaying ? 0x03FF : 0x2945);
    uint16_t audioTxtColor = audioMuted ? TFT_WHITE : (audioPlaying ? TFT_BLACK : TFT_WHITE);
    _sprite.fillRoundRect(_btnAudioToggle.x, _btnAudioToggle.y, _btnAudioToggle.w, _btnAudioToggle.h, 5, audioBg);
    _sprite.setTextColor(audioTxtColor, audioBg);
    if (audioMuted) {
        _sprite.drawString("MUTED", _btnAudioToggle.x + 18, _btnAudioToggle.y + 8);
    } else if (audioPlaying) {
        _sprite.drawString("AUDIO >", _btnAudioToggle.x + 12, _btnAudioToggle.y + 8);
    } else {
        _sprite.drawString("SPKR ON", _btnAudioToggle.x + 10, _btnAudioToggle.y + 8);
    }

    // Security Status Indicator
    bool isUnlocked = (millis() < _unlockedUntil);
    uint16_t lockBg = isUnlocked ? 0x03E0 : 0x39E7;
    _sprite.fillRoundRect(570, 6, 68, 30, 5, lockBg);
    _sprite.setTextColor(TFT_WHITE, lockBg);
    _sprite.drawString(isUnlocked ? "UNLOCKED" : "LOCKED", 576, 14);

    // Network Badges (WiFi & BLE)
    uint16_t wifiBg = wifiConnected ? 0x0400 : 0x2124;
    _sprite.fillRoundRect(644, 6, 68, 30, 5, wifiBg);
    _sprite.setTextColor(wifiConnected ? TFT_GREEN : 0x7BEF, wifiBg);
    _sprite.drawString(wifiConnected ? "WIFI ON" : "NO-WIFI", 650, 14);

    uint16_t bleBg = bleConnected ? 0x01B0 : 0x2124;
    _sprite.fillRoundRect(718, 6, 66, 30, 5, bleBg);
    _sprite.setTextColor(bleConnected ? TFT_CYAN : 0x7BEF, bleBg);
    _sprite.drawString(bleConnected ? "BLE ACT" : "BLE RDY", 724, 14);
}

void DisplayGUI::drawTankGraphic(const SystemTelemetry& telemetry) {
    // Holding Tank Card (Left Column: x=16, y=52, w=240, h=340)
    int tx = 16, ty = 52, tw = 240, th = 340;
    _sprite.fillRoundRect(tx, ty, tw, th, 10, 0x2124);
    _sprite.drawRoundRect(tx, ty, tw, th, 10, 0x632C);

    _sprite.setTextColor(TFT_WHITE, 0x2124);
    _sprite.drawString("TWEED HOLDING TANK", tx + 24, ty + 12);

    // Tank Graphic Outer Outline (x=32, y=86, w=208, h=240)
    int gx = tx + 16, gy = ty + 36, gw = tw - 32, gh = th - 52;
    _sprite.fillRoundRect(gx, gy, gw, gh, 8, 0x10A2);
    _sprite.drawRoundRect(gx, gy, gw, gh, 8, 0x4228);

    // Water level animation calculation
    int waterHeight = 30;
    if (!telemetry.tankHigh) {
        waterHeight = gh - 20; // 100% FULL
    } else if (!telemetry.tankLow) {
        waterHeight = (gh * 60) / 100; // 60% MEDIUM / ADEQUATE
    } else if (!telemetry.tankEmpty) {
        waterHeight = (gh * 25) / 100;  // 25% LOW / FILL DEMAND
    } else {
        waterHeight = 16;  // CRITICAL EMPTY (<10%)
    }

    int waterY = gy + gh - waterHeight;
    _sprite.fillRoundRect(gx + 4, waterY, gw - 8, waterHeight, 4, 0x03FF); // Bright Cyan Water Fill
    _sprite.drawFastHLine(gx + 4, waterY, gw - 8, TFT_WHITE); // Water surface line

    // Float Switch Indicators with Crisp Labels
    // 1. Tank High Switch (Top: y = gy + 35)
    bool highFull = !telemetry.tankHigh;
    _sprite.fillCircle(gx + 20, gy + 40, 8, highFull ? TFT_GREEN : 0x7BEF);
    _sprite.setTextColor(highFull ? TFT_GREEN : TFT_LIGHTGRAY, 0x10A2);
    _sprite.drawString(highFull ? "HIGH (100% FULL)" : "HIGH (BELOW FULL)", gx + 34, gy + 34);

    // 2. Tank Low Switch (Middle: y = gy + 120)
    bool lowActive = telemetry.tankLow;
    _sprite.fillCircle(gx + 20, gy + 125, 8, lowActive ? TFT_YELLOW : TFT_GREEN);
    _sprite.setTextColor(lowActive ? TFT_YELLOW : TFT_GREEN, 0x10A2);
    _sprite.drawString(lowActive ? "LOW (DEMAND ON)" : "LOW (ADEQUATE)", gx + 34, gy + 119);

    // 3. Tank Empty Switch (Bottom: y = gy + 210)
    bool emptyActive = telemetry.tankEmpty;
    _sprite.fillCircle(gx + 20, gy + 215, 8, emptyActive ? TFT_RED : TFT_GREEN);
    _sprite.setTextColor(emptyActive ? TFT_RED : TFT_GREEN, 0x10A2);
    _sprite.drawString(emptyActive ? "EMPTY (CRITICAL!)" : "EMPTY (NORMAL)", gx + 34, gy + 209);
}

void DisplayGUI::drawActuatorsAndClimate(const SystemTelemetry& telemetry) {
    // Actuators & Status Card (Right Column: x=270, y=52, w=514, h=340)
    int cx = 270, cy = 52, cw = 514, ch = 340;
    _sprite.fillRoundRect(cx, cy, cw, ch, 10, 0x2124);
    _sprite.drawRoundRect(cx, cy, cw, ch, 10, 0x632C);

    // 1. Line Valve Status (cy + 12)
    _sprite.setTextColor(TFT_LIGHTGRAY, 0x2124);
    _sprite.drawString("LINE VALVE:", cx + 18, cy + 12);
    _sprite.setTextColor(telemetry.lineValve ? TFT_GREEN : 0x7BEF, 0x2124);
    _sprite.drawString(telemetry.lineValve ? "OPEN (ENERGIZED / FILLING)" : "CLOSED (PIPE DRAINED)", cx + 180, cy + 12);

    // 2. Water Pump Status (cy + 34)
    _sprite.setTextColor(TFT_LIGHTGRAY, 0x2124);
    _sprite.drawString("WATER PUMP:", cx + 18, cy + 34);
    if (telemetry.pumpOvercurrentTrip) {
        _sprite.setTextColor(TFT_RED, 0x2124);
        _sprite.drawString("OVERLOAD TRIP (LOCKED/JAMMED)", cx + 180, cy + 34);
    } else if (telemetry.pumpUndercurrentTrip) {
        _sprite.setTextColor(TFT_YELLOW, 0x2124);
        _sprite.drawString("DRY RUN TRIP (LOSS OF PRIME)", cx + 180, cy + 34);
    } else if (telemetry.pumpCurrentFaultPending) {
        _sprite.setTextColor(TFT_YELLOW, 0x2124);
        _sprite.drawString("FAULT WARNING (PULSING ALARM)", cx + 180, cy + 34);
    } else if (telemetry.pumpTimingState == PUMP_STATE_RUNNING || telemetry.pump) {
        _sprite.setTextColor(TFT_CYAN, 0x2124);
        _sprite.drawString("RUNNING (BOOSTER ACTIVE)", cx + 180, cy + 34);
    } else if (telemetry.pumpTimingState == PUMP_STATE_COOLDOWN) {
        _sprite.setTextColor(TFT_YELLOW, 0x2124);
        _sprite.drawString("TIMED OUT (2-HR COOLDOWN)", cx + 180, cy + 34);
    } else if (telemetry.isFillCycleActive && telemetry.tankLow && telemetry.lineValve) {
        _sprite.setTextColor(TFT_YELLOW, 0x2124);
        _sprite.drawString("PRIMING (5s LINE CHARGE DELAY)", cx + 180, cy + 34);
    } else {
        _sprite.setTextColor(0x7BEF, 0x2124);
        _sprite.drawString("OFF / STANDBY READY", cx + 180, cy + 34);
    }

    // 3. Pump On-Time / Duty Cycle Timers (cy + 56)
    _sprite.setTextColor(TFT_LIGHTGRAY, 0x2124);
    _sprite.drawString("PUMP TIMER:", cx + 18, cy + 56);

    char timerStr[64];
    if (telemetry.municipalPressureTrip) {
        snprintf(timerStr, sizeof(timerStr), "MUNICIPAL OUTAGE (<5 PSI TRIP)");
        _sprite.setTextColor(TFT_RED, 0x2124);
    } else if (telemetry.municipalPressureFaultPending) {
        unsigned long remSec = telemetry.municipalPressureFaultRemainingMs / 1000UL;
        snprintf(timerStr, sizeof(timerStr), "LOW MUNI PRESSURE (%02lus until shutdown)", remSec);
        _sprite.setTextColor(TFT_YELLOW, 0x2124);
    } else if (telemetry.pumpCurrentFaultPending) {
        unsigned long remSec = telemetry.pumpCurrentFaultRemainingMs / 1000UL;
        snprintf(timerStr, sizeof(timerStr), "PRE-TRIP PULSE (%02lus until shutdown)", remSec);
        _sprite.setTextColor(TFT_YELLOW, 0x2124);
    } else if (telemetry.pumpTimingState == PUMP_STATE_RUNNING || telemetry.pump) {
        unsigned long elapsedSec = telemetry.pumpRunElapsedMs / 1000UL;
        snprintf(timerStr, sizeof(timerStr), "ON: %02lu:%02lu / 25:00 MAX RUN", elapsedSec / 60, elapsedSec % 60);
        _sprite.setTextColor(TFT_CYAN, 0x2124);
    } else if (telemetry.pumpTimingState == PUMP_STATE_COOLDOWN) {
        unsigned long remSec = telemetry.pumpCooldownRemainingMs / 1000UL;
        unsigned long ranSec = telemetry.pumpLastRunDurationMs / 1000UL;
        snprintf(timerStr, sizeof(timerStr), "RAN %02lum | REMAINING CD %02luh %02lum", ranSec / 60, remSec / 3600, (remSec % 3600) / 60);
        _sprite.setTextColor(TFT_YELLOW, 0x2124);
    } else if (telemetry.isFillCycleActive && telemetry.tankLow && telemetry.lineValve && !telemetry.pump) {
        snprintf(timerStr, sizeof(timerStr), "PRIMING SUCTION PIPE (5s DELAY)");
        _sprite.setTextColor(TFT_YELLOW, 0x2124);
    } else if (telemetry.pumpLastRunDurationMs > 0) {
        unsigned long lastSec = telemetry.pumpLastRunDurationMs / 1000UL;
        snprintf(timerStr, sizeof(timerStr), "STANDBY (Last Cycle: %02lum %02lus)", lastSec / 60, lastSec % 60);
        _sprite.setTextColor(TFT_GREEN, 0x2124);
    } else {
        snprintf(timerStr, sizeof(timerStr), "STANDBY (READY)");
        _sprite.setTextColor(TFT_GREEN, 0x2124);
    }
    _sprite.drawString(timerStr, cx + 180, cy + 56);

    // 4. Municipal 9W Line Pressure (cy + 78)
    _sprite.setTextColor(TFT_LIGHTGRAY, 0x2124);
    _sprite.drawString("MUNICIPAL (9W):", cx + 18, cy + 78);
    char muniPressStr[64];
    if (telemetry.municipalPressureTrip) {
        snprintf(muniPressStr, sizeof(muniPressStr), "%.1f PSI [OUTAGE TRIP <5 PSI! PUMP OFF]", telemetry.pressureMunicipalPsi);
        _sprite.setTextColor(TFT_RED, 0x2124);
    } else if (telemetry.municipalPressureFaultPending) {
        unsigned long remSec = telemetry.municipalPressureFaultRemainingMs / 1000UL;
        snprintf(muniPressStr, sizeof(muniPressStr), "%.1f PSI [CUTOUT IN %02lus!]", telemetry.pressureMunicipalPsi, remSec);
        _sprite.setTextColor(TFT_YELLOW, 0x2124);
    } else if (telemetry.municipalLowPressureAlarm) {
        snprintf(muniPressStr, sizeof(muniPressStr), "%.1f PSI [LOW PRESSURE ALERT <20!]", telemetry.pressureMunicipalPsi);
        _sprite.setTextColor(TFT_RED, 0x2124);
    } else {
        snprintf(muniPressStr, sizeof(muniPressStr), "%.1f PSI (CITY SUPPLY NOMINAL)", telemetry.pressureMunicipalPsi);
        _sprite.setTextColor(TFT_GREEN, 0x2124);
    }
    _sprite.drawString(muniPressStr, cx + 180, cy + 78);

    // 5. Fill Pipe Uphill Pressure (cy + 100)
    _sprite.setTextColor(TFT_LIGHTGRAY, 0x2124);
    _sprite.drawString("FILL PIPE (UPHILL):", cx + 18, cy + 100);
    char fillPressStr[64];
    if (telemetry.fillPipeHighPressureAlarm) {
        snprintf(fillPressStr, sizeof(fillPressStr), "%.1f PSI [OVER-PRESSURE / BLOCKED!]", telemetry.pressureFillPipePsi);
        _sprite.setTextColor(TFT_RED, 0x2124);
    } else if (telemetry.pump || telemetry.pumpTimingState == PUMP_STATE_RUNNING) {
        snprintf(fillPressStr, sizeof(fillPressStr), "%.1f PSI (BOOSTER ACTIVE / UPHILL)", telemetry.pressureFillPipePsi);
        _sprite.setTextColor(TFT_CYAN, 0x2124);
    } else if (telemetry.lineValve) {
        snprintf(fillPressStr, sizeof(fillPressStr), "%.1f PSI (GRAVITY / TOP-OFF)", telemetry.pressureFillPipePsi);
        _sprite.setTextColor(TFT_GREEN, 0x2124);
    } else {
        snprintf(fillPressStr, sizeof(fillPressStr), "%.1f PSI (PIPE DRAINED TO SUMP)", telemetry.pressureFillPipePsi);
        _sprite.setTextColor(0x7BEF, 0x2124);
    }
    _sprite.drawString(fillPressStr, cx + 180, cy + 100);

    // 6. Motor Current & FCS521-SD-10V AC Transmitter (cy + 122)
    _sprite.setTextColor(TFT_LIGHTGRAY, 0x2124);
    _sprite.drawString("MOTOR CURRENT:", cx + 18, cy + 122);
    char motorCurrStr[64];
    if (telemetry.pumpOvercurrentTrip) {
        snprintf(motorCurrStr, sizeof(motorCurrStr), "%.1f A (%.2fV) [OVERLOAD JAM TRIP!]", telemetry.pumpCurrentAmps, telemetry.pumpCurrentVolts);
        _sprite.setTextColor(TFT_RED, 0x2124);
    } else if (telemetry.pumpUndercurrentTrip) {
        snprintf(motorCurrStr, sizeof(motorCurrStr), "%.1f A (%.2fV) [DRY RUN / PRIME LOSS!]", telemetry.pumpCurrentAmps, telemetry.pumpCurrentVolts);
        _sprite.setTextColor(TFT_RED, 0x2124);
    } else if (telemetry.pumpCurrentFaultPending) {
        snprintf(motorCurrStr, sizeof(motorCurrStr), "%.1f A [PRE-TRIP PULSE (%02lus)]", telemetry.pumpCurrentAmps, telemetry.pumpCurrentFaultRemainingMs / 1000UL);
        _sprite.setTextColor(TFT_YELLOW, 0x2124);
    } else if (telemetry.pumpTimingState == PUMP_STATE_RUNNING || telemetry.pump) {
        snprintf(motorCurrStr, sizeof(motorCurrStr), "%.1f A (%.2fV) [NORMAL RUNNING LOAD]", telemetry.pumpCurrentAmps, telemetry.pumpCurrentVolts);
        _sprite.setTextColor(TFT_GREEN, 0x2124);
    } else {
        snprintf(motorCurrStr, sizeof(motorCurrStr), "%.1f A (%.2fV) [STANDBY READY]", telemetry.pumpCurrentAmps, telemetry.pumpCurrentVolts);
        _sprite.setTextColor(0x7BEF, 0x2124);
    }
    _sprite.drawString(motorCurrStr, cx + 180, cy + 122);

    // 7. Freeze Sensor Switch (<40°F) (cy + 144)
    _sprite.setTextColor(TFT_LIGHTGRAY, 0x2124);
    _sprite.drawString("FREEZE SENSOR:", cx + 18, cy + 144);
    if (telemetry.freezeSensor) {
        _sprite.setTextColor(TFT_RED, 0x2124);
        _sprite.drawString("< 40°F FREEZE HAZARD (PIPE DRAIN ACTIVE)", cx + 180, cy + 144);
    } else {
        _sprite.setTextColor(TFT_GREEN, 0x2124);
        _sprite.drawString(">= 40°F WARM (NORMAL TOP-OFF)", cx + 180, cy + 144);
    }

    // 8. DHT11 Room Climate & Siren Status (cy + 166)
    _sprite.setTextColor(TFT_LIGHTGRAY, 0x2124);
    _sprite.drawString("PUMP ROOM CLIMATE:", cx + 18, cy + 166);
    char dhtStr[64];
    if (telemetry.dhtValid) {
        if (telemetry.pumpRoomLowTempAlarm) {
            snprintf(dhtStr, sizeof(dhtStr), "%.1f°F (%.1f°C) [ALARM <55°F!] | %.0f%% RH", telemetry.temperatureF, telemetry.temperatureC, telemetry.humidity);
            _sprite.setTextColor(TFT_RED, 0x2124);
        } else {
            snprintf(dhtStr, sizeof(dhtStr), "%.1f°F (%.1f°C)  |  %.0f%% RH", telemetry.temperatureF, telemetry.temperatureC, telemetry.humidity);
            _sprite.setTextColor(TFT_WHITE, 0x2124);
        }
    } else {
        snprintf(dhtStr, sizeof(dhtStr), "INITIALIZING SENSOR...");
        _sprite.setTextColor(TFT_WHITE, 0x2124);
    }
    _sprite.drawString(dhtStr, cx + 180, cy + 166);

    // 9. Alarm / Safety Status Banner (cy + 196, height 128)
    uint16_t bannerBg = 0x0BC4;
    if (telemetry.municipalPressureTrip || telemetry.pumpOvercurrentTrip) {
        bannerBg = TFT_RED;
    } else if (telemetry.municipalPressureFaultPending || telemetry.pumpUndercurrentTrip || telemetry.pumpCurrentFaultPending) {
        bannerBg = 0xFD20;
    } else if (telemetry.municipalLowPressureAlarm || telemetry.fillPipeHighPressureAlarm) {
        bannerBg = 0xFD20;
    } else if (telemetry.alarm || telemetry.pumpRoomLowTempAlarm || telemetry.tankEmpty) {
        bannerBg = TFT_RED;
    } else if (telemetry.alarmSilenced) {
        bannerBg = 0x7380;
    } else if (telemetry.pumpTimingState == PUMP_STATE_COOLDOWN) {
        bannerBg = 0x8400;
    }

    _sprite.fillRoundRect(cx + 14, cy + 196, cw - 28, 128, 8, bannerBg);
    _sprite.setTextColor(TFT_WHITE, bannerBg);
    if (telemetry.municipalPressureTrip) {
        _sprite.drawString("! CRITICAL: MUNICIPAL WATER OUTAGE (<5 PSI) !", cx + 26, cy + 236);
        _sprite.drawString("Booster pump shut down to prevent dry cavitation. Verify supply and press RESET.", cx + 26, cy + 262);
    } else if (telemetry.municipalPressureFaultPending) {
        _sprite.setTextColor(TFT_BLACK, bannerBg);
        _sprite.drawString("! WARNING: MUNICIPAL PRESSURE < 5 PSI !", cx + 22, cy + 234);
        char warnStr[80];
        snprintf(warnStr, sizeof(warnStr), "Low suction pressure: Pump shutdown in %02lu seconds...", telemetry.municipalPressureFaultRemainingMs / 1000UL);
        _sprite.drawString(warnStr, cx + 22, cy + 262);
    } else if (telemetry.pumpOvercurrentTrip) {
        _sprite.drawString("! CRITICAL: MOTOR OVERCURRENT / JAM TRIP !", cx + 26, cy + 236);
        _sprite.drawString("Water pump is locked off for motor protection. Press RESET to clear.", cx + 26, cy + 262);
    } else if (telemetry.pumpUndercurrentTrip) {
        _sprite.drawString("! WARNING: DRY RUN / SUCTION LOSS TRIP !", cx + 26, cy + 236);
        _sprite.drawString("Booster pump stopped to protect seals. Verify water supply and press RESET.", cx + 26, cy + 262);
    } else if (telemetry.pumpCurrentFaultPending) {
        _sprite.setTextColor(TFT_BLACK, bannerBg);
        if (telemetry.isOvercurrentPending) {
            _sprite.drawString("! OVERCURRENT WARNING: PULSING ALARM ACTIVE !", cx + 22, cy + 234);
        } else {
            _sprite.drawString("! UNDERCURRENT WARNING: PULSING ALARM ACTIVE !", cx + 22, cy + 234);
        }
        char warnStr[64];
        snprintf(warnStr, sizeof(warnStr), "Fault persisting: Pump shutdown and alarm trip in %02lu seconds...", telemetry.pumpCurrentFaultRemainingMs / 1000UL);
        _sprite.drawString(warnStr, cx + 22, cy + 262);
    } else if (telemetry.pumpRoomLowTempAlarm) {
        _sprite.drawString("! CRITICAL: PUMP ROOM LOW TEMP (<55°F) ALARM !", cx + 26, cy + 246);
        char tempMsg[80];
        snprintf(tempMsg, sizeof(tempMsg), "Pump room temp dropped to %.1f°F (<55°F). Inspect room heater.", telemetry.temperatureF);
        _sprite.drawString(tempMsg, cx + 26, cy + 270);
    } else if (telemetry.alarm && telemetry.tankEmpty) {
        _sprite.drawString("! CRITICAL: TANK EMPTY SIREN SOUNDING !", cx + 26, cy + 246);
        _sprite.drawString("Tweed holding tank is empty. Tap SILENCE ALARM to mute buzzer.", cx + 26, cy + 270);
    } else if (telemetry.alarmSilenced) {
        _sprite.drawString("ALARM MUTED - AUDIBLE SIREN SILENCED BY USER", cx + 32, cy + 256);
    } else if (telemetry.pumpTimingState == PUMP_STATE_COOLDOWN) {
        _sprite.drawString("PUMP DUTY CYCLE TIMEOUT: 2-HOUR COOLDOWN IN EFFECT", cx + 26, cy + 246);
        _sprite.drawString("Tap RESET PUMP / TIMEOUT below to override cooldown immediately.", cx + 26, cy + 270);
    } else {
        _sprite.drawString("SYSTEM STATUS NOMINAL - AUTOMATIC SUPERVISION ACTIVE", cx + 26, cy + 246);
        _sprite.drawString("All field float switches, pressure transducers & current sensors healthy.", cx + 26, cy + 270);
    }
}

void DisplayGUI::drawDashboardControls(const SystemTelemetry& telemetry) {
    // Left Control: Silence Alarm (x=270, y=402, w=248, h=66)
    uint16_t silenceColor = (telemetry.alarm || telemetry.pumpOvercurrentTrip || telemetry.pumpUndercurrentTrip || telemetry.municipalPressureTrip || telemetry.pumpCurrentFaultPending || telemetry.municipalPressureFaultPending || telemetry.pumpRoomLowTempAlarm) ? TFT_RED : 0x39E7;
    _sprite.fillRoundRect(_btnSilence.x, _btnSilence.y, _btnSilence.w, _btnSilence.h, 8, silenceColor);
    _sprite.setTextColor(TFT_WHITE, silenceColor);
    _sprite.drawString(telemetry.alarmSilenced ? "ALARM SILENCED" : "SILENCE ALARM", _btnSilence.x + 36, _btnSilence.y + 24);

    // Right Control: Reset Pump / Timeout / Fault (x=536, y=402, w=248, h=66)
    bool hasFaultOrTimeout = (telemetry.pumpTimingState == PUMP_STATE_COOLDOWN || telemetry.pumpOvercurrentTrip || telemetry.pumpUndercurrentTrip || telemetry.municipalPressureTrip || telemetry.pumpCurrentFaultPending || telemetry.municipalPressureFaultPending);
    uint16_t resetColor = hasFaultOrTimeout ? 0xFD20 : 0x2124;
    _sprite.fillRoundRect(_btnResetTimeout.x, _btnResetTimeout.y, _btnResetTimeout.w, _btnResetTimeout.h, 8, resetColor);
    _sprite.setTextColor(hasFaultOrTimeout ? TFT_BLACK : TFT_WHITE, resetColor);
    _sprite.drawString("RESET FAULT / TIMEOUT", _btnResetTimeout.x + 18, _btnResetTimeout.y + 24);
}

void DisplayGUI::drawSettingsPage(const SystemTelemetry& telemetry) {
    // Top Subheader
    _sprite.setTextColor(0x03FF, TFT_BLACK);
    _sprite.drawString("MANUAL OVERRIDES & DIAGNOSTICS (PIN PROTECTED)", 16, 44);

    auto drawTile = [this](const Rect& r, const char* label, const char* modeStr, uint16_t badgeColor, const char* subText) {
        _sprite.fillRoundRect(r.x, r.y, r.w, r.h, 8, 0x2124);
        _sprite.drawRoundRect(r.x, r.y, r.w, r.h, 8, 0x632C);

        // Label
        _sprite.setTextColor(TFT_WHITE, 0x2124);
        _sprite.drawString(label, r.x + 14, r.y + 14);

        // Subtext / status
        _sprite.setTextColor(TFT_LIGHTGRAY, 0x2124);
        _sprite.drawString(subText, r.x + 14, r.y + 38);

        // Mode Pill Button on Right
        int pillW = 110, pillH = 38, pillX = r.x + r.w - pillW - 12, pillY = r.y + 15;
        _sprite.fillRoundRect(pillX, pillY, pillW, pillH, 6, badgeColor);
        _sprite.setTextColor(TFT_WHITE, badgeColor);
        _sprite.drawString(modeStr, pillX + 16, pillY + 12);
    };

    // 1. Line Valve Override Tile
    const char* valveStr = (telemetry.valveOverride == MODE_AUTO) ? "AUTO" : ((telemetry.valveOverride == MODE_FORCE_ON) ? "FORCE OPEN" : "FORCE CLOSE");
    uint16_t valveBg = (telemetry.valveOverride == MODE_AUTO) ? 0x1B2E : ((telemetry.valveOverride == MODE_FORCE_ON) ? TFT_GREEN : 0x8400);
    drawTile(_btnSetValve, "LINE VALVE RELAY", valveStr, valveBg, telemetry.lineValve ? "Relay State: ENERGIZED (OPEN)" : "Relay State: OFF (CLOSED)");

    // 2. Booster Water Pump Override Tile
    const char* pumpStr = (telemetry.pumpOverride == MODE_AUTO) ? "AUTO" : ((telemetry.pumpOverride == MODE_FORCE_ON) ? "FORCE ON" : "FORCE OFF");
    uint16_t pumpBg = (telemetry.pumpOverride == MODE_AUTO) ? 0x1B2E : ((telemetry.pumpOverride == MODE_FORCE_ON) ? TFT_CYAN : 0x8400);
    drawTile(_btnSetPump, "BOOSTER WATER PUMP", pumpStr, pumpBg, telemetry.pump ? "Relay State: ENERGIZED (RUNNING)" : "Relay State: OFF (STANDBY)");

    // 3. Tank High Sensor Override
    const char* highStr = (telemetry.tankHighOverride == MODE_AUTO) ? "AUTO" : ((telemetry.tankHighOverride == MODE_FORCE_ON) ? "SIM FULL" : "SIM BELOW");
    uint16_t highBg = (telemetry.tankHighOverride == MODE_AUTO) ? 0x1B2E : TFT_GREEN;
    drawTile(_btnSetHigh, "TANK HIGH (TOP FLOAT)", highStr, highBg, !telemetry.tankHigh ? "Sensor Reading: FULL STOP" : "Sensor Reading: BELOW FULL");

    // 4. Tank Low Sensor Override
    const char* lowStr = (telemetry.tankLowOverride == MODE_AUTO) ? "AUTO" : ((telemetry.tankLowOverride == MODE_FORCE_ON) ? "SIM LOW" : "SIM OK");
    uint16_t lowBg = (telemetry.tankLowOverride == MODE_AUTO) ? 0x1B2E : 0xFD20;
    drawTile(_btnSetLow, "TANK LOW (MID FLOAT)", lowStr, lowBg, telemetry.tankLow ? "Sensor Reading: DEMAND ON" : "Sensor Reading: ADEQUATE");

    // 5. Tank Empty Sensor Override
    const char* emptyStr = (telemetry.tankEmptyOverride == MODE_AUTO) ? "AUTO" : ((telemetry.tankEmptyOverride == MODE_FORCE_ON) ? "SIM ALARM" : "SIM OK");
    uint16_t emptyBg = (telemetry.tankEmptyOverride == MODE_AUTO) ? 0x1B2E : TFT_RED;
    drawTile(_btnSetEmpty, "TANK EMPTY (LOW FLOAT)", emptyStr, emptyBg, telemetry.tankEmpty ? "Sensor Reading: CRITICAL EMPTY" : "Sensor Reading: NORMAL OK");

    // 6. Overcurrent Protection Override (FCS521-SD-10V)
    char ocDesc[64];
    snprintf(ocDesc, sizeof(ocDesc), "Current: %.1fA (Trip > 18.0A)", telemetry.pumpCurrentAmps);
    const char* ocStr = (telemetry.overcurrentOverride == MODE_AUTO) ? "AUTO" : ((telemetry.overcurrentOverride == MODE_FORCE_ON) ? "SIM TRIP" : "SIM NORM");
    uint16_t ocBg = (telemetry.overcurrentOverride == MODE_AUTO) ? 0x1B2E : TFT_RED;
    drawTile(_btnSetOvercurrent, "OVERCURRENT (FCS521)", ocStr, ocBg, ocDesc);

    // 7. Undercurrent Protection Override (FCS521-SD-10V)
    char ucDesc[64];
    snprintf(ucDesc, sizeof(ucDesc), "Current: %.1fA (Dry < 4.5A)", telemetry.pumpCurrentAmps);
    const char* ucStr = (telemetry.undercurrentOverride == MODE_AUTO) ? "AUTO" : ((telemetry.undercurrentOverride == MODE_FORCE_ON) ? "SIM DRY" : "SIM NORM");
    uint16_t ucBg = (telemetry.undercurrentOverride == MODE_AUTO) ? 0x1B2E : 0xFD20;
    drawTile(_btnSetUndercurrent, "UNDERCURRENT (FCS521)", ucStr, ucBg, ucDesc);

    // 8. Freeze Sensor Override
    const char* fzStr = (telemetry.freezeOverride == MODE_AUTO) ? "AUTO" : ((telemetry.freezeOverride == MODE_FORCE_ON) ? "SIM <40F" : "SIM >=40F");
    uint16_t fzBg = (telemetry.freezeOverride == MODE_AUTO) ? 0x1B2E : TFT_BLUE;
    drawTile(_btnSetFreeze, "FREEZE SENSOR (<40°F)", fzStr, fzBg, telemetry.freezeSensor ? "Sensor State: <40°F FREEZE HAZARD" : "Sensor State: >=40°F NORMAL");

    // Bottom Action 1: Reset All to Auto (X=16, Y=390, W=376, H=68)
    _sprite.fillRoundRect(_btnResetAllAuto.x, _btnResetAllAuto.y, _btnResetAllAuto.w, _btnResetAllAuto.h, 8, 0x8400);
    _sprite.setTextColor(TFT_WHITE, 0x8400);
    _sprite.drawString("RESET ALL TO AUTO", _btnResetAllAuto.x + 90, _btnResetAllAuto.y + 26);

    // Bottom Action 2: Back to Dashboard (X=408, Y=390, W=376, H=68)
    _sprite.fillRoundRect(_btnBackToDash.x, _btnBackToDash.y, _btnBackToDash.w, _btnBackToDash.h, 8, 0x1B2E);
    _sprite.setTextColor(TFT_WHITE, 0x1B2E);
    _sprite.drawString("RETURN TO DASHBOARD", _btnBackToDash.x + 80, _btnBackToDash.y + 26);
}

void DisplayGUI::drawPinKeypad() {
    // Dim background overlay (800x480)
    _sprite.fillRect(0, 0, 800, 480, 0x0821);

    // Modal Window (X=220, Y=40, W=360, H=400)
    int mx = 220, my = 40, mw = 360, mh = 400;
    _sprite.fillRoundRect(mx, my, mw, mh, 12, 0x18E3);
    _sprite.drawRoundRect(mx, my, mw, mh, 12, 0x03FF);

    // Modal Header
    _sprite.setTextColor(0x03FF, 0x18E3);
    _sprite.drawString("SECURITY PIN REQUIRED", mx + 24, my + 16);

    // Close 'X' button in top right
    _sprite.fillRoundRect(mx + mw - 46, my + 10, 36, 30, 5, 0x632C);
    _sprite.setTextColor(TFT_WHITE, 0x632C);
    _sprite.drawString("X", mx + mw - 32, my + 16);

    // PIN Display Box
    int bx = mx + 24, by = my + 50, bw = mw - 48, bh = 44;
    _sprite.fillRoundRect(bx, by, bw, bh, 6, 0x0821);
    _sprite.drawRoundRect(bx, by, bw, bh, 6, _pinError ? TFT_RED : 0x03FF);

    if (_pinError) {
        _sprite.setTextColor(TFT_RED, 0x0821);
        _sprite.drawString("WRONG PIN! PLEASE TRY AGAIN", bx + 22, by + 14);
    } else {
        String dots = "";
        for (size_t i = 0; i < _enteredPin.length(); i++) {
            dots += "*  ";
        }
        if (dots.length() == 0) {
            _sprite.setTextColor(0x7BEF, 0x0821);
            _sprite.drawString("Enter 4-digit PIN...", bx + 22, by + 14);
        } else {
            _sprite.setTextColor(0x03FF, 0x0821);
            _sprite.drawString(dots.c_str(), bx + 36, by + 14);
        }
    }

    // Draw Keypad Buttons (0-11)
    const char* keyLabels[12] = { "1", "2", "3", "4", "5", "6", "7", "8", "9", "CLR", "0", "OK" };
    for (int i = 0; i < 12; i++) {
        uint16_t btnBg = 0x2945;
        uint16_t btnTxt = TFT_WHITE;
        if (i == 9) { // CLR
            btnBg = 0x8000;
        } else if (i == 11) { // OK
            btnBg = 0x03E0;
        }
        _sprite.fillRoundRect(_keypadBtns[i].x, _keypadBtns[i].y, _keypadBtns[i].w, _keypadBtns[i].h, 6, btnBg);
        _sprite.setTextColor(btnTxt, btnBg);
        _sprite.drawString(keyLabels[i], _keypadBtns[i].x + (_keypadBtns[i].w / 2) - 8, _keypadBtns[i].y + 16);
    }
}

void DisplayGUI::update(const SystemTelemetry& telemetry, bool wifiConnected, bool bleConnected) {
    handleTouchInput();

    unsigned long now = millis();
    if (now - _lastRenderTime < 100) { // 10 FPS refresh rate
        return;
    }
    _lastRenderTime = now;

    _sprite.fillScreen(TFT_BLACK);
    drawHeader(wifiConnected, bleConnected);
    if (_currentPage == PAGE_DASHBOARD) {
        drawTankGraphic(telemetry);
        drawActuatorsAndClimate(telemetry);
        drawControlButtons(telemetry);
    } else {
        drawSettingsPage(telemetry);
    }

    // If PIN Keypad modal is active, draw it on top
    if (_pinModalActive) {
        drawPinKeypad();
    }

    _sprite.pushSprite(0, 0);
}
