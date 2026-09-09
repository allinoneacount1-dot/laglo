/* ============================================================
   LAGLO - BEHAVIOUR STATES  (section 23)
   Pure logic: no three.js, no React, so states stay testable and
   reusable for future LAGLO surfaces (section 24).
   Amplitudes are deliberately small. You should not immediately
   notice he is moving - only notice if he stops.
   ============================================================ */
export type LagloState =
  | 'IDLE'
  | 'LOOK_POINTER'
  | 'THINKING'
  | 'CONFUSED'
  | 'MISSING_PIECE_APPROACH'
  | 'ALMOST'
  | 'ONE_SEC'
  | 'RETURN_IDLE';

export interface BrainInput {
  dt: number;
  /** normalised pointer, -1..1, or null once it has left */
  pointer: { x: number; y: number } | null;
  dragging: boolean;
  /** distance from the 1% to its slot: 0 = touching, 1 = far away */
  gapProximity: number;
  reduced: boolean;
}

export interface BrainOutput {
  state: LagloState;
  headYaw: number;
  headPitch: number;
  eyeX: number;
  eyeY: number;
  blink: number;
  armRaise: number;
  /** 0 = orbit freely, 1 = drawn toward the gap */
  fragmentSeek: number;
  progress: number;
  caption: string | null;
}

const SEQ = { APPROACH: 2.6, ALMOST: 1.0, ONE_SEC: 2.9, RETURN: 1.4 };
/** Soon enough to be seen once, then rare. Twice inside 40s read as a mascot
 *  performing; the joke lands harder when you are not expecting it again. */
const FIRST_RUN = 6.5;
const REPEAT = 52;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const ease = (t: number) => t * t * (3 - 2 * t);

export class LagloBrain {
  state: LagloState = 'IDLE';
  private t = 0;
  private since = 0;
  private ranOnce = false;
  private blinkIn = 3.2;
  private blinkT = -1;
  private driftIn = 5;
  private driftYaw = 0;
  private driftPitch = 0;
  private out: BrainOutput = {
    state: 'IDLE', headYaw: 0, headPitch: 0, eyeX: 0, eyeY: 0,
    blink: 0, armRaise: 0, fragmentSeek: 0, progress: 99, caption: null,
  };

  set(s: LagloState) { this.state = s; this.t = 0; }

  /** A click or a tap. He notices, briefly. */
  poke() {
    if (this.state === 'IDLE' || this.state === 'LOOK_POINTER') this.set('CONFUSED');
  }

  update(i: BrainInput): BrainOutput {
    const { dt } = i;
    this.t += dt;
    this.since += dt;

    // --- blink: rare. he is not a Tamagotchi --------------------------
    if (this.blinkT >= 0) {
      this.blinkT += dt;
      if (this.blinkT > 0.15) { this.blinkT = -1; this.blinkIn = 3 + Math.random() * 5; }
    } else {
      this.blinkIn -= dt;
      if (this.blinkIn <= 0) this.blinkT = 0;
    }
    const blink = this.blinkT >= 0 ? Math.sin((this.blinkT / 0.15) * Math.PI) : 0;

    // --- slow drift, so he is never mechanically still -----------------
    this.driftIn -= dt;
    if (this.driftIn <= 0) {
      this.driftIn = 4 + Math.random() * 5;
      this.driftYaw = (Math.random() - 0.5) * 0.16;
      this.driftPitch = (Math.random() - 0.5) * 0.07;
    }

    let headYaw = this.driftYaw;
    let headPitch = this.driftPitch;
    let eyeX = 0, eyeY = 0, armRaise = 0, fragmentSeek = 0;
    let progress = 99;
    let caption: string | null = null;

    // eyes reach the pointer before the head does
    if (i.pointer) {
      eyeX = clamp(i.pointer.x, -1, 1);
      eyeY = clamp(i.pointer.y, -1, 1);
      headYaw += i.pointer.x * 0.11;      // about +/- 6.3 degrees
      headPitch += -i.pointer.y * 0.055;  // about +/- 3.2 degrees
    }

    // --- the user is doing it themselves; the script stands aside ------
    if (i.dragging) {
      if (this.state !== 'IDLE') this.set('IDLE');
      this.since = 0;
      const near = 1 - clamp(i.gapProximity, 0, 1);
      progress = 99 + Math.min(0.9, near * 0.9);
      caption = near > 0.86 ? 'almost.' : null;
      headYaw = lerp(headYaw, 0.2, near * 0.7);
      headPitch = lerp(headPitch, -0.16, near * 0.7);
      eyeX = lerp(eyeX, 0.55, near);
      eyeY = lerp(eyeY, 0.5, near);
      return this.emit({ headYaw, headPitch, eyeX, eyeY, blink, armRaise, fragmentSeek, progress, caption });
    }

    switch (this.state) {
      case 'IDLE':
      case 'LOOK_POINTER': {
        const wait = this.ranOnce ? REPEAT : FIRST_RUN;
        if (this.since > wait && !i.reduced) {
          this.ranOnce = true;
          this.since = 0;
          this.set('MISSING_PIECE_APPROACH');
        }
        break;
      }
      case 'CONFUSED': {
        headYaw += 0.14;
        headPitch += 0.06;
        caption = 'huh?';
        if (this.t > 1.5) this.set('IDLE');
        break;
      }
      case 'MISSING_PIECE_APPROACH': {
        const k = ease(clamp(this.t / SEQ.APPROACH, 0, 1));
        fragmentSeek = k;
        progress = lerp(97, 99.7, k);
        headYaw = lerp(headYaw, 0.26, k);
        headPitch = lerp(headPitch, -0.2, k);
        eyeX = lerp(eyeX, 0.7, k);
        eyeY = lerp(eyeY, 0.6, k);
        caption = 'still loading.';
        if (this.t > SEQ.APPROACH) this.set('ALMOST');
        break;
      }
      case 'ALMOST': {
        const k = clamp(this.t / SEQ.ALMOST, 0, 1);
        fragmentSeek = 1;
        progress = lerp(99.7, 99.9, k);
        headYaw = 0.26; headPitch = -0.2; eyeX = 0.7; eyeY = 0.6;
        caption = 'almost.';
        if (this.t > SEQ.ALMOST) this.set('ONE_SEC');
        break;
      }
      case 'ONE_SEC': {
        /* Four separated beats. The pause between looking at you and lifting
           the finger is the joke; overlapping them reads as slapstick.
           0.00-0.50  still staring at the piece, stuck at 99.9
           0.50-1.10  turns to you
           1.10-1.35  holds. says nothing.
           1.35-1.90  one finger, "one sec." */
        const toViewer = ease(clamp((this.t - 0.5) / 0.6, 0, 1));
        fragmentSeek = 1 - ease(clamp((this.t - 0.9) / 1.2, 0, 1));
        headYaw = lerp(0.26, 0, toViewer);
        headPitch = lerp(-0.2, 0.02, toViewer);
        eyeX = lerp(0.7, 0, toViewer);
        eyeY = lerp(0.6, 0, toViewer);
        armRaise = ease(clamp((this.t - 1.35) / 0.55, 0, 1));
        progress = 99.9;
        caption = this.t > 1.45 ? 'one sec.' : 'almost.';
        if (this.t > SEQ.ONE_SEC) this.set('RETURN_IDLE');
        break;
      }
      case 'RETURN_IDLE': {
        const k = ease(clamp(this.t / SEQ.RETURN, 0, 1));
        armRaise = 1 - k;
        progress = lerp(99.9, 99, k);
        if (this.t > SEQ.RETURN) this.set('IDLE');
        break;
      }
      case 'THINKING': {
        caption = 'loading...';
        if (this.t > 2) this.set('IDLE');
        break;
      }
    }

    return this.emit({ headYaw, headPitch, eyeX, eyeY, blink, armRaise, fragmentSeek, progress, caption });
  }

  private emit(p: Omit<BrainOutput, 'state'>): BrainOutput {
    const o = this.out;
    o.state = this.state;
    o.headYaw = p.headYaw; o.headPitch = p.headPitch;
    o.eyeX = p.eyeX; o.eyeY = p.eyeY;
    o.blink = p.blink; o.armRaise = p.armRaise;
    o.fragmentSeek = p.fragmentSeek;
    o.progress = p.progress; o.caption = p.caption;
    return o;
  }
}
