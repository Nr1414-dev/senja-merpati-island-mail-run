// SENJA MERPATI — synthesised sound, no audio files: engine hum tied to
// throttle, wind tied to speed, ring chimes, landing thud, mission fanfare.
export function createAudio() {
  let ctx = null;
  let engineOsc = null, engineGain = null, windSrc = null, windGain = null;
  let muted = false;
  let started = false;

  function ensure() {
    if (started) return;
    started = true;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      // Engine: two detuned saws through a lowpass, pitch follows throttle.
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      const engineOsc2 = ctx.createOscillator();
      engineOsc2.type = 'sawtooth';
      engineOsc2.frequency.value = 57;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 320;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(lp); engineOsc2.connect(lp);
      lp.connect(engineGain); engineGain.connect(ctx.destination);
      engineOsc.start(); engineOsc2.start();
      // Wind: looped noise buffer through a bandpass.
      const len = ctx.sampleRate * 2;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      windSrc = ctx.createBufferSource();
      windSrc.buffer = buf; windSrc.loop = true;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = 500; bp.Q.value = 0.6;
      windGain = ctx.createGain();
      windGain.gain.value = 0;
      windSrc.connect(bp); bp.connect(windGain); windGain.connect(ctx.destination);
      windSrc.start();
    } catch {
      ctx = null;
    }
  }

  function tone(freq, dur, type, vol, when = 0) {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime + when;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g); g.connect(ctx.destination);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }

  return {
    ensure,
    toggleMute() { muted = !muted; return muted; },
    update(throttle, speed, grounded) {
      if (!ctx || muted) return;
      if (ctx.state === 'suspended') ctx.resume();
      const target = grounded ? 0.02 : 0.03 + throttle * 0.09;
      engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.15);
      engineOsc.frequency.setTargetAtTime(48 + throttle * 70, ctx.currentTime, 0.2);
      windGain.gain.setTargetAtTime(Math.min(0.12, speed * 0.0016), ctx.currentTime, 0.3);
    },
    ring() { tone(880, 0.25, 'sine', 0.16); tone(1318, 0.35, 'sine', 0.12, 0.09); },
    land() { tone(120, 0.3, 'sine', 0.22); tone(70, 0.4, 'triangle', 0.18, 0.05); },
    crash() {
      tone(90, 0.6, 'sawtooth', 0.2);
      tone(55, 0.9, 'sawtooth', 0.18, 0.1);
    },
    fanfare() {
      [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.4, 'triangle', 0.14, i * 0.12));
    },
    click() { tone(660, 0.08, 'square', 0.06); },
  };
}
