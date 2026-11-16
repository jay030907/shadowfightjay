export type GameState = 'TITLE_MENU' | 'PLAYING' | 'PAUSED' | 'ROUND_SUMMARY' | 'GAME_OVER';

export type GameMode = 'ARCADE_AI' | 'LOCAL_VERSUS' | 'PRACTICE';

export type Difficulty = 'EASY' | 'MEDIUM' | 'HARD' | 'EXPERT';

export type WeaponId = 'katana' | 'sai' | 'naginata' | 'unarmed';

export type HeadgearId = 'headband' | 'ronin_hat' | 'shinobi_hood' | 'oni_crest';

export type ArenaId = 'sunset_bamboo' | 'crimson_pagoda' | 'moonlit_temple';

export interface ArenaConfig {
  id: ArenaId;
  name: string;
  subtitle: string;
  imagePath: string;
  ambientGlow: string;
  rimColor: string;
  floorColor: string;
  particleColor: string;
  particleKind: 'embers' | 'petals' | 'mist';
}

export interface WeaponConfig {
  id: WeaponId;
  name: string;
  archetype: string;
  description: string;
  reach: number;
  speedMult: number;
  damageMult: number;
  trailColor: string;
}

export type FighterAction =
  | 'IDLE'
  | 'WALK_FWD'
  | 'WALK_BACK'
  | 'CROUCH'
  | 'JUMP'
  | 'DASH_FWD'
  | 'DASH_BACK'
  | 'BLOCK_HIGH'
  | 'BLOCK_LOW'
  | 'LIGHT_SLASH'
  | 'HEAVY_SLASH'
  | 'HIGH_KICK'
  | 'LOW_SWEEP'
  | 'AIR_STRIKE'
  | 'SHADOW_STRIKE'
  | 'HIT_STUN'
  | 'KNOCKDOWN'
  | 'GET_UP'
  | 'VICTORY';

export interface Pose {
  hipOffsetY: number; // 0 = standing neutral, positive = lower to ground (crouch/knockdown)
  hipOffsetX: number; // local forward shift
  torsoLean: number; // degrees from straight up (+ = lean forward, - = lean back)
  headTilt: number; // relative degrees
  // Limbs: degrees from straight down (+ = forward, - = backward)
  upperArmF: number;
  forearmF: number;
  upperArmB: number;
  forearmB: number;
  thighF: number;
  shinF: number;
  thighB: number;
  shinB: number;
  weaponRelAngle: number; // angle added to forearmF (or forearmB for offhand)
  offhandWeaponRelAngle?: number;
}

export interface MoveKeyframe {
  t: number; // normalized 0..1 within move duration
  pose: Pose;
}

export type HitHeight = 'HIGH' | 'MID' | 'LOW';

export interface MoveDefinition {
  id: FighterAction;
  label: string;
  duration: number; // seconds
  activeStart: number; // 0..1
  activeEnd: number; // 0..1
  damage: number;
  chipDamage: number;
  hitStun: number; // seconds
  knockback: number;
  knockdown?: boolean;
  hitHeight: HitHeight;
  lungeVelocity?: number; // px/s during active/startup
  hitSource: 'WEAPON_F' | 'WEAPON_B' | 'FOOT_F' | 'FOOT_B' | 'HAND_F';
  trailWidth: number;
  keyframes: MoveKeyframe[];
}

export interface Fighter {
  id: 1 | 2;
  name: string;
  weapon: WeaponId;
  headgear: HeadgearId;
  x: number;
  y: number; // 0 = ground level, negative = in air
  vx: number;
  vy: number;
  facing: 1 | -1;
  hp: number;
  maxHp: number;
  trailHp: number; // delayed white damage bar
  shadowEnergy: number; // 0..100
  action: FighterAction;
  actionTimer: number;
  actionDuration: number;
  currentPose: Pose;
  hasHitThisAction: boolean;
  hitStunTimer: number;
  comboCount: number;
  comboDamage: number;
  comboResetTimer: number;
  scarfNodes: Array<{ x: number; y: number }>;
  slashHistory: Array<{
    tipX: number;
    tipY: number;
    baseX: number;
    baseY: number;
    alpha: number;
    color: string;
  }>;
  aiCooldown: number;
  aiDesiredRange: number;
  roundsWon: number;
  damageDealt: number;
  maxCombo: number;
  hitsLanded: number;
  attacksThrown: number;
  powerMultiplier: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  decay: number;
  color: string;
  kind: 'spark' | 'dust' | 'shadow' | 'ambient';
}

export interface HitPopup {
  x: number;
  y: number;
  text: string;
  color: string;
  alpha: number;
  vy: number;
}

export interface HudSnapshot {
  p1Hp: number;
  p1MaxHp: number;
  p1TrailHp: number;
  p1Shadow: number;
  p1Rounds: number;
  p1Combo: number;
  p1ComboDamage: number;
  p2Hp: number;
  p2MaxHp: number;
  p2TrailHp: number;
  p2Shadow: number;
  p2Rounds: number;
  p2Combo: number;
  p2ComboDamage: number;
  roundNumber: number;
  roundTimer: number;
  bannerText: string | null;
  bannerSubtext: string | null;
  shadowFlashActive: boolean;
}

export interface MatchSummary {
  winner: 1 | 2 | 'DRAW';
  winnerName: string;
  p1Rounds: number;
  p2Rounds: number;
  p1Damage: number;
  p2Damage: number;
  p1MaxCombo: number;
  p2MaxCombo: number;
  p1Accuracy: number;
  p2Accuracy: number;
}
