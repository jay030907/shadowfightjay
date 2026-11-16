import { WEAPONS } from '../game/moves';
import { HudSnapshot, WeaponId } from '../game/types';

interface ArenaHudProps {
  hud: HudSnapshot;
  p1Name: string;
  p2Name: string;
  p1Weapon: WeaponId;
  p2Weapon: WeaponId;
  isPractice: boolean;
}

export function ArenaHud({
  hud,
  p1Name,
  p2Name,
  p1Weapon,
  p2Weapon,
  isPractice,
}: ArenaHudProps) {
  const p1Pct = Math.max(0, Math.min(100, (hud.p1Hp / hud.p1MaxHp) * 100));
  const p1TrailPct = Math.max(0, Math.min(100, (hud.p1TrailHp / hud.p1MaxHp) * 100));
  const p2Pct = Math.max(0, Math.min(100, (hud.p2Hp / hud.p2MaxHp) * 100));
  const p2TrailPct = Math.max(0, Math.min(100, (hud.p2TrailHp / hud.p2MaxHp) * 100));

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-col justify-between p-3 sm:p-5">
      {/* Top Health & Timer Strip */}
      <div className="flex items-start justify-between gap-3 sm:gap-5">
        {/* Player 1 */}
        <div className="flex-1 min-w-0">
          <div className="mb-1.5 flex items-baseline justify-between gap-2 text-xs sm:text-sm">
            <div className="flex items-center gap-2 min-w-0 truncate">
              <span className="font-display font-bold tracking-wider text-stone-100 truncate">
                {p1Name}
              </span>
              <span className="hidden sm:inline text-stone-400">·</span>
              <span className="hidden sm:inline text-xs text-stone-400 truncate">
                {WEAPONS[p1Weapon].name}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="font-mono-tabular text-[11px] sm:text-xs text-stone-300">
                HP {Math.ceil(hud.p1Hp)}/{hud.p1MaxHp}
              </span>
              {!isPractice && (
                <div className="flex items-center gap-1" aria-label={`Player 1 rounds won: ${hud.p1Rounds}`}>
                  {[0, 1].map((idx) => (
                    <span
                      key={idx}
                      className={`h-2.5 w-2.5 rotate-45 border transition-colors ${
                        hud.p1Rounds > idx
                          ? 'border-amber-300 bg-amber-400'
                          : 'border-stone-500 bg-stone-900/80'
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* P1 Health Bar */}
          <div className="relative h-3.5 sm:h-4 w-full overflow-hidden border border-stone-700/80 bg-stone-950/85">
            <div
              className="absolute inset-y-0 right-0 bg-stone-200/85 transition-all duration-100"
              style={{ width: `${p1TrailPct}%` }}
            />
            <div
              className="absolute inset-y-0 right-0 bg-gradient-to-l from-amber-500 to-red-600 transition-all duration-75"
              style={{ width: `${p1Pct}%` }}
            />
          </div>

          {/* P1 Shadow Energy */}
          <div className="mt-1.5 flex items-center gap-2">
            <div className="relative h-1.5 flex-1 overflow-hidden bg-stone-950/80 border border-stone-800">
              <div
                className={`h-full transition-all duration-100 ${
                  hud.p1Shadow >= 100 ? 'bg-amber-400' : 'bg-amber-600/85'
                }`}
                style={{ width: `${Math.min(100, hud.p1Shadow)}%` }}
              />
            </div>
            <span
              className={`font-mono-tabular text-[10px] tracking-wider whitespace-nowrap ${
                hud.p1Shadow >= 100 ? 'text-amber-300 font-bold' : 'text-stone-400'
              }`}
            >
              {hud.p1Shadow >= 100 ? 'SHADOW READY [L]' : `${Math.floor(hud.p1Shadow)}%`}
            </span>
          </div>
        </div>

        {/* Center Timer */}
        <div className="flex flex-col items-center justify-center px-2 sm:px-3 pt-0.5 shrink-0">
          <span className="font-mono-tabular text-2xl sm:text-3xl font-bold leading-none text-stone-100 drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]">
            {isPractice ? '∞' : String(hud.roundTimer).padStart(2, '0')}
          </span>
          <span className="mt-1 text-[10px] sm:text-xs font-medium tracking-widest text-stone-300 uppercase whitespace-nowrap">
            {isPractice ? 'Practice' : `Round ${hud.roundNumber}`}
          </span>
        </div>

        {/* Player 2 */}
        <div className="flex-1 min-w-0">
          <div className="mb-1.5 flex items-baseline justify-between gap-2 text-xs sm:text-sm">
            <div className="flex items-center gap-2 shrink-0">
              {!isPractice && (
                <div className="flex items-center gap-1" aria-label={`Player 2 rounds won: ${hud.p2Rounds}`}>
                  {[0, 1].map((idx) => (
                    <span
                      key={idx}
                      className={`h-2.5 w-2.5 rotate-45 border transition-colors ${
                        hud.p2Rounds > idx
                          ? 'border-red-300 bg-red-500'
                          : 'border-stone-500 bg-stone-900/80'
                      }`}
                    />
                  ))}
                </div>
              )}
              <span className="font-mono-tabular text-[11px] sm:text-xs text-stone-300">
                HP {Math.ceil(hud.p2Hp)}/{hud.p2MaxHp}
              </span>
            </div>
            <div className="flex items-center justify-end gap-2 min-w-0 truncate">
              <span className="hidden sm:inline text-xs text-stone-400 truncate">
                {WEAPONS[p2Weapon].name}
              </span>
              <span className="hidden sm:inline text-stone-400">·</span>
              <span className="font-display font-bold tracking-wider text-stone-100 truncate">
                {p2Name}
              </span>
            </div>
          </div>

          {/* P2 Health Bar */}
          <div className="relative h-3.5 sm:h-4 w-full overflow-hidden border border-stone-700/80 bg-stone-950/85">
            <div
              className="absolute inset-y-0 left-0 bg-stone-200/85 transition-all duration-100"
              style={{ width: `${p2TrailPct}%` }}
            />
            <div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-red-600 to-rose-500 transition-all duration-75"
              style={{ width: `${p2Pct}%` }}
            />
          </div>

          {/* P2 Shadow Energy */}
          <div className="mt-1.5 flex items-center gap-2">
            <span
              className={`font-mono-tabular text-[10px] tracking-wider whitespace-nowrap ${
                hud.p2Shadow >= 100 ? 'text-red-300 font-bold' : 'text-stone-400'
              }`}
            >
              {hud.p2Shadow >= 100 ? 'SHADOW READY' : `${Math.floor(hud.p2Shadow)}%`}
            </span>
            <div className="relative h-1.5 flex-1 overflow-hidden bg-stone-950/80 border border-stone-800">
              <div
                className={`ml-auto h-full transition-all duration-100 ${
                  hud.p2Shadow >= 100 ? 'bg-red-400' : 'bg-red-700/85'
                }`}
                style={{ width: `${Math.min(100, hud.p2Shadow)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Combo Indicators */}
      <div className="mt-5 flex justify-between">
        <div>
          {hud.p1Combo >= 2 && (
            <div className="drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
              <div className="font-display text-xl sm:text-2xl font-extrabold text-amber-300">
                {hud.p1Combo} HIT COMBO
              </div>
              <div className="font-mono-tabular text-xs text-stone-200">
                {hud.p1ComboDamage} DMG
              </div>
            </div>
          )}
        </div>
        <div className="text-right">
          {hud.p2Combo >= 2 && (
            <div className="drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
              <div className="font-display text-xl sm:text-2xl font-extrabold text-red-400">
                {hud.p2Combo} HIT COMBO
              </div>
              <div className="font-mono-tabular text-xs text-stone-200">
                {hud.p2ComboDamage} DMG
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Center Callout Banner (Round / Fight / K.O.) */}
      {hud.bannerText && (
        <div className="mt-8 sm:mt-16 flex flex-col items-center justify-center text-center">
          <h2 className="font-display text-4xl sm:text-6xl font-extrabold tracking-[0.14em] text-stone-50 drop-shadow-[0_4px_20px_rgba(0,0,0,0.95)]">
            {hud.bannerText}
          </h2>
          {hud.bannerSubtext && (
            <p className="mt-1.5 text-xs sm:text-sm font-semibold tracking-[0.28em] text-amber-300 drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)]">
              {hud.bannerSubtext}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
