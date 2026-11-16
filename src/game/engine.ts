import { ARENAS, MOVES, NEUTRAL_POSES, WEAPONS, lerpPose, sampleKeyframes } from './moves';
import { SkeletonWorld, computeSkeleton, renderFighter } from './skeleton';
import { soundEngine } from './sound';
import {
  ArenaConfig,
  ArenaId,
  Difficulty,
  Fighter,
  FighterAction,
  GameMode,
  HeadgearId,
  HitPopup,
  HudSnapshot,
  MatchSummary,
  MoveDefinition,
  Particle,
  Pose,
  WeaponId,
} from './types';

export const STAGE_WIDTH = 1280;
export const STAGE_HEIGHT = 720;
export const GROUND_Y = 598;
export const STAGE_LEFT = 95;
export const STAGE_RIGHT = 1185;

export interface PlayerInputState {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  light: boolean;
  heavy: boolean;
  kick: boolean;
  shadow: boolean;
  dashLeft: boolean;
  dashRight: boolean;
}

export interface MatchConfig {
  mode: GameMode;
  difficulty: Difficulty;
  arenaId: ArenaId;
  p1Weapon: WeaponId;
  p1Headgear: HeadgearId;
  p2Weapon: WeaponId;
  p2Headgear: HeadgearId;
}

function emptyInput(): PlayerInputState {
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

function pointToSegmentDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const abx = bx - ax;
  const aby = by - ay;
  const lenSq = abx * abx + aby * aby;
  if (lenSq < 0.0001) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * abx + (py - ay) * aby) / lenSq));
  const cx = ax + abx * t;
  const cy = ay + aby * t;
  return Math.hypot(px - cx, py - cy);
}

function createFighter(
  id: 1 | 2,
  name: string,
  weapon: WeaponId,
  headgear: HeadgearId,
  x: number,
  facing: 1 | -1
): Fighter {
  const powerMultiplier = id === 1 ? 2 : 1;
  const maxHp = 100 * powerMultiplier;
  const scarfNodes = Array.from({ length: 6 }, (_, i) => ({
    x: x - facing * i * 9,
    y: GROUND_Y - 150 + i * 2,
  }));
  return {
    id,
    name,
    weapon,
    headgear,
    x,
    y: 0,
    vx: 0,
    vy: 0,
    facing,
    hp: maxHp,
    maxHp,
    trailHp: maxHp,
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
    scarfNodes,
    slashHistory: [],
    aiCooldown: 0.35,
    aiDesiredRange: WEAPONS[weapon].reach + 28,
    roundsWon: 0,
    damageDealt: 0,
    maxCombo: 0,
    hitsLanded: 0,
    attacksThrown: 0,
    powerMultiplier,
  };
}

export class ShadowFightEngine {
  public config: MatchConfig;
  public arena: ArenaConfig;
  public p1: Fighter;
  public p2: Fighter;
  public roundNumber = 1;
  public roundTimer = 99;
  public roundPhase: 'INTRO' | 'FIGHT' | 'KO_SLOWMO' | 'ROUND_END' = 'INTRO';
  public phaseTimer = 1.6;
  public hitStopTimer = 0;
  public screenShake = 0;
  public shadowFlashTimer = 0;
  public timeScale = 1;
  public bannerText: string | null = 'ROUND 1';
  public bannerSubtext: string | null = 'PREPARE';
  public particles: Particle[] = [];
  public popups: HitPopup[] = [];

  private bgImage: HTMLImageElement | null = null;
  private bgLoaded = false;
  private camX = STAGE_WIDTH / 2;
  private camZoom = 1;
  private elapsed = 0;

  private p1Input: PlayerInputState = emptyInput();
  private p2Input: PlayerInputState = emptyInput();
  private p1PrevInput: PlayerInputState = emptyInput();
  private p2PrevInput: PlayerInputState = emptyInput();

  private onMatchComplete?: (summary: MatchSummary) => void;
  private matchFinished = false;

  constructor(config: MatchConfig, onMatchComplete?: (summary: MatchSummary) => void) {
    this.config = config;
    this.arena = ARENAS.find((a) => a.id === config.arenaId) ?? ARENAS[0];
    this.onMatchComplete = onMatchComplete;

    const p2Name =
      config.mode === 'LOCAL_VERSUS'
        ? 'Player 2'
        : config.mode === 'PRACTICE'
        ? 'Wooden Master'
        : config.difficulty === 'EXPERT'
        ? 'Kage-Oni'
        : config.difficulty === 'HARD'
        ? 'Crimson Ronin'
        : config.difficulty === 'MEDIUM'
        ? 'Shadow Disciple'
        : 'Dojo Initiate';

    this.p1 = createFighter(1, 'Shadow', config.p1Weapon, config.p1Headgear, 420, 1);
    this.p2 = createFighter(2, p2Name, config.p2Weapon, config.p2Headgear, 860, -1);

    this.loadArenaImage();
    this.seedAmbientParticles();
    soundEngine.playGong(false);
  }

  private loadArenaImage() {
    if (typeof Image === 'undefined') return;
    const img = new Image();
    img.src = this.arena.imagePath;
    img.onload = () => {
      this.bgLoaded = true;
    };
    this.bgImage = img;
  }

  private seedAmbientParticles() {
    this.particles = [];
    for (let i = 0; i < 28; i++) {
      this.particles.push({
        x: Math.random() * STAGE_WIDTH,
        y: Math.random() * STAGE_HEIGHT,
        vx: (Math.random() - 0.5) * 26,
        vy: this.arena.particleKind === 'embers' ? -18 - Math.random() * 25 : 14 + Math.random() * 20,
        size: 2 + Math.random() * 3.5,
        alpha: 0.25 + Math.random() * 0.5,
        decay: 0,
        color: this.arena.particleColor,
        kind: 'ambient',
      });
    }
  }

  public setInputs(p1: PlayerInputState, p2: PlayerInputState) {
    this.p1Input = { ...p1 };
    this.p2Input = { ...p2 };
  }

  public startNextRound() {
    this.roundNumber += 1;
    this.roundTimer = 99;
    this.roundPhase = 'INTRO';
    this.phaseTimer = 1.65;
    this.timeScale = 1;
    this.hitStopTimer = 0;
    this.bannerText = `ROUND ${this.roundNumber}`;
    this.bannerSubtext = 'READY';

    const p1Rounds = this.p1.roundsWon;
    const p2Rounds = this.p2.roundsWon;
    const p1Dmg = this.p1.damageDealt;
    const p2Dmg = this.p2.damageDealt;
    const p1MaxC = this.p1.maxCombo;
    const p2MaxC = this.p2.maxCombo;
    const p1Hits = this.p1.hitsLanded;
    const p2Hits = this.p2.hitsLanded;
    const p1Atk = this.p1.attacksThrown;
    const p2Atk = this.p2.attacksThrown;

    this.p1 = createFighter(1, this.p1.name, this.p1.weapon, this.p1.headgear, 420, 1);
    this.p2 = createFighter(2, this.p2.name, this.p2.weapon, this.p2.headgear, 860, -1);

    this.p1.roundsWon = p1Rounds;
    this.p2.roundsWon = p2Rounds;
    this.p1.damageDealt = p1Dmg;
    this.p2.damageDealt = p2Dmg;
    this.p1.maxCombo = p1MaxC;
    this.p2.maxCombo = p2MaxC;
    this.p1.hitsLanded = p1Hits;
    this.p2.hitsLanded = p2Hits;
    this.p1.attacksThrown = p1Atk;
    this.p2.attacksThrown = p2Atk;

    soundEngine.playGong(false);
  }

  public update(rawDt: number) {
    const dt = Math.min(rawDt, 0.05);
    this.elapsed += dt;

    if (this.screenShake > 0) {
      this.screenShake = Math.max(0, this.screenShake - dt * 42);
    }
    if (this.shadowFlashTimer > 0) {
      this.shadowFlashTimer = Math.max(0, this.shadowFlashTimer - dt);
    }

    // Update ambient & FX particles even during hitstop for crisp visual juice
    this.updateParticles(dt);
    this.updatePopups(dt);

    if (this.hitStopTimer > 0) {
      this.hitStopTimer -= dt;
      return;
    }

    const simDt = dt * this.timeScale;

    // Round phase transitions
    if (this.roundPhase === 'INTRO') {
      this.phaseTimer -= dt;
      if (this.phaseTimer < 0.55) {
        this.bannerText = 'FIGHT';
        this.bannerSubtext = null;
      }
      if (this.phaseTimer <= 0) {
        this.roundPhase = 'FIGHT';
        this.bannerText = null;
        this.bannerSubtext = null;
      }
      this.updateFighterPoseAndPhysics(this.p1, this.p2, simDt, emptyInput(), emptyInput());
      this.updateFighterPoseAndPhysics(this.p2, this.p1, simDt, emptyInput(), emptyInput());
      this.updateCamera(dt);
      return;
    }

    if (this.roundPhase === 'KO_SLOWMO') {
      this.phaseTimer -= dt;
      this.updateFighterPoseAndPhysics(this.p1, this.p2, simDt, emptyInput(), emptyInput());
      this.updateFighterPoseAndPhysics(this.p2, this.p1, simDt, emptyInput(), emptyInput());
      this.updateCamera(dt);
      if (this.phaseTimer <= 0) {
        this.timeScale = 1;
        this.finalizeRound();
      }
      return;
    }

    if (this.roundPhase === 'ROUND_END') {
      this.phaseTimer -= dt;
      this.updateFighterPoseAndPhysics(this.p1, this.p2, simDt, emptyInput(), emptyInput());
      this.updateFighterPoseAndPhysics(this.p2, this.p1, simDt, emptyInput(), emptyInput());
      this.updateCamera(dt);
      if (this.phaseTimer <= 0 && !this.matchFinished) {
        if (this.p1.roundsWon >= 2 || this.p2.roundsWon >= 2) {
          this.matchFinished = true;
          this.emitMatchSummary();
        } else {
          this.startNextRound();
        }
      }
      return;
    }

    // FIGHT PHASE
    if (this.config.mode !== 'PRACTICE') {
      this.roundTimer = Math.max(0, this.roundTimer - simDt);
      if (this.roundTimer <= 0) {
        this.triggerTimeOver();
        return;
      }
    } else {
      // Practice regeneration
      if (this.p2.hitStunTimer <= 0 && this.p2.action !== 'HIT_STUN' && this.p2.action !== 'KNOCKDOWN') {
        this.p2.hp = Math.min(this.p2.maxHp, this.p2.hp + simDt * 24);
      }
      this.p1.shadowEnergy = Math.min(100, this.p1.shadowEnergy + simDt * 18);
    }

    // Determine AI input for P2 when not Local Versus
    const effectiveP2Input =
      this.config.mode === 'LOCAL_VERSUS'
        ? this.p2Input
        : this.config.mode === 'PRACTICE'
        ? emptyInput()
        : this.computeAiInput(simDt);

    this.updateFighterPoseAndPhysics(this.p1, this.p2, simDt, this.p1Input, this.p1PrevInput);
    this.updateFighterPoseAndPhysics(this.p2, this.p1, simDt, effectiveP2Input, this.p2PrevInput);

    this.p1PrevInput = { ...this.p1Input };
    this.p2PrevInput = { ...effectiveP2Input };

    this.resolvePushbox();
    this.resolveCombatHits();
    this.updateCamera(dt);
  }

  private computeAiInput(dt: number): PlayerInputState {
    const ai = this.p2;
    const opp = this.p1;
    const inp = emptyInput();

    const dx = opp.x - ai.x;
    const dist = Math.abs(dx);
    const dirToOpp = dx >= 0 ? 'right' : 'left';
    const dirAway = dx >= 0 ? 'left' : 'right';

    const oppMove = MOVES[opp.action];
    const oppAttacking = Boolean(oppMove);

    const diff = this.config.difficulty;
    const blockChance =
      diff === 'EXPERT' ? 0.9 : diff === 'HARD' ? 0.74 : diff === 'MEDIUM' ? 0.5 : 0.22;
    const aggression =
      diff === 'EXPERT' ? 0.98 : diff === 'HARD' ? 0.8 : diff === 'MEDIUM' ? 0.56 : 0.3;
    const cooldownScale =
      diff === 'EXPERT' ? 0.65 : diff === 'HARD' ? 0.85 : diff === 'MEDIUM' ? 1.15 : 1.65;

    // Reactive blocking if opponent is swinging nearby
    if (oppAttacking && dist < WEAPONS[opp.weapon].reach + 85) {
      if (Math.random() < blockChance) {
        inp[dirAway] = true;
        if (oppMove?.hitHeight === 'LOW') {
          inp.down = true;
        }
        return inp;
      }
    }

    ai.aiCooldown -= dt;
    const optimalRange = WEAPONS[ai.weapon].reach + 36;

    if (ai.shadowEnergy >= 100 && dist < 250 && ai.aiCooldown <= 0.14) {
      inp.shadow = true;
      ai.aiCooldown = 0.55 * cooldownScale;
      return inp;
    }

    if (dist > optimalRange + 28) {
      inp[dirToOpp] = true;
      if (dist > 300 && Math.random() < 0.04 * aggression) {
        if (dirToOpp === 'left') inp.dashLeft = true;
        else inp.dashRight = true;
      }
    } else if (dist < 42) {
      inp[dirAway] = true;
    }

    if (ai.aiCooldown <= 0 && dist <= optimalRange + 36) {
      const roll = Math.random();
      if (roll < 0.36) {
        inp.light = true;
        ai.aiCooldown = 0.3 * cooldownScale;
      } else if (roll < 0.58) {
        inp.kick = true;
        ai.aiCooldown = 0.38 * cooldownScale;
      } else if (roll < 0.78) {
        inp.down = true;
        inp.kick = true;
        ai.aiCooldown = 0.42 * cooldownScale;
      } else if (roll < 0.94) {
        inp.heavy = true;
        ai.aiCooldown = 0.52 * cooldownScale;
      } else {
        inp.up = true;
        inp[dirToOpp] = true;
        ai.aiCooldown = 0.42 * cooldownScale;
      }
    }

    return inp;
  }

  private startMove(fighter: Fighter, action: FighterAction) {
    const move = MOVES[action];
    if (!move) return;
    const speedMult = action === 'HIGH_KICK' || action === 'LOW_SWEEP' ? 1 : WEAPONS[fighter.weapon].speedMult;
    fighter.action = action;
    fighter.actionTimer = 0;
    fighter.actionDuration = move.duration / speedMult;
    fighter.hasHitThisAction = false;
    fighter.attacksThrown += 1;

    if (action === 'SHADOW_STRIKE') {
      fighter.shadowEnergy = 0;
      this.shadowFlashTimer = 0.42;
      soundEngine.playShadowBurst();
    } else {
      soundEngine.playWhoosh(speedMult);
    }
  }

  private updateFighterPoseAndPhysics(
    fighter: Fighter,
    opponent: Fighter,
    dt: number,
    input: PlayerInputState,
    prevInput: PlayerInputState
  ) {
    // Delayed trail HP smoothly catches up
    if (fighter.trailHp > fighter.hp) {
      fighter.trailHp = Math.max(fighter.hp, fighter.trailHp - dt * 38);
    } else {
      fighter.trailHp = fighter.hp;
    }

    if (fighter.comboResetTimer > 0) {
      fighter.comboResetTimer -= dt;
      if (fighter.comboResetTimer <= 0) {
        fighter.comboCount = 0;
        fighter.comboDamage = 0;
      }
    }

    // Fade slash trails
    for (let i = fighter.slashHistory.length - 1; i >= 0; i--) {
      fighter.slashHistory[i].alpha -= dt * 6.5;
      if (fighter.slashHistory[i].alpha <= 0) {
        fighter.slashHistory.splice(i, 1);
      }
    }

    // Face opponent automatically when grounded & neutral
    const isNeutralState =
      fighter.action === 'IDLE' ||
      fighter.action === 'WALK_FWD' ||
      fighter.action === 'WALK_BACK' ||
      fighter.action === 'CROUCH' ||
      fighter.action === 'BLOCK_HIGH' ||
      fighter.action === 'BLOCK_LOW';

    if (isNeutralState && fighter.y === 0) {
      fighter.facing = opponent.x >= fighter.x ? 1 : -1;
    }

    const justPressed = (k: keyof PlayerInputState) => input[k] && !prevInput[k];
    const holdingBack = (fighter.facing === 1 && input.left) || (fighter.facing === -1 && input.right);
    const holdingFwd = (fighter.facing === 1 && input.right) || (fighter.facing === -1 && input.left);

    // Handle active move / hitstun / knockdown
    if (fighter.action === 'HIT_STUN') {
      fighter.hitStunTimer -= dt;
      fighter.vx *= Math.pow(0.04, dt);
      if (fighter.hitStunTimer <= 0) {
        fighter.action = fighter.y < 0 ? 'JUMP' : 'IDLE';
      }
    } else if (fighter.action === 'KNOCKDOWN') {
      fighter.actionTimer += dt;
      fighter.vx *= Math.pow(0.06, dt);
      if (fighter.y === 0 && fighter.actionTimer >= 0.72 && fighter.hp > 0) {
        fighter.action = 'GET_UP';
        fighter.actionTimer = 0;
        fighter.actionDuration = 0.34;
      }
    } else if (fighter.action === 'GET_UP') {
      fighter.actionTimer += dt;
      if (fighter.actionTimer >= fighter.actionDuration) {
        fighter.action = 'IDLE';
      }
    } else if (fighter.action === 'DASH_FWD' || fighter.action === 'DASH_BACK') {
      fighter.actionTimer += dt;
      if (fighter.actionTimer >= fighter.actionDuration) {
        fighter.action = 'IDLE';
        fighter.vx = 0;
      }
    } else if (MOVES[fighter.action]) {
      fighter.actionTimer += dt;
      const move = MOVES[fighter.action]!;
      const norm = Math.min(1, fighter.actionTimer / fighter.actionDuration);

      if (move.lungeVelocity && norm > 0.14 && norm < 0.56 && fighter.y === 0) {
        fighter.vx = fighter.facing * move.lungeVelocity;
      } else if (fighter.y === 0) {
        fighter.vx *= Math.pow(0.02, dt);
      }

      if (fighter.actionTimer >= fighter.actionDuration) {
        fighter.action = fighter.y < 0 ? 'JUMP' : input.down ? 'CROUCH' : 'IDLE';
        fighter.vx = 0;
      }
    } else if (fighter.action === 'VICTORY') {
      fighter.vx = 0;
    } else {
      // Neutral / Locomotion / Attack Triggers
      if (fighter.y < 0) {
        fighter.action = 'JUMP';
        if (justPressed('light') || justPressed('heavy') || justPressed('kick')) {
          this.startMove(fighter, 'AIR_STRIKE');
        }
      } else {
        if (justPressed('shadow') && fighter.shadowEnergy >= 100) {
          this.startMove(fighter, 'SHADOW_STRIKE');
        } else if (justPressed('dashLeft') || justPressed('dashRight')) {
          const dashDir = justPressed('dashRight') ? 1 : -1;
          fighter.action = dashDir === fighter.facing ? 'DASH_FWD' : 'DASH_BACK';
          fighter.actionTimer = 0;
          fighter.actionDuration = 0.24;
          fighter.vx = dashDir * 560;
          this.spawnDust(fighter.x, GROUND_Y, dashDir);
        } else if (justPressed('heavy')) {
          this.startMove(fighter, 'HEAVY_SLASH');
        } else if (justPressed('light')) {
          this.startMove(fighter, 'LIGHT_SLASH');
        } else if (justPressed('kick')) {
          this.startMove(fighter, input.down ? 'LOW_SWEEP' : 'HIGH_KICK');
        } else if (input.up) {
          fighter.vy = -660;
          fighter.y = -2;
          fighter.vx = holdingFwd ? fighter.facing * 260 : holdingBack ? -fighter.facing * 220 : 0;
          fighter.action = 'JUMP';
          this.spawnDust(fighter.x, GROUND_Y, 0);
        } else if (input.down) {
          fighter.vx = 0;
          const oppAttacking = Boolean(MOVES[opponent.action]);
          fighter.action = holdingBack && oppAttacking ? 'BLOCK_LOW' : 'CROUCH';
        } else if (holdingFwd) {
          fighter.vx = fighter.facing * 255;
          fighter.action = 'WALK_FWD';
        } else if (holdingBack) {
          const oppAttacking = Boolean(MOVES[opponent.action]);
          if (oppAttacking && Math.abs(opponent.x - fighter.x) < 250) {
            fighter.vx = -fighter.facing * 90;
            fighter.action = 'BLOCK_HIGH';
          } else {
            fighter.vx = -fighter.facing * 205;
            fighter.action = 'WALK_BACK';
          }
        } else {
          fighter.vx = 0;
          fighter.action = 'IDLE';
        }
      }
    }

    // Gravity & floor collision
    if (fighter.y < 0 || fighter.vy < 0) {
      fighter.vy += 1720 * dt;
      fighter.y += fighter.vy * dt;
      if (fighter.y >= 0) {
        fighter.y = 0;
        fighter.vy = 0;
        this.spawnDust(fighter.x, GROUND_Y, 0);
        if (fighter.action === 'JUMP' || fighter.action === 'AIR_STRIKE') {
          fighter.action = 'IDLE';
        }
      }
    }

    fighter.x = Math.max(STAGE_LEFT, Math.min(STAGE_RIGHT, fighter.x + fighter.vx * dt));

    // Compute target pose & smoothly blend
    const targetPose = this.getTargetPose(fighter);
    const blendRate = MOVES[fighter.action] ? 26 : 16;
    fighter.currentPose = lerpPose(fighter.currentPose, targetPose, Math.min(1, dt * blendRate));

    // Record weapon/foot trail during active strike frames
    const activeMove = MOVES[fighter.action];
    if (activeMove) {
      const norm = fighter.actionTimer / fighter.actionDuration;
      if (norm >= activeMove.activeStart * 0.75 && norm <= activeMove.activeEnd * 1.05) {
        const skel = computeSkeleton(fighter, GROUND_Y);
        let tip = skel.weaponTipF;
        let base = skel.weaponBaseF;
        if (activeMove.hitSource === 'FOOT_F') {
          tip = skel.footF;
          base = skel.kneeF;
        } else if (fighter.weapon === 'unarmed') {
          tip = skel.handF;
          base = skel.elbowF;
        }
        fighter.slashHistory.push({
          tipX: tip.x,
          tipY: tip.y,
          baseX: base.x,
          baseY: base.y,
          alpha: 1,
          color: fighter.action === 'SHADOW_STRIKE' ? '#f59e0b' : WEAPONS[fighter.weapon].trailColor,
        });
      }
    }

    // Update flowing scarf nodes attached to head
    const skelNow = computeSkeleton(fighter, GROUND_Y);
    fighter.scarfNodes[0] = {
      x: skelNow.head.x - fighter.facing * 8,
      y: skelNow.head.y + 2,
    };
    const windX = -fighter.facing * 35 - fighter.vx * 0.16 + Math.sin(this.elapsed * 5 + fighter.id) * 14;
    for (let i = 1; i < fighter.scarfNodes.length; i++) {
      const prev = fighter.scarfNodes[i - 1];
      const curr = fighter.scarfNodes[i];
      curr.x += windX * dt;
      curr.y += (32 - fighter.vy * 0.08) * dt;
      const dx = curr.x - prev.x;
      const dy = curr.y - prev.y;
      const dist = Math.hypot(dx, dy) || 1;
      const segLen = 9.5;
      curr.x = prev.x + (dx / dist) * segLen;
      curr.y = prev.y + (dy / dist) * segLen;
    }
  }

  private getTargetPose(fighter: Fighter): Pose {
    const move = MOVES[fighter.action];
    if (move) {
      const norm = Math.min(1, fighter.actionTimer / fighter.actionDuration);
      return sampleKeyframes(move.keyframes, norm);
    }

    if (fighter.action === 'WALK_FWD' || fighter.action === 'WALK_BACK') {
      const cycle = this.elapsed * (fighter.action === 'WALK_FWD' ? 9.5 : -7.5);
      const s = Math.sin(cycle);
      const c = Math.cos(cycle);
      return {
        ...NEUTRAL_POSES.IDLE,
        hipOffsetY: 8 + Math.abs(c) * 4,
        torsoLean: fighter.action === 'WALK_FWD' ? 14 : 4,
        thighF: 18 + s * 32,
        shinF: -14 + Math.max(0, -c) * 24,
        thighB: -16 - s * 32,
        shinB: -18 - Math.max(0, c) * 24,
        upperArmF: 40 - s * 14,
        upperArmB: -18 + s * 14,
      };
    }

    if (fighter.action === 'DASH_FWD' || fighter.action === 'DASH_BACK') {
      return {
        ...NEUTRAL_POSES.IDLE,
        hipOffsetY: 20,
        torsoLean: fighter.action === 'DASH_FWD' ? 32 : -18,
        thighF: 48,
        shinF: -18,
        thighB: -44,
        shinB: -50,
      };
    }

    if (fighter.action === 'IDLE') {
      const breathe = Math.sin(this.elapsed * 3.6 + fighter.id);
      return {
        ...NEUTRAL_POSES.IDLE,
        hipOffsetY: NEUTRAL_POSES.IDLE.hipOffsetY + breathe * 2.5,
        upperArmF: NEUTRAL_POSES.IDLE.upperArmF + breathe * 3,
        forearmF: NEUTRAL_POSES.IDLE.forearmF + breathe * 2,
      };
    }

    if (fighter.action in NEUTRAL_POSES) {
      return NEUTRAL_POSES[fighter.action as keyof typeof NEUTRAL_POSES];
    }
    return NEUTRAL_POSES.IDLE;
  }

  private resolvePushbox() {
    const minSep = 54;
    const dx = this.p2.x - this.p1.x;
    const dist = Math.abs(dx);
    if (dist < minSep && Math.abs(this.p1.y - this.p2.y) < 95) {
      const push = (minSep - dist) * 0.5;
      const dir = dx >= 0 ? 1 : -1;
      this.p1.x = Math.max(STAGE_LEFT, this.p1.x - dir * push);
      this.p2.x = Math.min(STAGE_RIGHT, this.p2.x + dir * push);
    }
  }

  private resolveCombatHits() {
    this.checkAttackHit(this.p1, this.p2);
    this.checkAttackHit(this.p2, this.p1);
  }

  private checkAttackHit(attacker: Fighter, defender: Fighter) {
    if (attacker.hasHitThisAction) return;
    if (defender.action === 'KNOCKDOWN' || defender.action === 'GET_UP') return;
    const move = MOVES[attacker.action];
    if (!move) return;

    const norm = attacker.actionTimer / attacker.actionDuration;
    if (norm < move.activeStart || norm > move.activeEnd) return;

    const atkSkel = computeSkeleton(attacker, GROUND_Y);
    const defSkel = computeSkeleton(defender, GROUND_Y);

    let segA = atkSkel.weaponBaseF;
    let segB = atkSkel.weaponTipF;
    let hitRadius = 12;

    if (move.hitSource === 'FOOT_F') {
      segA = atkSkel.kneeF;
      segB = atkSkel.footF;
      hitRadius = 15;
    } else if (attacker.weapon === 'unarmed') {
      segA = atkSkel.elbowF;
      segB = atkSkel.handF;
      hitRadius = 15;
    }

    let hitPoint: { x: number; y: number } | null = null;
    for (const hb of defSkel.hurtBoxes) {
      const d = pointToSegmentDist(hb.x, hb.y, segA.x, segA.y, segB.x, segB.y);
      if (d <= hb.r + hitRadius) {
        hitPoint = { x: (segB.x + hb.x) * 0.5, y: (segB.y + hb.y) * 0.5 };
        break;
      }
    }

    if (!hitPoint) return;

    attacker.hasHitThisAction = true;

    // Check if defender is blocking
    const isBlocked =
      (defender.action === 'BLOCK_HIGH' && move.hitHeight !== 'LOW') ||
      (defender.action === 'BLOCK_LOW' && move.hitHeight === 'LOW');

    if (isBlocked) {
      const chip = move.chipDamage * attacker.powerMultiplier;
      defender.hp = Math.max(1, defender.hp - chip);
      defender.vx = attacker.facing * move.knockback * 0.65;
      defender.shadowEnergy = Math.min(100, defender.shadowEnergy + 9);
      attacker.shadowEnergy = Math.min(100, attacker.shadowEnergy + 6);
      this.hitStopTimer = 0.045;
      this.screenShake = 5;
      soundEngine.playParry();
      this.spawnSparks(hitPoint.x, hitPoint.y, '#fef08a', 12);
      this.popups.push({ x: hitPoint.x, y: hitPoint.y - 18, text: 'PARRY', color: '#fde68a', alpha: 1, vy: -42 });
      return;
    }

    // Clean hit!
    const dmg = Math.round(move.damage * WEAPONS[attacker.weapon].damageMult * attacker.powerMultiplier);
    defender.hp = Math.max(0, defender.hp - dmg);
    attacker.damageDealt += dmg;
    attacker.hitsLanded += 1;

    attacker.comboCount += 1;
    attacker.comboDamage += dmg;
    attacker.comboResetTimer = 1.6;
    if (attacker.comboCount > attacker.maxCombo) {
      attacker.maxCombo = attacker.comboCount;
    }

    attacker.shadowEnergy = Math.min(100, attacker.shadowEnergy + 16);
    defender.shadowEnergy = Math.min(100, defender.shadowEnergy + 11);

    const heavyHit = move.id === 'HEAVY_SLASH' || move.id === 'SHADOW_STRIKE';
    this.hitStopTimer = heavyHit ? 0.095 : 0.055;
    this.screenShake = heavyHit ? 14 : 7;
    soundEngine.playHit(heavyHit);

    this.spawnSparks(
      hitPoint.x,
      hitPoint.y,
      move.id === 'SHADOW_STRIKE' ? '#f59e0b' : '#ef4444',
      heavyHit ? 22 : 13
    );
    this.popups.push({
      x: hitPoint.x,
      y: hitPoint.y - 20,
      text: `-${dmg}`,
      color: heavyHit ? '#fbbf24' : '#f87171',
      alpha: 1,
      vy: -55,
    });

    if (defender.hp <= 0) {
      defender.action = 'KNOCKDOWN';
      defender.actionTimer = 0;
      defender.vx = attacker.facing * Math.max(260, move.knockback);
      defender.vy = -210;
      defender.y = -4;
      this.triggerKO(attacker);
    } else if (move.knockdown) {
      defender.action = 'KNOCKDOWN';
      defender.actionTimer = 0;
      defender.vx = attacker.facing * move.knockback;
      defender.vy = -150;
      defender.y = -2;
    } else {
      defender.action = 'HIT_STUN';
      defender.hitStunTimer = move.hitStun;
      defender.vx = attacker.facing * move.knockback;
    }
  }

  private triggerKO(winner: Fighter) {
    this.roundPhase = 'KO_SLOWMO';
    this.phaseTimer = 1.75;
    this.timeScale = 0.28;
    this.bannerText = winner.hp === winner.maxHp ? 'PERFECT' : 'K.O.';
    this.bannerSubtext = `${winner.name.toUpperCase()} PREVAILS`;
    soundEngine.playGong(true);
  }

  private triggerTimeOver() {
    this.roundPhase = 'ROUND_END';
    this.phaseTimer = 2.0;
    this.bannerText = 'TIME OVER';
    if (this.p1.hp > this.p2.hp) {
      this.p1.roundsWon += 1;
      this.p1.action = 'VICTORY';
      this.bannerSubtext = `${this.p1.name.toUpperCase()} WINS THE ROUND`;
    } else if (this.p2.hp > this.p1.hp) {
      this.p2.roundsWon += 1;
      this.p2.action = 'VICTORY';
      this.bannerSubtext = `${this.p2.name.toUpperCase()} WINS THE ROUND`;
    } else {
      this.bannerSubtext = 'DRAW ROUND';
    }
    soundEngine.playGong(true);
  }

  private finalizeRound() {
    this.roundPhase = 'ROUND_END';
    this.phaseTimer = 1.5;
    if (this.p1.hp > 0 && this.p2.hp <= 0) {
      this.p1.roundsWon += 1;
      this.p1.action = 'VICTORY';
    } else if (this.p2.hp > 0 && this.p1.hp <= 0) {
      this.p2.roundsWon += 1;
      this.p2.action = 'VICTORY';
    }
  }

  private emitMatchSummary() {
    if (!this.onMatchComplete) return;
    const winner: 1 | 2 | 'DRAW' =
      this.p1.roundsWon > this.p2.roundsWon ? 1 : this.p2.roundsWon > this.p1.roundsWon ? 2 : 'DRAW';
    const winnerName = winner === 1 ? this.p1.name : winner === 2 ? this.p2.name : 'Draw';
    this.onMatchComplete({
      winner,
      winnerName,
      p1Rounds: this.p1.roundsWon,
      p2Rounds: this.p2.roundsWon,
      p1Damage: this.p1.damageDealt,
      p2Damage: this.p2.damageDealt,
      p1MaxCombo: this.p1.maxCombo,
      p2MaxCombo: this.p2.maxCombo,
      p1Accuracy: this.p1.attacksThrown > 0 ? Math.round((this.p1.hitsLanded / this.p1.attacksThrown) * 100) : 0,
      p2Accuracy: this.p2.attacksThrown > 0 ? Math.round((this.p2.hitsLanded / this.p2.attacksThrown) * 100) : 0,
    });
  }

  private spawnSparks(x: number, y: number, color: string, count: number) {
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 120 + Math.random() * 360;
      this.particles.push({
        x,
        y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 60,
        size: 2 + Math.random() * 3.5,
        alpha: 1,
        decay: 2.2 + Math.random() * 1.4,
        color,
        kind: 'spark',
      });
    }
  }

  private spawnDust(x: number, y: number, dir: number) {
    for (let i = 0; i < 7; i++) {
      this.particles.push({
        x: x + (Math.random() - 0.5) * 24,
        y: y - 4,
        vx: -dir * (40 + Math.random() * 90) + (Math.random() - 0.5) * 60,
        vy: -18 - Math.random() * 40,
        size: 5 + Math.random() * 6,
        alpha: 0.45,
        decay: 1.3,
        color: 'rgba(214, 211, 209, 0.55)',
        kind: 'dust',
      });
    }
  }

  private updateParticles(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      if (p.kind === 'ambient') {
        if (p.y < -10) p.y = STAGE_HEIGHT + 10;
        if (p.y > STAGE_HEIGHT + 10) p.y = -10;
        if (p.x < -10) p.x = STAGE_WIDTH + 10;
        if (p.x > STAGE_WIDTH + 10) p.x = -10;
      } else {
        if (p.kind === 'spark') p.vy += 420 * dt;
        p.alpha -= p.decay * dt;
        if (p.alpha <= 0) {
          this.particles.splice(i, 1);
        }
      }
    }
  }

  private updatePopups(dt: number) {
    for (let i = this.popups.length - 1; i >= 0; i--) {
      const pop = this.popups[i];
      pop.y += pop.vy * dt;
      pop.alpha -= dt * 1.5;
      if (pop.alpha <= 0) {
        this.popups.splice(i, 1);
      }
    }
  }

  private updateCamera(dt: number) {
    const midX = (this.p1.x + this.p2.x) * 0.5;
    const dist = Math.abs(this.p1.x - this.p2.x);
    let targetZoom = this.roundPhase === 'KO_SLOWMO' ? 1.2 : 1.0 + Math.max(0, 1 - dist / 620) * 0.09;
    if (this.shadowFlashTimer > 0) targetZoom = Math.max(targetZoom, 1.12);

    this.camZoom += (targetZoom - this.camZoom) * Math.min(1, dt * 6);
    const clampedCamX = Math.max(
      STAGE_WIDTH / (2 * this.camZoom),
      Math.min(STAGE_WIDTH - STAGE_WIDTH / (2 * this.camZoom), midX)
    );
    this.camX += (clampedCamX - this.camX) * Math.min(1, dt * 7);
  }

  public getHudSnapshot(): HudSnapshot {
    return {
      p1Hp: this.p1.hp,
      p1MaxHp: this.p1.maxHp,
      p1TrailHp: this.p1.trailHp,
      p1Shadow: this.p1.shadowEnergy,
      p1Rounds: this.p1.roundsWon,
      p1Combo: this.p1.comboCount,
      p1ComboDamage: this.p1.comboDamage,
      p2Hp: this.p2.hp,
      p2MaxHp: this.p2.maxHp,
      p2TrailHp: this.p2.trailHp,
      p2Shadow: this.p2.shadowEnergy,
      p2Rounds: this.p2.roundsWon,
      p2Combo: this.p2.comboCount,
      p2ComboDamage: this.p2.comboDamage,
      roundNumber: this.roundNumber,
      roundTimer: Math.ceil(this.roundTimer),
      bannerText: this.bannerText,
      bannerSubtext: this.bannerSubtext,
      shadowFlashActive: this.shadowFlashTimer > 0,
    };
  }

  public render(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.clearRect(0, 0, STAGE_WIDTH, STAGE_HEIGHT);

    // Camera transform + shake
    const shakeX = this.screenShake > 0 ? (Math.random() - 0.5) * this.screenShake : 0;
    const shakeY = this.screenShake > 0 ? (Math.random() - 0.5) * this.screenShake : 0;

    ctx.translate(STAGE_WIDTH / 2 + shakeX, STAGE_HEIGHT * 0.62 + shakeY);
    ctx.scale(this.camZoom, this.camZoom);
    ctx.translate(-this.camX, -STAGE_HEIGHT * 0.62);

    // 1. Arena Backdrop
    if (this.bgLoaded && this.bgImage) {
      ctx.drawImage(this.bgImage, 0, 0, STAGE_WIDTH, STAGE_HEIGHT);
    } else {
      const grad = ctx.createLinearGradient(0, 0, 0, STAGE_HEIGHT);
      grad.addColorStop(0, '#1c1917');
      grad.addColorStop(0.6, '#78350f');
      grad.addColorStop(1, '#09090b');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, STAGE_WIDTH, STAGE_HEIGHT);
    }

    // Subtle atmospheric contrast wash so black silhouettes always pop cleanly
    const atmos = ctx.createRadialGradient(
      (this.p1.x + this.p2.x) * 0.5,
      GROUND_Y - 140,
      40,
      STAGE_WIDTH * 0.5,
      GROUND_Y - 120,
      580
    );
    atmos.addColorStop(0, this.arena.ambientGlow);
    atmos.addColorStop(1, 'rgba(0, 0, 0, 0.36)');
    ctx.fillStyle = atmos;
    ctx.fillRect(0, 0, STAGE_WIDTH, STAGE_HEIGHT);

    // Shadow strike dramatic ink-vignette flash
    if (this.shadowFlashTimer > 0) {
      ctx.fillStyle = `rgba(5, 5, 10, ${Math.min(0.68, this.shadowFlashTimer * 1.6)})`;
      ctx.fillRect(0, 0, STAGE_WIDTH, STAGE_HEIGHT);
    }

    // Subtle floor contact plane line
    ctx.fillStyle = 'rgba(0, 0, 0, 0.32)';
    ctx.fillRect(0, GROUND_Y + 4, STAGE_WIDTH, STAGE_HEIGHT - GROUND_Y);

    // 2. Render Fighters (attacking fighter on top for crisp overlap)
    const p1Skel: SkeletonWorld = computeSkeleton(this.p1, GROUND_Y);
    const p2Skel: SkeletonWorld = computeSkeleton(this.p2, GROUND_Y);

    if (MOVES[this.p1.action]) {
      renderFighter(ctx, this.p2, GROUND_Y, this.arena, p2Skel);
      renderFighter(ctx, this.p1, GROUND_Y, this.arena, p1Skel);
    } else {
      renderFighter(ctx, this.p1, GROUND_Y, this.arena, p1Skel);
      renderFighter(ctx, this.p2, GROUND_Y, this.arena, p2Skel);
    }

    // 3. Particles (sparks, dust, drifting embers/petals)
    for (const p of this.particles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.alpha);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      if (p.kind === 'spark') {
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      } else if (p.kind === 'dust') {
        ctx.ellipse(p.x, p.y, p.size * 1.4, p.size * 0.8, 0, 0, Math.PI * 2);
      } else {
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      }
      ctx.fill();
      ctx.restore();
    }

    // 4. Floating damage / parry popups
    ctx.save();
    ctx.font = '700 20px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    for (const pop of this.popups) {
      ctx.globalAlpha = Math.max(0, pop.alpha);
      ctx.fillStyle = '#050507';
      ctx.fillText(pop.text, pop.x + 1.5, pop.y + 1.5);
      ctx.fillStyle = pop.color;
      ctx.fillText(pop.text, pop.x, pop.y);
    }
    ctx.restore();

    ctx.restore();
  }
}
