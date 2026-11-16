import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Flame, Footprints, Sword, Swords } from 'lucide-react';
import { PlayerInputState } from '../game/engine';

interface TouchControlsProps {
  onControlChange: (key: keyof PlayerInputState, pressed: boolean) => void;
  shadowReady: boolean;
}

export function TouchControls({ onControlChange, shadowReady }: TouchControlsProps) {
  const bindHold = (key: keyof PlayerInputState) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      onControlChange(key, true);
    },
    onPointerUp: (e: React.PointerEvent) => {
      e.preventDefault();
      onControlChange(key, false);
    },
    onPointerLeave: () => onControlChange(key, false),
    onPointerCancel: () => onControlChange(key, false),
  });

  const btnBase =
    'select-none touch-none flex items-center justify-center rounded-lg border border-stone-700 bg-stone-900/90 text-stone-100 active:scale-95 active:bg-stone-800 transition-transform';

  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-stone-800/90 bg-stone-950/85 px-4 py-3">
      {/* Movement D-Pad */}
      <div className="grid grid-cols-3 gap-1.5">
        <div />
        <button
          type="button"
          className={`${btnBase} h-11 w-11`}
          aria-label="Jump"
          {...bindHold('up')}
        >
          <ArrowUp className="h-5 w-5" />
        </button>
        <div />
        <button
          type="button"
          className={`${btnBase} h-11 w-11`}
          aria-label="Move Left / Block"
          {...bindHold('left')}
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <button
          type="button"
          className={`${btnBase} h-11 w-11`}
          aria-label="Crouch"
          {...bindHold('down')}
        >
          <ArrowDown className="h-5 w-5" />
        </button>
        <button
          type="button"
          className={`${btnBase} h-11 w-11`}
          aria-label="Move Right / Block"
          {...bindHold('right')}
        >
          <ArrowRight className="h-5 w-5" />
        </button>
      </div>

      {/* Center Dash Buttons */}
      <div className="hidden sm:flex items-center gap-2">
        <button
          type="button"
          className={`${btnBase} h-10 px-3 text-xs font-medium whitespace-nowrap`}
          {...bindHold('dashLeft')}
        >
          Dash Left
        </button>
        <button
          type="button"
          className={`${btnBase} h-10 px-3 text-xs font-medium whitespace-nowrap`}
          {...bindHold('dashRight')}
        >
          Dash Right
        </button>
      </div>

      {/* Combat Actions */}
      <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
        <button
          type="button"
          className={`${btnBase} h-11 px-3.5 gap-1.5 text-xs font-semibold whitespace-nowrap`}
          {...bindHold('light')}
        >
          <Sword className="h-4 w-4 text-amber-300" />
          <span>Light</span>
        </button>
        <button
          type="button"
          className={`${btnBase} h-11 px-3.5 gap-1.5 text-xs font-semibold whitespace-nowrap`}
          {...bindHold('heavy')}
        >
          <Swords className="h-4 w-4 text-red-400" />
          <span>Heavy</span>
        </button>
        <button
          type="button"
          className={`${btnBase} h-11 px-3.5 gap-1.5 text-xs font-semibold whitespace-nowrap`}
          {...bindHold('kick')}
        >
          <Footprints className="h-4 w-4 text-stone-300" />
          <span>Kick</span>
        </button>
        <button
          type="button"
          disabled={!shadowReady}
          className={`select-none touch-none flex h-11 items-center justify-center gap-1.5 rounded-lg border px-3.5 text-xs font-semibold whitespace-nowrap transition-all ${
            shadowReady
              ? 'border-amber-400 bg-amber-500/20 text-amber-200 hover:bg-amber-500/30 active:scale-95'
              : 'border-stone-800 bg-stone-900/50 text-stone-600 cursor-not-allowed'
          }`}
          {...bindHold('shadow')}
        >
          <Flame className="h-4 w-4" />
          <span>Shadow</span>
        </button>
      </div>
    </div>
  );
}
