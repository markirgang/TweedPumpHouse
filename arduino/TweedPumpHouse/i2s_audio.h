#ifndef I2S_AUDIO_H
#define I2S_AUDIO_H

#include <Arduino.h>
#include "config.h"

// Audio Chime and Feedback Sound Effects
enum AudioChime {
    CHIME_NONE = 0,
    CHIME_CLICK,         // Crisp tactile touch click (1800Hz, 15ms)
    CHIME_STARTUP,       // Boot chime (C5-E5-G5-C6 ascending arpeggio)
    CHIME_VALVE_OPEN,    // Line valve opening (440Hz -> 660Hz dual-tone)
    CHIME_PUMP_START,    // Booster pump start (tri-tone ascending burst)
    CHIME_TANK_FULL,     // Holding tank full (pleasant melodic completion sequence)
    CHIME_WARNING,       // Pre-trip / general warning 2-pulse chirp
    CHIME_FAULT,         // Critical motor fault alert tone
    CHIME_SILENCE        // Alarm silenced acknowledgment tone
};

// Continuous / Modulated Emergency Sirens
enum AudioSiren {
    SIREN_NONE = 0,
    SIREN_TANK_EMPTY,    // Emergency high-low alternating wail (800Hz / 1200Hz)
    SIREN_FREEZE_ALERT,  // Warble frequency sweep (<40°F pipe freeze danger)
    SIREN_PUMP_FAULT,    // Rapid pulsing buzzer alarm (overload / dry-run cavitation)
    SIREN_LOW_TEMP       // Room freeze low-temp siren (<55°F heating failure)
};

// On-Chip Synthetic Robotic Speech Phrases for Hexabot Mascot
enum AudioPhrase {
    PHRASE_NONE = 0,
    PHRASE_SYSTEM_NOMINAL,   // "System Nominal"
    PHRASE_WATER_LOW,         // "Water Low - Line Valve Opening - Pump Starting"
    PHRASE_TANK_FULL,         // "Holding Tank Full - Stopping Booster Pump"
    PHRASE_FREEZE_WARNING,    // "Warning - Outside Freeze Hazard Detected"
    PHRASE_CRITICAL_ALARM,    // "Critical Alarm - Holding Tank Empty"
    PHRASE_ALARM_SILENCED,    // "Alarm Silenced"
    PHRASE_FAULT_CLEARED,     // "Fault Reset - Normal Operation Resumed"
    PHRASE_LOW_TEMP_ALARM     // "Alert - Pumphouse Interior Low Temperature"
};

class I2SAudioDriver {
public:
    I2SAudioDriver();

    // Initialization & Lifecycle
    bool begin();
    void update();

    // Volume & Mute Controls
    void setVolume(uint8_t percent);      // 0 to 100%
    uint8_t getVolume() const { return _volume; }
    void setMute(bool muted);
    bool isMuted() const { return _muted; }
    void toggleMute() { setMute(!_muted); }

    // Sound Effects & Synthesis Trigger API
    void playTone(uint16_t freqHz, uint32_t durationMs, float volumeScale = 1.0f);
    void playChime(AudioChime chime);
    void playSiren(AudioSiren siren, uint32_t durationMs = 0); // durationMs = 0 for continuous until stopped
    void speakRoboticPhrase(AudioPhrase phrase);
    void playPcmChunk(const int16_t* samples, size_t sampleCount);
    void stopAudio();

    // Status Queries
    bool isPlaying() const { return _isPlaying || _activeSiren != SIREN_NONE; }
    AudioSiren getActiveSiren() const { return _activeSiren; }
    float getCurrentRms() const { return _currentRms; }
    bool isAudioLipSyncActive() const { return _lipSyncMouthOpen; }

private:
    bool _initialized;
    uint8_t _volume;         // 0 - 100
    bool _muted;
    bool _isPlaying;
    float _currentRms;
    bool _lipSyncMouthOpen;

    // Siren Generator State
    AudioSiren _activeSiren;
    unsigned long _sirenStartTime;
    unsigned long _sirenDurationMs;
    unsigned long _sirenLastStepTime;
    uint8_t _sirenPhase;
    uint16_t _sirenCurFreq;

    // Sequencer & Tone State
    struct AudioNote {
        uint16_t freqHz;
        uint16_t durationMs;
        uint16_t pauseMs;
        float volume;
    };

    static const uint8_t MAX_SEQUENCE_NOTES = 16;
    AudioNote _noteSequence[MAX_SEQUENCE_NOTES];
    uint8_t _sequenceLength;
    uint8_t _sequenceIndex;
    unsigned long _noteStartTime;
    bool _inNotePause;

    // Speech Phrase Synthesizer State
    AudioPhrase _activePhrase;
    uint8_t _phraseStep;
    unsigned long _phraseStepEndTime;

    // Internal Audio Buffer & Output Methods
    void writeSineWaveChunk(uint16_t freqHz, size_t numSamples, float volumeScale);
    void writeSilenceChunk(size_t numSamples);
    void processSirenStep();
    void processNoteSequence();
    void processRoboticSpeechStep();
    void updateLipSync(float rms);
};

extern I2SAudioDriver i2sAudio;

#endif // I2S_AUDIO_H
