import { WEAPONS } from './moves';
import { ArenaConfig, Fighter, Pose } from './types';

export interface Point {
  x: number;
  y: number;
}

export interface SkeletonWorld {
  hip: Point;
  chest: Point;
  shoulder: Point;
  head: Point;
  elbowF: Point;
  handF: Point;
  elbowB: Point;
  handB: Point;
  kneeF: Point;
  ankleF: Point;
  footF: Point;
  kneeB: Point;
  ankleB: Point;
  footB: Point;
  weaponBaseF: Point;
  weaponTipF: Point;
  weaponBaseB: Point;
  weaponTipB: Point;
  hurtBoxes: Array<{ x: number; y: number; r: number }>;
}

const DEG = Math.PI / 180;

function dirDown(deg: number, facing: 1 | -1): Point {
  const rad = deg * DEG;
  return {
    x: Math.sin(rad) * facing,
    y: Math.cos(rad),
  };
}

function dirUp(deg: number, facing: 1 | -1): Point {
  const rad = deg * DEG;
  return {
    x: Math.sin(rad) * facing,
    y: -Math.cos(rad),
  };
}

function addVec(p: Point, d: Point, len: number): Point {
  return { x: p.x + d.x * len, y: p.y + d.y * len };
}

export function computeSkeleton(fighter: Fighter, groundY: number, poseOverride?: Pose): SkeletonWorld {
  const p = poseOverride ?? fighter.currentPose;
  const f = fighter.facing;
  const scale = 1.06;

  const hip: Point = {
    x: fighter.x + p.hipOffsetX * f * scale,
    y: groundY + fighter.y - 92 * scale + p.hipOffsetY * scale,
  };

  const torsoDir = dirUp(p.torsoLean, f);
  const chest = addVec(hip, torsoDir, 30 * scale);
  const shoulder = addVec(hip, torsoDir, 52 * scale);
  const headDir = dirUp(p.torsoLean + p.headTilt, f);
  const head = addVec(shoulder, headDir, 19 * scale);

  // Front arm
  const uArmFDir = dirDown(p.upperArmF, f);
  const elbowF = addVec(shoulder, uArmFDir, 31 * scale);
  const fArmFDir = dirDown(p.forearmF, f);
  const handF = addVec(elbowF, fArmFDir, 29 * scale);

  // Back arm
  const uArmBDir = dirDown(p.upperArmB, f);
  const elbowB = addVec(shoulder, uArmBDir, 31 * scale);
  const fArmBDir = dirDown(p.forearmB, f);
  const handB = addVec(elbowB, fArmBDir, 29 * scale);

  // Front leg
  const thighFDir = dirDown(p.thighF, f);
  const kneeF = addVec(hip, thighFDir, 45 * scale);
  const shinFDir = dirDown(p.shinF, f);
  const ankleF = addVec(kneeF, shinFDir, 44 * scale);
  const footFDir = dirDown(82, f);
  const footF = addVec(ankleF, footFDir, 17 * scale);

  // Back leg
  const thighBDir = dirDown(p.thighB, f);
  const kneeB = addVec(hip, thighBDir, 45 * scale);
  const shinBDir = dirDown(p.shinB, f);
  const ankleB = addVec(kneeB, shinBDir, 44 * scale);
  const footBDir = dirDown(82, f);
  const footB = addVec(ankleB, footBDir, 17 * scale);

  // Weapons
  const weaponCfg = WEAPONS[fighter.weapon];
  const weaponAngF = p.forearmF + p.weaponRelAngle;
  const weaponDirF = dirDown(weaponAngF, f);
  const weaponBaseF = handF;
  const weaponTipF = addVec(handF, weaponDirF, weaponCfg.reach * scale);

  const weaponAngB = p.forearmB + (p.offhandWeaponRelAngle ?? 15);
  const weaponDirB = dirDown(weaponAngB, f);
  const weaponBaseB = handB;
  const weaponTipB = addVec(handB, weaponDirB, (fighter.weapon === 'sai' ? weaponCfg.reach : 16) * scale);

  const hurtBoxes = [
    { x: head.x, y: head.y, r: 16 * scale },
    { x: shoulder.x, y: shoulder.y, r: 19 * scale },
    { x: chest.x, y: chest.y, r: 18 * scale },
    { x: hip.x, y: hip.y, r: 18 * scale },
    { x: kneeF.x, y: kneeF.y, r: 12 * scale },
  ];

  return {
    hip,
    chest,
    shoulder,
    head,
    elbowF,
    handF,
    elbowB,
    handB,
    kneeF,
    ankleF,
    footF,
    kneeB,
    ankleB,
    footB,
    weaponBaseF,
    weaponTipF,
    weaponBaseB,
    weaponTipB,
    hurtBoxes,
  };
}

function drawTaperedSegment(
  ctx: CanvasRenderingContext2D,
  a: Point,
  b: Point,
  r1: number,
  r2: number
) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < 0.01) return;
  const nx = -dy / len;
  const ny = dx / len;

  ctx.beginPath();
  ctx.moveTo(a.x + nx * r1, a.y + ny * r1);
  ctx.lineTo(b.x + nx * r2, b.y + ny * r2);
  ctx.arc(b.x, b.y, r2, Math.atan2(ny, nx), Math.atan2(-ny, -nx), false);
  ctx.lineTo(a.x - nx * r1, a.y - ny * r1);
  ctx.arc(a.x, a.y, r1, Math.atan2(-ny, -nx), Math.atan2(ny, nx), false);
  ctx.closePath();
  ctx.fill();
}

function drawWeapon(
  ctx: CanvasRenderingContext2D,
  fighter: Fighter,
  base: Point,
  tip: Point,
  isOffhand: boolean,
  rimColor: string
) {
  const dx = tip.x - base.x;
  const dy = tip.y - base.y;
  const len = Math.hypot(dx, dy);
  if (len < 1) return;
  const ux = dx / len;
  const uy = dy / len;
  const nx = -uy * fighter.facing;
  const ny = ux * fighter.facing;

  if (fighter.weapon === 'unarmed') {
    return;
  }

  if (fighter.weapon === 'katana') {
    if (isOffhand) return;
    // Handle (tsuka) extending slightly behind hand
    const hiltStart = { x: base.x - ux * 16, y: base.y - uy * 16 };
    const guardPos = { x: base.x + ux * 6, y: base.y + uy * 6 };
    ctx.strokeStyle = '#050507';
    ctx.lineWidth = 4.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(hiltStart.x, hiltStart.y);
    ctx.lineTo(guardPos.x, guardPos.y);
    ctx.stroke();

    // Tsuba (guard)
    ctx.strokeStyle = '#050507';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(guardPos.x - nx * 8, guardPos.y - ny * 8);
    ctx.lineTo(guardPos.x + nx * 8, guardPos.y + ny * 8);
    ctx.stroke();

    // Curved katana blade
    const mid = {
      x: (guardPos.x + tip.x) * 0.5 - nx * 4,
      y: (guardPos.y + tip.y) * 0.5 - ny * 4,
    };
    ctx.fillStyle = '#050507';
    ctx.beginPath();
    ctx.moveTo(guardPos.x - nx * 2.4, guardPos.y - ny * 2.4);
    ctx.quadraticCurveTo(mid.x - nx * 2.2, mid.y - ny * 2.2, tip.x, tip.y);
    ctx.quadraticCurveTo(mid.x + nx * 2.2, mid.y + ny * 2.2, guardPos.x + nx * 2.4, guardPos.y + ny * 2.4);
    ctx.closePath();
    ctx.fill();

    // Crisp rim highlight along sharp edge
    ctx.strokeStyle = rimColor;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(guardPos.x - nx * 2.4, guardPos.y - ny * 2.4);
    ctx.quadraticCurveTo(mid.x - nx * 2.2, mid.y - ny * 2.2, tip.x, tip.y);
    ctx.stroke();
    return;
  }

  if (fighter.weapon === 'sai') {
    const hiltStart = { x: base.x - ux * 10, y: base.y - uy * 10 };
    const guardPos = { x: base.x + ux * 4, y: base.y + uy * 4 };
    ctx.fillStyle = '#050507';
    ctx.strokeStyle = '#050507';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(hiltStart.x, hiltStart.y);
    ctx.lineTo(tip.x, tip.y);
    ctx.stroke();

    // Pronged guard
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(guardPos.x - nx * 9 + ux * 8, guardPos.y - ny * 9 + uy * 8);
    ctx.quadraticCurveTo(guardPos.x - nx * 8, guardPos.y - ny * 8, guardPos.x + nx * 8, guardPos.y + ny * 8);
    ctx.lineTo(guardPos.x + nx * 9 + ux * 8, guardPos.y + ny * 9 + uy * 8);
    ctx.stroke();

    ctx.strokeStyle = rimColor;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(guardPos.x, guardPos.y);
    ctx.lineTo(tip.x, tip.y);
    ctx.stroke();
    return;
  }

  if (fighter.weapon === 'naginata') {
    if (isOffhand) return;
    // Long shaft extending back behind hand
    const shaftButt = { x: base.x - ux * 58, y: base.y - uy * 58 };
    const bladeStart = { x: base.x + ux * (len * 0.62), y: base.y + uy * (len * 0.62) };

    ctx.strokeStyle = '#050507';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(shaftButt.x, shaftButt.y);
    ctx.lineTo(bladeStart.x, bladeStart.y);
    ctx.stroke();

    // Curved glaive blade
    const mid = {
      x: (bladeStart.x + tip.x) * 0.5 - nx * 5,
      y: (bladeStart.y + tip.y) * 0.5 - ny * 5,
    };
    ctx.fillStyle = '#050507';
    ctx.beginPath();
    ctx.moveTo(bladeStart.x - nx * 3, bladeStart.y - ny * 3);
    ctx.quadraticCurveTo(mid.x - nx * 3.5, mid.y - ny * 3.5, tip.x, tip.y);
    ctx.quadraticCurveTo(mid.x + nx * 4, mid.y + ny * 4, bladeStart.x + nx * 3.5, bladeStart.y + ny * 3.5);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = rimColor;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(bladeStart.x - nx * 3, bladeStart.y - ny * 3);
    ctx.quadraticCurveTo(mid.x - nx * 3.5, mid.y - ny * 3.5, tip.x, tip.y);
    ctx.stroke();
  }
}

function drawHeadgear(
  ctx: CanvasRenderingContext2D,
  fighter: Fighter,
  skel: SkeletonWorld,
  rimColor: string
) {
  const { head, shoulder } = skel;
  const f = fighter.facing;
  const dx = head.x - shoulder.x;
  const dy = head.y - shoulder.y;
  const headAngle = Math.atan2(dy, dx) + Math.PI / 2;

  ctx.save();
  ctx.translate(head.x, head.y);
  ctx.rotate(headAngle);

  ctx.fillStyle = '#050507';
  if (fighter.headgear === 'ronin_hat') {
    // Wide bamboo kasa hat
    ctx.beginPath();
    ctx.moveTo(-36, -3);
    ctx.quadraticCurveTo(0, -24, 36, -3);
    ctx.quadraticCurveTo(0, -9, -36, -3);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = rimColor;
    ctx.lineWidth = 1.2;
    ctx.stroke();
  } else if (fighter.headgear === 'oni_crest') {
    // Samurai kabuto & crescent horns
    ctx.beginPath();
    ctx.arc(0, -2, 16, Math.PI, 0);
    ctx.lineTo(18, 5);
    ctx.lineTo(-18, 5);
    ctx.closePath();
    ctx.fill();
    // Horns
    ctx.beginPath();
    ctx.moveTo(4 * f, -14);
    ctx.quadraticCurveTo(16 * f, -28, 12 * f, -34);
    ctx.quadraticCurveTo(9 * f, -22, 0, -15);
    ctx.fill();
    ctx.strokeStyle = rimColor;
    ctx.lineWidth = 1.1;
    ctx.stroke();
  } else if (fighter.headgear === 'shinobi_hood') {
    // Sleek cowl collar
    ctx.beginPath();
    ctx.arc(0, 0, 15.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Subtle glowing eye slit so facing is unmistakably sharp
  ctx.fillStyle = fighter.id === 1 ? 'rgba(254, 243, 199, 0.92)' : 'rgba(252, 165, 165, 0.92)';
  ctx.beginPath();
  ctx.moveTo(6 * f, -3);
  ctx.lineTo(12.5 * f, -4.5);
  ctx.lineTo(11 * f, -1.2);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

export function renderFighter(
  ctx: CanvasRenderingContext2D,
  fighter: Fighter,
  groundY: number,
  arena: ArenaConfig,
  skel: SkeletonWorld
) {
  const isShadowActive = fighter.action === 'SHADOW_STRIKE';

  // 1. Ground contact shadow
  const airScale = Math.max(0.4, 1 + fighter.y / 220);
  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.beginPath();
  ctx.ellipse(fighter.x, groundY + 4, 40 * airScale, 9 * airScale, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 2. Render sweeping weapon/limb slash trails behind fighter
  if (fighter.slashHistory.length >= 2) {
    ctx.save();
    for (let i = 1; i < fighter.slashHistory.length; i++) {
      const prev = fighter.slashHistory[i - 1];
      const curr = fighter.slashHistory[i];
      if (curr.alpha <= 0.02) continue;

      ctx.fillStyle = curr.color;
      ctx.globalAlpha = curr.alpha * 0.42;
      ctx.beginPath();
      ctx.moveTo(prev.baseX, prev.baseY);
      ctx.lineTo(prev.tipX, prev.tipY);
      ctx.lineTo(curr.tipX, curr.tipY);
      ctx.lineTo(curr.baseX, curr.baseY);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = '#ffffff';
      ctx.globalAlpha = curr.alpha * 0.78;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(prev.tipX, prev.tipY);
      ctx.lineTo(curr.tipX, curr.tipY);
      ctx.stroke();
    }
    ctx.restore();
  }

  ctx.save();

  // Subtle rim aura on shadow strike
  if (isShadowActive) {
    ctx.shadowColor = fighter.id === 1 ? '#f59e0b' : '#ef4444';
    ctx.shadowBlur = 18;
  } else {
    ctx.shadowColor = arena.rimColor;
    ctx.shadowBlur = 2.5;
  }

  // Flowing headband / scarf ribbon (behind body)
  if (fighter.scarfNodes.length > 1) {
    ctx.strokeStyle = fighter.id === 1 ? '#09090c' : '#14080a';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let i = 0; i < fighter.scarfNodes.length - 1; i++) {
      const n1 = fighter.scarfNodes[i];
      const n2 = fighter.scarfNodes[i + 1];
      ctx.lineWidth = Math.max(2, 6.5 - i * 0.9);
      ctx.beginPath();
      ctx.moveTo(n1.x, n1.y);
      ctx.lineTo(n2.x, n2.y);
      ctx.stroke();
    }
  }

  const silhouette = '#050507';
  const rim = isShadowActive ? (fighter.id === 1 ? '#fbbf24' : '#f87171') : arena.rimColor;

  // 3. Back Arm + Offhand weapon (rendered behind torso)
  ctx.fillStyle = silhouette;
  drawTaperedSegment(ctx, skel.shoulder, skel.elbowB, 8.5, 6.5);
  drawTaperedSegment(ctx, skel.elbowB, skel.handB, 6.5, 4.8);
  drawWeapon(ctx, fighter, skel.weaponBaseB, skel.weaponTipB, true, rim);

  // 4. Back Leg (hakama-styled wider thigh tapering cleanly to ankle)
  ctx.fillStyle = silhouette;
  drawTaperedSegment(ctx, skel.hip, skel.kneeB, 14, 11);
  drawTaperedSegment(ctx, skel.kneeB, skel.ankleB, 11, 5.5);
  drawTaperedSegment(ctx, skel.ankleB, skel.footB, 5.2, 3.8);

  // 5. Torso & Waist Sash
  drawTaperedSegment(ctx, skel.hip, skel.chest, 13.5, 15);
  drawTaperedSegment(ctx, skel.chest, skel.shoulder, 15, 16.5);

  // Subtle rim edge on back/shoulder for silhouette separation
  ctx.strokeStyle = rim;
  ctx.lineWidth = 1.25;
  ctx.beginPath();
  ctx.moveTo(skel.hip.x - fighter.facing * 12, skel.hip.y);
  ctx.lineTo(skel.shoulder.x - fighter.facing * 14, skel.shoulder.y);
  ctx.stroke();

  // 6. Neck & Head
  ctx.fillStyle = silhouette;
  drawTaperedSegment(ctx, skel.shoulder, skel.head, 7.5, 7);
  ctx.beginPath();
  ctx.arc(skel.head.x, skel.head.y, 13.5, 0, Math.PI * 2);
  ctx.fill();

  drawHeadgear(ctx, fighter, skel, rim);

  // 7. Front Leg
  ctx.fillStyle = silhouette;
  drawTaperedSegment(ctx, skel.hip, skel.kneeF, 14.5, 11.5);
  drawTaperedSegment(ctx, skel.kneeF, skel.ankleF, 11.5, 5.8);
  drawTaperedSegment(ctx, skel.ankleF, skel.footF, 5.5, 4);

  // 8. Front Arm & Main Weapon
  ctx.fillStyle = silhouette;
  drawTaperedSegment(ctx, skel.shoulder, skel.elbowF, 9, 6.8);
  drawTaperedSegment(ctx, skel.elbowF, skel.handF, 6.8, 5);
  drawWeapon(ctx, fighter, skel.weaponBaseF, skel.weaponTipF, false, rim);

  // Subtle colored waist obi sash accent (only thin subtle martial-arts cue to distinguish P1 vs P2 in mirror matches)
  ctx.strokeStyle = fighter.id === 1 ? 'rgba(245, 158, 11, 0.72)' : 'rgba(220, 38, 38, 0.75)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(skel.hip.x - 11, skel.hip.y - 6);
  ctx.lineTo(skel.hip.x + 11, skel.hip.y - 6);
  ctx.stroke();

  ctx.restore();
}
