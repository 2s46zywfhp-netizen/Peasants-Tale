import './style.css';
import { Audio, type Sfx } from './audio/sfx';
import { Input } from './input/input';
import { initSprites } from './render/atlas';
import { loadFont } from './render/font';
import { IDENTITY, setDmgMode, useUiRemap } from './render/palette';
import { Screen } from './render/screen';
import { SaveManager } from './save/saveManager';
import { newSave, type Settings } from './save/schema';
import { act, advance, type SimState } from './sim/sim';
import { dayInfo } from './sim/calendar';
import { BLOCKS_PER_REAL_DAY, DEBUG_HOLD_MS, REAL_DAY_MS } from './sim/balance';
import { DebugScene } from './ui/scenes/debug';
import { ParchmentLogScene } from './ui/scenes/parchmentLog';
import { WorldScene } from './ui/scenes/world';
import type { Game } from './ui/game';
import { onActivation } from './ui/gesture';
import { SceneManager } from './ui/scene';
import { TitleScene } from './ui/scenes/title';
import { bindControls, lockDownGestures, vibrateTick } from './ui/shell';

function newSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0]!;
}

async function boot(): Promise<void> {
  lockDownGestures();
  try {
    await (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }).lock?.('portrait');
  } catch {
    // Most browsers only allow locking in fullscreen; the manifest and CSS cover the rest.
  }

  const canvas = document.getElementById('screen') as HTMLCanvasElement;
  const gb = document.getElementById('gb')!;
  const display = new Screen(canvas);
  const input = new Input();
  const audio = new Audio();
  const [save] = await Promise.all([SaveManager.open(newSeed(), Date.now()), loadFont(), initSprites(IDENTITY)]);
  const scenes = new SceneManager(input);
  // Frame clock: integer ms since boot keeps numbers small (unboxed) in the render loop.
  let frameNow = 0;
  let lastFrame = performance.now() | 0;
  // When to next look at the wall clock (frame time). Date.now() allocates, so it is not read every frame.
  let clockCheckAt = 0;

  const game: Game = {
    scenes,
    input,
    save,
    audio,
    now: () => Date.now(),
    newSeed,
    sfx: (name: Sfx) => audio.play(name),
    updateSettings(patch: Partial<Settings>) {
      save.data = { ...save.data, settings: { ...save.data.settings, ...patch } };
      this.applySettings();
      void save.save(Date.now());
    },
    applySettings() {
      audio.setEnabled(save.data.settings.sound);
      setDmgMode(save.data.settings.dmg);
    },
    sim: () => save.data.sim,
    act(id, param = null) {
      const r = act(save.data.sim, id, Date.now(), param);
      save.data = { ...save.data, sim: r.state, tutorial: r.ok && save.data.tutorial === 1 ? 2 : save.data.tutorial };
      void save.save(Date.now());
      return { ok: r.ok, message: r.message };
    },
    setSim(s: SimState) {
      save.data = { ...save.data, sim: s };
      void save.save(Date.now());
    },
    frameNow: () => frameNow,
    markSeen(block: number) {
      save.data = { ...save.data, seenBlock: Math.max(save.data.seenBlock, block) };
      void save.save(Date.now());
    },
    newLife(names) {
      const now = Date.now();
      void save.replace({ ...newSave(newSeed(), now, save.data.settings, names), onboarded: true }, now);
      clockCheckAt = 0;
    },
    tutorial: () => save.data.tutorial,
    advanceTutorial(step: number) {
      if (save.data.tutorial !== step) return;
      save.data = { ...save.data, tutorial: step + 1 };
      void save.save(Date.now());
    },
  };
  game.applySettings();

  input.onPress = () => vibrateTick();
  bindControls(gb, input, () => performance.now());
  // Audio may only start inside a user activation; pointerdown is tried too as some browsers allow it.
  onActivation(() => audio.unlock());
  window.addEventListener('pointerdown', () => audio.unlock(), { capture: true });

  const bezel = document.getElementById('bezel')!;
  const layout = () => {
    const cs = getComputedStyle(bezel);
    const w = bezel.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const h = bezel.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    display.resize(w, h, window.devicePixelRatio || 1);
    display.present(save.data.settings);
  };
  new ResizeObserver(layout).observe(bezel);
  window.addEventListener('resize', layout);
  matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`).addEventListener?.('change', layout);
  layout();

  // Autosave whenever the app is hidden (home button, app switch, lock screen).
  const flush = () => void save.save(Date.now());
  let returned = false;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      input.releaseAll();
      flush();
    } else returned = true;
  });
  window.addEventListener('pagehide', flush);

  scenes.push(new TitleScene(game), false);

  // Hold SELECT + START to open the debug panel.
  let comboSince: number | null = null;
  const frame = (t: number) => {
    if (input.isHeld('select') && input.isHeld('start')) {
      comboSince ??= t;
      if (t - comboSince >= DEBUG_HOLD_MS && !(scenes.top instanceof DebugScene)) {
        scenes.push(new DebugScene(game), false);
        comboSince = Infinity;
      }
    } else comboSince = null;
    frameNow = t | 0;
    let dt = frameNow - lastFrame;
    if (dt > 100) dt = 100;
    lastFrame = frameNow;
    // The sim runs in whole blocks of real time; autosave after every block processed.
    // The cheap check first: advance() is only called (and only allocates) when a block is due.
    const sim = save.data.sim;
    // Is a block due? The wall clock is read when the current block should end, and at least once
    // a second (Date.now() allocates, so it is not read every frame).
    // Before the new life is named, no time passes for it.
    if (frameNow >= clockCheckAt && save.data.onboarded) {
      const wall = Date.now();
      if (Math.floor(((wall - sim.anchorMs) * BLOCKS_PER_REAL_DAY) / REAL_DAY_MS) > sim.block && wall >= sim.lastSimMs) {
        const { state, blocksRun } = advance(sim, wall);
        if (blocksRun > 0) {
          // While the player watches the world, what happens there counts as seen.
          const watching = scenes.top instanceof WorldScene && document.visibilityState === 'visible' && !returned;
          save.data = { ...save.data, sim: state, seenBlock: watching ? state.block : save.data.seenBlock };
          flush();
          if (blocksRun <= 2) audio.bell((state.block % 6) % 3 + 1); // the church bell marks the hour
        }
      }
      const cur = save.data.sim;
      const endOfBlock = cur.anchorMs + ((cur.block + 1) * REAL_DAY_MS) / BLOCKS_PER_REAL_DAY;
      clockCheckAt = frameNow + Math.max(16, Math.min(1000, Math.ceil(endOfBlock - wall)));
    }
    if (returned) {
      returned = false;
      if (scenes.top instanceof WorldScene && save.data.sim.block > save.data.seenBlock) {
        scenes.push(new ParchmentLogScene(game, save.data.seenBlock, save.data.sim.block), false);
      }
    }
    audio.setSeason(dayInfo((save.data.sim.block / 6) | 0).season);
    input.update(frameNow);
    scenes.update(dt, frameNow);
    useUiRemap();
    scenes.draw(display.ctx, frameNow);
    display.present(save.data.settings);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    // A new version takes over as soon as it is installed: reload once onto it (the save is in IndexedDB).
    const hadController = !!navigator.serviceWorker.controller;
    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController || reloading) return;
      reloading = true;
      flush();
      window.location.reload();
    });
    navigator.serviceWorker
      .register('/sw.js', { updateViaCache: 'none' })
      .then((reg) => {
        // Look for a new version whenever the app comes back to the foreground.
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') void reg.update().catch(() => {});
        });
      })
      .catch(() => {});
  }
}

void boot();
