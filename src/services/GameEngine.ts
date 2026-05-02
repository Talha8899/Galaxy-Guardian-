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
  
  private isRunning: boolean = false;
  private nextEntityId = 0;
  private scrollSpeed = 50;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.resize();
    window.addEventListener('resize', this.resize);
    this.initStars();
    this.initPlanets();
  }

  public resize = () => {
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = rect.width;
    this.canvas.height = rect.height;
    if (this.player.x === 0) {
      this.player.x = this.canvas.width / 2;
      this.player.y = this.canvas.height - 100;
    }
  };

  public handleKeyDown = (e: KeyboardEvent) => {
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
        size: Math.random() * 2 + 0.5,
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
     const radius = Math.random() * 80 + 40;
     const featuresCount = Math.floor(Math.random() * 5) + 3;
     const features = [];
     for (let i = 0; i < featuresCount; i++) {
        features.push({
           x: (Math.random() - 0.5) * radius * 1.5,
           y: (Math.random() - 0.5) * radius * 1.5,
           r: Math.random() * radius * 0.3 + 5,
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
      x: this.canvas.width / 2, y: this.canvas.height - 100,
      energy: 100, maxEnergy: 100,
      health: 100, maxHealth: 100,
      isShielded: false,
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
            radius: Math.random() * 3 + 1,
            life: 1.0, maxLife: Math.random() * 0.5 + 0.2,
            color, markedForDeletion: false
        });
    }
  }

  private spawnMeteor() {
    const radius = Math.random() * 30 + 20;
    this.meteors.push({
      id: this.nextEntityId++,
      x: Math.random() * this.canvas.width,
      y: -50,
      vx: (Math.random() - 0.5) * 40,
      vy: Math.random() * 50 + 60 + (this.wave * 5),
      radius,
      rotation: Math.random() * Math.PI * 2,
      spinSpeed: (Math.random() - 0.5) * 2,
      markedForDeletion: false
    });
  }

  private spawnEnemy(forceType?: 'drone' | 'hunter' | 'bruiser') {
    const rand = Math.random();
    let type: 'drone' | 'hunter' | 'bruiser' = 'drone';
    if (forceType) {
        type = forceType;
    } else {
        // As waves increase, harder enemies appear more frequently
        const bruiserChance = Math.min(0.3, 0.05 + this.wave * 0.02);
        const hunterChance = Math.min(0.5, 0.15 + this.wave * 0.03);
        if (rand < bruiserChance) type = 'bruiser';
        else if (rand < bruiserChance + hunterChance) type = 'hunter';
    }

    let hp = 1, radius = 14, vx = 0, vy = 0, shootTimer = 0;

    // HP scales with wave
    const hpMult = 1 + Math.floor(this.wave / 3) * 0.5;

    if (type === 'bruiser') {
        hp = Math.floor(8 * hpMult);
        radius = 28;
        vy = Math.random() * 15 + 20 + (this.wave * 4);
        shootTimer = Math.max(0.5, Math.random() * 2 + 1 - (this.wave * 0.05));
    } else if (type === 'hunter') {
        hp = Math.floor(3 * hpMult);
        radius = 18;
        vy = Math.random() * 30 + 40 + (this.wave * 8);
        shootTimer = Math.max(0.3, Math.random() * 2 - (this.wave * 0.1));
    } else {
        hp = Math.floor(1 * hpMult);
        vx = (Math.random() - 0.5) * 80;
        vy = Math.random() * 40 + 50 + (this.wave * 10);
        shootTimer = Math.max(0.5, Math.random() * 2 + 1 - (this.wave * 0.05));
    }

    this.enemies.push({
      id: this.nextEntityId++,
      type,
      x: Math.random() * this.canvas.width,
      y: -30,
      vx, vy, radius, hp, maxHp: hp,
      shootTimer,
      markedForDeletion: false
    });
  }

  private loop = (timestamp: number) => {
    if (!this.isRunning) return;
    
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
      y: -100,
      vx: 0,
      vy: 50,
      radius: 40,
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
    this.player.isShielded = false;

    // Keyboard movement
    const speed = 600;
    if (this.keys.has('ArrowUp') || this.keys.has('KeyW')) this.player.y -= speed * dt;
    if (this.keys.has('ArrowDown') || this.keys.has('KeyS')) this.player.y += speed * dt;
    if (this.keys.has('ArrowLeft') || this.keys.has('KeyA')) this.player.x -= speed * dt;
    if (this.keys.has('ArrowRight') || this.keys.has('KeyD')) this.player.x += speed * dt;

    let isShooting = this.keys.has('Space');
    let isShielding = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') || this.keys.has('KeyZ');
    let isFiringRocket = this.keys.has('KeyX') || this.keys.has('KeyF') || this.keys.has('Digit1');

    this.player.x = Math.max(15, Math.min(this.canvas.width - 15, this.player.x));
    this.player.y = Math.max(15, Math.min(this.canvas.height - 15, this.player.y));

    if (this.playerRocketTimer > 0) this.playerRocketTimer -= dt;

    if (isShielding) {
        if (this.player.energy > 0) {
            this.player.isShielded = true;
            if (!this.wasShielded) {
                SoundManager.shieldOn();
            }
            this.player.energy -= 40 * dt; // Drain energy
            
            // Subtle health regeneration while shielded
            if (this.player.health < this.player.maxHealth) {
                this.player.health += 1.5 * dt; // Regenerate small amount per second
                if (this.player.health > this.player.maxHealth) this.player.health = this.player.maxHealth;
            }
        }
    } else if (isShooting) {
        this.playerShootTimer -= dt;
        if (this.playerShootTimer <= 0 && !this.player.isShielded) {
            const isBuffed = this.player.weaponTimer > 0;
            if (isBuffed) {
                SoundManager.shootPower();
                for (let fan of [-1, 0, 1]) {
                    this.bullets.push({
                        id: this.nextEntityId++,
                        x: this.player.x + (fan * 10), y: this.player.y - 15,
                        vx: fan * 150, vy: -600, radius: 4, markedForDeletion: false,
                        isPlayer: true, damage: 2
                    });
                }
                this.playerShootTimer = 0.15;
            } else {
                SoundManager.shoot();
                this.bullets.push({
                    id: this.nextEntityId++,
                    x: this.player.x - 10, y: this.player.y - 15,
                    vx: 0, vy: -500, radius: 4, markedForDeletion: false,
                    isPlayer: true, damage: 1
                });
                this.bullets.push({
                    id: this.nextEntityId++,
                    x: this.player.x + 10, y: this.player.y - 15,
                    vx: 0, vy: -500, radius: 4, markedForDeletion: false,
                    isPlayer: true, damage: 1
                });
                this.playerShootTimer = 0.2; // slightly slower fire rate
            }
        }
    }

    if (isFiringRocket && this.player.rocketCount > 0 && !this.player.isShielded && this.playerRocketTimer <= 0) {
        this.player.rocketCount--;
        SoundManager.rocket();
        this.bullets.push({
            id: this.nextEntityId++,
            x: this.player.x, y: this.player.y - 20,
            vx: 0, vy: -800, radius: 12, markedForDeletion: false,
            isPlayer: true, isRocket: true, damage: 300
        });
        this.playerRocketTimer = 0.5; // Cooldown after rocket now uses its own timer
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
                            vx: fan * 90, vy: 220 + (this.wave * 5),
                            radius: 6, markedForDeletion: false,
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
                        vx: Math.cos(angle) * 450, vy: Math.sin(angle) * 450,
                        radius: 8, markedForDeletion: false,
                        isPlayer: false, damage: 18
                    });

                    if (Math.floor(e.bossTimer * 2) % 2 === 0) {
                         for (let fan of [-1.2, 1.2]) {
                             this.bullets.push({
                                id: this.nextEntityId++,
                                x: e.x, y: e.y + e.radius,
                                vx: fan * 180, vy: 280,
                                radius: 5, markedForDeletion: false,
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
                            vx: Math.cos(angle) * 350, vy: Math.sin(angle) * 350,
                            radius: 5, markedForDeletion: false,
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
                        vx: fan * 100, vy: 250 + (this.wave * 10),
                        radius: 5, markedForDeletion: false,
                        isPlayer: false, damage: 15
                    });
                }
                e.shootTimer = 3.5;
            } else {
                this.bullets.push({
                    id: this.nextEntityId++,
                    x: e.x, y: e.y + e.radius,
                    vx: 0, vy: 300 + (this.wave * 15),
                    radius: 4, markedForDeletion: false,
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

    const playerHitbox = { x: this.player.x, y: this.player.y, radius: this.player.isShielded ? 40 : 15 };

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
                // Bounce meteor slightly, destroy shield faster
                m.vy = -m.vy * 0.5;
                m.vx += (m.x - this.player.x) * 2;
                this.player.energy -= 20;
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
                this.player.energy -= 10;
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
                                x: e.x + (Math.random() - 0.5) * 40,
                                y: e.y + (Math.random() - 0.5) * 40,
                                vx: (Math.random() - 0.5) * 120,
                                vy: Math.random() * 80 + 100, // Always move down
                                radius: 12, life: 10, markedForDeletion: false
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
                    this.player.energy -= 5; // Shield takes a hit
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
              this.player.energy = Math.min(this.player.maxEnergy, this.player.energy + 50);
              this.createParticles(this.player.x, this.player.y, '#00ffff', 15);
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
    this.ctx.fillStyle = '#05020a';
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
        const radGrad = this.ctx.createRadialGradient(0, 0, p.radius, 0, 0, p.radius + 40);
        radGrad.addColorStop(0, p.atmosphereColor);
        radGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        this.ctx.fillStyle = radGrad;
        this.ctx.arc(0, 0, p.radius + 40, 0, Math.PI * 2);
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
           this.ctx.lineWidth = 6;
           this.ctx.stroke();
           
           // Double ring for variety
           this.ctx.beginPath();
           this.ctx.ellipse(0, 0, p.radius * 2.4, p.radius * 0.55, 0, 0, Math.PI * 2);
           this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
           this.ctx.lineWidth = 2;
           this.ctx.stroke();
        }
        
        this.ctx.restore();
    }

    this.ctx.globalCompositeOperation = 'screen';

    // Player Ship
    this.ctx.save();
    this.ctx.translate(this.player.x, this.player.y);
    
    // Thrust main
    this.ctx.fillStyle = '#00ffff';
    this.ctx.beginPath();
    this.ctx.moveTo(-6, 12);
    this.ctx.lineTo(6, 12);
    this.ctx.lineTo(0, 25 + Math.random() * 15);
    this.ctx.fill();

    // Thrust sides
    this.ctx.fillStyle = '#ff00aa';
    this.ctx.beginPath();
    this.ctx.moveTo(-16, 10);
    this.ctx.lineTo(-10, 10);
    this.ctx.lineTo(-13, 20 + Math.random() * 8);
    this.ctx.fill();
    this.ctx.beginPath();
    this.ctx.moveTo(10, 10);
    this.ctx.lineTo(16, 10);
    this.ctx.lineTo(13, 20 + Math.random() * 8);
    this.ctx.fill();

    // Ship Body Gradient
    const shipGrad = this.ctx.createLinearGradient(0, -25, 0, 15);
    shipGrad.addColorStop(0, '#e2e8f0');
    shipGrad.addColorStop(1, '#64748b');

    this.ctx.fillStyle = shipGrad;
    this.ctx.beginPath();
    this.ctx.moveTo(0, -25); // Nose
    this.ctx.lineTo(18, 15); // Right Wing
    this.ctx.lineTo(8, 10);  // Right engine recess
    this.ctx.lineTo(-8, 10); // Left engine recess
    this.ctx.lineTo(-18, 15); // Left Wing
    this.ctx.closePath();
    this.ctx.fill();

    // Cockpit
    this.ctx.fillStyle = '#0ea5e9';
    this.ctx.beginPath();
    this.ctx.ellipse(0, -5, 4, 8, 0, 0, Math.PI * 2);
    this.ctx.fill();

    // Shield
    if (this.player.isShielded) {
        this.ctx.strokeStyle = `rgba(34, 211, 238, ${this.player.energy / this.player.maxEnergy})`;
        this.ctx.lineWidth = 3;
        // removing shadow blur to improve frame rate
        this.ctx.beginPath();
        this.ctx.arc(0, 0, 40, 0, Math.PI * 2);
        this.ctx.stroke();
        
        // inner fill instead of shadow blob
        this.ctx.fillStyle = `rgba(34, 211, 238, 0.15)`;
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
            this.ctx.moveTo(0, 15);
            this.ctx.lineTo(15, -10);
            this.ctx.lineTo(0, 0);
            this.ctx.lineTo(-15, -10);
            this.ctx.fill();
        } else if (e.type === 'bruiser') {
            this.ctx.fillStyle = isHit ? '#ffffff' : '#0a2211';
            this.ctx.strokeStyle = isHit ? '#ffffff' : '#00ff55'; // neon green
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.moveTo(0, 20);
            this.ctx.lineTo(25, 0);
            this.ctx.lineTo(15, -20);
            this.ctx.lineTo(-15, -20);
            this.ctx.lineTo(-25, 0);
            this.ctx.closePath();
            this.ctx.fill();
            this.ctx.stroke();
            
            // Health bar for bruiser
            this.ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
            this.ctx.fillRect(-20, -28, 40, 4);
            this.ctx.fillStyle = '#00ff00';
            this.ctx.fillRect(-20, -28, 40 * (e.hp / e.maxHp), 4);
        } else if (e.type === 'boss') {
            let bossColor = '#8800ff'; // Phase 1: Purple
            if (e.bossPhase === 2) bossColor = '#ff0055'; // Phase 2: Pink/Red
            if (e.bossPhase === 3) bossColor = '#ff8800'; // Phase 3: Orange/Fire
            
            this.ctx.fillStyle = isHit ? '#ffffff' : bossColor;
            this.ctx.strokeStyle = isHit ? '#ffffff' : '#fff';
            this.ctx.lineWidth = 3;

            // Phase 3 gets an extra pulsing glow
            if (e.bossPhase === 3) {
                const glowSize = 60 + Math.sin(Date.now() / 100) * 10;
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
            this.ctx.moveTo(0, 40);
            this.ctx.lineTo(50, 0);
            this.ctx.lineTo(30, -30);
            this.ctx.lineTo(-30, -30);
            this.ctx.lineTo(-50, 0);
            this.ctx.closePath();
            this.ctx.fill();
            this.ctx.stroke();

            // Cockpit or core detail
            this.ctx.fillStyle = isHit ? '#ffffff' : '#00ffff';
            if (e.bossPhase === 3) this.ctx.fillStyle = isHit ? '#ffffff' : '#ffff00';
            this.ctx.beginPath();
            this.ctx.arc(0, -10, 15, 0, Math.PI * 2);
            this.ctx.fill();

            // Boss engine flare
            const flareY = -30;
            this.ctx.fillStyle = e.bossPhase === 3 ? '#ff4400' : '#00ffff';
            const flareSize = 10 + Math.sin(Date.now() / 50) * 5;
            this.ctx.fillRect(-25, flareY, 10, flareSize);
            this.ctx.fillRect(15, flareY, 10, flareSize);
        } else {
            this.ctx.fillStyle = isHit ? '#ffffff' : '#ff5500'; // neon orange
            this.ctx.beginPath();
            this.ctx.arc(0, 0, e.radius, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.fillStyle = isHit ? '#ffffff' : '#fff';
            this.ctx.fillRect(-5, -5, 10, 10);
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
        this.ctx.lineWidth = 2;
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
            this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            this.ctx.fill();
            
            this.ctx.fillStyle = '#000';
            this.ctx.font = 'bold 14px monospace';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(symbol, p.x, p.y + 1);
        }
        
        // Glow effect
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, p.radius + 3 + Math.sin(performance.now()/100)*2, 0, Math.PI * 2);
        this.ctx.stroke();
    }

    // Bullets
    for (const b of this.bullets) {
        if (b.isRocket) {
            // Rocket glow effect
            const rocketGlow = this.ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.radius * 3);
            rocketGlow.addColorStop(0, 'rgba(255, 100, 0, 0.6)');
            rocketGlow.addColorStop(1, 'rgba(255, 50, 0, 0)');
            this.ctx.fillStyle = rocketGlow;
            this.ctx.beginPath();
            this.ctx.arc(b.x, b.y, b.radius * 3, 0, Math.PI * 2);
            this.ctx.fill();

            // Rocket body
            this.ctx.fillStyle = '#ff4400';
            this.ctx.beginPath();
            this.ctx.moveTo(b.x - 12, b.y + 15);
            this.ctx.lineTo(b.x + 12, b.y + 15);
            this.ctx.lineTo(b.x, b.y - 25);
            this.ctx.fill();

            // Enhanced Rocket fire trail
            this.ctx.fillStyle = '#ffff00';
            const flameHeight = 15 + Math.random() * 20;
            this.ctx.beginPath();
            this.ctx.moveTo(b.x - 6, b.y + 15);
            this.ctx.lineTo(b.x + 6, b.y + 15);
            this.ctx.lineTo(b.x, b.y + 15 + flameHeight);
            this.ctx.fill();

            // Occasional exhaust particles
            if (Math.random() > 0.4) {
               this.createParticles(b.x, b.y + 15, '#ff8800', 1, 1);
            }
        } else {
            this.ctx.fillStyle = b.isPlayer ? '#00ffff' : '#ff0055';
            this.ctx.fillRect(b.x - b.radius, b.y - b.radius * 2, b.radius * 2, b.radius * 4);
        }
    }

    // Particles
    this.ctx.globalCompositeOperation = 'screen';
    for (const p of this.particles) {
        this.ctx.globalAlpha = p.life / p.maxLife;
        this.ctx.fillStyle = p.color;
        // Using fillRect for particles is significantly faster
        this.ctx.fillRect(p.x - p.radius, p.y - p.radius, p.radius * 2, p.radius * 2);
    }
    this.ctx.globalAlpha = 1.0;
    this.ctx.globalCompositeOperation = 'source-over';
  }
}

