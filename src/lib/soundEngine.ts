let ctx: AudioContext | null = null;

function ac(): AudioContext {
  if (!ctx || ctx.state === 'closed') ctx = new AudioContext();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(freq: number, endFreq: number, dur: number, vol: number, type: OscillatorType = 'sine') {
  try {
    const c = ac();
    const o = c.createOscillator();
    const g = c.createGain();
    o.connect(g); g.connect(c.destination);
    o.type = type;
    o.frequency.setValueAtTime(freq, c.currentTime);
    if (endFreq !== freq) o.frequency.exponentialRampToValueAtTime(endFreq, c.currentTime + dur);
    g.gain.setValueAtTime(vol, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
    o.start(c.currentTime);
    o.stop(c.currentTime + dur + 0.01);
  } catch {}
}

export function playClick() { tone(520, 420, 0.06, 0.08); }
export function playSuccess() {
  try {
    const c = ac();
    [440, 554, 660].forEach((f, i) => {
      const o = c.createOscillator(); const g = c.createGain();
      o.connect(g); g.connect(c.destination);
      o.type = 'sine'; o.frequency.value = f;
      const t = c.currentTime + i * 0.08;
      g.gain.setValueAtTime(0.1, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
      o.start(t); o.stop(t + 0.2);
    });
  } catch {}
}
export function playError()  { tone(380, 200, 0.18, 0.09); }
export function playNav()    { tone(360, 480, 0.07, 0.07); }
export function playOpen()   { tone(480, 600, 0.09, 0.07); }
export function playClose()  { tone(600, 380, 0.07, 0.06); }
export function playToggle() { tone(500, 500, 0.04, 0.06, 'square'); }
