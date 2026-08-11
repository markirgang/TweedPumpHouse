#ifndef DISPLAY_GUI_H
#define DISPLAY_GUI_H

#include <Arduino.h>
#define LGFX_USE_V1
#include <LovyanGFX.hpp>
#include "controller.h"

// LovyanGFX configuration class specifically customized for WT32-SC01 (ST7796 + FT6336U)
class LGFX_WT32_SC01 : public lgfx::LGFX_Device {
    lgfx::Panel_ST7796 _panel_instance;
    lgfx::Bus_SPI _bus_instance;
    lgfx::Light_PWM _light_instance;
    lgfx::Touch_FT5x06 _touch_instance; // FT6336U uses FT5x06 driver

public:
    LGFX_WT32_SC01();
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
    LGFX_WT32_SC01 _lcd;
    LGFX_Sprite _sprite; // Double buffering sprite for flicker-free rendering

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

    // Touch Button Bounding Boxes (Landscape 480x320)
    struct Rect { int x; int y; int w; int h; };
    
    // Header Tabs
    Rect _tabDashboard;
    Rect _tabSettings;

    // Dashboard Buttons
    Rect _btnSilenceAlarm;
    Rect _btnResetPump;
    Rect _btnValveOverride;
    Rect _btnPumpOverride;

    // Settings Page Buttons (Grid of 8 + Actions)
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

    // PIN Pad Keypad Rectangles
    Rect _keypadBtns[12]; // 1-9, Clear, 0, Cancel/OK

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
