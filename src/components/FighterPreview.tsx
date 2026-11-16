import { useEffect, useRef } from 'react';
import { ARENAS, NEUTRAL_POSES } from '../game/moves';
import { computeSkeleton, renderFighter } from '../game/skeleton';
import { ArenaId, Fighter, HeadgearId, WeaponId } from '../game/types';

interface FighterPreviewProps {
  weapon: WeaponId;
  headgear: HeadgearId;
  arenaId: ArenaId;
}

export function FighterPreview({ weapon, headgear, arenaId }: FighterPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const arena = ARENAS.find((a) => a.id === arenaId) ?? ARENAS[0];
    let animId = 0;
    const start = performance.now();

    const fighter: Fighter = {
      id: 1,
      name: 'Shadow',
      weapon,
      headgear,
      x: 150,
      y: 0,
      vx: 0,
      vy: 0,
      facing: 1,
      hp: 100,
      maxHp: 100,
      trailHp: 100,
      shadowEnergy: 0,
      action: 'IDLE',
      actionTimer: 0,
      actionDuration: 0,
      currentPose: { ...NEUTRAL_POSES.IDLE },
      hasHitThisAction: false,
      hitStunTimer: 0,
      comboCount: 0,
      comboDamage: 0,
      comboResetTimer: 0,
      scarfNodes: Array.from({ length: 6 }, (_, i) => ({ x: 140 - i * 9, y: 80 + i * 2 })),
      slashHistory: [],
      aiCooldown: 0,
      aiDesiredRange: 100,
      roundsWon: 0,
      damageDealt: 0,
      maxCombo: 0,
      hitsLanded: 0,
      attacksThrown: 0,
      powerMultiplier: 2,
    };

    const tick = (now: number) => {
      const t = (now - start) / 1000;
      const breathe = Math.sin(t * 3.2);
      fighter.weapon = weapon;
      fighter.headgear = headgear;
      fighter.currentPose = {
        ...NEUTRAL_POSES.IDLE,
        hipOffsetY: NEUTRAL_POSES.IDLE.hipOffsetY + breathe * 2.5,
        upperArmF: NEUTRAL_POSES.IDLE.upperArmF + breathe * 3.5,
        forearmF: NEUTRAL_POSES.IDLE.forearmF + breathe * 2.5,
      };

      const groundY = 232;
      const skel = computeSkeleton(fighter, groundY);
      fighter.scarfNodes[0] = { x: skel.head.x - 8, y: skel.head.y + 2 };
      for (let i = 1; i < fighter.scarfNodes.length; i++) {
        const prev = fighter.scarfNodes[i - 1];
        const curr = fighter.scarfNodes[i];
        curr.x -= (28 + Math.sin(t * 5 + i) * 14) * 0.016;
        curr.y += 18 * 0.016;
        const dx = curr.x - prev.x;
        const dy = curr.y - prev.y;
        const dist = Math.hypot(dx, dy) || 1;
        curr.x = prev.x + (dx / dist) * 9;
        curr.y = prev.y + (dy / dist) * 9;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Soft radial backlight behind silhouette
      const glow = ctx.createRadialGradient(150, 140, 12, 150, 140, 130);
      glow.addColorStop(0, arena.rimColor);
      glow.addColorStop(0.55, arena.ambientGlow);
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      renderFighter(ctx, fighter, groundY, arena, skel);
      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [weapon, headgear, arenaId]);

  return (
    <canvas
      ref={canvasRef}
      width={300}
      height={255}
      className="h-[220px] w-[260px] sm:h-[255px] sm:w-[300px]"
      aria-label="Fighter silhouette preview"
    />
  );
}
