import { useCallback, useEffect, useRef, useState } from 'react';
import { BookOpen, Pause, Play, RotateCcw, Swords, Volume2, VolumeX, Gamepad2, X } from 'lucide-react';
import { ArenaHud } from './components/ArenaHud';
import { FighterPreview } from './components/FighterPreview';
import { TouchControls } from './components/TouchControls';
import {
  MatchConfig,
  PlayerInputState,
  STAGE_HEIGHT,
  STAGE_WIDTH,
  ShadowFightEngine,
} from './game/engine';
import { ARENAS, WEAPONS } from './game/moves';
import { soundEngine } from './game/sound';
import {
  ArenaId,
  Difficulty,
  GameMode,
  GameState,
  HeadgearId,
  HudSnapshot,
  MatchSummary,
  WeaponId,
} from './game/types';

const HEADGEARS: Array<{ id: HeadgearId; name: string }> = [
  { id: 'headband', name: 'Shinobi Band' },
  { id: 'ronin_hat', name: 'Ronin Kasa' },
  { id: 'shinobi_hood', name: 'Shadow Cowl' },
  { id: 'oni_crest', name: 'Kabuto Crest' },
];

const INITIAL_HUD: HudSnapshot = {
  p1Hp: 100,
  p1MaxHp: 100,
  p1TrailHp: 100,
  p1Shadow: 0,
  p1Rounds: 0,
  p1Combo: 0,
  p1ComboDamage: 0,
  p2Hp: 100,
  p2MaxHp: 100,
  p2TrailHp: 100,
  p2Shadow: 0,
  p2Rounds: 0,
  p2Combo: 0,
  p2ComboDamage: 0,
  roundNumber: 1,
  roundTimer: 99,
  bannerText: 'ROUND 1',
  bannerSubtext: 'PREPARE',
  shadowFlashActive: false,
};

function createEmptyInput(): PlayerInputState {
  return {
    left: false,
    right: false,
    up: false,
    down: false,
    light: false,
    heavy: false,
    kick: false,
    shadow: false,
    dashLeft: false,
    dashRight: false,
  };
}

export default function App() {
  const [gameState, setGameState] = useState<GameState>('TITLE_MENU');
  const [mode, setMode] = useState<GameMode>('ARCADE_AI');
  const [difficulty, setDifficulty] = useState<Difficulty>('MEDIUM');
  const [arenaId, setArenaId] = useState<ArenaId>('sunset_bamboo');
  const [p1Weapon, setP1Weapon] = useState<WeaponId>('katana');
  const [p1Headgear, setP1Headgear] = useState<HeadgearId>('ronin_hat');
  const [p2Weapon, setP2Weapon] = useState<WeaponId>('naginata');
  const [p2Headgear, setP2Headgear] = useState<HeadgearId>('oni_crest');

  const [muted, setMuted] = useState(false);
  const [showTouchPad, setShowTouchPad] = useState(false);
  const [showMoveList, setShowMoveList] = useState(false);
  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
  const [summary, setSummary] = useState<MatchSummary | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<ShadowFightEngine | null>(null);
  const gameStateRef = useRef<GameState>(gameState);
  const modeRef = useRef<GameMode>(mode);

  const keysHeldRef = useRef<Set<string>>(new Set());
  const touchInputRef = useRef<PlayerInputState>(createEmptyInput());
  const lastTapRef = useRef<{ key: string; time: number }>({ key: '', time: 0 });
  const dashBurstRef = useRef<{ left: number; right: number }>({ left: 0, right: 0 });

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    soundEngine.setMuted(next);
  };

  const startDuel = useCallback(() => {
    const config: MatchConfig = {
      mode,
      difficulty,
      arenaId,
      p1Weapon,
      p1Headgear,
      p2Weapon,
      p2Headgear,
    };
    const engine = new ShadowFightEngine(config, (matchSummary) => {
      setSummary(matchSummary);
      setGameState('GAME_OVER');
    });
    engineRef.current = engine;
    keysHeldRef.current.clear();
    touchInputRef.current = createEmptyInput();
    setSummary(null);
    setShowMoveList(false);
    setHud(engine.getHudSnapshot());
    setGameState('PLAYING');
  }, [mode, difficulty, arenaId, p1Weapon, p1Headgear, p2Weapon, p2Headgear]);

  const returnToMenu = () => {
    engineRef.current = null;
    setSummary(null);
    setShowMoveList(false);
    setGameState('TITLE_MENU');
  };

  const handleTouchControl = useCallback((key: keyof PlayerInputState, pressed: boolean) => {
    touchInputRef.current[key] = pressed;
  }, []);

  // Keyboard bindings
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const code = e.code;
      if (
        ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(code) &&
        gameStateRef.current === 'PLAYING'
      ) {
        e.preventDefault();
      }

      if (code === 'Escape') {
        if (gameStateRef.current === 'PLAYING') {
          setGameState('PAUSED');
        } else if (gameStateRef.current === 'PAUSED') {
          setGameState('PLAYING');
        }
        return;
      }

      if (!e.repeat && gameStateRef.current === 'PLAYING') {
        const now = performance.now();
        const isSingle = modeRef.current !== 'LOCAL_VERSUS';
        const isLeftKey = code === 'KeyA' || (isSingle && code === 'ArrowLeft');
        const isRightKey = code === 'KeyD' || (isSingle && code === 'ArrowRight');

        if (isLeftKey && lastTapRef.current.key === 'LEFT' && now - lastTapRef.current.time < 240) {
          dashBurstRef.current.left = now + 120;
        }
        if (isRightKey && lastTapRef.current.key === 'RIGHT' && now - lastTapRef.current.time < 240) {
          dashBurstRef.current.right = now + 120;
        }
        if (isLeftKey) lastTapRef.current = { key: 'LEFT', time: now };
        if (isRightKey) lastTapRef.current = { key: 'RIGHT', time: now };
      }

      keysHeldRef.current.add(code);
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysHeldRef.current.delete(e.code);
    };

    const handleBlur = () => {
      keysHeldRef.current.clear();
      touchInputRef.current = createEmptyInput();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  // Main 60fps Game Loop
  useEffect(() => {
    if (gameState !== 'PLAYING' && gameState !== 'PAUSED' && gameState !== 'GAME_OVER') {
      return;
    }

    let animId = 0;
    let lastTime = performance.now();
    let hudAccumulator = 0;

    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      const engine = engineRef.current;
      const canvas = canvasRef.current;

      if (engine && canvas) {
        if (gameStateRef.current === 'PLAYING') {
          const held = keysHeldRef.current;
          const touch = touchInputRef.current;
          const isSingle = modeRef.current !== 'LOCAL_VERSUS';

          const p1Input: PlayerInputState = {
            left: held.has('KeyA') || (isSingle && held.has('ArrowLeft')) || touch.left,
            right: held.has('KeyD') || (isSingle && held.has('ArrowRight')) || touch.right,
            up: held.has('KeyW') || (isSingle && held.has('ArrowUp')) || touch.up,
            down: held.has('KeyS') || (isSingle && held.has('ArrowDown')) || touch.down,
            light: held.has('KeyJ') || held.has('KeyZ') || touch.light,
            heavy: held.has('KeyK') || held.has('KeyX') || touch.heavy,
            kick: held.has('KeyU') || held.has('KeyC') || touch.kick,
            shadow: held.has('KeyL') || held.has('KeyV') || touch.shadow,
            dashLeft: held.has('KeyQ') || dashBurstRef.current.left > now || touch.dashLeft,
            dashRight: held.has('KeyE') || dashBurstRef.current.right > now || touch.dashRight,
          };

          const p2Input: PlayerInputState = isSingle
            ? createEmptyInput()
            : {
                left: held.has('ArrowLeft'),
                right: held.has('ArrowRight'),
                up: held.has('ArrowUp'),
                down: held.has('ArrowDown'),
                light: held.has('Digit1') || held.has('Numpad1') || held.has('Comma'),
                heavy: held.has('Digit2') || held.has('Numpad2') || held.has('Period'),
                kick: held.has('Digit3') || held.has('Numpad3') || held.has('Slash'),
                shadow: held.has('Digit4') || held.has('Numpad4') || held.has('ShiftRight'),
                dashLeft: false,
                dashRight: false,
              };

          engine.setInputs(p1Input, p2Input);
          engine.update(dt);
        }

        const ctx = canvas.getContext('2d');
        if (ctx) {
          engine.render(ctx);
        }

        hudAccumulator += dt;
        if (hudAccumulator >= 0.032) {
          hudAccumulator = 0;
          setHud(engine.getHudSnapshot());
        }
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [gameState]);

  const currentArena = ARENAS.find((a) => a.id === arenaId) ?? ARENAS[0];
  const activeWeapon = WEAPONS[p1Weapon];

  // TITLE MENU VIEW
  if (gameState === 'TITLE_MENU') {
    return (
      <div className="relative min-h-screen w-full overflow-x-hidden bg-[#0b0b0e] text-stone-100">
        {/* Atmospheric Selected Arena Backdrop */}
        <div className="pointer-events-none fixed inset-0 z-0">
          <img
            src={currentArena.imagePath}
            alt={currentArena.name}
            referrerPolicy="no-referrer"
            className="h-full w-full object-cover opacity-35 transition-opacity duration-500"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0b0b0e] via-[#0b0b0e]/75 to-[#0b0b0e]/60" />
        </div>

        <div className="relative z-10 mx-auto flex min-h-screen max-w-[1200px] flex-col justify-between px-4 py-6 sm:px-8 sm:py-8">
          {/* Top Bar */}
          <header className="flex items-center justify-between gap-8 border-b border-stone-800/80 pb-4">
            <span className="font-display text-xl sm:text-2xl font-extrabold tracking-[0.18em] text-stone-100 whitespace-nowrap shrink-0">
              SHADOW DUEL
            </span>
            <div className="hidden md:flex items-center gap-6 text-xs font-medium tracking-wider text-stone-400">
              <span className="whitespace-nowrap shrink-0">Articulated Silhouette Combat</span>
              <span aria-hidden="true">·</span>
              <span className="whitespace-nowrap shrink-0">Best of 3 Rounds</span>
            </div>
            <button
              type="button"
              onClick={toggleMute}
              className="flex items-center gap-2 rounded-lg border border-stone-800 bg-stone-900/80 px-3 py-2 text-xs font-medium text-stone-200 hover:bg-stone-800 transition-colors whitespace-nowrap shrink-0"
            >
              {muted ? <VolumeX className="h-4 w-4 text-stone-400" /> : <Volume2 className="h-4 w-4 text-amber-400" />}
              <span>{muted ? 'Muted' : 'Sound On'}</span>
            </button>
          </header>

          {/* Main 2-Column Staging & Loadout */}
          <main className="my-6 grid grid-cols-1 items-stretch gap-6 lg:grid-cols-12">
            {/* Left: Visual Focal Anchor & Fighter Stance */}
            <section className="relative flex flex-col justify-between overflow-hidden rounded-xl border border-stone-800/90 bg-stone-950/80 p-6 lg:col-span-5">
              <div className="absolute inset-0 z-0 opacity-45">
                <img
                  src={currentArena.imagePath}
                  alt={currentArena.name}
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-stone-950 via-stone-950/35 to-stone-950/75" />
              </div>

              <div className="relative z-10">
                <p className="text-xs font-medium tracking-[0.2em] text-amber-400 uppercase">
                  {currentArena.name} · {currentArena.subtitle}
                </p>
                <h1 className="font-display mt-2 text-3xl sm:text-4xl font-extrabold tracking-wide text-stone-50 text-balance">
                  Master the Blade of Shadows
                </h1>
              </div>

              <div className="relative z-10 my-4 flex items-center justify-center">
                <FighterPreview weapon={p1Weapon} headgear={p1Headgear} arenaId={arenaId} />
              </div>

              <div className="relative z-10 border-t border-stone-800/80 pt-4">
                <div className="flex items-baseline justify-between gap-4">
                  <span className="font-display text-lg font-bold text-stone-100">
                    {activeWeapon.name}
                  </span>
                  <span className="text-xs font-medium text-amber-300">
                    {activeWeapon.archetype}
                  </span>
                </div>
                <p className="mt-1 text-sm text-stone-300 leading-relaxed">
                  {activeWeapon.description}
                </p>
                <div className="mt-3 flex items-center gap-4 font-mono-tabular text-xs text-stone-400">
                  <span>Reach {activeWeapon.reach}</span>
                  <span aria-hidden="true">·</span>
                  <span>Speed {Math.round(activeWeapon.speedMult * 100)}%</span>
                  <span aria-hidden="true">·</span>
                  <span>Power {Math.round(activeWeapon.damageMult * 200)}% (2×)</span>
                </div>
              </div>
            </section>

            {/* Right: Configuration & Start CTA */}
            <section className="flex flex-col justify-between rounded-xl border border-stone-800/90 bg-stone-950/85 p-6 lg:col-span-7">
              <div className="space-y-5">
                {/* Mode & Difficulty Row */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-xs font-semibold tracking-wider text-stone-400 uppercase">
                      Combat Mode
                    </label>
                    <div className="grid grid-cols-3 gap-1 rounded-lg bg-stone-900 p-1 border border-stone-800">
                      {(
                        [
                          { id: 'ARCADE_AI', label: 'vs AI' },
                          { id: 'LOCAL_VERSUS', label: '2P Local' },
                          { id: 'PRACTICE', label: 'Practice' },
                        ] as const
                      ).map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setMode(m.id)}
                          className={`rounded-md px-2.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                            mode === m.id
                              ? 'bg-amber-500 text-stone-950'
                              : 'text-stone-300 hover:text-stone-100'
                          }`}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-semibold tracking-wider text-stone-400 uppercase">
                      {mode === 'ARCADE_AI' ? 'Opponent Tier' : mode === 'LOCAL_VERSUS' ? 'Player 2 Weapon' : 'Dojo Dummy'}
                    </label>
                    {mode === 'ARCADE_AI' ? (
                      <div className="grid grid-cols-4 gap-1 rounded-lg bg-stone-900 p-1 border border-stone-800">
                        {(
                          [
                            { id: 'EASY', label: 'Easy' },
                            { id: 'MEDIUM', label: 'Medium' },
                            { id: 'HARD', label: 'Hard' },
                            { id: 'EXPERT', label: 'Expert' },
                          ] as const
                        ).map((d) => (
                          <button
                            key={d.id}
                            type="button"
                            onClick={() => setDifficulty(d.id)}
                            className={`rounded-md px-1.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                              difficulty === d.id
                                ? 'bg-red-600 text-stone-50'
                                : 'text-stone-300 hover:text-stone-100'
                            }`}
                          >
                            {d.label}
                          </button>
                        ))}
                      </div>
                    ) : mode === 'LOCAL_VERSUS' ? (
                      <div className="grid grid-cols-4 gap-1 rounded-lg bg-stone-900 p-1 border border-stone-800">
                        {(Object.keys(WEAPONS) as WeaponId[]).map((wid) => (
                          <button
                            key={wid}
                            type="button"
                            onClick={() => setP2Weapon(wid)}
                            className={`rounded-md px-1.5 py-2 text-xs font-semibold transition-colors truncate ${
                              p2Weapon === wid
                                ? 'bg-red-600 text-stone-50'
                                : 'text-stone-300 hover:text-stone-100'
                            }`}
                          >
                            {wid === 'katana' ? 'Katana' : wid === 'sai' ? 'Sai' : wid === 'naginata' ? 'Pole' : 'Fist'}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="flex h-[38px] items-center rounded-lg border border-stone-800 bg-stone-900/60 px-3 text-xs text-stone-400">
                        Auto-regenerating health · Unlimited shadow meter
                      </div>
                    )}
                  </div>
                </div>

                {/* Weapon Selection */}
                <div>
                  <label className="mb-2 block text-xs font-semibold tracking-wider text-stone-400 uppercase">
                    Select Weapon Style
                  </label>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {(Object.values(WEAPONS)).map((w) => {
                      const selected = p1Weapon === w.id;
                      return (
                        <button
                          key={w.id}
                          type="button"
                          onClick={() => setP1Weapon(w.id)}
                          className={`rounded-lg border px-3 py-2.5 text-left transition-colors ${
                            selected
                              ? 'border-amber-500 bg-amber-500/12 text-stone-50'
                              : 'border-stone-800 bg-stone-900/70 text-stone-300 hover:border-stone-700'
                          }`}
                        >
                          <div className="text-sm font-semibold whitespace-nowrap truncate">{w.name}</div>
                          <div className="mt-0.5 text-[11px] text-stone-400 whitespace-nowrap truncate">
                            {w.archetype}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Headgear Selection */}
                <div>
                  <label className="mb-2 block text-xs font-semibold tracking-wider text-stone-400 uppercase">
                    Fighter Silhouette Crest
                  </label>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {HEADGEARS.map((hg) => (
                      <button
                        key={hg.id}
                        type="button"
                        onClick={() => setP1Headgear(hg.id)}
                        className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                          p1Headgear === hg.id
                            ? 'border-amber-500 bg-amber-500/12 text-amber-200'
                            : 'border-stone-800 bg-stone-900/70 text-stone-300 hover:border-stone-700'
                        }`}
                      >
                        {hg.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Arena Selection */}
                <div>
                  <label className="mb-2 block text-xs font-semibold tracking-wider text-stone-400 uppercase">
                    Battleground Dojo
                  </label>
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                    {ARENAS.map((ar) => {
                      const active = arenaId === ar.id;
                      return (
                        <button
                          key={ar.id}
                          type="button"
                          onClick={() => setArenaId(ar.id)}
                          className={`group relative overflow-hidden rounded-lg border text-left transition-all ${
                            active
                              ? 'border-amber-500 ring-1 ring-amber-500/40'
                              : 'border-stone-800 hover:border-stone-700'
                          }`}
                        >
                          <div className="relative h-20 w-full bg-stone-900">
                            <img
                              src={ar.imagePath}
                              alt={ar.name}
                              referrerPolicy="no-referrer"
                              className="h-full w-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-stone-950 via-stone-950/35 to-transparent" />
                            <div className="absolute inset-x-0 bottom-0 p-2.5">
                              <div className="text-xs font-bold text-stone-100 truncate">{ar.name}</div>
                              <div className="text-[10px] text-stone-300 truncate">{ar.subtitle}</div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Action Footer */}
              <div className="mt-6 flex flex-col gap-4 border-t border-stone-800/80 pt-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-xs text-stone-400 leading-relaxed">
                  <span className="font-semibold text-stone-200">Controls:</span>{' '}
                  {mode === 'LOCAL_VERSUS'
                    ? 'P1 WASD + J/K/U/L · P2 Arrows + 1/2/3/4 · Hold Back to Block'
                    : 'A/D or Arrows Move · Hold Back to Block · W Jump · S Crouch · J Light · K Heavy · U Kick · L Shadow'}
                </div>
                <button
                  type="button"
                  onClick={startDuel}
                  className="inline-flex items-center justify-center gap-2.5 rounded-lg bg-amber-500 px-7 py-3 text-sm font-bold tracking-wide text-stone-950 hover:bg-amber-400 active:scale-[0.98] transition-all whitespace-nowrap shrink-0"
                >
                  <Swords className="h-4 w-4" />
                  <span>Start Duel</span>
                </button>
              </div>
            </section>
          </main>

          <footer className="flex items-center justify-between text-xs text-stone-500">
            <span>Double-tap Back/Forward or press Q/E to Dash</span>
            <span>Down + Kick executes an Iron Sweep</span>
          </footer>
        </div>
      </div>
    );
  }

  const p2DisplayName =
    mode === 'LOCAL_VERSUS'
      ? 'Player 2'
      : mode === 'PRACTICE'
      ? 'Wooden Master'
      : difficulty === 'EXPERT'
      ? 'Kage-Oni'
      : difficulty === 'HARD'
      ? 'Crimson Ronin'
      : difficulty === 'MEDIUM'
      ? 'Shadow Disciple'
      : 'Dojo Initiate';

  // ACTIVE COMBAT / PAUSED / GAME OVER VIEW
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#070709] px-2 py-3 sm:px-6 sm:py-4 text-stone-100">
      <div className="w-full max-w-[1280px] space-y-3">
        {/* Arena Stage Container */}
        <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-stone-800 bg-stone-950 shadow-2xl">
          <canvas
            ref={canvasRef}
            width={STAGE_WIDTH}
            height={STAGE_HEIGHT}
            className="block h-full w-full"
          />

          <ArenaHud
            hud={hud}
            p1Name="Shadow"
            p2Name={p2DisplayName}
            p1Weapon={p1Weapon}
            p2Weapon={p2Weapon}
            isPractice={mode === 'PRACTICE'}
          />

          {/* Pause Overlay */}
          {gameState === 'PAUSED' && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-stone-950/80 backdrop-blur-sm p-4">
              <div className="w-full max-w-sm rounded-xl border border-stone-800 bg-stone-900 p-6 text-center shadow-2xl">
                <h2 className="font-display text-2xl font-bold tracking-widest text-stone-100">
                  PAUSED
                </h2>
                <p className="mt-1 text-xs text-stone-400">
                  {currentArena.name} · Round {hud.roundNumber}
                </p>
                <div className="mt-6 flex flex-col gap-2.5">
                  <button
                    type="button"
                    onClick={() => setGameState('PLAYING')}
                    className="flex items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-bold text-stone-950 hover:bg-amber-400 transition-colors"
                  >
                    <Play className="h-4 w-4" />
                    <span>Resume Duel</span>
                  </button>
                  <button
                    type="button"
                    onClick={startDuel}
                    className="flex items-center justify-center gap-2 rounded-lg border border-stone-700 bg-stone-800 px-4 py-2.5 text-sm font-semibold text-stone-100 hover:bg-stone-700 transition-colors"
                  >
                    <RotateCcw className="h-4 w-4" />
                    <span>Restart Match</span>
                  </button>
                  <button
                    type="button"
                    onClick={returnToMenu}
                    className="rounded-lg border border-stone-800 bg-stone-950 px-4 py-2.5 text-sm font-medium text-stone-300 hover:text-stone-100 transition-colors"
                  >
                    Return to Menu
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Post-Match Summary Overlay */}
          {gameState === 'GAME_OVER' && summary && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-stone-950/85 backdrop-blur-sm p-4">
              <div className="w-full max-w-md rounded-xl border border-stone-800 bg-stone-900/95 p-6 shadow-2xl">
                <div className="text-center">
                  <p className="text-xs font-semibold tracking-[0.24em] text-amber-400 uppercase">
                    Match Concluded
                  </p>
                  <h2 className="font-display mt-1 text-3xl font-extrabold tracking-wider text-stone-50">
                    {summary.winner === 1 ? 'VICTORY' : summary.winner === 2 ? 'DEFEAT' : 'DRAW'}
                  </h2>
                  <p className="mt-1 text-sm text-stone-300">
                    {summary.winnerName} wins {summary.p1Rounds} – {summary.p2Rounds}
                  </p>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-4 border-y border-stone-800 py-4 text-xs">
                  <div>
                    <div className="font-semibold text-amber-300">Shadow (P1)</div>
                    <div className="mt-1.5 space-y-1 font-mono-tabular text-stone-300">
                      <div>Damage Dealt: {summary.p1Damage}</div>
                      <div>Max Combo: {summary.p1MaxCombo} hits</div>
                      <div>Strike Accuracy: {summary.p1Accuracy}%</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-red-400">{p2DisplayName}</div>
                    <div className="mt-1.5 space-y-1 font-mono-tabular text-stone-300">
                      <div>Damage Dealt: {summary.p2Damage}</div>
                      <div>Max Combo: {summary.p2MaxCombo} hits</div>
                      <div>Strike Accuracy: {summary.p2Accuracy}%</div>
                    </div>
                  </div>
                </div>

                <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
                  <button
                    type="button"
                    onClick={startDuel}
                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-bold text-stone-950 hover:bg-amber-400 transition-colors whitespace-nowrap"
                  >
                    <RotateCcw className="h-4 w-4" />
                    <span>Play Again</span>
                  </button>
                  <button
                    type="button"
                    onClick={returnToMenu}
                    className="flex-1 rounded-lg border border-stone-700 bg-stone-800 px-4 py-2.5 text-sm font-semibold text-stone-200 hover:bg-stone-700 transition-colors whitespace-nowrap"
                  >
                    Change Loadout
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Move List Drawer Overlay */}
          {showMoveList && gameState === 'PLAYING' && (
            <div className="absolute inset-y-0 right-0 z-20 w-72 border-l border-stone-800 bg-stone-950/95 p-4 backdrop-blur-sm">
              <div className="flex items-center justify-between border-b border-stone-800 pb-3">
                <h3 className="font-display text-sm font-bold tracking-wider text-stone-100">
                  COMBAT TECHNIQUES
                </h3>
                <button
                  type="button"
                  onClick={() => setShowMoveList(false)}
                  className="rounded p-1 text-stone-400 hover:bg-stone-800 hover:text-stone-100"
                  aria-label="Close move list"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-3 space-y-2.5 text-xs">
                <div className="flex justify-between text-stone-300">
                  <span>Quick Strike</span>
                  <span className="font-mono-tabular text-amber-300">J / Z</span>
                </div>
                <div className="flex justify-between text-stone-300">
                  <span>Overhead Cleave</span>
                  <span className="font-mono-tabular text-amber-300">K / X</span>
                </div>
                <div className="flex justify-between text-stone-300">
                  <span>Roundhouse Kick</span>
                  <span className="font-mono-tabular text-amber-300">U / C</span>
                </div>
                <div className="flex justify-between text-stone-300">
                  <span>Iron Low Sweep</span>
                  <span className="font-mono-tabular text-amber-300">S + U</span>
                </div>
                <div className="flex justify-between text-stone-300">
                  <span>Flying Air Strike</span>
                  <span className="font-mono-tabular text-amber-300">Jump + J/K/U</span>
                </div>
                <div className="flex justify-between text-stone-300">
                  <span>Shadow Tempest (100%)</span>
                  <span className="font-mono-tabular text-amber-300">L / V</span>
                </div>
                <div className="flex justify-between text-stone-300">
                  <span>Dash Step</span>
                  <span className="font-mono-tabular text-amber-300">Q / E or 2× A/D</span>
                </div>
                <div className="flex justify-between text-stone-300">
                  <span>High / Low Guard</span>
                  <span className="font-mono-tabular text-amber-300">Hold Back / S+Back</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Utility Control Bar Below Arena */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-stone-800/80 bg-stone-950/90 px-4 py-2.5 text-xs">
          <div className="flex items-center gap-3 text-stone-400">
            <span className="font-medium text-stone-200">{currentArena.name}</span>
            <span aria-hidden="true">·</span>
            <span className="hidden md:inline">
              {mode === 'LOCAL_VERSUS'
                ? 'P1: WASD + J/K/U/L · P2: Arrows + 1/2/3/4'
                : 'A/D Move · W Jump · S Crouch · J Light · K Heavy · U Kick · L Shadow · Hold Back to Parry'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowTouchPad((v) => !v)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 font-medium transition-colors whitespace-nowrap ${
                showTouchPad
                  ? 'border-amber-500/60 bg-amber-500/15 text-amber-200'
                  : 'border-stone-800 bg-stone-900 text-stone-300 hover:text-stone-100'
              }`}
            >
              <Gamepad2 className="h-3.5 w-3.5" />
              <span>On-Screen Pad</span>
            </button>
            <button
              type="button"
              onClick={() => setShowMoveList((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-stone-800 bg-stone-900 px-3 py-1.5 font-medium text-stone-300 hover:text-stone-100 transition-colors whitespace-nowrap"
            >
              <BookOpen className="h-3.5 w-3.5" />
              <span>Moves</span>
            </button>
            <button
              type="button"
              onClick={toggleMute}
              className="inline-flex items-center gap-1.5 rounded-lg border border-stone-800 bg-stone-900 px-3 py-1.5 font-medium text-stone-300 hover:text-stone-100 transition-colors whitespace-nowrap"
            >
              {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
              <span>{muted ? 'Muted' : 'Audio'}</span>
            </button>
            <button
              type="button"
              onClick={() => setGameState(gameState === 'PAUSED' ? 'PLAYING' : 'PAUSED')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-stone-700 bg-stone-800 px-3 py-1.5 font-semibold text-stone-100 hover:bg-stone-700 transition-colors whitespace-nowrap"
            >
              <Pause className="h-3.5 w-3.5" />
              <span>Pause</span>
            </button>
          </div>
        </div>

        {/* Optional On-Screen Touch/Mouse Pad */}
        {showTouchPad && (
          <TouchControls onControlChange={handleTouchControl} shadowReady={hud.p1Shadow >= 100} />
        )}
      </div>
    </div>
  );
}
