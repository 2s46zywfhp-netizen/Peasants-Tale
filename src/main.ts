import './style.css';
import { Audio, type Sfx } from './audio/sfx';
import { Input } from './input/input';
import { loadFont } from './render/font';
import { Screen } from './render/screen';
import { SaveManager } from './save/saveManager';
import type { Settings } from './save/schema';
import { advance } from './sim/sim';
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
  const [save] = await Promise.all([SaveManager.open(newSeed(), Date.now()), loadFont()]);
  const scenes = new SceneManager(input);

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
      audio.enabled = save.data.settings.sound;
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
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      input.releaseAll();
      flush();
    }
  });
  window.addEventListener('pagehide', flush);

  scenes.push(new TitleScene(game), false);

  let last = performance.now();
  const frame = (t: number) => {
    const dt = Math.min(100, t - last);
    last = t;
    // The sim runs in whole blocks of real time; autosave after every block processed.
    const { state, blocksRun } = advance(save.data.sim, Date.now());
    if (blocksRun > 0) {
      save.data = { ...save.data, sim: state };
      flush();
    }
    input.update(t);
    scenes.update(dt, Date.now());
    scenes.draw(display.ctx, Date.now());
    display.present(save.data.settings);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
}

void boot();
