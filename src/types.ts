export type PowerUpType = 'shield' | 'health' | 'weapon' | 'score' | 'rocket';

export interface Planet {
  x: number;
  y: number;
  radius: number;
  color: string;
  speed: number;
  hasRing: boolean;
  ringColor: string;
  rotation: number;
  atmosphereColor: string;
  swirls: { angle: number, dist: number, size: number, color: string }[];
  features: { x: number, y: number, r: number, color: string }[];
}

export interface PowerUp extends Entity {
  type: PowerUpType;
  life: number;
}

export interface PlayerState {
  x: number;
  y: number;
  energy: number; 
  maxEnergy: number;
  health: number;
  maxHealth: number;
  isShielded: boolean;
  shieldTimer: number; // Added for power-up based shield
  score: number;
  meteorsHit: number;
  weaponTimer: number;
  scoreTimer: number;
  rocketCount: number;
  hasBossWarning: boolean;
  bossHealthPct: number;
}

export interface Entity {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  markedForDeletion: boolean;
}

export interface Enemy extends Entity {
  type: 'drone' | 'hunter' | 'bruiser' | 'boss' | 'sniper' | 'weaver';
  hp: number;
  maxHp: number;
  shootTimer: number;
  hitTimer?: number;
  bossPhase?: number;
  bossTimer?: number;
  targetX?: number;
}

export interface Meteor extends Entity {
  rotation: number;
  spinSpeed: number;
}

export interface Bullet extends Entity {
  isPlayer: boolean;
  isRocket?: boolean;
  damage: number;
}

export interface Particle extends Entity {
  life: number;
  maxLife: number;
  color: string;
}

export interface Star {
  x: number;
  y: number;
  speed: number;
  size: number;
  brightness: number;
}

