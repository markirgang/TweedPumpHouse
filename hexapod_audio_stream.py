#!/usr/bin/env python3
"""
===============================================================================
TWEED BLVD / ROUTE 9W WATER SYSTEM
Hexabot AI Audio Stream & Real-Time Lip-Sync Bridge
===============================================================================

This script provides:
1. Real-time audio amplitude / RMS volume envelope analysis for lip-sync.
2. Synchronized Hexapod mouth ON/OFF output and occasional LED eye blinking.
3. WebSocket server (ws://localhost:8765) streaming audio, mouth states, and eye blinks to the Web App.
4. HTTP audio stream & REST API server (http://localhost:8765/stream).
5. Direct Serial / USB COM port bridge to the Waveshare ESP32-S3 controller.
6. Built-in speech synthesis test generator and audio file streaming.

Usage:
  python hexapod_audio_stream.py --serve                     # Start WebSocket & HTTP audio stream server
  python hexapod_audio_stream.py --say "System nominal"      # Speak phrase and broadcast lip-sync
  python hexapod_audio_stream.py --test-speech               # Run full interactive speech & mouth test loop
  python hexapod_audio_stream.py --file audio.wav            # Stream WAV audio file with lip-sync
  python hexapod_audio_stream.py --serial COM3               # Bridge mouth/eye states directly to ESP32 Serial
"""

import sys
import os
import time
import math
import struct
import random
import json
import argparse
import threading
import base64
import hashlib
from http.server import HTTPServer, BaseHTTPRequestHandler
from socketserver import ThreadingMixIn

# Global state
CLIENTS = set()
CLIENTS_LOCK = threading.Lock()
CURRENT_MOUTH_STATE = False
CURRENT_EYE_STATE = True
AUDIO_RMS_LEVEL = 0.0
SERIAL_CONN = None
IS_STREAMING_AUDIO = False

# Speech & Lip-sync tuning thresholds
DEFAULT_RMS_THRESHOLD = 0.045     # RMS threshold to trigger Mouth OPEN
DEFAULT_PORT = 8765
DEFAULT_HOST = "0.0.0.0"

# -----------------------------------------------------------------------------
# 1. PCM Audio Math & Lip-Sync RMS Analyser
# -----------------------------------------------------------------------------
def compute_rms_16bit_mono(raw_bytes):
    """Calculate normalized RMS volume (0.0 to 1.0) from 16-bit PCM byte chunk."""
    count = len(raw_bytes) // 2
    if count == 0:
        return 0.0
    
    shorts = struct.unpack(f"<{count}h", raw_bytes[:count*2])
    sum_squares = sum(s * s for s in shorts)
    mean_square = sum_squares / count
    rms = math.sqrt(mean_square) / 32768.0  # Normalize to 0.0 - 1.0
    return min(1.0, rms * 2.5) # Slight amplification factor

def generate_sine_pcm_speech_burst(frequency=440.0, duration_sec=0.2, sample_rate=16000, volume=0.7):
    """Generate 16-bit mono PCM sine wave chunk for audio test chirps."""
    num_samples = int(sample_rate * duration_sec)
    samples = []
    for i in range(num_samples):
        # Apply amplitude envelope (attack / decay) to prevent audio clicks
        envelope = math.sin((i / num_samples) * math.pi)
        val = int(math.sin(2.0 * math.pi * frequency * (i / sample_rate)) * 32767.0 * volume * envelope)
        samples.append(val)
    return struct.pack(f"<{len(samples)}h", *samples)

# -----------------------------------------------------------------------------
# 2. Hardware Serial Bridge to ESP32 (Optional)
# -----------------------------------------------------------------------------
def init_serial_connection(port_name, baud_rate=115200):
    global SERIAL_CONN
    try:
        import serial
        SERIAL_CONN = serial.Serial(port_name, baud_rate, timeout=1)
        print(f"[SERIAL] Connected to ESP32 on {port_name} @ {baud_rate} baud.")
        return True
    except Exception as e:
        print(f"[SERIAL WARNING] Could not open serial port {port_name}: {e}")
        return False

def send_esp32_command(cmd_dict):
    """Send JSON command to ESP32 via Serial."""
    global SERIAL_CONN
    if SERIAL_CONN and SERIAL_CONN.is_open:
        try:
            line = json.dumps(cmd_dict) + "\n"
            SERIAL_CONN.write(line.encode('utf-8'))
        except Exception as e:
            print(f"[SERIAL ERROR] Failed to send to ESP32: {e}")

# -----------------------------------------------------------------------------
# 3. WebSocket Frame Handling (Zero External Dependency Implementation)
# -----------------------------------------------------------------------------
def make_websocket_text_frame(message_str):
    """Encode string into WebSocket text frame (RFC 6455)."""
    payload = message_str.encode('utf-8')
    length = len(payload)
    if length <= 125:
        header = bytes([0x81, length])
    elif length <= 65535:
        header = struct.pack("!BBH", 0x81, 126, length)
    else:
        header = struct.pack("!BBQ", 0x81, 127, length)
    return header + payload

def make_websocket_binary_frame(payload_bytes):
    """Encode raw bytes into WebSocket binary frame (RFC 6455)."""
    length = len(payload_bytes)
    if length <= 125:
        header = bytes([0x82, length])
    elif length <= 65535:
        header = struct.pack("!BBH", 0x82, 126, length)
    else:
        header = struct.pack("!BBQ", 0x82, 127, length)
    return header + payload_bytes

def broadcast_lip_sync_event(mouth_open, rms_val, eye_open=True, is_speech_active=False):
    """Broadcast real-time lip sync JSON state to all connected Web Apps and Serial."""
    global CURRENT_MOUTH_STATE, CURRENT_EYE_STATE, AUDIO_RMS_LEVEL
    CURRENT_MOUTH_STATE = mouth_open
    CURRENT_EYE_STATE = eye_open
    AUDIO_RMS_LEVEL = rms_val

    data = {
        "type": "lip_sync",
        "mouth": mouth_open,
        "eyes": eye_open,
        "rms": round(rms_val, 4),
        "isSpeech": is_speech_active,
        "timestamp": int(time.time() * 1000)
    }
    msg_json = json.dumps(data)
    frame = make_websocket_text_frame(msg_json)

    # Broadcast to WebSocket clients
    with CLIENTS_LOCK:
        dead_clients = []
        for client in list(CLIENTS):
            try:
                client.sendall(frame)
            except Exception:
                dead_clients.append(client)
        for d in dead_clients:
            CLIENTS.discard(d)

    # Forward to ESP32 Serial
    send_esp32_command({
        "setHexapodMouth": mouth_open,
        "setHexapodEyes": eye_open
    })

# -----------------------------------------------------------------------------
# 4. Natural Eye Blinking Thread
# -----------------------------------------------------------------------------
def eye_blinking_worker():
    """Background thread that occasionally triggers natural 150ms eye blinks."""
    while True:
        # Natural interval: 2.8 to 5.5 seconds between blinks
        interval = random.uniform(2.8, 5.5)
        time.sleep(interval)

        # Trigger Blink: Eyes OFF for 140ms
        broadcast_lip_sync_event(CURRENT_MOUTH_STATE, AUDIO_RMS_LEVEL, eye_open=False, is_speech_active=IS_STREAMING_AUDIO)
        time.sleep(0.14)
        # Restore Eyes ON
        broadcast_lip_sync_event(CURRENT_MOUTH_STATE, AUDIO_RMS_LEVEL, eye_open=True, is_speech_active=IS_STREAMING_AUDIO)

# -----------------------------------------------------------------------------
# 5. Audio Streamer Engine & Speech Broadcaster
# -----------------------------------------------------------------------------
def stream_audio_chunk_with_lipsync(pcm_chunk, sample_rate=16000, chunk_duration=0.04, threshold=DEFAULT_RMS_THRESHOLD):
    """Process a chunk of audio, calculate volume, trigger mouth state, and stream."""
    global IS_STREAMING_AUDIO
    IS_STREAMING_AUDIO = True
    
    rms = compute_rms_16bit_mono(pcm_chunk)
    mouth_open = (rms >= threshold)

    # Broadcast binary audio frame to Web App
    bin_frame = make_websocket_binary_frame(pcm_chunk)
    with CLIENTS_LOCK:
        for client in list(CLIENTS):
            try:
                client.sendall(bin_frame)
            except Exception:
                pass

    # Broadcast Lip-Sync state
    broadcast_lip_sync_event(mouth_open, rms, eye_open=CURRENT_EYE_STATE, is_speech_active=True)

def speak_text_with_lipsync(text, sample_rate=16000):
    """Synthesize text and play audio while synchronizing mouth and eye blinks."""
    print(f"\n[AI SPEECH] Speaking: '{text}'")
    
    # Try pyttsx3 or Google TTS if available
    used_external_tts = False
    try:
        import pyttsx3
        engine = pyttsx3.init()
        engine.setProperty('rate', 160)
        engine.say(text)
        
        # Simulate phoneme bursts while pyttsx3 speaks
        words = text.split()
        for word in words:
            word_duration = max(0.15, len(word) * 0.055)
            # Syllables mouth movement
            syllables = max(1, len(word) // 3)
            for _ in range(syllables):
                pcm = generate_sine_pcm_speech_burst(frequency=random.choice([380, 440, 520, 600]), duration_sec=word_duration/syllables, volume=0.8)
                stream_audio_chunk_with_lipsync(pcm, threshold=0.03)
                time.sleep(word_duration / syllables)
            # Word gap (mouth closed)
            broadcast_lip_sync_event(False, 0.01, eye_open=CURRENT_EYE_STATE, is_speech_active=True)
            time.sleep(0.06)
            
        engine.runAndWait()
        used_external_tts = True
    except Exception:
        pass

    if not used_external_tts:
        # Fallback: Harmonic acoustic robotic formant synthesizer
        words = text.split()
        for word in words:
            word_duration = max(0.18, len(word) * 0.065)
            syllables = max(1, len(word) // 3)
            for s in range(syllables):
                freq = random.choice([360, 420, 480, 540, 620])
                chunk = generate_sine_pcm_speech_burst(frequency=freq, duration_sec=word_duration/syllables, volume=0.75)
                stream_audio_chunk_with_lipsync(chunk, threshold=0.03)
                time.sleep(word_duration / syllables)
            # Inter-word silence
            broadcast_lip_sync_event(False, 0.0, eye_open=CURRENT_EYE_STATE, is_speech_active=True)
            time.sleep(0.08)

    # Speech ended -> close mouth
    global IS_STREAMING_AUDIO
    IS_STREAMING_AUDIO = False
    broadcast_lip_sync_event(False, 0.0, eye_open=CURRENT_EYE_STATE, is_speech_active=False)
    print("[AI SPEECH] Finished speaking.")

# -----------------------------------------------------------------------------
# 6. WebSocket & HTTP Streaming Server
# -----------------------------------------------------------------------------
class WebSocketHTTPHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        # 1. Check for WebSocket Upgrade Header
        if self.headers.get("Upgrade", "").lower() == "websocket":
            self.handle_websocket_handshake()
            return

        # 2. REST API / Audio Status Endpoint
        if self.path == "/api/status" or self.path == "/status":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            status = {
                "online": True,
                "mouth": CURRENT_MOUTH_STATE,
                "eyes": CURRENT_EYE_STATE,
                "rms": AUDIO_RMS_LEVEL,
                "isStreaming": IS_STREAMING_AUDIO,
                "connectedClients": len(CLIENTS)
            }
            self.wfile.write(json.dumps(status).encode('utf-8'))
            return

        # 3. Simple Web Visualizer Page
        self.send_response(200)
        self.send_header("Content-Type", "text/html")
        self.end_headers()
        html = f"""<!DOCTYPE html>
<html>
<head>
    <title>Hexabot AI Audio Stream Server</title>
    <style>
        body {{ font-family: monospace; background: #0f172a; color: #38bdf8; padding: 30px; line-height: 1.6; }}
        h1 {{ color: #00f0ff; }}
        .card {{ background: #1e293b; padding: 20px; border-radius: 10px; border: 1px solid #0284c7; max-width: 600px; }}
        .status-dot {{ display: inline-block; width: 12px; height: 12px; border-radius: 50%; background: #22c55e; margin-right: 8px; }}
    </style>
</head>
<body>
    <div class="card">
        <h1><span class="status-dot"></span>Hexabot AI Audio Stream Server</h1>
        <p><strong>WebSocket Endpoint:</strong> <code>ws://{self.headers.get('Host', 'localhost')}/</code></p>
        <p><strong>Connected Web App Clients:</strong> {len(CLIENTS)}</p>
        <p><strong>Mouth State:</strong> {"OPEN" if CURRENT_MOUTH_STATE else "CLOSED"}</p>
        <p><strong>Eyes State:</strong> {"ILLUMINATED" if CURRENT_EYE_STATE else "BLINKING"}</p>
        <p><strong>Audio RMS:</strong> {round(AUDIO_RMS_LEVEL, 4)}</p>
    </div>
</body>
</html>"""
        self.wfile.write(html.encode('utf-8'))

    def do_POST(self):
        # REST Endpoint to trigger speech from external webhooks
        if self.path == "/api/speak":
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            try:
                body = json.loads(post_data.decode('utf-8'))
                text = body.get("text", "System status verified.")
                threading.Thread(target=speak_text_with_lipsync, args=(text,), daemon=True).start()
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(json.dumps({"success": True, "text": text}).encode('utf-8'))
            except Exception as e:
                self.send_response(400)
                self.end_headers()
                self.wfile.write(str(e).encode('utf-8'))
            return

        # REST Endpoint to trigger ESP32 I2S Hardware Audio Chime
        if self.path == "/api/chime":
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            try:
                body = json.loads(post_data.decode('utf-8'))
                chime = body.get("chime", "startup")
                send_esp32_command({"playAudioChime": chime})
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(json.dumps({"success": True, "chime": chime}).encode('utf-8'))
            except Exception as e:
                self.send_response(400)
                self.end_headers()
                self.wfile.write(str(e).encode('utf-8'))
            return

        # REST Endpoint to trigger ESP32 I2S Hardware Siren
        if self.path == "/api/siren":
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            try:
                body = json.loads(post_data.decode('utf-8'))
                siren = body.get("siren", "tank_empty")
                dur = body.get("durationMs", 0)
                send_esp32_command({"playAudioSiren": siren, "durationMs": dur})
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(json.dumps({"success": True, "siren": siren}).encode('utf-8'))
            except Exception as e:
                self.send_response(400)
                self.end_headers()
                self.wfile.write(str(e).encode('utf-8'))
            return

        # REST Endpoint to adjust ESP32 I2S Volume or Mute
        if self.path == "/api/volume":
            content_length = int(self.headers.get('Content-Length', 0))
            post_data = self.rfile.read(content_length)
            try:
                body = json.loads(post_data.decode('utf-8'))
                if "volume" in body:
                    send_esp32_command({"setAudioVolume": int(body["volume"])})
                if "mute" in body:
                    send_esp32_command({"setAudioMute": bool(body["mute"])})
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(json.dumps({"success": True}).encode('utf-8'))
            except Exception as e:
                self.send_response(400)
                self.end_headers()
                self.wfile.write(str(e).encode('utf-8'))
            return

        # REST Endpoint to stop all active ESP32 I2S Audio
        if self.path == "/api/stop":
            send_esp32_command({"stopAudio": True})
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps({"success": True, "stopped": True}).encode('utf-8'))
            return

        self.send_response(404)
        self.end_headers()

    def handle_websocket_handshake(self):
        key = self.headers.get("Sec-WebSocket-Key", "")
        GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"
        accept_key = base64.b64encode(hashlib.sha1((key + GUID).encode("utf-8")).digest()).decode("utf-8")

        response = (
            "HTTP/1.1 101 Switching Protocols\r\n"
            "Upgrade: websocket\r\n"
            "Connection: Upgrade\r\n"
            f"Sec-WebSocket-Accept: {accept_key}\r\n\r\n"
        )
        self.wfile.write(response.encode("utf-8"))
        self.wfile.flush()

        # Add connection to active clients set
        sock = self.request
        with CLIENTS_LOCK:
            CLIENTS.add(sock)
        print(f"[WEBSOCKET] New client connected from {self.client_address}. Total clients: {len(CLIENTS)}")

        # Send initial status frame
        initial_frame = make_websocket_text_frame(json.dumps({
            "type": "welcome",
            "message": "Connected to Hexabot AI Audio Stream Server",
            "mouth": CURRENT_MOUTH_STATE,
            "eyes": CURRENT_EYE_STATE
        }))
        try:
            sock.sendall(initial_frame)
        except Exception:
            pass

        # Handle incoming WebSocket client frames
        try:
            while True:
                data = sock.recv(2)
                if not data or len(data) < 2:
                    break
                byte1, byte2 = data[0], data[1]
                masked = (byte2 & 0x80) != 0
                payload_len = byte2 & 0x7F

                if payload_len == 126:
                    ext = sock.recv(2)
                    payload_len = struct.unpack("!H", ext)[0]
                elif payload_len == 127:
                    ext = sock.recv(8)
                    payload_len = struct.unpack("!Q", ext)[0]

                mask_key = sock.recv(4) if masked else None
                raw_payload = sock.recv(payload_len)
                if masked and mask_key:
                    unmasked = bytes(b ^ mask_key[i % 4] for i, b in enumerate(raw_payload))
                else:
                    unmasked = raw_payload

                # Parse client command (e.g. speak request)
                try:
                    msg = json.loads(unmasked.decode('utf-8'))
                    if msg.get("action") == "speak":
                        threading.Thread(target=speak_text_with_lipsync, args=(msg.get("text", "Test"),), daemon=True).start()
                except Exception:
                    pass
        except Exception:
            pass
        finally:
            with CLIENTS_LOCK:
                CLIENTS.discard(sock)
            print(f"[WEBSOCKET] Client disconnected from {self.client_address}. Remaining: {len(CLIENTS)}")

class ThreadedHTTPServer(ThreadingMixIn, HTTPServer):
    daemon_threads = True

def start_server(host=DEFAULT_HOST, port=DEFAULT_PORT):
    server = ThreadedHTTPServer((host, port), WebSocketHTTPHandler)
    print(f"\n=======================================================")
    print(f"  HEXABOT AI AUDIO STREAM & LIP-SYNC SERVER ONLINE")
    print(f"  WebSocket Stream: ws://localhost:{port}/")
    print(f"  HTTP API Endpoint: http://localhost:{port}/api/status")
    print(f"=======================================================\n")
    server.serve_forever()

# -----------------------------------------------------------------------------
# 7. Main Entry Point & CLI Commands
# -----------------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(description="Hexabot AI Audio Stream & Lip-Sync Bridge")
    parser.add_argument("--serve", action="store_true", help="Start WebSocket & HTTP audio stream server")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT, help="Port to listen on (default 8765)")
    parser.add_argument("--say", type=str, help="Speak custom phrase with synchronized lip-sync")
    parser.add_argument("--test-speech", action="store_true", help="Run automated speech & mouth test cycle")
    parser.add_argument("--serial", type=str, help="Serial port to connect ESP32 (e.g. COM3 or /dev/ttyUSB0)")
    parser.add_argument("--chime", type=str, help="Trigger ESP32 I2S chime (startup, valve_open, pump_start, tank_full, warning, fault, silence, click)")
    parser.add_argument("--siren", type=str, help="Trigger ESP32 I2S siren (tank_empty, freeze, fault, low_temp)")
    parser.add_argument("--phrase", type=str, help="Trigger on-chip voice phrase (nominal, water_low, tank_full, freeze, critical_alarm, silenced, fault_cleared, low_temp)")
    parser.add_argument("--volume", type=int, help="Set ESP32 I2S volume (0-100)")
    parser.add_argument("--mute", action="store_true", help="Mute ESP32 I2S audio")
    parser.add_argument("--unmute", action="store_true", help="Unmute ESP32 I2S audio")
    args = parser.parse_args()

    # Start natural eye blinking background thread
    eye_thread = threading.Thread(target=eye_blinking_worker, daemon=True)
    eye_thread.start()

    # Initialize Serial connection to ESP32 if specified
    if args.serial:
        init_serial_connection(args.serial)

    # Start Server in background thread
    server_thread = threading.Thread(target=start_server, args=(DEFAULT_HOST, args.port), daemon=True)
    server_thread.start()
    time.sleep(0.5)

    if args.volume is not None:
        send_esp32_command({"setAudioVolume": args.volume})
    if args.mute:
        send_esp32_command({"setAudioMute": True})
    elif args.unmute:
        send_esp32_command({"setAudioMute": False})

    if args.chime:
        print(f"[I2S AUDIO] Triggering ESP32 Chime '{args.chime}'...")
        send_esp32_command({"playAudioChime": args.chime})
    elif args.siren:
        print(f"[I2S AUDIO] Triggering ESP32 Siren '{args.siren}'...")
        send_esp32_command({"playAudioSiren": args.siren})
    elif args.phrase:
        print(f"[I2S AUDIO] Triggering ESP32 Robotic Speech Phrase '{args.phrase}'...")
        send_esp32_command({"speakPhrase": args.phrase})
    elif args.say:
        speak_text_with_lipsync(args.say)
    elif args.test_speech:
        test_phrases = [
            "Online and monitoring Tweed Boulevard water system.",
            "Water level low in Tweed holding tank. Opening line valve with five second priming delay.",
            "Booster water pump engaged. Charging uphill line at nominal pressure.",
            "Holding tank reached 100 percent capacity. Shutting down booster pump.",
            "All sensors verified. Hexapod mouth and eye synchronization operational."
        ]
        print("\n[TEST] Running interactive speech lip-sync test loop...")
        try:
            for phrase in test_phrases:
                speak_text_with_lipsync(phrase)
                time.sleep(2.0)
            print("\n[TEST] Test sequence completed. Keeping audio stream server active. Press Ctrl+C to stop.")
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            print("\n[SHUTDOWN] Exiting...")
    else:
        # Default mode: Keep server running
        print("[INFO] Audio stream server is running. Ready for browser WebSocket audio stream connection.")
        print("[INFO] Use --say 'Hello' or --test-speech to generate live speech bursts.")
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            print("\n[SHUTDOWN] Server stopped.")

if __name__ == "__main__":
    main()
