import { Enemy, Meteor, Particle, Bullet, Star, PlayerState, PowerUp, PowerUpType, Planet } from '../types';
import { SoundManager } from './SoundManager';

export class GameEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  
  private enemies: Enemy[] = [];
  private meteors: Meteor[] = [];
  private particles: Particle[] = [];
  private bullets: Bullet[] = [];
  private stars: Star[] = [];
  private planets: Planet[] = [];
  private powerUps: PowerUp[] = [];
  private keys: Set<string> = new Set();
  private wasShielded: boolean = false;
  
  private player: PlayerState = {
    x: 0, y: 0,
    energy: 100, maxEnergy: 100,
    health: 100, maxHealth: 100,
    isShielded: false,
    shieldTimer: 0,
    score: 0, meteorsHit: 0,
    weaponTimer: 0,
    scoreTimer: 0,
    rocketCount: 3,
    hasBossWarning: false,
    bossHealthPct: 0
  };
  
  private lastTime: number = 0;
  private enemySpawnTimer: number = 0;
  private meteorSpawnTimer: number = 0;
  private playerShootTimer: number = 0;
  private playerRocketTimer: number = 0;
  private wave: number = 1;
  private lastBossWave: number = 0;
  private bossWarningTimer: number = 0;
  private currentBoss: Enemy | null = null;

  public onPlayerStateChange?: (state: PlayerState, wave: number) => void;
  public onGameOver?: (score: number, meteorsHit: number, wave: number) => void;
  public onPauseToggle?: (isPaused: boolean) => void;
  
  private isRunning: boolean = false;
  private isPaused: boolean = false;
  private controlMode: 'keyboard' | 'touch' = 'keyboard';
  private nextEntityId = 0;
  private scrollSpeed = 50;
  private scale = 1;
  private touchX: number | null = null;
  private touchY: number | null = null;
  private lastTouchX: number | null = null;
  private lastTouchY: number | null = null;
  private lastTouchTime: number = 0;
  private manualShoot = false;
  private manualShield = false;
  private manualRocket = false;
  private playerTrails: { x: number, y: number, life: number, size: number }[] = [];

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.resize();
    window.addEventListener('resize', this.resize);
    
    // Auto-detect touch capability for initial mode
    if (('ontouchstart' in window) || (navigator.maxTouchPoints > 0)) {
        this.controlMode = 'touch';
    }

    this.canvas.addEventListener('touchstart', (e) => this.handleTouch(e), { passive: false });
    this.canvas.addEventListener('touchmove', (e) => this.handleTouch(e), { passive: false });
    this.canvas.addEventListener('touchend', (e) => this.handleTouch(e), { passive: false });
    
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);

    this.initStars();
    this.initPlanets();
  }

  public setControlMode(mode: 'keyboard' | 'touch') {
    this.controlMode = mode;
  }

  private handleTouch(e: TouchEvent) {
    if (e.cancelable) e.preventDefault();
    
    // Switch to touch mode on any touch event
    if (this.controlMode !== 'touch') {
        this.controlMode = 'touch';
    }

    if (e.type === 'touchend') {
        this.touchX = null; 
        this.touchY = null;
        this.lastTouchX = null;
        this.lastTouchY = null;
        this.manualShoot = false;
        return;
    }

    if (e.touches.length > 0) {
      const rect = this.canvas.getBoundingClientRect();
      const touch = e.touches[0];
      const currentX = touch.clientX - rect.left;
      const currentY = touch.clientY - rect.top;

      if (e.type === 'touchstart') {
          // Double tap detection for missile (rocket)
          const now = Date.now();
          const timesinceLast = now - this.lastTouchTime;
          if (timesinceLast < 250 && timesinceLast > 50) {
              if (this.player.rocketCount > 0) {
                this.manualRocket = true;
              }
          }
          this.lastTouchTime = now;

          this.lastTouchX = currentX;
          this.lastTouchY = currentY;
          
          // Start firing on touch
          this.manualShoot = true;
      } else if (e.type === 'touchmove') {
          if (this.lastTouchX !== null && this.lastTouchY !== null) {
              const dx = currentX - this.lastTouchX;
              const dy = currentY - this.lastTouchY;
              
              const sensitivity = 1.35; 
              this.player.x += dx * sensitivity;
              this.player.y += dy * sensitivity;
          }
          this.lastTouchX = currentX;
          this.lastTouchY = currentY;
      }
      
      this.touchX = currentX;
      this.touchY = currentY;
    }
  }

  public setManualShoot(val: boolean) { this.manualShoot = val; }
  public setManualShield(val: boolean) { this.manualShield = val; }
  public triggerManualRocket() { this.manualRocket = true; }

  public resize = () => {
    const rect = this.canvas.getBoundingClientRect();
    const oldWidth = this.canvas.width;
    const oldHeight = this.canvas.height;
    
    this.canvas.width = rect.width;
    this.canvas.height = rect.height;
    
    // Calculate scale by using screen diagonal proportionality, providing consistent perceived size
    // across different aspect ratios (desktop vs mobile).
    const baseDiagonal = Math.sqrt(800 * 800 + 1000 * 1000);
    const currentDiagonal = Math.sqrt(this.canvas.width * this.canvas.width + this.canvas.height * this.canvas.height);
    this.scale = currentDiagonal / baseDiagonal;
    this.scale = Math.max(0.35, Math.min(4.0, this.scale));

    if (this.player.x === 0 || isNaN(this.player.x)) {
      this.player.x = this.canvas.width / 2;
      this.player.y = this.canvas.height - 100 * this.scale;
    } else if (oldWidth > 0 && oldHeight > 0) {
       this.player.x = (this.player.x / oldWidth) * this.canvas.width;
       this.player.y = (this.player.y / oldHeight) * this.canvas.height;
    }
  };

  public handleKeyDown = (e: KeyboardEvent) => {
      // Switch to keyboard mode on any relevant key press
      const gameplayKeys = ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyX', 'KeyF', 'KeyZ', 'ShiftLeft', 'ShiftRight', 'Digit1'];
      if (gameplayKeys.includes(e.code)) {
          this.controlMode = 'keyboard';
          if (this.isRunning) {
              e.preventDefault();
          }
      }

      if (e.code === 'Escape' && this.isRunning) {
          this.togglePause();
          return;
      }
      this.keys.add(e.code);
  };

  public handleKeyUp = (e: KeyboardEvent) => {
      this.keys.delete(e.code);
  };

  private initStars() {
    this.stars = [];
    for (let i = 0; i < 150; i++) {
      this.stars.push({
        x: Math.random() * this.canvas.width,
        y: Math.random() * this.canvas.height,
        speed: Math.random() * 80 + 20,
        size: (Math.random() * 2 + 0.5) * this.scale,
        brightness: Math.random(),
      });
    }
  }

  private initPlanets() {
    this.planets = [];
    const colors = ['#1e1b4b', '#3b0764', '#064e3b', '#4c1d95', '#0284c7', '#be185d'];
    for (let i = 0; i < 3; i++) {
       this.spawnPlanet(colors[Math.floor(Math.random() * colors.length)]);
    }
  }

  private spawnPlanet(color: string, yPos?: number) {
     const radius = (Math.random() * 80 + 40) * this.scale;
     const featuresCount = Math.floor(Math.random() * 5) + 3;
     const features = [];
     for (let i = 0; i < featuresCount; i++) {
        features.push({
           x: (Math.random() - 0.5) * radius * 1.5,
           y: (Math.random() - 0.5) * radius * 1.5,
           r: Math.random() * radius * 0.3 + 5 * this.scale,
           color: `rgba(255, 255, 255, ${Math.random() * 0.1 + 0.05})`
        });
     }

     const swirls = [];
     const swirlCount = Math.floor(Math.random() * 4) + 2;
     for (let i = 0; i < swirlCount; i++) {
        swirls.push({
           angle: Math.random() * Math.PI * 2,
           dist: Math.random() * radius * 0.7,
           size: Math.random() * radius * 0.5 + 10,
           color: `rgba(255, 255, 255, ${Math.random() * 0.08 + 0.02})`
        });
     }

     this.planets.push({
        x: Math.random() * this.canvas.width,
        y: yPos ?? Math.random() * this.canvas.height,
        radius: radius,
        color: color,
        speed: Math.random() * 10 + 5,
        hasRing: Math.random() > 0.6,
        ringColor: `rgba(255, 255, 255, 0.15)`,
        rotation: 0,
        atmosphereColor: `hsla(${Math.random() * 360}, 70%, 50%, 0.15)`,
        swirls: swirls,
        features: features
     });
  }

  public start(startingWave: number = 1) {
    this.enemies = [];
    this.meteors = [];
    this.particles = [];
    this.bullets = [];
    this.powerUps = [];
    this.wave = startingWave;
    this.playerRocketTimer = 0;
    this.playerShootTimer = 0;
    this.bossWarningTimer = 0;
    this.currentBoss = null;
    this.keys.clear();
    
    SoundManager.init();
    SoundManager.waveStart();
    
    this.player = {
      x: this.canvas.width / 2, y: this.canvas.height - 100 * this.scale,
      energy: 100, maxEnergy: 100,
      health: 100, maxHealth: 100,
      isShielded: false,
      shieldTimer: 0,
      score: (startingWave - 1) * 500, meteorsHit: 0,
      weaponTimer: 0,
      scoreTimer: 0,
      rocketCount: 3,
      hasBossWarning: false,
      bossHealthPct: 0
    };

    this.isRunning = true;
    this.lastTime = performance.now();
    this.loop(this.lastTime);
  }

  public stop() {
    this.isRunning = false;
    this.isPaused = false;
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
  }

  public togglePause() {
    if (!this.isRunning) return;
    this.isPaused = !this.isPaused;
    if (this.onPauseToggle) this.onPauseToggle(this.isPaused);
    if (!this.isPaused) {
      this.lastTime = performance.now();
      this.loop(this.lastTime);
    }
  }

  public pause() {
    if (this.isRunning && !this.isPaused) {
        this.isPaused = true;
        if (this.onPauseToggle) this.onPauseToggle(this.isPaused);
    }
  }

  public resume() {
    if (this.isRunning && this.isPaused) {
      this.isPaused = false;
      if (this.onPauseToggle) this.onPauseToggle(this.isPaused);
      this.lastTime = performance.now();
      requestAnimationFrame(this.loop);
    }
  }

  public getIsPaused() {
    return this.isPaused;
  }

  private createParticles(x: number, y: number, color: string, count: number, speedMult: number = 1) {
    // Limit maximum particles for performance
    if (this.particles.length > 300) return; 
    
    // Decrease count for performance
    const actualCount = Math.min(count, 8);
    for (let i = 0; i < actualCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 100 * speedMult;
        this.particles.push({
            id: this.nextEntityId++,
            x, y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            radius: (Math.random() * 3 + 1) * this.scale,
            life: 1.0, maxLife: Math.random() * 0.5 + 0.2,
            color, markedForDeletion: false
        });
    }
}

  private spawnMeteor() {
    const radius = (Math.random() * 30 + 20) * this.scale;
    this.meteors.push({
      id: this.nextEntityId++,
      x: Math.random() * this.canvas.width,
      y: -50 * this.scale,
      vx: (Math.random() - 0.5) * 40 * this.scale,
      vy: (Math.random() * 50 + 60 + (this.wave * 5)) * this.scale,
      radius,
      rotation: Math.random() * Math.PI * 2,
      spinSpeed: (Math.random() - 0.5) * 2,
      markedForDeletion: false
    });
  }

  private spawnEnemy(forceType?: 'drone' | 'hunter' | 'bruiser' | 'sniper' | 'weaver') {
    const rand = Math.random();
    let type: 'drone' | 'hunter' | 'bruiser' | 'sniper' | 'weaver' = 'drone';
    if (forceType) {
        type = forceType;
    } else {
        // As waves increase, harder enemies appear more frequently
        const weaverChance = Math.min(0.2, 0.0 + this.wave * 0.02);
        const sniperChance = Math.min(0.2, 0.0 + this.wave * 0.02);
        const bruiserChance = Math.min(0.2, 0.05 + this.wave * 0.02);
        const hunterChance = Math.min(0.4, 0.15 + this.wave * 0.03);
        
        if (rand < weaverChance) type = 'weaver';
        else if (rand < weaverChance + sniperChance) type = 'sniper';
        else if (rand < weaverChance + sniperChance + bruiserChance) type = 'bruiser';
        else if (rand < weaverChance + sniperChance + bruiserChance + hunterChance) type = 'hunter';
    }

    let hp = 1, radius = 14, vx = 0, vy = 0, shootTimer = 0;

    // HP scales with wave
    const hpMult = 1 + Math.floor(this.wave / 3) * 0.5;

    if (type === 'sniper') {
        hp = Math.floor(4 * hpMult);
        radius = 20;
        vx = (Math.random() - 0.5) * 50 * this.scale;
        vy = (Math.random() * 10 + 15 + (this.wave * 2)) * this.scale; // Very slow moving down
        shootTimer = Math.max(1.5, Math.random() * 1.5 + 1.5 - (this.wave * 0.05));
    } else if (type === 'weaver') {
        hp = Math.floor(2 * hpMult);
        radius = 16;
        vx = (Math.random() > 0.5 ? 1 : -1) * (150 + this.wave * 10) * this.scale; // Fast horiz
        vy = (Math.random() * 20 + 30 + (this.wave * 5)) * this.scale;
        shootTimer = Math.max(0.4, Math.random() * 1 - (this.wave * 0.05));
    } else if (type === 'bruiser') {
        hp = Math.floor(8 * hpMult);
        radius = 28;
        vy = (Math.random() * 15 + 20 + (this.wave * 4)) * this.scale;
        shootTimer = Math.max(0.5, Math.random() * 2 + 1 - (this.wave * 0.05));
    } else if (type === 'hunter') {
        hp = Math.floor(3 * hpMult);
        radius = 18;
        vy = (Math.random() * 30 + 40 + (this.wave * 8)) * this.scale;
        shootTimer = Math.max(0.3, Math.random() * 2 - (this.wave * 0.1));
    } else {
        hp = Math.floor(1 * hpMult);
        vx = (Math.random() - 0.5) * 80 * this.scale;
        vy = (Math.random() * 40 + 50 + (this.wave * 10)) * this.scale;
        shootTimer = Math.max(0.5, Math.random() * 2 + 1 - (this.wave * 0.05));
    }

    this.enemies.push({
      id: this.nextEntityId++,
      type,
      x: Math.random() * this.canvas.width,
      y: -30 * this.scale,
      vx, vy, radius: radius * this.scale, hp, maxHp: hp,
      shootTimer,
      markedForDeletion: false
    });
  }

  private loop = (timestamp: number) => {
    if (!this.isRunning || this.isPaused) return;
    
    let dt = (timestamp - this.lastTime) / 1000;
    if (dt > 0.1) dt = 0.1; // clamp
    this.lastTime = timestamp;
    
    this.update(dt);
    this.draw();
    
    requestAnimationFrame(this.loop);
  }

  private spawnBoss() {
    const hp = 300 + (this.wave * 50);
    this.currentBoss = {
      id: this.nextEntityId++,
      type: 'boss',
      x: this.canvas.width / 2,
      y: -100 * this.scale,
      vx: 0,
      vy: 50 * this.scale,
      radius: 40 * this.scale,
      hp: hp,
      maxHp: hp,
      shootTimer: 2.0,
      bossPhase: 1,
      bossTimer: 0,
      targetX: this.canvas.width / 2,
      markedForDeletion: false
    };
    this.enemies.push(this.currentBoss);
  }

  private update(dt: number) {
    this.wasShielded = this.player.isShielded;

    // Movement speeds scaled - slightly increased base speed for keyboard
    const keyboardSpeed = 700 * this.scale;
    
    // Keyboard movement logic
    if (this.controlMode === 'keyboard') {
      if (this.keys.has('ArrowUp') || this.keys.has('KeyW')) this.player.y -= keyboardSpeed * dt;
      if (this.keys.has('ArrowDown') || this.keys.has('KeyS')) this.player.y += keyboardSpeed * dt;
      if (this.keys.has('ArrowLeft') || this.keys.has('KeyA')) this.player.x -= keyboardSpeed * dt;
      if (this.keys.has('ArrowRight') || this.keys.has('KeyD')) this.player.x += keyboardSpeed * dt;
    }

    let isShooting = this.keys.has('Space') || this.manualShoot;
    let isFiringRocket = this.keys.has('KeyX') || this.keys.has('KeyF') || this.keys.has('Digit1') || this.manualRocket;
    let isShielding = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') || this.keys.has('KeyZ') || this.manualShield;

    // Shield Logic (Power-Up based)
    if (this.player.shieldTimer > 0) {
        this.player.shieldTimer -= dt;
        this.player.isShielded = true;
        this.player.energy = (this.player.shieldTimer / 10) * 100; // Repurpose energy bar as shield bar
        if (this.player.shieldTimer <= 0) {
            this.player.isShielded = false;
            this.player.shieldTimer = 0;
            this.player.energy = 0;
            SoundManager.shieldOff();
        }
    } else {
        this.player.isShielded = false;
        this.player.energy = 0;
    }

    // Reset one-shot triggers
    this.manualRocket = false;

    const margin = 20 * this.scale;
    this.player.x = Math.max(margin, Math.min(this.canvas.width - margin, this.player.x));
    this.player.y = Math.max(margin, Math.min(this.canvas.height - margin * 2, this.player.y));

    if (this.playerRocketTimer > 0) this.playerRocketTimer -= dt;

    if (isShooting) {
        this.playerShootTimer -= dt;
        if (this.playerShootTimer <= 0) {
            const isBuffed = this.player.weaponTimer > 0;
            if (isBuffed) {
                SoundManager.shootPower();
                for (let fan of [-1, 0, 1]) {
                    this.bullets.push({
                        id: this.nextEntityId++,
                        x: this.player.x + (fan * 10 * this.scale), y: this.player.y - 15 * this.scale,
                        vx: fan * 150 * this.scale, vy: -600 * this.scale, radius: 4 * this.scale, markedForDeletion: false,
                        isPlayer: true, damage: 2
                    });
                }
                this.playerShootTimer = 0.15;
            } else {
                SoundManager.shoot();
                this.bullets.push({
                    id: this.nextEntityId++,
                    x: this.player.x - 10 * this.scale, y: this.player.y - 15 * this.scale,
                    vx: 0, vy: -500 * this.scale, radius: 4 * this.scale, markedForDeletion: false,
                    isPlayer: true, damage: 1
                });
                this.bullets.push({
                    id: this.nextEntityId++,
                    x: this.player.x + 10 * this.scale, y: this.player.y - 15 * this.scale,
                    vx: 0, vy: -500 * this.scale, radius: 4 * this.scale, markedForDeletion: false,
                    isPlayer: true, damage: 1
                });
                this.playerShootTimer = 0.2; // slightly slower fire rate
            }
        }
    }

    if (isFiringRocket && this.player.rocketCount > 0 && this.playerRocketTimer <= 0) {
        this.player.rocketCount--;
        SoundManager.rocket();
        this.bullets.push({
            id: this.nextEntityId++,
            x: this.player.x, y: this.player.y - 20 * this.scale,
            vx: 0, vy: -800 * this.scale, radius: 12 * this.scale, markedForDeletion: false,
            isPlayer: true, isRocket: true, damage: 300
        });
        this.playerRocketTimer = 0.5; // Cooldown after rocket now uses its own timer
    }

    // Engine Trails Logic
    this.playerTrails.push({
        x: this.player.x,
        y: this.player.y + 10 * this.scale,
        life: 1.0,
        size: 8 * this.scale
    });
    for (let i = this.playerTrails.length - 1; i >= 0; i--) {
        this.playerTrails[i].life -= dt * 4;
        this.playerTrails[i].y += 100 * dt; // move down slightly
        if (this.playerTrails[i].life <= 0) {
            this.playerTrails.splice(i, 1);
        }
    }

    if (this.player.weaponTimer > 0) this.player.weaponTimer -= dt;
    if (this.player.scoreTimer > 0) this.player.scoreTimer -= dt;

    // Regen energy
    if (!this.player.isShielded) {
        this.player.energy = Math.min(this.player.maxEnergy, this.player.energy + 15 * dt);
    }

    // Wave Progression
    this.wave = 1 + Math.floor(this.player.score / 500);

    // Boss warning and spawning
    if (this.wave > 1 && this.wave % 3 === 0 && this.lastBossWave !== this.wave && !this.currentBoss) {
        if (this.bossWarningTimer <= 0) {
            this.bossWarningTimer = 3.0; // 3 seconds warning
            this.player.hasBossWarning = true;
        }
    }

    if (this.bossWarningTimer > 0) {
        this.bossWarningTimer -= dt;
        if (this.bossWarningTimer <= 0) {
            this.player.hasBossWarning = false;
            this.spawnBoss();
            this.lastBossWave = this.wave;
        }
    }

    // Update Boss Health Pct
    if (this.currentBoss) {
        this.player.bossHealthPct = this.currentBoss.hp / this.currentBoss.maxHp;
        if (this.currentBoss.markedForDeletion) {
             this.currentBoss = null;
             this.player.bossHealthPct = 0;
        }
    } else {
        this.player.bossHealthPct = 0;
    }

    // Spawners
    this.meteorSpawnTimer -= dt;
    this.enemySpawnTimer -= dt;

    if (this.meteorSpawnTimer <= 0) {
        this.spawnMeteor();
        this.meteorSpawnTimer = Math.max(1.0, 4.0 - this.wave * 0.2); // Slower spawn
    }

    if (this.enemySpawnTimer <= 0) {
        if (!this.currentBoss) {
            this.spawnEnemy();
        } else {
            // Spawn drones occasionally to give powerups during boss fight
            if (Math.random() < 0.3) {
                 this.spawnEnemy('drone');
            }
        }
        this.enemySpawnTimer = Math.max(0.3, 2.0 - this.wave * 0.2); // Faster spawn based on wave
    }

    // Dynamic Scroll Speed based on intensity and wave
    const baseSpeed = 50 + (this.wave * 5);
    const targetScrollSpeed = this.currentBoss ? baseSpeed * 1.5 : baseSpeed;
    this.scrollSpeed += (targetScrollSpeed - this.scrollSpeed) * dt;

    // Horizontal Parallax based on player position
    const canvasMidX = this.canvas.width / 2;
    const playerOffset = (this.player.x - canvasMidX) / canvasMidX; // -1 to 1 range

    // Move stars
    for (const star of this.stars) {
        star.y += star.speed * (this.scrollSpeed / 50) * dt;
        star.x -= playerOffset * star.speed * 0.1 * dt * (this.scrollSpeed / 50); // Parallax drift
        
        if (star.y > this.canvas.height) {
            star.y = 0;
            star.x = Math.random() * this.canvas.width;
        }
        if (star.x < 0) star.x = this.canvas.width;
        if (star.x > this.canvas.width) star.x = 0;
    }

    // Move planets
    for (const p of this.planets) {
        p.y += p.speed * (this.scrollSpeed / 50) * dt;
        p.x -= playerOffset * p.speed * 0.2 * dt * (this.scrollSpeed / 50); // Stronger parallax for planets
        p.rotation += 0.2 * dt; 
        
        if (p.y > this.canvas.height + p.radius * 2) {
            p.y = -p.radius * 2;
            p.x = Math.random() * this.canvas.width;
        }
        // Keep planets visible even if they slightly drift out horizontally
        if (p.x < -p.radius * 2) p.x = this.canvas.width + p.radius * 2;
        if (p.x > this.canvas.width + p.radius * 2) p.x = -p.radius * 2;
    }

    // Move Meteors
    for (const m of this.meteors) {
        m.x += m.vx * dt;
        m.y += m.vy * dt;
        m.rotation += m.spinSpeed * dt;
        if (m.y > this.canvas.height + m.radius) m.markedForDeletion = true;
    }

    // Move Enemies
    for (const e of this.enemies) {
        if (e.hitTimer && e.hitTimer > 0) e.hitTimer -= dt;
        e.x += e.vx * dt;
        e.y += e.vy * dt;
        
        if (e.type === 'hunter') {
            // Track player X with more "AI" intelligence (predictive movement)
            const targetX = this.player.x + (this.player.x - e.x) * 0.1;
            if (e.x < targetX) e.vx += 100 * dt;
            else if (e.x > targetX) e.vx -= 100 * dt;
            e.vx *= 0.96; // friction
        } else if (e.type === 'drone') {
            // Drones now zig-zag downward
            e.vx = Math.sin(this.lastTime / 500) * 150;
            if (e.x < 0) e.x = this.canvas.width;
            if (e.x > this.canvas.width) e.x = 0;
        } else if (e.type === 'bruiser') {
            // Bruisers move slightly side to side heavily armored
            e.vx = Math.cos(this.lastTime / 1000) * 50;
        } else if (e.type === 'sniper') {
            const desiredY = this.canvas.height / 5;
            if (e.y < desiredY) e.vy = 60 * this.scale;
            else e.vy = 0;
            
            if (e.x < this.player.x) e.vx += 80 * dt;
            else if (e.x > this.player.x) e.vx -= 80 * dt;
            e.vx *= 0.95;
            if (e.x < 0) e.vx = Math.abs(e.vx);
            if (e.x > this.canvas.width) e.vx = -Math.abs(e.vx);
        } else if (e.type === 'weaver') {
            if (e.x <= e.radius) e.vx = Math.abs(e.vx);
            if (e.x >= this.canvas.width - e.radius) e.vx = -Math.abs(e.vx);
            e.vy = (30 + (this.wave * 5) + Math.cos(this.lastTime / 300) * 80) * this.scale;
        } else if (e.type === 'boss') {
            // Boss enters and stays in upper half
            if (e.y > 100 && e.vy > 0) {
                e.vy -= 100 * dt;
                if (e.vy < 0) e.vy = 0;
            }

            e.bossTimer = (e.bossTimer || 0) + dt;

            // Phase change based on health
            const hpPct = e.hp / e.maxHp;
            let currentPhase = 1;
            if (hpPct < 0.3) {
                currentPhase = 3;
            } else if (hpPct < 0.65) {
                currentPhase = 2;
            }

            if (currentPhase !== e.bossPhase) {
                e.bossPhase = currentPhase;
                // Visual feedback for phase shift
                this.createParticles(e.x, e.y, e.bossPhase === 3 ? '#ff8800' : '#ff0000', 50, 3);
                SoundManager.explosion(); // dramatic sound
            }

            // Boss Movement based on phase
            if (e.bossPhase === 1) {
                // Calm, controlled horizontal patrol
                if (Math.abs((e.targetX || e.x) - e.x) < 20) {
                    e.targetX = Math.random() * (this.canvas.width - 200) + 100;
                }
                if (e.x < (e.targetX || e.x)) e.vx += 120 * dt;
                else e.vx -= 120 * dt;
                e.vx *= 0.94;
            } else if (e.bossPhase === 2) {
                // Aggressive chase - follow player horizontally
                const targetX = this.player.x;
                if (e.x < targetX) e.vx += 250 * dt;
                else e.vx -= 250 * dt;
                e.vx *= 0.92;
                // Pulsing vertical hover
                e.y = 100 + Math.sin(e.bossTimer * 2) * 40;
            } else {
                // Phase 3: Desperation/Frenzy
                // Fast erratic circles or zig-zags
                e.vx = Math.sin(e.bossTimer * 4) * 400;
                e.y = 120 + Math.cos(e.bossTimer * 3) * 60;
            }

            // Boss Shooting based on phase
            e.shootTimer -= dt;
            if (e.shootTimer <= 0) {
                if (e.bossPhase === 1) {
                    // Spread 5
                    for (let fan of [-2, -1, 0, 1, 2]) {
                        this.bullets.push({
                            id: this.nextEntityId++,
                            x: e.x, y: e.y + e.radius,
                            vx: fan * 90 * this.scale, vy: (220 + (this.wave * 5)) * this.scale,
                            radius: 6 * this.scale, markedForDeletion: false,
                            isPlayer: false, damage: 15
                        });
                    }
                    e.shootTimer = 2.0;
                } else if (e.bossPhase === 2) {
                    // Rapid targeted fire + small fan
                    const angle = Math.atan2(this.player.y - e.y, this.player.x - e.x);
                    this.bullets.push({
                        id: this.nextEntityId++,
                        x: e.x, y: e.y + e.radius,
                        vx: Math.cos(angle) * 450 * this.scale, vy: Math.sin(angle) * 450 * this.scale,
                        radius: 8 * this.scale, markedForDeletion: false,
                        isPlayer: false, damage: 18
                    });

                    if (Math.floor(e.bossTimer * 2) % 2 === 0) {
                         for (let fan of [-1.2, 1.2]) {
                             this.bullets.push({
                                id: this.nextEntityId++,
                                x: e.x, y: e.y + e.radius,
                                vx: fan * 180 * this.scale, vy: 280 * this.scale,
                                radius: 5 * this.scale, markedForDeletion: false,
                                isPlayer: false, damage: 12
                            });
                        }
                    }
                    e.shootTimer = 0.7;
                } else {
                    // Phase 3: Rapid 360 burst or rapid targeting
                    for (let i = 0; i < 8; i++) {
                        const angle = (i / 8) * Math.PI * 2 + (e.bossTimer * 2);
                        this.bullets.push({
                            id: this.nextEntityId++,
                            x: e.x, y: e.y,
                            vx: Math.cos(angle) * 350 * this.scale, vy: Math.sin(angle) * 350 * this.scale,
                            radius: 5 * this.scale, markedForDeletion: false,
                            isPlayer: false, damage: 10
                        });
                    }
                    e.shootTimer = 1.2;
                }
                SoundManager.enemyShoot();
            }

            // Don't delete boss if offscreen y
            continue; // Skip the normal shootTimer logic
        }

        e.shootTimer -= dt;
        if (e.shootTimer <= 0) {
            // Bruisers shoot fan spread, others shoot straight mapping
            if (e.type === 'bruiser') {
                for (let fan = -1; fan <= 1; fan++) {
                    this.bullets.push({
                        id: this.nextEntityId++,
                        x: e.x, y: e.y + e.radius,
                        vx: fan * 100 * this.scale, vy: (250 + (this.wave * 10)) * this.scale,
                        radius: 5 * this.scale, markedForDeletion: false,
                        isPlayer: false, damage: 15
                    });
                }
                e.shootTimer = 3.5;
            } else if (e.type === 'sniper') {
                 // Aim at player
                 const angle = Math.atan2(this.player.y - e.y, this.player.x - e.x);
                 // High velocity
                 const speed = (450 + (this.wave * 15)) * this.scale;
                 this.bullets.push({
                     id: this.nextEntityId++,
                     x: e.x, y: e.y + e.radius,
                     vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
                     radius: 3 * this.scale, markedForDeletion: false,
                     isPlayer: false, damage: 20
                 });
                 e.shootTimer = 2.5;
            } else if (e.type === 'weaver') {
                this.bullets.push({
                    id: this.nextEntityId++,
                    x: e.x, y: e.y + e.radius,
                    vx: (Math.random() - 0.5) * 150 * this.scale, vy: (300 + (this.wave * 10)) * this.scale,
                    radius: 4 * this.scale, markedForDeletion: false,
                    isPlayer: false, damage: 10
                });
                e.shootTimer = 0.8;
            } else {
                this.bullets.push({
                    id: this.nextEntityId++,
                    x: e.x, y: e.y + e.radius,
                    vx: 0, vy: (300 + (this.wave * 15)) * this.scale,
                    radius: 4 * this.scale, markedForDeletion: false,
                    isPlayer: false, damage: 10
                });
                e.shootTimer = e.type === 'hunter' ? 1.5 : 3.0;
            }
        }

        if (e.y > this.canvas.height + e.radius) e.markedForDeletion = true;
    }

    // Move Bullets
    for (const b of this.bullets) {
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        if (b.y < -100 || b.y > this.canvas.height + 100) b.markedForDeletion = true;
    }

    // Move Particles
    for (const p of this.particles) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= dt;
        if (p.life <= 0) p.markedForDeletion = true;
    }

    // Move PowerUps
    for (const p of this.powerUps) {
        if (p.vx) p.x += p.vx * dt;
        p.vy = p.vy || 100;
        if (p.vx) p.vx *= 0.95; // Drag on horizontal random scattering
        p.y += p.vy * dt; // fall down
        p.life -= dt;
        if (p.life <= 0 || p.y > this.canvas.height + p.radius) {
            p.markedForDeletion = true;
        }
    }

    // Collisions
    const checkCollision = (e1: {x:number,y:number,radius:number}, e2: {x:number,y:number,radius:number}) => {
        const dx = e1.x - e2.x;
        const dy = e1.y - e2.y;
        return Math.sqrt(dx*dx + dy*dy) < (e1.radius + e2.radius);
    };

    const playerHitbox = { x: this.player.x, y: this.player.y, radius: (this.player.isShielded ? 40 : 15) * this.scale };

    // Player vs PowerUps
    for (const p of this.powerUps) {
        if (!p.markedForDeletion && checkCollision(playerHitbox, p)) {
            p.markedForDeletion = true;
            this.applyPowerUp(p.type);
        }
    }

    // Player vs Everything
    // Meteors
    for (const m of this.meteors) {
        if (!m.markedForDeletion && checkCollision(playerHitbox, m)) {
            if (this.player.isShielded) {
                // Bounce meteor slightly
                m.vy = -m.vy * 0.5;
                m.vx += (m.x - this.player.x) * 2;
                this.createParticles(m.x, m.y + m.radius, '#22d3ee', 10);
            } else {
                // Player hit
                SoundManager.hit();
                this.player.health -= 30;
                this.player.meteorsHit++;
                m.markedForDeletion = true;
                this.createParticles(m.x, m.y, '#ff4444', 20);
                this.canvas.parentElement?.querySelector('.damage-flash')?.classList.add('animate-ping');
            }
        }
    }

    // Enemies vs Player Hitbox
    for (const e of this.enemies) {
        if (!e.markedForDeletion && checkCollision(playerHitbox, e)) {
             if (this.player.isShielded) {
                e.markedForDeletion = true;
                this.createParticles(e.x, e.y, '#22d3ee', 15);
             } else {
                e.markedForDeletion = true;
                SoundManager.hit();
                this.player.health -= 20;
                this.createParticles(e.x, e.y, '#ff4444', 20);
             }
        }
    }

    // Bullets vs Everything
    for (const b of this.bullets) {
        if (b.markedForDeletion) continue;

        if (b.isPlayer) {
            // Hit Enemies
            for (const e of this.enemies) {
                if (!e.markedForDeletion && checkCollision(b, e)) {
                    b.markedForDeletion = true;
                    e.hp -= b.damage;
                    e.hitTimer = 0.1; // Flash for 100ms
                    if (b.isRocket) {
                        this.createParticles(b.x, b.y, '#ff8800', 20, 3);
                        SoundManager.explosion();
                    } else {
                        this.createParticles(b.x, b.y, '#ffff00', 3);
                    }
                    if (e.hp <= 0) {
                        SoundManager.explosion();
                        e.markedForDeletion = true;
                        let points = 20;
                        let color = '#ff8800';
                        if (e.type === 'hunter') { points = 50; color = '#ff00ff'; }
                        else if (e.type === 'bruiser') { points = 100; color = '#00ffcc'; }
                        else if (e.type === 'boss') { points = 1000; color = '#ffffff'; }
                        
                        if (this.player.scoreTimer > 0) points *= 2; // double score if buff active
                        
                        this.player.score += points;
                        this.createParticles(e.x, e.y, color, e.type === 'boss' ? 50 : 12, e.type === 'boss' ? 3.0 : 1.5);
                        
                        // Spawn powerup chance
                        let spawnCount = e.type === 'boss' ? 5 : (Math.random() < 0.2 ? 1 : 0);
                        for (let i = 0; i < spawnCount; i++) {
                            const types: PowerUpType[] = ['shield', 'health', 'weapon', 'score', 'rocket'];
                            const weights = [3, 2, 2, 2, 1]; // Rocket is rarer
                            let total = weights.reduce((a,b) => a+b, 0);
                            let r = Math.random() * total;
                            let type: PowerUpType = 'shield';
                            let acc = 0;
                            for(let j=0; j<types.length; j++) {
                                acc += weights[j];
                                if(r < acc) {
                                    type = types[j];
                                    break;
                                }
                            }

                            this.powerUps.push({
                                id: this.nextEntityId++,
                                type,
                                x: e.x + (Math.random() - 0.5) * 40 * this.scale,
                                y: e.y + (Math.random() - 0.5) * 40 * this.scale,
                                vx: (Math.random() - 0.5) * 120 * this.scale,
                                vy: (Math.random() * 80 + 100) * this.scale, // Always move down
                                radius: 12 * this.scale, life: 10, markedForDeletion: false
                            });
                        }
                    }
                    break;
                }
            }
            // Hit Meteors
            for (const m of this.meteors) {
                if (!m.markedForDeletion && checkCollision(b, m)) {
                    b.markedForDeletion = true;
                    if (b.isRocket) {
                        m.markedForDeletion = true;
                        this.createParticles(m.x, m.y, '#888888', 25, 2);
                        SoundManager.explosion();
                    } else {
                        this.createParticles(b.x, b.y, '#888888', 5);
                    }
                    break;
                }
            }
        } else {
            // Enemy Bullet hitting player
            if (checkCollision(b, playerHitbox)) {
                b.markedForDeletion = true;
                if (this.player.isShielded) {
                    this.createParticles(b.x, b.y, '#22d3ee', 5);
                } else {
                    SoundManager.hit();
                    this.player.health -= b.damage;
                    this.createParticles(this.player.x, this.player.y, '#ff0000', 10);
                }
            }
        }
    }

    // Setup applyPowerUp method
    // Cleanup
    this.enemies = this.enemies.filter(e => !e.markedForDeletion);
    this.meteors = this.meteors.filter(e => !e.markedForDeletion);
    this.bullets = this.bullets.filter(e => !e.markedForDeletion);
    this.particles = this.particles.filter(e => !e.markedForDeletion);
    this.powerUps = this.powerUps.filter(e => !e.markedForDeletion);

    if (this.player.health <= 0 && this.isRunning) {
        this.isRunning = false;
        if (this.onGameOver) this.onGameOver(this.player.score, this.player.meteorsHit, this.wave);
    }
    
    if (this.onPlayerStateChange) {
        this.onPlayerStateChange({...this.player}, this.wave);
    }
    
    this.wasShielded = this.player.isShielded;
  }

  private applyPowerUp(type: PowerUpType) {
      SoundManager.powerup();
      switch (type) {
          case 'shield':
              this.player.shieldTimer = 10.0; // 10 seconds of shield
              this.player.isShielded = true;
              this.player.energy = 100;
              this.createParticles(this.player.x, this.player.y, '#00ffff', 15);
              SoundManager.shieldOn();
              break;
          case 'health':
              this.player.health = Math.min(this.player.maxHealth, this.player.health + 40);
              this.createParticles(this.player.x, this.player.y, '#00ff00', 15);
              break;
          case 'weapon':
              this.player.weaponTimer = 10.0; // 10 seconds of weapon buff
              this.createParticles(this.player.x, this.player.y, '#ff00ff', 15);
              break;
          case 'score':
              this.player.scoreTimer = 15.0; // 15 sec score multiplier
              this.createParticles(this.player.x, this.player.y, '#ffff00', 15);
              break;
          case 'rocket':
              this.player.rocketCount = Math.min(10, this.player.rocketCount + 3);
              this.createParticles(this.player.x, this.player.y, '#ff4400', 15);
              break;
      }
  }

  private draw() {
    // Space Background
    this.ctx.fillStyle = '#000000';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Stars
    for (const star of this.stars) {
        this.ctx.fillStyle = `rgba(255, 255, 255, ${star.brightness})`;
        this.ctx.fillRect(star.x, star.y, star.size, star.size);
    }

    // Planets
    for (const p of this.planets) {
        this.ctx.save();
        this.ctx.translate(p.x, p.y);
        this.ctx.rotate(p.rotation);

        // Atmosphere Glow (static, but translated)
        this.ctx.beginPath();
        const glowRadius = p.radius + 40 * this.scale;
        const radGrad = this.ctx.createRadialGradient(0, 0, p.radius, 0, 0, glowRadius);
        radGrad.addColorStop(0, p.atmosphereColor);
        radGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        this.ctx.fillStyle = radGrad;
        this.ctx.arc(0, 0, glowRadius, 0, Math.PI * 2);
        this.ctx.fill();

        // Planet Body
        this.ctx.beginPath();
        this.ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
        this.ctx.fillStyle = p.color;
        this.ctx.fill();

        // Features (Craters/Spots) - drawn before clouds
        for(const f of p.features) {
           this.ctx.beginPath();
           this.ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
           this.ctx.fillStyle = f.color;
           this.ctx.fill();
        }

        // Swirling Clouds / Aurorae
        this.ctx.save();
        for(const s of p.swirls) {
           this.ctx.beginPath();
           this.ctx.ellipse(Math.cos(s.angle) * s.dist, Math.sin(s.angle) * s.dist, s.size, s.size * 0.3, s.angle, 0, Math.PI * 2);
           this.ctx.fillStyle = s.color;
           this.ctx.fill();
        }
        this.ctx.restore();

        // Shadow Overlay (3D effect)
        const shadowGrad = this.ctx.createRadialGradient(-p.radius*0.3, -p.radius*0.3, p.radius * 0.1, 0, 0, p.radius);
        shadowGrad.addColorStop(0, 'rgba(255,255,255,0.15)');
        shadowGrad.addColorStop(0.5, 'rgba(0,0,0,0)');
        shadowGrad.addColorStop(1, 'rgba(0,0,0,0.5)');
        this.ctx.fillStyle = shadowGrad;
        this.ctx.fill();

        // Ring
        if (p.hasRing) {
           this.ctx.beginPath();
           this.ctx.ellipse(0, 0, p.radius * 2.2, p.radius * 0.5, 0, 0, Math.PI * 2);
           this.ctx.strokeStyle = p.ringColor;
           this.ctx.lineWidth = 6 * this.scale;
           this.ctx.stroke();
           
           // Double ring for variety
           this.ctx.beginPath();
           this.ctx.ellipse(0, 0, p.radius * 2.4, p.radius * 0.55, 0, 0, Math.PI * 2);
           this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
           this.ctx.lineWidth = 2 * this.scale;
           this.ctx.stroke();
        }
        
        this.ctx.restore();
    }

    this.ctx.globalCompositeOperation = 'screen';

    // Player Engine Trails
    for (const t of this.playerTrails) {
       this.ctx.globalAlpha = t.life * 0.4;
       const trailColor = this.player.isShielded ? 'rgba(0, 255, 255, 0.4)' : 'rgba(255, 100, 0, 0.4)';
       this.ctx.fillStyle = trailColor;
       this.ctx.beginPath();
       this.ctx.arc(t.x, t.y, t.size * t.life, 0, Math.PI * 2);
       this.ctx.fill();
    }
    this.ctx.globalAlpha = 1.0;

    // Player Ship
    this.ctx.save();
    this.ctx.translate(this.player.x, this.player.y);
    
    // Thrust main
    this.ctx.fillStyle = this.player.isShielded ? '#00ffff' : '#ffaa00';
    this.ctx.beginPath();
    this.ctx.moveTo(-6 * this.scale, 12 * this.scale);
    this.ctx.lineTo(6 * this.scale, 12 * this.scale);
    this.ctx.lineTo(0, (25 + Math.random() * 15) * this.scale);
    this.ctx.fill();

    // Thrust sides
    this.ctx.fillStyle = this.player.isShielded ? '#00ffff' : '#ff00aa';
    this.ctx.beginPath();
    this.ctx.moveTo(-16 * this.scale, 10 * this.scale);
    this.ctx.lineTo(-10 * this.scale, 10 * this.scale);
    this.ctx.lineTo(-13 * this.scale, (20 + Math.random() * 8) * this.scale);
    this.ctx.fill();
    this.ctx.beginPath();
    this.ctx.moveTo(10 * this.scale, 10 * this.scale);
    this.ctx.lineTo(16 * this.scale, 10 * this.scale);
    this.ctx.lineTo(13 * this.scale, (20 + Math.random() * 8) * this.scale);
    this.ctx.fill();

    // Ship Body Gradient
    const shipGrad = this.ctx.createLinearGradient(0, -25 * this.scale, 0, 15 * this.scale);
    shipGrad.addColorStop(0, '#00ffff');
    shipGrad.addColorStop(0.5, '#3b82f6');
    shipGrad.addColorStop(1, '#1d4ed8');

    this.ctx.fillStyle = shipGrad;
    this.ctx.beginPath();
    this.ctx.moveTo(0, -25 * this.scale); // Nose
    this.ctx.lineTo(18 * this.scale, 15 * this.scale); // Right Wing
    this.ctx.lineTo(8 * this.scale, 10 * this.scale);  // Right engine recess
    this.ctx.lineTo(-8 * this.scale, 10 * this.scale); // Left engine recess
    this.ctx.lineTo(-18 * this.scale, 15 * this.scale); // Left Wing
    this.ctx.closePath();
    this.ctx.fill();

    // Cockpit
    this.ctx.fillStyle = '#ffffff';
    this.ctx.beginPath();
    this.ctx.ellipse(0, -5 * this.scale, 4 * this.scale, 8 * this.scale, 0, 0, Math.PI * 2);
    this.ctx.fill();

    // Shield
    if (this.player.isShielded) {
        this.ctx.strokeStyle = `rgba(34, 211, 238, ${Math.min(1, this.player.shieldTimer)})`;
        this.ctx.lineWidth = 3 * this.scale;
        this.ctx.beginPath();
        this.ctx.arc(0, 0, 40 * this.scale, 0, Math.PI * 2);
        this.ctx.stroke();
        
        this.ctx.fillStyle = `rgba(34, 211, 238, ${Math.min(0.15, this.player.shieldTimer * 0.15)})`;
        this.ctx.fill();
    }
    this.ctx.restore();

    this.ctx.globalCompositeOperation = 'source-over';

    // Enemies
    for (const e of this.enemies) {
        this.ctx.save();
        this.ctx.translate(e.x, e.y);
        
        const isHit = e.hitTimer && e.hitTimer > 0;
        
        if (e.type === 'hunter') {
            this.ctx.fillStyle = isHit ? '#ffffff' : '#ff0055';
            this.ctx.beginPath();
            this.ctx.moveTo(0, 15 * this.scale);
            this.ctx.lineTo(15 * this.scale, -10 * this.scale);
            this.ctx.lineTo(0, 0);
            this.ctx.lineTo(-15 * this.scale, -10 * this.scale);
            this.ctx.fill();
        } else if (e.type === 'bruiser') {
            this.ctx.fillStyle = isHit ? '#ffffff' : '#0a2211';
            this.ctx.strokeStyle = isHit ? '#ffffff' : '#00ff55'; // neon green
            this.ctx.lineWidth = 2 * this.scale;
            this.ctx.beginPath();
            this.ctx.moveTo(0, 20 * this.scale);
            this.ctx.lineTo(25 * this.scale, 0);
            this.ctx.lineTo(15 * this.scale, -20 * this.scale);
            this.ctx.lineTo(-15 * this.scale, -20 * this.scale);
            this.ctx.lineTo(-25 * this.scale, 0);
            this.ctx.closePath();
            this.ctx.fill();
            this.ctx.stroke();
            
            // Health bar for bruiser
            this.ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
            this.ctx.fillRect(-20 * this.scale, -28 * this.scale, 40 * this.scale, 4 * this.scale);
            this.ctx.fillStyle = '#00ff00';
            this.ctx.fillRect(-20 * this.scale, -28 * this.scale, (40 * (e.hp / e.maxHp)) * this.scale, 4 * this.scale);
        } else if (e.type === 'sniper') {
            this.ctx.fillStyle = isHit ? '#ffffff' : '#5500ff'; // deep violet
            this.ctx.strokeStyle = isHit ? '#ffffff' : '#aa00ff';
            this.ctx.lineWidth = 2 * this.scale;
            this.ctx.beginPath();
            this.ctx.moveTo(0, 20 * this.scale);
            this.ctx.lineTo(10 * this.scale, -15 * this.scale);
            this.ctx.lineTo(0, -5 * this.scale);
            this.ctx.lineTo(-10 * this.scale, -15 * this.scale);
            this.ctx.closePath();
            this.ctx.fill();
            this.ctx.stroke();

            // Scope glow
            this.ctx.fillStyle = '#00ffff';
            this.ctx.beginPath();
            this.ctx.arc(0, 10 * this.scale, 3 * this.scale, 0, Math.PI * 2);
            this.ctx.fill();
            
            // Health bar for sniper
            this.ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
            this.ctx.fillRect(-15 * this.scale, -20 * this.scale, 30 * this.scale, 3 * this.scale);
            this.ctx.fillStyle = '#00ff00';
            this.ctx.fillRect(-15 * this.scale, -20 * this.scale, (30 * (e.hp / e.maxHp)) * this.scale, 3 * this.scale);

        } else if (e.type === 'weaver') {
            this.ctx.fillStyle = isHit ? '#ffffff' : '#00aaff'; // cyan blue
            this.ctx.strokeStyle = isHit ? '#ffffff' : '#ffffff';
            this.ctx.lineWidth = 1.5 * this.scale;
            
            this.ctx.beginPath();
            this.ctx.moveTo(0, 15 * this.scale);
            
            // Curve swept wings
            this.ctx.quadraticCurveTo(20 * this.scale, 10 * this.scale, 20 * this.scale, -10 * this.scale);
            this.ctx.lineTo(5 * this.scale, -5 * this.scale);
            this.ctx.lineTo(0, -15 * this.scale);
            this.ctx.lineTo(-5 * this.scale, -5 * this.scale);
            this.ctx.lineTo(-20 * this.scale, -10 * this.scale);
            this.ctx.quadraticCurveTo(-20 * this.scale, 10 * this.scale, 0, 15 * this.scale);
            
            this.ctx.closePath();
            this.ctx.fill();
            this.ctx.stroke();
            
            // Health bar for weaver
            this.ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
            this.ctx.fillRect(-12 * this.scale, -22 * this.scale, 24 * this.scale, 3 * this.scale);
            this.ctx.fillStyle = '#00ff00';
            this.ctx.fillRect(-12 * this.scale, -22 * this.scale, (24 * (e.hp / e.maxHp)) * this.scale, 3 * this.scale);

        } else if (e.type === 'boss') {
            let bossColor = '#8800ff'; // Phase 1: Purple
            if (e.bossPhase === 2) bossColor = '#ff0055'; // Phase 2: Pink/Red
            if (e.bossPhase === 3) bossColor = '#ff8800'; // Phase 3: Orange/Fire
            
            this.ctx.fillStyle = isHit ? '#ffffff' : bossColor;
            this.ctx.strokeStyle = isHit ? '#ffffff' : '#fff';
            this.ctx.lineWidth = 3 * this.scale;

            // Phase 3 gets an extra pulsing glow
            if (e.bossPhase === 3) {
                const glowSize = (60 + Math.sin(Date.now() / 100) * 10) * this.scale;
                const phaseGlow = this.ctx.createRadialGradient(0, 0, 0, 0, 0, glowSize);
                phaseGlow.addColorStop(0, 'rgba(255, 120, 0, 0.4)');
                phaseGlow.addColorStop(1, 'rgba(255, 0, 0, 0)');
                this.ctx.fillStyle = phaseGlow;
                this.ctx.beginPath();
                this.ctx.arc(0, 0, glowSize, 0, Math.PI * 2);
                this.ctx.fill();
                this.ctx.fillStyle = isHit ? '#ffffff' : bossColor;
            }

            // Draw a big nasty alien ship
            this.ctx.beginPath();
            this.ctx.moveTo(0, 40 * this.scale);
            this.ctx.lineTo(50 * this.scale, 0);
            this.ctx.lineTo(30 * this.scale, -30 * this.scale);
            this.ctx.lineTo(-30 * this.scale, -30 * this.scale);
            this.ctx.lineTo(-50 * this.scale, 0);
            this.ctx.closePath();
            this.ctx.fill();
            this.ctx.stroke();

            // Cockpit or core detail
            this.ctx.fillStyle = isHit ? '#ffffff' : '#00ffff';
            if (e.bossPhase === 3) this.ctx.fillStyle = isHit ? '#ffffff' : '#ffff00';
            this.ctx.beginPath();
            this.ctx.arc(0, -10 * this.scale, 15 * this.scale, 0, Math.PI * 2);
            this.ctx.fill();

            // Boss engine flare
            const flareY = -30 * this.scale;
            this.ctx.fillStyle = e.bossPhase === 3 ? '#ff4400' : '#00ffff';
            const flareSize = (10 + Math.sin(Date.now() / 50) * 5) * this.scale;
            this.ctx.fillRect(-25 * this.scale, flareY, 10 * this.scale, flareSize);
            this.ctx.fillRect(15 * this.scale, flareY, 10 * this.scale, flareSize);
        } else {
            this.ctx.fillStyle = isHit ? '#ffffff' : '#ff5500'; // neon orange
            this.ctx.beginPath();
            this.ctx.arc(0, 0, e.radius, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.fillStyle = isHit ? '#ffffff' : '#fff';
            this.ctx.fillRect(-5 * this.scale, -5 * this.scale, 10 * this.scale, 10 * this.scale);
        }
        this.ctx.restore();
    }

    // Meteors
    for (const m of this.meteors) {
        this.ctx.save();
        this.ctx.translate(m.x, m.y);
        this.ctx.rotate(m.rotation);
        
        this.ctx.fillStyle = '#8B4513';
        this.ctx.strokeStyle = '#5c2d0c';
        this.ctx.lineWidth = 2 * this.scale;
        this.ctx.beginPath();
        
        // Rocky shape
        for(let i=0; i<8; i++) {
            const ang = (i * Math.PI / 4);
            const rad = m.radius * (0.8 + Math.sin(i * 123.4) * 0.2); 
            this.ctx.lineTo(Math.cos(ang)*rad, Math.sin(ang)*rad);
        }
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.stroke();
        this.ctx.restore();
    }

    // PowerUps
    for (const p of this.powerUps) {
        let color = '#fff';
        let symbol = '?';
        switch (p.type) {
            case 'shield': color = '#00ffff'; symbol = 'S'; break;
            case 'health': color = '#00ff00'; symbol = 'H'; break;
            case 'weapon': color = '#ff00ff'; symbol = 'W'; break;
            case 'score': color = '#ffff00'; symbol = 'X'; break;
            case 'rocket': color = '#ff4400'; symbol = 'R'; break;
        }
        
        // Blink if about to expire
        if (p.life > 3 || Math.floor(p.life * 10) % 2 === 0) {
            this.ctx.fillStyle = color;
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y, p.radius * this.scale, 0, Math.PI * 2);
            this.ctx.fill();
            
            this.ctx.fillStyle = '#000';
            this.ctx.font = `bold ${14 * this.scale}px monospace`;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(symbol, p.x, p.y + 1 * this.scale);
        }
        
        // Glow effect
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 2 * this.scale;
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, (p.radius + 3 + Math.sin(performance.now()/100)*2) * this.scale, 0, Math.PI * 2);
        this.ctx.stroke();
    }

    // Bullets
    for (const b of this.bullets) {
        if (b.isRocket) {
            // Rocket glow effect
            const rocketGlow = this.ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.radius * 3 * this.scale);
            rocketGlow.addColorStop(0, 'rgba(255, 100, 0, 0.6)');
            rocketGlow.addColorStop(1, 'rgba(255, 50, 0, 0)');
            this.ctx.fillStyle = rocketGlow;
            this.ctx.beginPath();
            this.ctx.arc(b.x, b.y, b.radius * 3 * this.scale, 0, Math.PI * 2);
            this.ctx.fill();

            // Rocket body
            this.ctx.fillStyle = '#ff4400';
            this.ctx.beginPath();
            this.ctx.moveTo(b.x - 12 * this.scale, b.y + 15 * this.scale);
            this.ctx.lineTo(b.x + 12 * this.scale, b.y + 15 * this.scale);
            this.ctx.lineTo(b.x, b.y - 25 * this.scale);
            this.ctx.fill();

            // Enhanced Rocket fire trail
            this.ctx.fillStyle = '#ffff00';
            const flameHeight = (15 + Math.random() * 20) * this.scale;
            this.ctx.beginPath();
            this.ctx.moveTo(b.x - 6 * this.scale, b.y + 15 * this.scale);
            this.ctx.lineTo(b.x + 6 * this.scale, b.y + 15 * this.scale);
            this.ctx.lineTo(b.x, b.y + (15 * this.scale) + flameHeight);
            this.ctx.fill();

            // Occasional exhaust particles
            if (Math.random() > 0.4) {
               this.createParticles(b.x, b.y + 15 * this.scale, '#ff8800', 1, 1);
            }
        } else {
            this.ctx.fillStyle = b.isPlayer ? '#00ffff' : '#ff0055';
            this.ctx.fillRect(b.x - b.radius * this.scale, b.y - b.radius * 2 * this.scale, b.radius * 2 * this.scale, b.radius * 4 * this.scale);
        }
    }

    // Particles
    this.ctx.globalCompositeOperation = 'screen';
    for (const p of this.particles) {
        this.ctx.globalAlpha = p.life / p.maxLife;
        this.ctx.fillStyle = p.color;
        // Using fillRect for particles is significantly faster
        this.ctx.fillRect(p.x - p.radius * this.scale, p.y - p.radius * this.scale, p.radius * 2 * this.scale, p.radius * 2 * this.scale);
    }
    this.ctx.globalAlpha = 1.0;
    this.ctx.globalCompositeOperation = 'source-over';
  }
}

