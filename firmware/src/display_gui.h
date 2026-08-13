#ifndef DISPLAY_GUI_H
#define DISPLAY_GUI_H

#include <Arduino.h>
#define LGFX_USE_V1
#include <LovyanGFX.hpp>
#include <lgfx/v1/platforms/esp32s3/Panel_RGB.hpp>
#include <lgfx/v1/platforms/esp32s3/Bus_RGB.hpp>
#include "controller.h"

// LovyanGFX configuration class specifically customized for Waveshare ESP32-S3-Touch-LCD-7
// (ST7262 800x480 16-bit Parallel RGB + GT911 Capacitive Touch on I2C GPIO 8/9)
class LGFX_Waveshare_LCD7 : public lgfx::LGFX_Device {
    lgfx::Panel_RGB _panel_instance;
    lgfx::Bus_RGB _bus_instance;
    lgfx::Touch_GT911 _touch_instance;

public:
    LGFX_Waveshare_LCD7();
};

enum GuiPage {
    PAGE_DASHBOARD = 0,
    PAGE_SETTINGS = 1
};

enum PinAction {
    ACT_NONE = 0,
    ACT_PUMP_OVERRIDE = 1,
    ACT_VALVE_OVERRIDE = 2,
    ACT_HIGH_OVERRIDE = 3,
    ACT_LOW_OVERRIDE = 4,
    ACT_EMPTY_OVERRIDE = 5,
    ACT_OVERCURRENT_OVERRIDE = 6,
    ACT_UNDERCURRENT_OVERRIDE = 7,
    ACT_FREEZE_OVERRIDE = 8,
    ACT_RESET_ALL_AUTO = 9
};

class DisplayGUI {
public:
    DisplayGUI();
    void begin();
    void update(const SystemTelemetry& telemetry, bool wifiConnected, bool bleConnected);

private:
    LGFX_Waveshare_LCD7 _lcd;
    LGFX_Sprite _sprite; // Double buffering sprite for smooth flicker-free 800x480 rendering

    GuiPage _currentPage;
    unsigned long _lastRenderTime;
    bool _touchPressed;
    int _touchX;
    int _touchY;

    // PIN Authentication State
    bool _pinModalActive;
    String _enteredPin;
    PinAction _pendingAction;
    unsigned long _unlockedUntil; // Millis timestamp when unlock expires
    bool _pinError;

    // Touch Button Bounding Boxes (Landscape 800x480)
    struct Rect { int x; int y; int w; int h; };
    
    // Header Tabs & Status
    Rect _tabDashboard;
    Rect _tabSettings;

    // Dashboard Buttons (Bottom Control Bar: Y=406, H=62)
    Rect _btnSilenceAlarm;
    Rect _btnResetPump;
    Rect _btnValveOverride;
    Rect _btnPumpOverride;

    // Settings Page Buttons (2-Column x 4-Row Grid + Bottom Actions)
    Rect _btnSetPump;
    Rect _btnSetValve;
    Rect _btnSetHigh;
    Rect _btnSetLow;
    Rect _btnSetEmpty;
    Rect _btnSetOvercurrent;
    Rect _btnSetUndercurrent;
    Rect _btnSetFreeze;
    Rect _btnResetAllAuto;
    Rect _btnBackToDash;

    // PIN Pad Keypad Rectangles (Modal at X=220, Y=40, W=360, H=400)
    Rect _keypadBtns[12]; // 1-9, CLR, 0, OK

    void initIOExpander();
    void requestProtectedAction(PinAction act);
    void executeAction(PinAction act);
    void handleTouchInput();
    void handlePinKeypadTouch();
    void drawHeader(bool wifiConnected, bool bleConnected);
    void drawTankGraphic(const SystemTelemetry& telemetry);
    void drawActuatorsAndClimate(const SystemTelemetry& telemetry);
    void drawControlButtons(const SystemTelemetry& telemetry);
    void drawSettingsPage(const SystemTelemetry& telemetry);
    void drawPinKeypad();
};

extern DisplayGUI displayGui;

#endif // DISPLAY_GUI_H
