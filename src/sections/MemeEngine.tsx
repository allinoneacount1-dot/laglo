import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * MEME ENGINE — community remix surface (section 14).
 * Composites a canonical pose from the model sheet with a caption onto a
 * canvas and hands back a PNG. Deliberately four controls, not an editor.
 */
const POSES = [
  { id: 'stand', label: 'stand' },
  { id: 'one-sec', label: 'one sec' },
  { id: 'walk', label: 'walk' },
  { id: 'sit', label: 'sit' },
  { id: 'lie-down', label: 'lie down' },
  { id: 'point', label: 'point' },
  { id: 'hold', label: 'hold' },
  { id: 'jump', label: 'jump' },
] as const;

const CAPTIONS = ['almost.', 'one sec.', 'still loading.', '99%.', 'done-ish.', 'loading thought...'];

const GROUNDS = [
  { id: 'ink', label: 'ink', bg: '#111111', fg: '#F0E8D8' },
  { id: 'cream', label: 'cream', bg: '#F0E8D8', fg: '#111111' },
  { id: 'acid', label: 'acid', bg: '#C8FF45', fg: '#111111' },
] as const;

const W = 1080;
const H = 1080;

export function MemeEngine() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pose, setPose] = useState(1);
  const [caption, setCaption] = useState(CAPTIONS[1]);
  const [ground, setGround] = useState(0);
  const [bar, setBar] = useState(true);
  const [busy, setBusy] = useState(false);

  const draw = useCallback(async () => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const g = GROUNDS[ground];

    ctx.fillStyle = g.bg;
    ctx.fillRect(0, 0, W, H);

    const img = new Image();
    img.src = `/laglo/pose-${POSES[pose].id}.webp`;
    try { await img.decode(); } catch { /* fall through to text-only frame */ }

    if (img.complete && img.naturalWidth) {
      const maxH = H * 0.52;
      const s = Math.min(maxH / img.naturalHeight, (W * 0.6) / img.naturalWidth);
      const w = img.naturalWidth * s;
      const h = img.naturalHeight * s;
      ctx.drawImage(img, (W - w) / 2, H * 0.30 - h * 0.1, w, h);
    }

    ctx.fillStyle = g.fg;
    ctx.textAlign = 'center';
    ctx.font = `800 ${Math.round(W * 0.085)}px Archivo, system-ui, sans-serif`;
    ctx.fillText(caption, W / 2, H * 0.855, W * 0.86);

    if (bar) {
      const bw = W * 0.62, bh = 22, bx = (W - bw) / 2, by = H * 0.895;
      ctx.fillStyle = g.id === 'acid' ? 'rgba(17,17,17,.22)' : 'rgba(255,255,255,.14)';
      ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, bh / 2); ctx.fill();
      ctx.fillStyle = g.id === 'acid' ? '#111111' : '#C8FF45';
      ctx.beginPath(); ctx.roundRect(bx, by, bw * 0.99, bh, bh / 2); ctx.fill();
      ctx.fillStyle = g.fg;
      ctx.font = `500 ${Math.round(W * 0.028)}px "JetBrains Mono", ui-monospace, monospace`;
      ctx.fillText('99%', W / 2, by + bh + 44);
    }

    ctx.fillStyle = g.fg;
    ctx.globalAlpha = 0.42;
    ctx.font = `500 ${Math.round(W * 0.022)}px "JetBrains Mono", ui-monospace, monospace`;
    ctx.textAlign = 'left';
    ctx.fillText('LAGLO', 44, H - 40);
    ctx.textAlign = 'right';
    ctx.fillText('still loading.', W - 44, H - 40);
    ctx.globalAlpha = 1;
  }, [pose, caption, ground, bar]);

  useEffect(() => { void draw(); }, [draw]);

  const save = async () => {
    setBusy(true);
    await draw();
    const c = canvasRef.current;
    if (c) {
      const url = c.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = url;
      a.download = `laglo-${POSES[pose].id}.png`;
      a.click();
    }
    window.setTimeout(() => setBusy(false), 420);
  };

  return (
    <section className="sec meme" id="meme" aria-labelledby="meme-h">
      <div className="shell">
        <p className="meta">04 — meme engine</p>
        <h2 className="display meme__h" id="meme-h">make one.<br />badly.</h2>

        <div className="meme__grid">
          <div className="meme__preview glass glass--dense" data-refract="on">
            <canvas ref={canvasRef} width={W} height={H} aria-label="meme preview" />
          </div>

          <div className="meme__controls">
            <fieldset className="meme__set">
              <legend className="meta">pose</legend>
              <div className="meme__chips">
                {POSES.map((p, i) => (
                  <button key={p.id} type="button" className="meme__chip"
                    data-on={i === pose ? 'yes' : 'no'} onClick={() => setPose(i)}>
                    {p.label}
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset className="meme__set">
              <legend className="meta">caption</legend>
              <div className="meme__chips">
                {CAPTIONS.map((c) => (
                  <button key={c} type="button" className="meme__chip"
                    data-on={c === caption ? 'yes' : 'no'} onClick={() => setCaption(c)}>
                    {c}
                  </button>
                ))}
              </div>
              <label className="sr-only" htmlFor="meme-own">your own caption</label>
              <input id="meme-own" className="meme__input" value={caption} maxLength={40}
                onChange={(e) => setCaption(e.target.value)} placeholder="or write your own" />
            </fieldset>

            <fieldset className="meme__set">
              <legend className="meta">ground</legend>
              <div className="meme__chips">
                {GROUNDS.map((g, i) => (
                  <button key={g.id} type="button" className="meme__chip"
                    data-on={i === ground ? 'yes' : 'no'} onClick={() => setGround(i)}>
                    {g.label}
                  </button>
                ))}
                <button type="button" className="meme__chip" data-on={bar ? 'yes' : 'no'}
                  onClick={() => setBar((v) => !v)} aria-pressed={bar}>
                  99% bar
                </button>
              </div>
            </fieldset>

            <button type="button" className="meme__save" onClick={save} disabled={busy}>
              {busy ? 'saving-ish...' : 'save png'}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
