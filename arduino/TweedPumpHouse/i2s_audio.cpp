#include "i2s_audio.h"
#include "controller.h"
#include <driver/i2s.h>
#include <math.h>

I2SAudioDriver i2sAudio;

// Fixed audio buffer size for non-blocking DMA chunk transfers
#define AUDIO_CHUNK_SAMPLES 128

I2SAudioDriver::I2SAudioDriver()
    : _initialized(false),
      _volume(I2S_DEFAULT_VOLUME),
      _muted(false),
      _isPlaying(false),
      _currentRms(0.0f),
      _lipSyncMouthOpen(false),
      _activeSiren(SIREN_NONE),
      _sirenStartTime(0),
      _sirenDurationMs(0),
      _sirenLastStepTime(0),
      _sirenPhase(0),
      _sirenCurFreq(800),
      _sequenceLength(0),
      _sequenceIndex(0),
      _noteStartTime(0),
      _inNotePause(false),
      _activePhrase(PHRASE_NONE),
      _phraseStep(0),
      _phraseStepEndTime(0)
{
}

bool I2SAudioDriver::begin() {
#if !defined(I2S_ENABLED) || (I2S_ENABLED == false)
    Serial.println("[I2S AUDIO] Audio output disabled in config.");
    return false;
#endif

    // 1. Configure Optional SD_MODE / Mute Pin
    if (PIN_I2S_SD_MODE >= 0) {
        pinMode(PIN_I2S_SD_MODE, OUTPUT);
        digitalWrite(PIN_I2S_SD_MODE, HIGH); // Active HIGH enable on MAX98357A
    }

    // 2. Configure I2S Driver Settings (Standard 16-Bit Stereo Frame for MAX98357A DAC)
    i2s_config_t i2s_config = {
        .mode = (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_TX),
        .sample_rate = I2S_SAMPLE_RATE,
        .bits_per_sample = I2S_BITS_PER_SAMPLE_16BIT,
        .channel_format = I2S_CHANNEL_FMT_RIGHT_LEFT, // 2-channel stereo frame (L=R) for MAX98357A
        .communication_format = I2S_COMM_FORMAT_STAND_I2S,
        .intr_alloc_flags = ESP_INTR_FLAG_LEVEL1,
        .dma_buf_count = 4,
        .dma_buf_len = 256,
        .use_apll = false,
        .tx_desc_auto_clear = true,
        .fixed_mclk = 0
    };

    // 3. Configure Hardware GPIO Pin Mapping
    i2s_pin_config_t pin_config = {
        .bck_io_num = PIN_I2S_BCLK,
        .ws_io_num = PIN_I2S_LRC,
        .data_out_num = PIN_I2S_DOUT,
        .data_in_num = I2S_PIN_NO_CHANGE
    };

    i2s_port_t port = (i2s_port_t)I2S_PORT_NUM;
    esp_err_t err = i2s_driver_install(port, &i2s_config, 0, NULL);
    if (err != ESP_OK) {
        Serial.printf("[I2S AUDIO] Failed to install I2S driver! Error: 0x%x\n", err);
        return false;
    }

    err = i2s_set_pin(port, &pin_config);
    if (err != ESP_OK) {
        Serial.printf("[I2S AUDIO] Failed to assign I2S pins (BCLK:%d, LRC:%d, DOUT:%d)! Error: 0x%x\n", 
                      PIN_I2S_BCLK, PIN_I2S_LRC, PIN_I2S_DOUT, err);
        return false;
    }

    i2s_zero_dma_buffer(port);
    _initialized = true;

    Serial.printf("[I2S AUDIO] MAX98357A I2S Mono Audio Amp driver active @ %d Hz (BCLK:%d, LRC:%d, DOUT:%d)\n", 
                  I2S_SAMPLE_RATE, PIN_I2S_BCLK, PIN_I2S_LRC, PIN_I2S_DOUT);

    // Play pleasant power-on startup chime
    playChime(CHIME_STARTUP);
    return true;
}

void I2SAudioDriver::setVolume(uint8_t percent) {
    _volume = min((uint8_t)100, percent);
    Serial.printf("[I2S AUDIO] Volume set to %d%%\n", _volume);
}

void I2SAudioDriver::setMute(bool muted) {
    _muted = muted;
    if (PIN_I2S_SD_MODE >= 0) {
        digitalWrite(PIN_I2S_SD_MODE, _muted ? LOW : HIGH);
    }
    if (_muted) {
        stopAudio();
    }
    Serial.printf("[I2S AUDIO] Audio %s\n", _muted ? "MUTED" : "UNMUTED");
}

void I2SAudioDriver::stopAudio() {
    _isPlaying = false;
    _activeSiren = SIREN_NONE;
    _sequenceLength = 0;
    _sequenceIndex = 0;
    _activePhrase = PHRASE_NONE;
    _currentRms = 0.0f;
    updateLipSync(0.0f);
    if (_initialized) {
        i2s_zero_dma_buffer((i2s_port_t)I2S_PORT_NUM);
    }
}

void I2SAudioDriver::writeSilenceChunk(size_t numSamples) {
    if (!_initialized) return;
    int16_t silenceBuffer[AUDIO_CHUNK_SAMPLES * 2] = {0}; // Stereo
    size_t bytesWritten = 0;
    size_t samplesToWrite = min(numSamples, (size_t)AUDIO_CHUNK_SAMPLES);
    i2s_write((i2s_port_t)I2S_PORT_NUM, silenceBuffer, samplesToWrite * 2 * sizeof(int16_t), &bytesWritten, 10 / portTICK_PERIOD_MS);
}

void I2SAudioDriver::writeSineWaveChunk(uint16_t freqHz, size_t numSamples, float volumeScale) {
    if (!_initialized || _muted || _volume == 0) {
        writeSilenceChunk(numSamples);
        return;
    }

    static float phase = 0.0f;
    float phaseIncrement = (2.0f * (float)M_PI * (float)freqHz) / (float)I2S_SAMPLE_RATE;
    float effectiveVol = (_volume / 100.0f) * volumeScale;
    if (effectiveVol > 1.0f) effectiveVol = 1.0f;

    int16_t buffer[AUDIO_CHUNK_SAMPLES * 2]; // Stereo interleaved (L, R, L, R)
    size_t count = min(numSamples, (size_t)AUDIO_CHUNK_SAMPLES);
    int32_t amplitude = (int32_t)(32767.0f * effectiveVol * 0.75f); // 0.75 headroom to prevent clipping

    double sumSquares = 0.0;
    for (size_t i = 0; i < count; i++) {
        int16_t sample = (int16_t)(sinf(phase) * amplitude);
        phase += phaseIncrement;
        if (phase >= 2.0f * (float)M_PI) {
            phase -= 2.0f * (float)M_PI;
        }
        buffer[i * 2] = sample;     // Left
        buffer[i * 2 + 1] = sample; // Right
        sumSquares += (double)sample * (double)sample;
    }

    size_t bytesWritten = 0;
    i2s_write((i2s_port_t)I2S_PORT_NUM, buffer, count * 2 * sizeof(int16_t), &bytesWritten, 20 / portTICK_PERIOD_MS);

    // Compute RMS and update lip-sync
    float rms = sqrtf(sumSquares / count) / 32768.0f;
    _currentRms = rms;
    updateLipSync(rms);
}

void I2SAudioDriver::playPcmChunk(const int16_t* samples, size_t sampleCount) {
    if (!_initialized || _muted || sampleCount == 0) return;

    float effectiveVol = (_volume / 100.0f);
    int16_t stereoBuf[AUDIO_CHUNK_SAMPLES * 2];
    size_t processed = 0;

    while (processed < sampleCount) {
        size_t chunk = min((size_t)(sampleCount - processed), (size_t)AUDIO_CHUNK_SAMPLES);
        double sumSq = 0.0;

        for (size_t i = 0; i < chunk; i++) {
            int16_t s = (int16_t)(samples[processed + i] * effectiveVol);
            stereoBuf[i * 2] = s;
            stereoBuf[i * 2 + 1] = s;
            sumSq += (double)s * (double)s;
        }

        size_t bytesWritten = 0;
        i2s_write((i2s_port_t)I2S_PORT_NUM, stereoBuf, chunk * 2 * sizeof(int16_t), &bytesWritten, 20 / portTICK_PERIOD_MS);
        processed += chunk;

        float rms = sqrtf(sumSq / chunk) / 32768.0f;
        _currentRms = rms;
        updateLipSync(rms);
    }
}

void I2SAudioDriver::playTone(uint16_t freqHz, uint32_t durationMs, float volumeScale) {
    if (_muted || freqHz == 0) return;
    _sequenceLength = 1;
    _sequenceIndex = 0;
    _noteSequence[0] = { freqHz, (uint16_t)durationMs, 0, volumeScale };
    _noteStartTime = millis();
    _inNotePause = false;
    _isPlaying = true;
}

void I2SAudioDriver::playChime(AudioChime chime) {
    if (_muted) return;
    _activeSiren = SIREN_NONE;
    _activePhrase = PHRASE_NONE;
    _sequenceIndex = 0;
    _inNotePause = false;
    _noteStartTime = millis();

    switch (chime) {
        case CHIME_CLICK:
            // Crisp 15ms tactile click at 1800Hz
            _sequenceLength = 1;
            _noteSequence[0] = { 1800, 15, 0, 0.45f };
            break;

        case CHIME_STARTUP:
            // Harmonious ascending C-Major boot chord (C5, E5, G5, C6)
            _sequenceLength = 4;
            _noteSequence[0] = { 523, 80, 15, 0.6f };
            _noteSequence[1] = { 659, 80, 15, 0.65f };
            _noteSequence[2] = { 784, 80, 15, 0.7f };
            _noteSequence[3] = { 1046, 180, 0, 0.85f };
            break;

        case CHIME_VALVE_OPEN:
            // Rising dual-tone chime (440Hz -> 660Hz)
            _sequenceLength = 2;
            _noteSequence[0] = { 440, 100, 20, 0.7f };
            _noteSequence[1] = { 660, 150, 0, 0.85f };
            break;

        case CHIME_PUMP_START:
            // High-energy ascending pump sequence
            _sequenceLength = 3;
            _noteSequence[0] = { 349, 90, 15, 0.7f };
            _noteSequence[1] = { 523, 90, 15, 0.75f };
            _noteSequence[2] = { 698, 200, 0, 0.9f };
            break;

        case CHIME_TANK_FULL:
            // Pleasant celebratory completion sequence
            _sequenceLength = 4;
            _noteSequence[0] = { 587, 90, 15, 0.7f };
            _noteSequence[1] = { 740, 90, 15, 0.75f };
            _noteSequence[2] = { 880, 90, 15, 0.8f };
            _noteSequence[3] = { 1174, 250, 0, 0.9f };
            break;

        case CHIME_WARNING:
            // Dual alert pulse (880Hz, 880Hz)
            _sequenceLength = 2;
            _noteSequence[0] = { 880, 80, 60, 0.8f };
            _noteSequence[1] = { 880, 80, 0, 0.8f };
            break;

        case CHIME_FAULT:
            // Descending critical alert triad
            _sequenceLength = 3;
            _noteSequence[0] = { 988, 120, 30, 0.9f };
            _noteSequence[1] = { 587, 120, 30, 0.85f };
            _noteSequence[2] = { 370, 250, 0, 0.95f };
            break;

        case CHIME_SILENCE:
            // Soft calming acknowledgment chime
            _sequenceLength = 2;
            _noteSequence[0] = { 659, 120, 20, 0.5f };
            _noteSequence[1] = { 523, 160, 0, 0.45f };
            break;

        default:
            _sequenceLength = 0;
            return;
    }

    _isPlaying = true;
}

void I2SAudioDriver::playSiren(AudioSiren siren, uint32_t durationMs) {
    if (_muted || siren == SIREN_NONE) {
        stopAudio();
        return;
    }

    _activeSiren = siren;
    _sirenStartTime = millis();
    _sirenDurationMs = durationMs;
    _sirenLastStepTime = 0;
    _sirenPhase = 0;
    _sirenCurFreq = 800;
    _sequenceLength = 0;
    _activePhrase = PHRASE_NONE;
    _isPlaying = true;
}

void I2SAudioDriver::speakRoboticPhrase(AudioPhrase phrase) {
    if (_muted || phrase == PHRASE_NONE) return;

    _activePhrase = phrase;
    _phraseStep = 0;
    _phraseStepEndTime = 0;
    _activeSiren = SIREN_NONE;
    _sequenceLength = 0;
    _isPlaying = true;

    Serial.printf("[I2S AUDIO] Hexabot speaking phrase ID #%d\n", phrase);
}

void I2SAudioDriver::updateLipSync(float rms) {
    bool shouldOpen = (rms >= 0.035f);
    if (shouldOpen != _lipSyncMouthOpen) {
        _lipSyncMouthOpen = shouldOpen;
        systemController.setHexapodMouth(_lipSyncMouthOpen);
    }
}

void I2SAudioDriver::processNoteSequence() {
    if (_sequenceIndex >= _sequenceLength) {
        _isPlaying = false;
        _sequenceLength = 0;
        updateLipSync(0.0f);
        return;
    }

    unsigned long now = millis();
    AudioNote& note = _noteSequence[_sequenceIndex];

    if (!_inNotePause) {
        // Playing active note
        if (now - _noteStartTime < note.durationMs) {
            writeSineWaveChunk(note.freqHz, AUDIO_CHUNK_SAMPLES, note.volume);
        } else {
            // Note finished
            if (note.pauseMs > 0) {
                _inNotePause = true;
                _noteStartTime = now;
                writeSilenceChunk(AUDIO_CHUNK_SAMPLES);
                updateLipSync(0.0f);
            } else {
                _sequenceIndex++;
                _noteStartTime = now;
            }
        }
    } else {
        // In note pause gap
        if (now - _noteStartTime < note.pauseMs) {
            writeSilenceChunk(AUDIO_CHUNK_SAMPLES);
            updateLipSync(0.0f);
        } else {
            _inNotePause = false;
            _sequenceIndex++;
            _noteStartTime = now;
        }
    }
}

void I2SAudioDriver::processSirenStep() {
    unsigned long now = millis();

    // Check duration timeout
    if (_sirenDurationMs > 0 && (now - _sirenStartTime >= _sirenDurationMs)) {
        stopAudio();
        return;
    }

    switch (_activeSiren) {
        case SIREN_TANK_EMPTY: {
            // Alternating two-tone emergency wail (800Hz / 1200Hz every 250ms)
            if (now - _sirenLastStepTime >= 250) {
                _sirenPhase = !_sirenPhase;
                _sirenLastStepTime = now;
            }
            uint16_t freq = _sirenPhase ? 1200 : 800;
            writeSineWaveChunk(freq, AUDIO_CHUNK_SAMPLES, 0.95f);
            break;
        }
        case SIREN_FREEZE_ALERT: {
            // Sinusoidal sweep siren (550Hz to 850Hz)
            float phaseAngle = (float)(now % 1000) / 1000.0f * 2.0f * (float)M_PI;
            uint16_t freq = (uint16_t)(700.0f + sinf(phaseAngle) * 150.0f);
            writeSineWaveChunk(freq, AUDIO_CHUNK_SAMPLES, 0.9f);
            break;
        }
        case SIREN_PUMP_FAULT: {
            // Fast pulsed buzzer (900Hz ON 100ms / OFF 80ms)
            uint16_t cycle = (now - _sirenStartTime) % 180;
            if (cycle < 100) {
                writeSineWaveChunk(920, AUDIO_CHUNK_SAMPLES, 1.0f);
            } else {
                writeSilenceChunk(AUDIO_CHUNK_SAMPLES);
                updateLipSync(0.0f);
            }
            break;
        }
        case SIREN_LOW_TEMP: {
            // Pumphouse low temperature alarm (600Hz / 750Hz alternating every 400ms)
            if (now - _sirenLastStepTime >= 400) {
                _sirenPhase = !_sirenPhase;
                _sirenLastStepTime = now;
            }
            uint16_t freq = _sirenPhase ? 750 : 600;
            writeSineWaveChunk(freq, AUDIO_CHUNK_SAMPLES, 0.85f);
            break;
        }
        default:
            stopAudio();
            break;
    }
}

void I2SAudioDriver::processRoboticSpeechStep() {
    unsigned long now = millis();

    // Define robotic speech formant pitch clusters & cadences for phrases
    struct SpeechSyllable {
        uint16_t pitch;
        uint16_t durationMs;
        uint16_t pauseMs;
    };

    static const SpeechSyllable phraseNominal[] = {
        { 480, 90, 20 }, { 580, 110, 30 }, { 520, 140, 50 }, { 440, 180, 0 }
    };
    static const SpeechSyllable phraseWaterLow[] = {
        { 420, 100, 20 }, { 540, 120, 40 }, { 380, 110, 20 }, { 600, 160, 0 }
    };
    static const SpeechSyllable phraseTankFull[] = {
        { 500, 90, 20 }, { 620, 110, 30 }, { 700, 130, 20 }, { 840, 200, 0 }
    };
    static const SpeechSyllable phraseFreeze[] = {
        { 600, 120, 30 }, { 450, 120, 30 }, { 680, 150, 30 }, { 400, 220, 0 }
    };
    static const SpeechSyllable phraseAlarm[] = {
        { 880, 140, 40 }, { 960, 140, 40 }, { 880, 160, 40 }, { 1040, 250, 0 }
    };
    static const SpeechSyllable phraseSilenced[] = {
        { 660, 110, 25 }, { 550, 110, 25 }, { 440, 160, 0 }
    };
    static const SpeechSyllable phraseFaultCleared[] = {
        { 440, 90, 20 }, { 550, 100, 20 }, { 660, 120, 20 }, { 880, 180, 0 }
    };
    static const SpeechSyllable phraseLowTemp[] = {
        { 520, 110, 25 }, { 440, 110, 25 }, { 620, 140, 30 }, { 360, 200, 0 }
    };

    const SpeechSyllable* currList = nullptr;
    size_t listCount = 0;

    switch (_activePhrase) {
        case PHRASE_SYSTEM_NOMINAL:   currList = phraseNominal; listCount = sizeof(phraseNominal)/sizeof(phraseNominal[0]); break;
        case PHRASE_WATER_LOW:        currList = phraseWaterLow; listCount = sizeof(phraseWaterLow)/sizeof(phraseWaterLow[0]); break;
        case PHRASE_TANK_FULL:        currList = phraseTankFull; listCount = sizeof(phraseTankFull)/sizeof(phraseTankFull[0]); break;
        case PHRASE_FREEZE_WARNING:   currList = phraseFreeze; listCount = sizeof(phraseFreeze)/sizeof(phraseFreeze[0]); break;
        case PHRASE_CRITICAL_ALARM:   currList = phraseAlarm; listCount = sizeof(phraseAlarm)/sizeof(phraseAlarm[0]); break;
        case PHRASE_ALARM_SILENCED:   currList = phraseSilenced; listCount = sizeof(phraseSilenced)/sizeof(phraseSilenced[0]); break;
        case PHRASE_FAULT_CLEARED:    currList = phraseFaultCleared; listCount = sizeof(phraseFaultCleared)/sizeof(phraseFaultCleared[0]); break;
        case PHRASE_LOW_TEMP_ALARM:   currList = phraseLowTemp; listCount = sizeof(phraseLowTemp)/sizeof(phraseLowTemp[0]); break;
        default:
            _activePhrase = PHRASE_NONE;
            _isPlaying = false;
            return;
    }

    if (_phraseStep >= listCount) {
        _activePhrase = PHRASE_NONE;
        _isPlaying = false;
        updateLipSync(0.0f);
        return;
    }

    const SpeechSyllable& syl = currList[_phraseStep];
    if (_phraseStepEndTime == 0) {
        _phraseStepEndTime = now + syl.durationMs;
    }

    if (now < _phraseStepEndTime) {
        // Syllable formant burst
        writeSineWaveChunk(syl.pitch, AUDIO_CHUNK_SAMPLES, 0.85f);
    } else {
        // Syllable finished -> pause gap
        writeSilenceChunk(AUDIO_CHUNK_SAMPLES);
        updateLipSync(0.0f);
        if (now >= _phraseStepEndTime + syl.pauseMs) {
            _phraseStep++;
            _phraseStepEndTime = 0;
        }
    }
}

void I2SAudioDriver::update() {
    if (!_initialized) return;

    if (_sequenceLength > 0) {
        processNoteSequence();
    } else if (_activeSiren != SIREN_NONE) {
        processSirenStep();
    } else if (_activePhrase != PHRASE_NONE) {
        processRoboticSpeechStep();
    } else {
        _isPlaying = false;
        _currentRms = 0.0f;
    }
}
