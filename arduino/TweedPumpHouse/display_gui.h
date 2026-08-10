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

class DisplayGUI {
public:
    DisplayGUI();
    void begin();
    void update(const SystemTelemetry& telemetry, bool wifiConnected, bool bleConnected);

private:
    LGFX_WT32_SC01 _lcd;
    LGFX_Sprite _sprite; // Double buffering sprite for flicker-free rendering

    unsigned long _lastRenderTime;
    bool _touchPressed;
    int _touchX;
    int _touchY;

    // Touch Button Bounding Boxes (Landscape 480x320)
    struct Rect { int x; int y; int w; int h; };
    Rect _btnSilenceAlarm;
    Rect _btnResetPump;
    Rect _btnValveOverride;
    Rect _btnPumpOverride;

    void handleTouchInput();
    void drawHeader(bool wifiConnected, bool bleConnected);
    void drawTankGraphic(const SystemTelemetry& telemetry);
    void drawActuatorsAndClimate(const SystemTelemetry& telemetry);
    void drawControlButtons(const SystemTelemetry& telemetry);
};

extern DisplayGUI displayGui;

#endif // DISPLAY_GUI_H
