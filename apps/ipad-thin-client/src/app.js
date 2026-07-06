const GATEWAY_WS = "ws://100.86.69.108:18130/display-fabric/control/ws/ipad-thin-client";
const TTS_URL = "http://100.86.69.108:18130/display-fabric/tts/latest.wav";

let ws = null;
let audioCtx = null;
let micStream = null;
let micProcessor = null;
let connected = false;
let micActive = false;
let reconnectTimer = null;
let logEl, dotEl, connEl, lastTextEl, btnConnect, btnMic;

document.addEventListener("DOMContentLoaded", () => {
  logEl = document.getElementById("log");
  dotEl = document.getElementById("statusDot");
  connEl = document.getElementById("connState");
  lastTextEl = document.getElementById("lastText");
  btnConnect = document.getElementById("btnConnect");
  btnMic = document.getElementById("btnMic");
  log("Denis Thin Client cargado");
});

function log(msg) {
  const ts = new Date().toLocaleTimeString("es-ES", { hour12: false });
  const div = document.createElement("div");
  div.innerHTML = `<span class="ts">${ts}</span> <span class="msg">${msg}</span>`;
  if (logEl) {
    logEl.prepend(div);
    while (logEl.children.length > 50) logEl.removeChild(logEl.lastChild);
  }
}

async function ensureAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: "interactive" });
  }
  if (audioCtx.state === "suspended") await audioCtx.resume();
  return audioCtx;
}

function toggleConnection() {
  if (connected) disconnect();
  else connect();
}

function connect() {
  if (ws?.readyState === WebSocket.OPEN) return;
  log("conectando...");
  ws = new WebSocket(GATEWAY_WS);

  ws.onopen = () => {
    connected = true;
    dotEl.classList.add("live");
    connEl.textContent = "conectado";
    btnConnect.classList.add("connected");
    btnConnect.textContent = "Desconectar";
    log("WebSocket conectado");
    ws.send(JSON.stringify({
      event_type: "client_ready",
      session_id: "ipad-thin-client",
      payload: { user_agent: navigator.userAgent, platform: "ipad_native" }
    }));
  };

  ws.onmessage = async (event) => {
    const msg = JSON.parse(event.data);
    if (msg.command_type === "play_tts") {
      const url = msg.payload?.audio_url || TTS_URL;
      const text = msg.payload?.text || "";
      log(`▶ reproduciendo: ${text}`);
      lastTextEl.textContent = text;
      dotEl.classList.add("speaking");
      try {
        await playWavUrl(url);
      } catch (e) {
        log(`error playback: ${e.message}`);
      }
      dotEl.classList.remove("speaking");
      log("✓ reproducción completa");
    } else if (msg.type === "ack") {
      // silent ack
    } else {
      log(`← ${msg.command_type || msg.type || "evento"}`);
    }
  };

  ws.onclose = () => {
    connected = false;
    dotEl.classList.remove("live", "speaking");
    connEl.textContent = "desconectado";
    btnConnect.classList.remove("connected");
    btnConnect.textContent = "Conectar";
    log("WebSocket cerrado");
    reconnectTimer = setTimeout(connect, 3000);
  };

  ws.onerror = () => {
    log("error WebSocket");
  };
}

function disconnect() {
  clearTimeout(reconnectTimer);
  if (ws) ws.close();
  ws = null;
  connected = false;
  dotEl.classList.remove("live", "speaking");
  connEl.textContent = "desconectado";
  btnConnect.classList.remove("connected");
  btnConnect.textContent = "Conectar";
}

async function playWavUrl(url) {
  const ctx = await ensureAudioContext();
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
  return new Promise((resolve) => {
    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);
    source.onended = resolve;
    source.start();
  });
}

async function toggleMic() {
  if (micActive) {
    stopMic();
  } else {
    await startMic();
  }
}

async function startMic() {
  try {
    micStream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true }
    });
    const ctx = await ensureAudioContext();
    const source = ctx.createMediaStreamSource(micStream);
    const processor = ctx.createScriptProcessor(2048, 1, 1);
    const silenceGain = ctx.createGain();
    silenceGain.gain.value = 0;

    processor.onaudioprocess = (event) => {
      if (!connected || ws?.readyState !== WebSocket.OPEN) return;
      const input = event.inputBuffer.getChannelData(0);
      const pcm16 = float32ToPcm16(input);
      const b64 = arrayBufferToBase64(pcm16);
      ws.send(JSON.stringify({
        type: "mic_audio",
        session_id: "ipad-thin-client",
        format: "pcm_s16le",
        sample_rate: ctx.sampleRate,
        channels: 1,
        data: b64,
        timestamp_ms: Date.now()
      }));
    };

    source.connect(processor);
    processor.connect(silenceGain);
    silenceGain.connect(ctx.destination);
    micProcessor = processor;
    micActive = true;
    btnMic.classList.add("active");
    btnMic.textContent = "🎙️ Mic ON";
    log("micrófono activo");
  } catch (e) {
    log(`mic error: ${e.message}`);
  }
}

function stopMic() {
  if (micProcessor) { micProcessor.disconnect(); micProcessor = null; }
  if (micStream) { micStream.getTracks().forEach(t => t.stop()); micStream = null; }
  micActive = false;
  btnMic.classList.remove("active");
  btnMic.textContent = "🎙️ Mic";
  log("micrófono desactivado");
}

function float32ToPcm16(float32Array) {
  const pcm16 = new Int16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  return pcm16.buffer;
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
