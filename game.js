// --- AUDIO ENGINE (Web Audio API Retro Synth) ---
class SoundEngine {
  constructor() {
    this.ctx = null;
    this.isMuted = localStorage.getItem('surf_cat_muted') === 'true';
  }

  init() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      console.warn("Web Audio API not supported", e);
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    localStorage.setItem('surf_cat_muted', this.isMuted);
    return this.isMuted;
  }

  playJump() {
    if (this.isMuted || !this.ctx) return;
    this.init();
    
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(580, now + 0.14);
    
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.14);
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.start(now);
    osc.stop(now + 0.14);
  }

  playCollect() {
    if (this.isMuted || !this.ctx) return;
    this.init();
    
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(523.25, now); // C5
    osc.frequency.setValueAtTime(659.25, now + 0.08); // E5
    
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.setValueAtTime(0.08, now + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.22);
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.start(now);
    osc.stop(now + 0.22);
  }

  playDive() {
    if (this.isMuted || !this.ctx) return;
    this.init();
    
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.exponentialRampToValueAtTime(180, now + 0.12);
    
    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.start(now);
    osc.stop(now + 0.12);
  }

  playCrash() {
    if (this.isMuted || !this.ctx) return;
    this.init();
    
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(260, now);
    osc.frequency.linearRampToValueAtTime(60, now + 0.45);
    
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.45);
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.start(now);
    osc.stop(now + 0.45);
  }
}

const sound = new SoundEngine();

// --- GAME CONFIGURATION ---
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 400;
const FLOOR_Y = 320;
const GRAVITY = 0.65;
const BASE_SPEED = 5.0;
const MAX_SPEED = 10.5;

// --- STATE MANAGEMENT ---
let gameState = 'START'; // START, PLAYING, PAUSED, GAMEOVER
let score = 0;
let highScore = parseInt(localStorage.getItem('surf_cat_hiscore')) || 0;
let gameSpeed = BASE_SPEED;
let distanceRan = 0;

// Canvas details
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// UI DOM references
const screenStart = document.getElementById('screen-start');
const screenPause = document.getElementById('screen-pause');
const screenGameover = document.getElementById('screen-gameover');
const currentScoreEl = document.getElementById('current-score');
const highScoreEl = document.getElementById('high-score');
const finalScoreEl = document.getElementById('final-score');
const finalHighEl = document.getElementById('final-high');

const btnStart = document.getElementById('btn-start');
const btnResume = document.getElementById('btn-resume');
const btnRestart = document.getElementById('btn-restart');
const btnPause = document.getElementById('btn-pause');
const btnSound = document.getElementById('btn-sound');
const soundIconPath = document.getElementById('sound-icon-path');

// Update high score in DOM on load
highScoreEl.textContent = String(highScore).padStart(5, '0');

// Sync sound mute icon initially
updateSoundIcon();

// --- PLAYER ENTITY (CAT) ---
class Cat {
  constructor() {
    this.width = 54;
    this.height = 40;
    this.x = 110;
    this.y = FLOOR_Y - this.height;
    this.vy = 0;
    this.jumpForce = -12.5;
    
    // States: 'running', 'jumping', 'diving', 'sliding', 'dead'
    this.state = 'running';
    
    // Animation variables
    this.runTimer = 0;
    this.runFrame = 0;
    this.tailAngle = 0;
    this.blinkTimer = 0;
    this.isBlinking = false;
  }

  reset() {
    this.y = FLOOR_Y - this.height;
    this.vy = 0;
    this.state = 'running';
    this.width = 54;
    this.height = 40;
    this.runTimer = 0;
    this.runFrame = 0;
    this.tailAngle = 0;
  }

  jump() {
    if (this.state === 'running' || this.state === 'sliding') {
      this.state = 'jumping';
      this.vy = this.jumpForce;
      sound.playJump();
      // Spawn puff particle at launch point
      particles.push(new JumpPuff(this.x + this.width / 2, FLOOR_Y));
    }
  }

  dive() {
    if (this.state === 'jumping') {
      this.state = 'diving';
      this.vy = 14; // Strong downward velocity
      sound.playDive();
      // Spawn neon streak particle
      particles.push(new DiveStreak(this.x + this.width / 2, this.y + this.height / 2));
    }
  }

  setSlide(isSliding) {
    if (this.state === 'dead') return;
    
    if (isSliding) {
      if (this.state === 'running') {
        this.state = 'sliding';
        this.height = 24; // Flat bounding box
        this.y = FLOOR_Y - this.height;
      }
    } else {
      if (this.state === 'sliding') {
        this.state = 'running';
        this.height = 40; // Restore standard box
        this.y = FLOOR_Y - this.height;
      }
    }
  }

  update(dtMultiplier) {
    // Blinking eye routine
    this.blinkTimer += dtMultiplier;
    if (this.blinkTimer > 180) {
      this.isBlinking = true;
      if (this.blinkTimer > 192) {
        this.isBlinking = false;
        this.blinkTimer = 0;
      }
    }

    // Apply gravity
    if (this.state === 'jumping' || this.state === 'diving') {
      this.vy += GRAVITY * dtMultiplier;
      this.y += this.vy * dtMultiplier;

      // Check ground collision
      if (this.y + this.height >= FLOOR_Y) {
        this.y = FLOOR_Y - this.height;
        this.vy = 0;
        this.state = 'running';
        // Spawn small dust puff on landing
        for (let i = 0; i < 3; i++) {
          particles.push(new Dust(this.x + this.width / 2, FLOOR_Y, -2 - Math.random() * 2));
        }
      }
    }

    // Run animation frames
    if (this.state === 'running') {
      this.runTimer += dtMultiplier * (gameSpeed / 5);
      if (this.runTimer > 6) {
        this.runFrame = (this.runFrame + 1) % 4;
        this.runTimer = 0;
        // Spawn running dust occasionally
        if (this.runFrame === 0 || this.runFrame === 2) {
          particles.push(new Dust(this.x, FLOOR_Y, -gameSpeed * 0.3));
        }
      }
      this.tailAngle = Math.sin(Date.now() * 0.015) * 12; // Wavy tail
    } else if (this.state === 'sliding') {
      this.runTimer += dtMultiplier * (gameSpeed / 5);
      if (this.runTimer > 4) {
        this.runFrame = (this.runFrame + 1) % 2;
        this.runTimer = 0;
        particles.push(new Dust(this.x, FLOOR_Y, -gameSpeed * 0.4));
      }
      this.tailAngle = 5;
    }
  }

  getHitbox() {
    // Returns padded hitbox for fairer gameplay
    if (this.state === 'sliding') {
      return {
        x: this.x + 6,
        y: this.y + 2,
        width: this.width - 10,
        height: this.height - 2
      };
    }
    return {
      x: this.x + 8,
      y: this.y + 4,
      width: this.width - 16,
      height: this.height - 6
    };
  }

  draw() {
    ctx.save();
    ctx.translate(this.x, this.y);

    // Dynamic coloring - Soft cream-white cat with pastel accents
    const bodyColor = '#fdfcf7';
    const detailColor = '#ffd29d'; // Pastel light orange stripes
    const pinkEar = '#ffa4b6';
    const collarColor = '#a78bfa'; // Neon purple collar
    const collarTagColor = '#ffd23f'; // Golden bell

    if (this.state === 'dead') {
      // Draw sleeping/collapsed dead cat
      ctx.translate(this.width / 2, this.height / 2);
      ctx.rotate(Math.PI * 0.45); // Rolled onto side
      ctx.translate(-this.width / 2, -this.height / 2);
    }

    if (this.state === 'sliding') {
      // Draw flattened sliding cat
      // Tail
      ctx.beginPath();
      ctx.strokeStyle = bodyColor;
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.moveTo(4, 16);
      ctx.quadraticCurveTo(-10, 10, -6, 2);
      ctx.stroke();

      // Body (lowered)
      ctx.fillStyle = bodyColor;
      ctx.beginPath();
      ctx.roundRect(4, 6, 42, 18, [8, 12, 10, 8]);
      ctx.fill();

      // Head (lowered)
      ctx.beginPath();
      ctx.arc(43, 10, 9, 0, Math.PI * 2);
      ctx.fill();

      // Ears (pointing backward)
      ctx.fillStyle = detailColor;
      ctx.beginPath();
      ctx.moveTo(38, 3);
      ctx.lineTo(30, 4);
      ctx.lineTo(37, 8);
      ctx.fill();

      // Closed/blinking eyes (X_X if dead, else content closed eyes)
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(44, 9);
      ctx.lineTo(46, 11);
      ctx.moveTo(44, 11);
      ctx.lineTo(46, 9);
      ctx.stroke();

      // Sliding legs
      ctx.fillStyle = bodyColor;
      if (this.runFrame === 0) {
        ctx.fillRect(8, 22, 10, 3);
        ctx.fillRect(32, 22, 10, 3);
      } else {
        ctx.fillRect(12, 22, 10, 3);
        ctx.fillRect(28, 22, 10, 3);
      }
    } else {
      // Standard Cat Drawing (Running, Jumping, Diving)
      // 1. Tail (Animated)
      ctx.save();
      ctx.translate(6, 20);
      ctx.rotate((this.tailAngle * Math.PI) / 180);
      ctx.beginPath();
      ctx.strokeStyle = bodyColor;
      ctx.lineWidth = 5.5;
      ctx.lineCap = 'round';
      ctx.moveTo(0, 0);
      if (this.state === 'diving') {
        ctx.quadraticCurveTo(-12, -18, -6, -26);
      } else {
        ctx.quadraticCurveTo(-8, -12, -4, -20);
      }
      ctx.stroke();
      ctx.restore();

      // 2. Legs (Dynamic swing depending on states)
      ctx.fillStyle = bodyColor;
      const legY = 28;
      const legHeight = 12;
      const legWidth = 5;

      if (this.state === 'running') {
        // Run cycle: alternating legs swing back and forth
        let legOffset1 = Math.sin(this.runTimer * 0.8) * 8;
        let legOffset2 = -Math.sin(this.runTimer * 0.8) * 8;
        
        ctx.fillRect(10 + legOffset1, legY, legWidth, legHeight);
        ctx.fillRect(18 + legOffset2, legY, legWidth, legHeight);
        ctx.fillRect(32 + legOffset2, legY, legWidth, legHeight);
        ctx.fillRect(40 + legOffset1, legY, legWidth, legHeight);
      } else if (this.state === 'jumping') {
        // Legs curled inward slightly
        ctx.fillRect(12, legY, legWidth, legHeight - 4);
        ctx.fillRect(18, legY, legWidth, legHeight - 4);
        ctx.fillRect(30, legY, legWidth, legHeight - 4);
        ctx.fillRect(36, legY, legWidth, legHeight - 4);
      } else if (this.state === 'diving') {
        // Legs stretched backwards
        ctx.save();
        ctx.rotate(-Math.PI * 0.1);
        ctx.fillRect(6, legY - 2, legWidth, legHeight);
        ctx.fillRect(12, legY - 2, legWidth, legHeight);
        ctx.fillRect(26, legY - 2, legWidth, legHeight);
        ctx.fillRect(32, legY - 2, legWidth, legHeight);
        ctx.restore();
      }

      // 3. Body
      ctx.fillStyle = bodyColor;
      ctx.beginPath();
      // Draw rounded torso
      ctx.roundRect(8, 10, 38, 22, 12);
      ctx.fill();

      // Cozy orange stripes on body
      ctx.fillStyle = detailColor;
      ctx.beginPath();
      ctx.roundRect(16, 10, 4, 10, 2);
      ctx.roundRect(24, 10, 4, 12, 2);
      ctx.roundRect(32, 10, 4, 10, 2);
      ctx.fill();

      // 4. Collar & Tag
      ctx.fillStyle = collarColor;
      ctx.fillRect(38, 14, 4, 10);
      ctx.fillStyle = collarTagColor;
      ctx.beginPath();
      ctx.arc(40, 24, 2.5, 0, Math.PI * 2);
      ctx.fill();

      // 5. Head
      ctx.fillStyle = bodyColor;
      ctx.beginPath();
      ctx.arc(43, 13, 11, 0, Math.PI * 2);
      ctx.fill();

      // Ears (Triangles)
      ctx.fillStyle = bodyColor;
      ctx.beginPath();
      // Left Ear
      ctx.moveTo(34, 7);
      ctx.lineTo(37, -3);
      ctx.lineTo(42, 4);
      // Right Ear
      ctx.moveTo(44, 4);
      ctx.lineTo(49, -3);
      ctx.lineTo(52, 7);
      ctx.fill();

      // Inner Ear (Pink accent)
      ctx.fillStyle = pinkEar;
      ctx.beginPath();
      ctx.moveTo(36, 5);
      ctx.lineTo(38, 0);
      ctx.lineTo(40, 4);
      ctx.moveTo(46, 4);
      ctx.lineTo(48, 0);
      ctx.lineTo(50, 5);
      ctx.fill();

      // 6. Face Details
      if (this.state === 'dead') {
        // Dead cross eyes X X
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        // Eye 1
        ctx.moveTo(42, 11); ctx.lineTo(45, 14);
        ctx.moveTo(45, 11); ctx.lineTo(42, 14);
        // Eye 2
        ctx.moveTo(48, 11); ctx.lineTo(51, 14);
        ctx.moveTo(51, 11); ctx.lineTo(48, 14);
        ctx.stroke();
      } else {
        // Glowing Neon Yellow Eyes
        ctx.fillStyle = '#ffd23f';
        if (this.isBlinking) {
          // Closed line eyes
          ctx.strokeStyle = '#333';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(41, 13); ctx.lineTo(45, 13);
          ctx.moveTo(47, 13); ctx.lineTo(51, 13);
          ctx.stroke();
        } else {
          // Round eyes
          ctx.beginPath();
          ctx.arc(43, 12, 2.5, 0, Math.PI * 2);
          ctx.arc(49, 12, 2.5, 0, Math.PI * 2);
          ctx.fill();
          
          // Slit Pupils (Cat style)
          ctx.fillStyle = '#111';
          ctx.fillRect(42.5, 10.5, 1, 3);
          ctx.fillRect(48.5, 10.5, 1, 3);
        }
      }

      // Nose & Whiskers
      ctx.fillStyle = pinkEar;
      ctx.beginPath();
      ctx.moveTo(45.5, 15);
      ctx.lineTo(46.5, 15);
      ctx.lineTo(46, 16);
      ctx.fill();

      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      // Left whiskers
      ctx.moveTo(39, 16); ctx.lineTo(34, 15);
      ctx.moveTo(39, 17); ctx.lineTo(33, 18);
      // Right whiskers
      ctx.moveTo(51, 16); ctx.lineTo(56, 15);
      ctx.moveTo(51, 17); ctx.lineTo(57, 18);
      ctx.stroke();
    }

    ctx.restore();
  }
}

const player = new Cat();

// --- PARALLAX BACKGROUND SYSTEM ---
class Starfield {
  constructor() {
    this.stars = [];
    this.maxStars = 45;
    for (let i = 0; i < this.maxStars; i++) {
      this.stars.push({
        x: Math.random() * CANVAS_WIDTH,
        y: Math.random() * (CANVAS_HEIGHT - 180),
        size: 0.5 + Math.random() * 1.5,
        brightness: Math.random(),
        speed: 0.05 + Math.random() * 0.08
      });
    }
  }

  update(dtMultiplier) {
    this.stars.forEach(star => {
      // Drift left very slowly
      star.x -= star.speed * (gameSpeed / 4) * dtMultiplier;
      if (star.x < 0) {
        star.x = CANVAS_WIDTH;
        star.y = Math.random() * (CANVAS_HEIGHT - 180);
      }
      // Twinkle
      star.brightness += (Math.random() - 0.5) * 0.08;
      if (star.brightness < 0) star.brightness = 0;
      if (star.brightness > 1) star.brightness = 1;
    });
  }

  draw() {
    this.stars.forEach(star => {
      ctx.fillStyle = `rgba(255, 255, 255, ${star.brightness})`;
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
      ctx.fill();
    });

    // Draw large glowing Moon
    ctx.save();
    ctx.shadowBlur = 30;
    ctx.shadowColor = 'rgba(254, 243, 199, 0.4)';
    ctx.fillStyle = 'rgba(254, 243, 199, 0.85)';
    ctx.beginPath();
    ctx.arc(680, 75, 28, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Subtle moon crater detail
    ctx.fillStyle = 'rgba(217, 119, 6, 0.06)';
    ctx.beginPath();
    ctx.arc(668, 70, 5, 0, Math.PI * 2);
    ctx.arc(684, 85, 8, 0, Math.PI * 2);
    ctx.arc(672, 88, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

class CitySilhouettes {
  constructor(layerIndex) {
    this.layerIndex = layerIndex; // 0 = Far, 1 = Middle
    this.buildings = [];
    this.widthRange = layerIndex === 0 ? [50, 100] : [70, 130];
    this.heightRange = layerIndex === 0 ? [100, 200] : [140, 240];
    this.scrollSpeed = layerIndex === 0 ? 0.08 : 0.28;
    this.color = layerIndex === 0 ? '#101124' : '#171936';
    
    // Generate initial buildings to fill screen
    let currentX = 0;
    while (currentX < CANVAS_WIDTH + 200) {
      const w = this.getRandom(this.widthRange);
      const h = this.getRandom(this.heightRange);
      this.buildings.push({
        x: currentX,
        width: w,
        height: h,
        windows: this.generateWindows(w, h)
      });
      currentX += w - 2; // slight overlap to prevent cracks
    }
  }

  getRandom(range) {
    return Math.floor(range[0] + Math.random() * (range[1] - range[0]));
  }

  generateWindows(w, h) {
    // Generate scattered window coordinates
    const windows = [];
    if (this.layerIndex === 0) return windows; // No windows in distant layer for simplicity
    
    const rows = Math.floor(h / 25) - 2;
    const cols = Math.floor(w / 20) - 1;
    
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (Math.random() < 0.25) { // 25% chance of light on
          windows.push({
            rx: 6 + c * 20,
            ry: 20 + r * 25,
            color: Math.random() < 0.4 ? '#fef08a' : '#c084fc' // Amber yellow or purple lights
          });
        }
      }
    }
    return windows;
  }

  update(dtMultiplier) {
    const shift = gameSpeed * this.scrollSpeed * dtMultiplier;
    
    this.buildings.forEach(b => {
      b.x -= shift;
    });

    // Remove scrolled out buildings
    if (this.buildings[0].x + this.buildings[0].width < 0) {
      this.buildings.shift();
    }

    // Append new buildings
    const lastBuilding = this.buildings[this.buildings.length - 1];
    if (lastBuilding.x + lastBuilding.width < CANVAS_WIDTH + 150) {
      const w = this.getRandom(this.widthRange);
      const h = this.getRandom(this.heightRange);
      this.buildings.push({
        x: lastBuilding.x + lastBuilding.width - 2,
        width: w,
        height: h,
        windows: this.generateWindows(w, h)
      });
    }
  }

  draw() {
    ctx.fillStyle = this.color;
    this.buildings.forEach(b => {
      // Draw building silhouette
      ctx.fillRect(b.x, CANVAS_HEIGHT - b.height, b.width, b.height);
      
      // Draw glowing windows for middle layer
      if (this.layerIndex === 1) {
        b.windows.forEach(w => {
          ctx.fillStyle = w.color;
          ctx.shadowBlur = 6;
          ctx.shadowColor = w.color;
          ctx.fillRect(b.x + w.rx, CANVAS_HEIGHT - b.height + w.ry, 8, 12);
        });
        ctx.shadowBlur = 0; // reset
        ctx.fillStyle = this.color; // reset for next building
      }
    });
  }
}

const backgroundStars = new Starfield();
const backgroundFarCity = new CitySilhouettes(0);
const backgroundMidCity = new CitySilhouettes(1);

// --- FLOOR / ACTIVE ROOFTOP FLOOR ---
class RooftopFloor {
  constructor() {
    this.x = 0;
  }

  update(dtMultiplier) {
    this.x -= gameSpeed * dtMultiplier;
    if (this.x <= -CANVAS_WIDTH) {
      this.x = 0;
    }
  }

  draw() {
    // Rooftop Slab (Deep purple-blue)
    const baseColor = '#1d2146';
    const ledgeColor = '#2b3064';
    const wireColor = 'rgba(255,255,255,0.06)';

    ctx.fillStyle = baseColor;
    ctx.fillRect(0, FLOOR_Y, CANVAS_WIDTH, CANVAS_HEIGHT - FLOOR_Y);

    // Decorative rooftop ledge line on top
    ctx.fillStyle = ledgeColor;
    ctx.fillRect(0, FLOOR_Y, CANVAS_WIDTH, 6);

    // Draw repeating ledge tiles/bricks for depth
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    let startX = Math.floor(this.x) % 30;
    for (let x = startX; x < CANVAS_WIDTH; x += 30) {
      ctx.fillRect(x, FLOOR_Y, 2, 6);
    }
    
    // Draw horizontal telephone cables in background
    ctx.strokeStyle = wireColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, FLOOR_Y - 45);
    ctx.lineTo(CANVAS_WIDTH, FLOOR_Y - 45);
    ctx.moveTo(0, FLOOR_Y - 55);
    ctx.lineTo(CANVAS_WIDTH, FLOOR_Y - 55);
    ctx.stroke();
  }
}

const activeFloor = new RooftopFloor();

// --- OBSTACLES SYSTEM ---
class Obstacle {
  constructor(x, type) {
    this.x = x;
    this.type = type; // 'chimney', 'antenna', 'laundry', 'pigeon'
    
    this.width = 0;
    this.height = 0;
    this.y = 0;
    this.passed = false;
    
    // Define properties based on type
    switch (type) {
      case 'chimney':
        this.width = 32;
        this.height = 42;
        this.y = FLOOR_Y - this.height;
        break;
      case 'antenna':
        this.width = 30;
        this.height = 68;
        this.y = FLOOR_Y - this.height;
        break;
      case 'laundry':
        this.width = 46;
        this.height = 44;
        this.y = FLOOR_Y - 82; // Floating obstacle, cat must duck/slide under
        break;
      case 'pigeon':
        this.width = 34;
        this.height = 24;
        // Float at medium height: jump over or duck under depending on spawn y
        this.y = FLOOR_Y - 42;
        this.flapTimer = 0;
        this.flapFrame = 0;
        break;
    }
  }

  update(dtMultiplier) {
    this.x -= gameSpeed * dtMultiplier;
    
    // Pigeon flapping animation
    if (this.type === 'pigeon') {
      this.flapTimer += dtMultiplier;
      if (this.flapTimer > 7) {
        this.flapFrame = (this.flapFrame + 1) % 2;
        this.flapTimer = 0;
      }
    }
  }

  draw() {
    ctx.save();
    ctx.translate(this.x, this.y);

    if (this.type === 'chimney') {
      // 1. Chimney Pot drawing
      const fillG = ctx.createLinearGradient(0, 0, this.width, 0);
      fillG.addColorStop(0, '#2e3152');
      fillG.addColorStop(1, '#1b1d31');
      ctx.fillStyle = fillG;
      
      // Main shaft
      ctx.fillRect(4, 8, this.width - 8, this.height - 8);
      // Top lip
      ctx.fillStyle = '#4c5185';
      ctx.fillRect(0, 4, this.width, 6);
      
      // Neon exhaust pipe (pink neon smoke outlet)
      ctx.fillStyle = '#ff79c6';
      ctx.fillRect(8, 0, 5, 4);
      ctx.fillRect(20, 0, 5, 4);
    } 
    else if (this.type === 'antenna') {
      // 2. TV Antenna drawing
      ctx.strokeStyle = '#a78bfa'; // Neon purple pole
      ctx.lineWidth = 2.5;
      
      // Central pole
      ctx.beginPath();
      ctx.moveTo(this.width / 2, 0);
      ctx.lineTo(this.width / 2, this.height);
      ctx.stroke();

      // Cross bars
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      // Top thin crossbar
      ctx.moveTo(4, 15); ctx.lineTo(this.width - 4, 15);
      // Mid crossbar
      ctx.moveTo(0, 28); ctx.lineTo(this.width, 28);
      // Lower crossbar
      ctx.moveTo(8, 42); ctx.lineTo(this.width - 8, 42);
      ctx.stroke();

      // Tiny glowing flashing LED on top
      ctx.fillStyle = (Math.floor(Date.now() / 250) % 2 === 0) ? '#ff5555' : 'rgba(255,85,85,0.1)';
      ctx.beginPath();
      ctx.arc(this.width / 2, 0, 3, 0, Math.PI * 2);
      ctx.fill();
    } 
    else if (this.type === 'laundry') {
      // 3. Clothesline / Hanging laundry drawing
      // Left and right thin ropes
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, 2);
      ctx.bezierCurveTo(10, 8, this.width - 10, 8, this.width, 2);
      ctx.stroke();

      // Hanging socks and shirts (neon colored)
      // Sock 1 (Pink)
      ctx.fillStyle = '#f472b6';
      ctx.fillRect(8, 6, 4, 15);
      ctx.fillRect(12, 17, 4, 4); // foot

      // Shirt (Cyan)
      ctx.fillStyle = '#22d3ee';
      ctx.beginPath();
      ctx.moveTo(18, 5);
      ctx.lineTo(34, 5);
      ctx.lineTo(36, 10);
      ctx.lineTo(32, 11);
      ctx.lineTo(32, 28);
      ctx.lineTo(20, 28);
      ctx.lineTo(20, 11);
      ctx.lineTo(16, 10);
      ctx.closePath();
      ctx.fill();

      // Clothespins
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(9, 3, 2, 3);
      ctx.fillRect(23, 4, 2, 3);
      ctx.fillRect(29, 4, 2, 3);
    } 
    else if (this.type === 'pigeon') {
      // 4. Sleeping Pigeon drawing
      const bodyColor = '#80829a';
      const wingColor = '#595a6f';
      const beakColor = '#fbbf24';

      ctx.fillStyle = bodyColor;
      
      // Body (round fat egg shape)
      ctx.beginPath();
      ctx.ellipse(this.width / 2, this.height / 2 + 2, 14, 10, 0, 0, Math.PI * 2);
      ctx.fill();

      // Head
      ctx.beginPath();
      ctx.arc(this.width / 2 + 8, this.height / 2 - 4, 6.5, 0, Math.PI * 2);
      ctx.fill();

      // Wing (Animated based on flapping)
      ctx.fillStyle = wingColor;
      ctx.beginPath();
      if (this.flapFrame === 0) {
        // Wing flat/down
        ctx.ellipse(this.width / 2 - 4, this.height / 2 + 4, 8, 5, -Math.PI*0.05, 0, Math.PI * 2);
      } else {
        // Wing pointing slightly up
        ctx.ellipse(this.width / 2 - 4, this.height / 2, 8, 5, -Math.PI*0.25, 0, Math.PI * 2);
      }
      ctx.fill();

      // Beak
      ctx.fillStyle = beakColor;
      ctx.beginPath();
      ctx.moveTo(this.width / 2 + 14, this.height / 2 - 6);
      ctx.lineTo(this.width / 2 + 18, this.height / 2 - 4);
      ctx.lineTo(this.width / 2 + 13, this.height / 2 - 2);
      ctx.closePath();
      ctx.fill();

      // Closed eye sleeping "^"
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(this.width / 2 + 6, this.height / 2 - 5);
      ctx.lineTo(this.width / 2 + 8, this.height / 2 - 7);
      ctx.lineTo(this.width / 2 + 10, this.height / 2 - 5);
      ctx.stroke();
    }

    ctx.restore();
  }
}

let obstacles = [];
let obstacleSpawnTimer = 0;

function spawnObstacle() {
  const types = ['chimney', 'antenna', 'laundry', 'pigeon'];
  // Choose random type based on game progress
  let allowedTypes = ['chimney', 'antenna'];
  if (score > 150) allowedTypes.push('pigeon');
  if (score > 350) allowedTypes.push('laundry');

  const randomType = allowedTypes[Math.floor(Math.random() * allowedTypes.length)];
  obstacles.push(new Obstacle(CANVAS_WIDTH + 50, randomType));
}

// --- COLLECTIBLES SYSTEM (GOLDEN FISH TREATS) ---
class GoldenFish {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.width = 24;
    this.height = 14;
    this.collected = false;
    this.pulseScale = 0;
  }

  update(dtMultiplier) {
    this.x -= gameSpeed * dtMultiplier;
    this.pulseScale = Math.sin(Date.now() * 0.01) * 0.15;
  }

  draw() {
    ctx.save();
    ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
    ctx.scale(1 + this.pulseScale, 1 + this.pulseScale);
    
    // Golden glow neon drop shadow
    ctx.shadowBlur = 12;
    ctx.shadowColor = '#fbbf24';

    ctx.fillStyle = '#fbbf24'; // Golden fish body
    
    // Tail fin (triangle)
    ctx.beginPath();
    ctx.moveTo(-this.width / 2, 0);
    ctx.lineTo(-this.width / 2 - 6, -6);
    ctx.lineTo(-this.width / 2 - 6, 6);
    ctx.closePath();
    ctx.fill();

    // Body (ellipse shape)
    ctx.beginPath();
    ctx.ellipse(0, 0, this.width / 2, this.height / 2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Tiny eye dot
    ctx.fillStyle = '#5c4100';
    ctx.beginPath();
    ctx.arc(this.width / 2 - 5, -1, 1.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}

let collectibles = [];
let collectibleSpawnTimer = 0;

function spawnCollectible() {
  // Spawn fish in tracks/heights: 
  // Height 0: high (requires jump)
  // Height 1: medium (curved jump)
  // Height 2: low (must slide or run)
  const heights = [FLOOR_Y - 32, FLOOR_Y - 80, FLOOR_Y - 130];
  const randomY = heights[Math.floor(Math.random() * heights.length)];
  
  // Prevent spawning too close/right inside another obstacle
  let isOverlap = false;
  obstacles.forEach(obs => {
    if (Math.abs((CANVAS_WIDTH + 60) - obs.x) < 80) {
      isOverlap = true;
    }
  });

  if (!isOverlap) {
    collectibles.push(new GoldenFish(CANVAS_WIDTH + 60, randomY));
  }
}

// --- VISUAL EFFECTS / PARTICLE SYSTEM ---
let particles = [];

// Dust particle spawned by running
class Dust {
  constructor(x, y, vx) {
    this.x = x;
    this.y = y - 2;
    this.vx = vx;
    this.vy = -Math.random() * 1.5;
    this.size = 2 + Math.random() * 4;
    this.alpha = 0.6;
    this.life = 1.0;
    this.decay = 0.04 + Math.random() * 0.03;
  }
  update(dtMultiplier) {
    this.x += this.vx * dtMultiplier;
    this.y += this.vy * dtMultiplier;
    this.life -= this.decay * dtMultiplier;
    if (this.life <= 0) {
      this.alpha = 0;
    } else {
      this.alpha = this.life * 0.6;
    }
  }
  draw() {
    ctx.fillStyle = `rgba(148, 163, 184, ${this.alpha})`; // Dusty grey slate color
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Sparkle particle spawned on catching fish
class Sparkle {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.vx = (Math.random() - 0.5) * 6;
    this.vy = (Math.random() - 0.5) * 6 - 1.5;
    this.size = 2 + Math.random() * 3;
    this.color = Math.random() < 0.5 ? '#ffd23f' : '#f472b6'; // Gold or Pink sparkle
    this.life = 1.0;
    this.decay = 0.03 + Math.random() * 0.02;
  }
  update(dtMultiplier) {
    this.x += this.vx * dtMultiplier;
    this.y += this.vy * dtMultiplier;
    this.vy += 0.08 * dtMultiplier; // Gravity pull on sparkles
    this.life -= this.decay * dtMultiplier;
  }
  draw() {
    ctx.save();
    ctx.shadowBlur = 8;
    ctx.shadowColor = this.color;
    ctx.fillStyle = this.color;
    ctx.globalAlpha = Math.max(0, this.life);
    
    // Draw small diamond star shape
    ctx.beginPath();
    ctx.moveTo(this.x, this.y - this.size);
    ctx.lineTo(this.x + this.size, this.y);
    ctx.lineTo(this.x, this.y + this.size);
    ctx.lineTo(this.x - this.size, this.y);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

// Ring puff when launching a jump
class JumpPuff {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.radius = 2;
    this.maxRadius = 18;
    this.alpha = 0.7;
    this.life = 1.0;
  }
  update(dtMultiplier) {
    this.radius += 1.2 * dtMultiplier;
    this.life = 1.0 - (this.radius / this.maxRadius);
    this.alpha = this.life * 0.7;
  }
  draw() {
    if (this.life <= 0) return;
    ctx.strokeStyle = `rgba(167, 139, 250, ${this.alpha})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.stroke();
  }
}

// Glowing trail behind air quick-diving
class DiveStreak {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.width = 4;
    this.height = 20;
    this.alpha = 0.55;
  }
  update(dtMultiplier) {
    this.alpha -= 0.06 * dtMultiplier;
    this.x -= gameSpeed * dtMultiplier; // moves back with screen
  }
  draw() {
    if (this.alpha <= 0) return;
    ctx.fillStyle = `rgba(244, 114, 182, ${this.alpha})`; // Pink trail
    ctx.fillRect(this.x - this.width/2, this.y - this.height/2, this.width, this.height);
  }
}

function updateParticles(dtMultiplier) {
  // Update and clean up dead particles
  particles.forEach(p => p.update(dtMultiplier));
  particles = particles.filter(p => p.life === undefined ? p.alpha > 0 : p.life > 0);
}

function drawParticles() {
  particles.forEach(p => p.draw());
}

// --- COLLISION RESOLUTION ---
function checkCollision(rect1, rect2) {
  return rect1.x < rect2.x + rect2.width &&
         rect1.x + rect1.width > rect2.x &&
         rect1.y < rect2.y + rect2.height &&
         rect1.y + rect1.height > rect2.y;
}

// --- GAME LOGIC UPDATES ---
function updatePhysics(dtMultiplier) {
  if (gameState !== 'PLAYING') return;

  // Increment distance and score
  distanceRan += gameSpeed * 0.02 * dtMultiplier;
  score = Math.floor(distanceRan);
  currentScoreEl.textContent = String(score).padStart(5, '0');

  // Gradual speed scaling
  gameSpeed = BASE_SPEED + Math.min(MAX_SPEED - BASE_SPEED, score * 0.005);

  // Update Cat Physics
  player.update(dtMultiplier);
  
  // Spawning Particles during quick-dive
  if (player.state === 'diving') {
    particles.push(new DiveStreak(player.x + player.width / 2, player.y + player.height / 2));
  }

  // Update Parallax Backgrounds
  backgroundStars.update(dtMultiplier);
  backgroundFarCity.update(dtMultiplier);
  backgroundMidCity.update(dtMultiplier);
  activeFloor.update(dtMultiplier);

  // Spawn and Update Obstacles
  obstacleSpawnTimer += dtMultiplier;
  // Spawn obstacles at variable intervals that decrease slightly with speed
  const spawnThreshold = Math.max(75, 130 - gameSpeed * 4);
  if (obstacleSpawnTimer >= spawnThreshold) {
    if (Math.random() < 0.7) { // 70% chance of spawning
      spawnObstacle();
      obstacleSpawnTimer = 0;
    }
  }

  obstacles.forEach(obs => {
    obs.update(dtMultiplier);

    // Collision Check
    const catBox = player.getHitbox();
    const obsBox = {
      x: obs.x + 3,
      y: obs.y + 3,
      width: obs.width - 6,
      height: obs.height - 6
    };

    if (checkCollision(catBox, obsBox)) {
      triggerGameOver();
    }
  });

  // Filter out obstacles that left the screen
  obstacles = obstacles.filter(obs => obs.x + obs.width > 0);

  // Spawn and Update Collectibles
  collectibleSpawnTimer += dtMultiplier;
  const collectibleThreshold = 180 + Math.random() * 120;
  if (collectibleSpawnTimer >= collectibleThreshold) {
    spawnCollectible();
    collectibleSpawnTimer = 0;
  }

  collectibles.forEach(fish => {
    fish.update(dtMultiplier);

    // Check Catch Collision
    const catBox = player.getHitbox();
    const fishBox = {
      x: fish.x,
      y: fish.y,
      width: fish.width,
      height: fish.height
    };

    if (checkCollision(catBox, fishBox) && !fish.collected) {
      fish.collected = true;
      // Add extra points via distance offset bonus
      distanceRan += 50; 
      sound.playCollect();
      
      // Spawn burst particles
      for (let i = 0; i < 8; i++) {
        particles.push(new Sparkle(fish.x + fish.width/2, fish.y + fish.height/2));
      }
    }
  });

  // Clean collected and off-screen collectibles
  collectibles = collectibles.filter(fish => !fish.collected && fish.x + fish.width > 0);

  // Update particles
  updateParticles(dtMultiplier);
}

// --- RENDER SYSTEM ---
function render() {
  // Clear Frame
  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // Draw Deep Sky Color Gradient
  const skyGradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
  skyGradient.addColorStop(0, '#060713'); // Very dark midnight blue
  skyGradient.addColorStop(0.6, '#0f1122');
  skyGradient.addColorStop(1, '#1b1c31');
  ctx.fillStyle = skyGradient;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // Draw Layers (Parallax order)
  backgroundStars.draw();
  backgroundFarCity.draw();
  backgroundMidCity.draw();
  activeFloor.draw();
  
  // Draw Collectibles
  collectibles.forEach(fish => fish.draw());

  // Draw Obstacles
  obstacles.forEach(obs => obs.draw());

  // Draw Particles
  drawParticles();

  // Draw Cat
  player.draw();
}

// --- GAME STATE FLOWS ---
function startGame() {
  sound.init(); // Initialize audio context on player action
  gameState = 'PLAYING';
  
  // Reset state variables
  distanceRan = 0;
  score = 0;
  gameSpeed = BASE_SPEED;
  obstacleSpawnTimer = 0;
  collectibleSpawnTimer = 0;
  
  player.reset();
  obstacles = [];
  collectibles = [];
  particles = [];
  
  // DOM overlay toggle
  hideAllScreens();
  document.getElementById('hud').style.display = 'flex';
}

function triggerGameOver() {
  gameState = 'GAMEOVER';
  player.state = 'dead';
  sound.playCrash();

  // Save and set high score
  if (score > highScore) {
    highScore = score;
    localStorage.setItem('surf_cat_hiscore', highScore);
    highScoreEl.textContent = String(highScore).padStart(5, '0');
  }

  // Update GameOver text
  finalScoreEl.textContent = String(score).padStart(5, '0');
  finalHighEl.textContent = String(highScore).padStart(5, '0');
  
  // DOM overlay toggle
  showScreen(screenGameover);
}

function togglePause() {
  if (gameState === 'PLAYING') {
    gameState = 'PAUSED';
    showScreen(screenPause);
    document.getElementById('pause-icon-path').setAttribute('d', 'M8 5v14l11-7z'); // Play triangle icon
  } else if (gameState === 'PAUSED') {
    gameState = 'PLAYING';
    hideAllScreens();
    document.getElementById('pause-icon-path').setAttribute('d', 'M6 19h4V5H6v14zm8-14v14h4V5h-4z'); // Pause twin lines icon
  }
}

function hideAllScreens() {
  screenStart.classList.remove('active');
  screenPause.classList.remove('active');
  screenGameover.classList.remove('active');
}

function showScreen(screenEl) {
  hideAllScreens();
  screenEl.classList.add('active');
}

function toggleMute() {
  const muted = sound.toggleMute();
  updateSoundIcon();
}

function updateSoundIcon() {
  if (sound.isMuted) {
    // Muted volume symbol with cross slash
    soundIconPath.setAttribute('d', 'M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.21.05-.42.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z');
  } else {
    // Standard volume symbol with waves
    soundIconPath.setAttribute('d', 'M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z');
  }
}

// --- EVENT HANDLERS ---

// Tap / Click Handler on Game Area
function handleInteraction(e) {
  // Prevent jumping if clicking on HUD controls
  if (e.target.closest('#hud') || e.target.closest('.hud-btn')) {
    return;
  }

  if (gameState === 'PLAYING') {
    if (player.state === 'running' || player.state === 'sliding') {
      player.jump();
    } else if (player.state === 'jumping') {
      player.dive();
    }
  } else if (gameState === 'START') {
    startGame();
  } else if (gameState === 'GAMEOVER') {
    startGame();
  }
}

// Keyboard Listeners
const activeKeys = {};

window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' || e.code === 'ArrowUp') {
    e.preventDefault(); // prevent scrolling
    if (gameState === 'PLAYING') {
      if (player.state === 'running' || player.state === 'sliding') {
        player.jump();
      } else if (player.state === 'jumping') {
        player.dive();
      }
    } else if (gameState === 'START') {
      startGame();
    } else if (gameState === 'GAMEOVER') {
      startGame();
    }
  }

  if (e.code === 'ArrowDown' || e.code === 'KeyS') {
    e.preventDefault();
    activeKeys[e.code] = true;
    if (gameState === 'PLAYING') {
      player.setSlide(true);
    }
  }

  if (e.code === 'KeyP') {
    e.preventDefault();
    togglePause();
  }
});

window.addEventListener('keyup', (e) => {
  if (e.code === 'ArrowDown' || e.code === 'KeyS') {
    activeKeys[e.code] = false;
    // Only release slide if BOTH duck keys are released
    if (!activeKeys['ArrowDown'] && !activeKeys['KeyS']) {
      player.setSlide(false);
    }
  }
});

// Attach Click & Touch Event to Canvas Wrapper
const container = document.getElementById('game-container');

container.addEventListener('mousedown', (e) => {
  handleInteraction(e);
});

container.addEventListener('touchstart', (e) => {
  // touchstart behaves like click but avoids latency
  handleInteraction(e);
}, { passive: true });

// Prevent space bar default behavior on overlay buttons so it doesn't trigger double clicks
const buttons = [btnStart, btnResume, btnRestart, btnPause, btnSound];
buttons.forEach(btn => {
  if (btn) {
    btn.addEventListener('keydown', (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
      }
    });
  }
});

// UI Button Clicks
btnStart.addEventListener('click', (e) => {
  e.stopPropagation();
  startGame();
});

btnResume.addEventListener('click', (e) => {
  e.stopPropagation();
  togglePause();
});

btnRestart.addEventListener('click', (e) => {
  e.stopPropagation();
  startGame();
});

btnPause.addEventListener('click', (e) => {
  e.stopPropagation();
  togglePause();
});

btnSound.addEventListener('click', (e) => {
  e.stopPropagation();
  toggleMute();
});

// --- CORE GAME LOOP (Fixed Timestep Accumulator) ---
let lastTime = 0;
const physicsTimestep = 1000 / 60; // 60 updates per second (16.67ms)
let timeAccumulator = 0;

function mainLoop(timestamp) {
  if (!lastTime) lastTime = timestamp;
  let elapsed = timestamp - lastTime;
  lastTime = timestamp;

  // Cap elapsed time to avoid spiral of death (e.g. if tab is inactive)
  if (elapsed > 150) elapsed = 150;

  timeAccumulator += elapsed;

  // Run updates in fixed timesteps
  while (timeAccumulator >= physicsTimestep) {
    // Passing 1.0 multiplier since timestep is constant (16.67ms)
    // If we need to scale logic, we pass 1.0. This guarantees matching physics behavior on high refresh screens.
    updatePhysics(1.0);
    timeAccumulator -= physicsTimestep;
  }

  // Draw current state
  render();

  requestAnimationFrame(mainLoop);
}

// Initial draw of starting state
render();

// Launch loop
requestAnimationFrame(mainLoop);
