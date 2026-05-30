'use client';

import { useState, useEffect, useRef, FormEvent } from 'react';

interface ScoreEntry {
  id: string;
  name: string;
  score: number;
  date: string;
}

export default function Home() {
  const [gameState, setGameState] = useState<'START' | 'PLAYING' | 'GAMEOVER' | 'SUBMITTING' | 'SUBMITTED'>('START');
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [highScores, setHighScores] = useState<ScoreEntry[]>([]);
  const [playerName, setPlayerName] = useState('');
  const [playerScoreInput, setPlayerScoreInput] = useState('');
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Keyboard input states
  const keysPressed = useRef<{ [key: string]: boolean }>({});

  // Game variables stored in Ref to avoid stale closures
  const gameData = useRef({
    gameState: 'START' as 'START' | 'PLAYING' | 'GAMEOVER' | 'SUBMITTING' | 'SUBMITTED',
    score: 0,
    lives: 3,
    wave: 1,
    player: {
      x: 200,
      y: 440,
      width: 26,
      height: 26,
      speed: 5,
      shootCooldown: 0,
      invincibility: 0, // frames
    },
    bullets: [] as Array<{ x: number; y: number; vy: number; width: number; height: number; color: string; isEnemy: boolean }>,
    enemies: [] as Array<{
      x: number;
      y: number;
      startX: number;
      startY: number;
      width: number;
      height: number;
      type: 'BEE' | 'BUTTERFLY' | 'BOSS';
      hp: number;
      maxHp: number;
      points: number;
      flash: number;
      phase: number;
      state: 'FORMATION' | 'SWOOPING' | 'RETURNING';
      swoopX: number;
      swoopY: number;
      swoopSpeed: number;
      angle: number;
    }>,
    stars: [] as Array<{ x: number; y: number; speed: number; size: number }>,
    particles: [] as Array<{ x: number; y: number; vx: number; vy: number; color: string; size: number; alpha: number; decay: number }>,
    formationDir: 1,
    formationXOffset: 0,
    formationYOffset: 0,
    spawnTimer: 0,
    enemyShootCooldown: 0,
  });

  // Sound Synthesizer helpers
  const initAudio = () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
  };

  const playLaserSound = () => {
    if (!audioCtxRef.current) return;
    const ctx = audioCtxRef.current;
    
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.15);
    
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.15);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  };

  const playExplosionSound = (isPlayer: boolean) => {
    if (!audioCtxRef.current) return;
    const ctx = audioCtxRef.current;
    
    const bufferSize = ctx.sampleRate * (isPlayer ? 0.8 : 0.25);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(isPlayer ? 300 : 800, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(20, ctx.currentTime + (isPlayer ? 0.8 : 0.25));
    
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(isPlayer ? 0.3 : 0.15, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + (isPlayer ? 0.8 : 0.25));
    
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    
    noise.start();
    noise.stop(ctx.currentTime + (isPlayer ? 0.8 : 0.25));
  };

  const playHitSound = () => {
    if (!audioCtxRef.current) return;
    const ctx = audioCtxRef.current;
    
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.type = 'square';
    osc.frequency.setValueAtTime(200, ctx.currentTime);
    osc.frequency.setValueAtTime(120, ctx.currentTime + 0.05);
    
    gain.gain.setValueAtTime(0.05, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + 0.1);
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.start();
    osc.stop(ctx.currentTime + 0.1);
  };

  const playStartSound = () => {
    if (!audioCtxRef.current) return;
    const ctx = audioCtxRef.current;
    
    const notes = [261.63, 329.63, 392.00, 523.25, 392.00, 523.25, 659.25];
    const noteLength = 0.09;
    
    notes.forEach((freq, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + index * noteLength);
      
      gain.gain.setValueAtTime(0.06, ctx.currentTime + index * noteLength);
      gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + (index + 0.8) * noteLength);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(ctx.currentTime + index * noteLength);
      osc.stop(ctx.currentTime + (index + 0.8) * noteLength);
    });
  };

  const playGameOverSound = () => {
    if (!audioCtxRef.current) return;
    const ctx = audioCtxRef.current;
    
    const notes = [392.00, 349.23, 311.13, 246.94];
    const noteLength = 0.25;
    
    notes.forEach((freq, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + index * noteLength);
      
      gain.gain.setValueAtTime(0.08, ctx.currentTime + index * noteLength);
      gain.gain.linearRampToValueAtTime(0.01, ctx.currentTime + (index + 0.9) * noteLength);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(ctx.currentTime + index * noteLength);
      osc.stop(ctx.currentTime + (index + 0.9) * noteLength);
    });
  };

  // Fetch scores
  const fetchScores = async () => {
    try {
      const response = await fetch('/api/scores');
      if (response.ok) {
        const data = await response.json();
        setHighScores(data);
      }
    } catch (error) {
      console.error('Error fetching scores:', error);
    }
  };

  // Setup Keyboard
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysPressed.current[e.code] = true;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current[e.code] = false;
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    fetchScores();
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Starfield Setup
  const initStars = () => {
    const stars = [];
    for (let i = 0; i < 40; i++) {
      stars.push({
        x: Math.random() * 400,
        y: Math.random() * 500,
        speed: 0.5 + Math.random() * 1.5,
        size: 0.8 + Math.random() * 1.2
      });
    }
    gameData.current.stars = stars;
  };

  // Spawn formation of enemies
  const spawnEnemyWave = (wave: number) => {
    const enemies = [];
    const rows = [
      { type: 'BOSS' as const, hp: 2, points: 400, color: '#ff0055' },
      { type: 'BUTTERFLY' as const, hp: 1, points: 200, color: '#ff00ff' },
      { type: 'BUTTERFLY' as const, hp: 1, points: 200, color: '#ff00ff' },
      { type: 'BEE' as const, hp: 1, points: 100, color: '#00ff66' },
      { type: 'BEE' as const, hp: 1, points: 100, color: '#00ff66' },
    ];
    
    const cols = 6;
    const colSpacing = 42;
    const rowSpacing = 30;
    
    const startX = 400 / 2 - ((cols - 1) * colSpacing) / 2;
    const startY = 60;
    
    for (let r = 0; r < rows.length; r++) {
      const rowInfo = rows[r];
      for (let c = 0; c < cols; c++) {
        enemies.push({
          x: 0,
          y: 0,
          startX: startX + c * colSpacing,
          startY: startY + r * rowSpacing,
          width: 22,
          height: 22,
          type: rowInfo.type,
          hp: rowInfo.hp,
          maxHp: rowInfo.hp,
          points: rowInfo.points,
          flash: 0,
          phase: Math.random() * 100,
          state: 'FORMATION' as const,
          swoopX: 0,
          swoopY: 0,
          swoopSpeed: 2 + wave * 0.3,
          angle: 0,
        });
      }
    }
    
    gameData.current.enemies = enemies;
    gameData.current.formationXOffset = 0;
    gameData.current.formationYOffset = 0;
    gameData.current.formationDir = 1;
    gameData.current.enemyShootCooldown = 120;
  };

  const createExplosion = (x: number, y: number, color: string, count = 10) => {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 4;
      gameData.current.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color,
        size: 2 + Math.random() * 3,
        alpha: 1,
        decay: 0.02 + Math.random() * 0.03
      });
    }
  };

  // Start continuous loop
  useEffect(() => {
    initStars();
    
    let animationId: number;
    
    const tick = () => {
      updateAndDraw();
      animationId = requestAnimationFrame(tick);
    };
    
    animationId = requestAnimationFrame(tick);
    
    return () => {
      cancelAnimationFrame(animationId);
    };
  }, []);

  const startGame = () => {
    initAudio();
    playStartSound();
    
    const gd = gameData.current;
    gd.score = 0;
    gd.lives = 3;
    gd.wave = 1;
    gd.bullets = [];
    gd.particles = [];
    gd.player.x = 200;
    gd.player.y = 440;
    gd.player.invincibility = 120;
    gd.gameState = 'PLAYING';
    
    setScore(0);
    setLives(3);
    setGameState('PLAYING');
    setPlayerName('');
    setPlayerScoreInput('');
    setSubmittedId(null);
    
    spawnEnemyWave(1);
  };

  const handlePlayerDeath = () => {
    const gd = gameData.current;
    const player = gd.player;
    createExplosion(player.x, player.y, '#ffffff', 25);
    createExplosion(player.x, player.y, '#00f0ff', 15);
    playExplosionSound(true);
    
    gd.lives--;
    setLives(gd.lives);
    
    if (gd.lives <= 0) {
      gd.gameState = 'GAMEOVER';
      
      // Delay state update to allow explosion animation to show
      setTimeout(() => {
        setGameState('GAMEOVER');
        setScore(gd.score);
        setPlayerScoreInput(gd.score.toString());
        playGameOverSound();
      }, 1000);
    } else {
      // Respawn player
      player.x = 200;
      player.y = 440;
      player.invincibility = 120;
    }
  };

  // High score submission
  const handleScoreSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!playerName.trim()) return;
    
    setGameState('SUBMITTING');
    
    try {
      const response = await fetch('/api/scores', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: playerName,
          score: Number(playerScoreInput) || 0,
        }),
      });
      
      if (response.ok) {
        const result = await response.json();
        setSubmittedId(result.score.id);
        await fetchScores();
        setGameState('SUBMITTED');
        
        // Update local ref state too
        gameData.current.gameState = 'SUBMITTED';
      } else {
        alert('提交失敗，請重試！');
        setGameState('GAMEOVER');
      }
    } catch (err) {
      console.error('Failed to submit score:', err);
      alert('網路錯誤，無法提交分數！');
      setGameState('GAMEOVER');
    }
  };

  // Continuous animation frame update & rendering
  const updateAndDraw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const gd = gameData.current;
    
    // --- 1. Clear & Background ---
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Starfield
    gd.stars.forEach(star => {
      // Stars speed up slightly if playing
      const currentSpeed = gd.gameState === 'PLAYING' ? star.speed : star.speed * 0.4;
      star.y += currentSpeed;
      if (star.y > canvas.height) {
        star.y = 0;
        star.x = Math.random() * canvas.width;
      }
      ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(1, star.speed / 2)})`;
      ctx.fillRect(star.x, star.y, star.size, star.size);
    });

    // --- 2. START / GAMEOVER Attract Mode Render ---
    if (gd.gameState === 'START' || gd.gameState === 'GAMEOVER' || gd.gameState === 'SUBMITTED') {
      // Just draw particles
      gd.particles = gd.particles.filter(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= p.decay;
        
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        return p.alpha > 0;
      });
      return; 
    }

    // --- 3. Update & Draw Game Entities (PLAYING State) ---
    if (gd.gameState === 'PLAYING') {
      const player = gd.player;

      // Player Movement
      if (keysPressed.current['ArrowLeft'] || keysPressed.current['KeyA']) {
        player.x -= player.speed;
      }
      if (keysPressed.current['ArrowRight'] || keysPressed.current['KeyD']) {
        player.x += player.speed;
      }
      if (player.x < player.width / 2) player.x = player.width / 2;
      if (player.x > canvas.width - player.width / 2) player.x = canvas.width - player.width / 2;

      // Shooting logic
      if (player.shootCooldown > 0) player.shootCooldown--;
      if (player.invincibility > 0) player.invincibility--;

      if ((keysPressed.current['Space'] || keysPressed.current['KeyK']) && player.shootCooldown === 0) {
        gd.bullets.push({
          x: player.x,
          y: player.y - 15,
          vy: -8,
          width: 3,
          height: 10,
          color: '#00f0ff',
          isEnemy: false,
        });
        player.shootCooldown = 15;
        playLaserSound();
      }

      // Draw Player Thruster
      ctx.fillStyle = Math.random() > 0.5 ? '#ff5e00' : '#ff0000';
      ctx.beginPath();
      ctx.moveTo(player.x - 4, player.y + 12);
      ctx.lineTo(player.x, player.y + 20 + Math.random() * 6);
      ctx.lineTo(player.x + 4, player.y + 12);
      ctx.closePath();
      ctx.fill();

      // Draw Player Fighter Jet
      if (player.invincibility === 0 || Math.floor(player.invincibility / 8) % 2 === 0) {
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#00f0ff';
        
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(player.x, player.y - 16);
        ctx.lineTo(player.x - 6, player.y - 4);
        ctx.lineTo(player.x + 6, player.y - 4);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#00f0ff';
        ctx.beginPath();
        ctx.moveTo(player.x - 6, player.y - 4);
        ctx.lineTo(player.x - 14, player.y + 10);
        ctx.lineTo(player.x - 10, player.y + 12);
        ctx.lineTo(player.x, player.y + 6);
        ctx.lineTo(player.x + 10, player.y + 12);
        ctx.lineTo(player.x + 14, player.y + 10);
        ctx.lineTo(player.x + 6, player.y - 4);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#ff007f';
        ctx.fillRect(player.x - 3, player.y + 2, 6, 6);
        ctx.shadowBlur = 0;
      }

      // Update formation offsets
      gd.formationXOffset += 0.8 * gd.formationDir;
      if (Math.abs(gd.formationXOffset) > 40) {
        gd.formationDir *= -1;
        gd.formationYOffset += 1.5;
      }

      // Swooping enemy trigger
      gd.spawnTimer++;
      if (gd.enemies.length > 0 && gd.spawnTimer % 200 === 0) {
        const formationEnemies = gd.enemies.filter(e => e.state === 'FORMATION');
        if (formationEnemies.length > 0) {
          const swooper = formationEnemies[Math.floor(Math.random() * formationEnemies.length)];
          swooper.state = 'SWOOPING';
          swooper.swoopX = swooper.x;
          swooper.swoopY = swooper.y;
        }
      }

      // Update & Draw Enemies
      let waveCleared = gd.enemies.length === 0;

      gd.enemies.forEach((enemy) => {
        enemy.phase += 0.15;
        
        if (enemy.state === 'FORMATION') {
          enemy.x = enemy.startX + gd.formationXOffset;
          enemy.y = enemy.startY + gd.formationYOffset;
        } else if (enemy.state === 'SWOOPING') {
          enemy.swoopY += enemy.swoopSpeed;
          enemy.swoopX += Math.sin(enemy.phase * 0.4) * 4;
          enemy.x = enemy.swoopX;
          enemy.y = enemy.swoopY;
          
          if (enemy.y > canvas.height + 20) {
            enemy.y = -20;
            enemy.swoopY = -20;
            enemy.swoopX = enemy.startX + gd.formationXOffset;
            enemy.state = 'RETURNING';
          }
        } else if (enemy.state === 'RETURNING') {
          const targetX = enemy.startX + gd.formationXOffset;
          const targetY = enemy.startY + gd.formationYOffset;
          enemy.x += (targetX - enemy.x) * 0.05;
          enemy.y += (targetY - enemy.y) * 0.05;
          if (Math.hypot(targetX - enemy.x, targetY - enemy.y) < 4) {
            enemy.state = 'FORMATION';
          }
        }

        if (enemy.flash > 0) enemy.flash--;

        // Draw Enemy
        ctx.save();
        ctx.translate(enemy.x, enemy.y);
        
        const wingOffset = Math.sin(enemy.phase) * 4;
        if (enemy.flash > 0) {
          ctx.fillStyle = '#ffffff';
        } else {
          if (enemy.type === 'BOSS') ctx.fillStyle = '#ff003c';
          else if (enemy.type === 'BUTTERFLY') ctx.fillStyle = '#ff00ff';
          else ctx.fillStyle = '#00ff66';
        }
        ctx.shadowBlur = 8;
        ctx.shadowColor = ctx.fillStyle as string;
        
        // Body
        ctx.beginPath();
        ctx.arc(0, 0, 8, 0, Math.PI * 2);
        ctx.fill();
        
        // Wings
        ctx.fillStyle = enemy.flash > 0 ? '#ffffff' : '#fff30f';
        ctx.beginPath();
        ctx.moveTo(-8, 0);
        ctx.lineTo(-14 - wingOffset, -6);
        ctx.lineTo(-12, 6);
        ctx.closePath();
        ctx.fill();
        
        ctx.beginPath();
        ctx.moveTo(8, 0);
        ctx.lineTo(14 + wingOffset, -6);
        ctx.lineTo(12, 6);
        ctx.closePath();
        ctx.fill();
        
        // Eyes
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-3, -11, 2, 3);
        ctx.fillRect(1, -11, 2, 3);
        
        ctx.restore();
        ctx.shadowBlur = 0;
      });

      // Enemy shoots back
      if (gd.enemyShootCooldown > 0) gd.enemyShootCooldown--;
      if (gd.enemyShootCooldown === 0 && gd.enemies.length > 0) {
        const activeShooters = gd.enemies.filter(e => e.y > 0 && e.y < 350);
        if (activeShooters.length > 0) {
          const shooter = activeShooters[Math.floor(Math.random() * activeShooters.length)];
          gd.bullets.push({
            x: shooter.x,
            y: shooter.y + 12,
            vy: 4.5 + gd.wave * 0.4,
            width: 3,
            height: 8,
            color: '#ff5e00',
            isEnemy: true,
          });
          gd.enemyShootCooldown = Math.max(30, 80 - gd.wave * 8 + Math.random() * 50);
        }
      }

      // Update & Draw Bullets
      gd.bullets = gd.bullets.filter(bullet => {
        bullet.y += bullet.vy;
        
        ctx.fillStyle = bullet.color;
        ctx.shadowBlur = 8;
        ctx.shadowColor = bullet.color;
        ctx.fillRect(bullet.x - bullet.width / 2, bullet.y, bullet.width, bullet.height);
        ctx.shadowBlur = 0;

        if (!bullet.isEnemy) {
          // Player lasers hitting enemies
          for (let i = gd.enemies.length - 1; i >= 0; i--) {
            const enemy = gd.enemies[i];
            if (Math.hypot(bullet.x - enemy.x, bullet.y - enemy.y) < 14) {
              enemy.hp--;
              enemy.flash = 5;
              if (enemy.hp <= 0) {
                createExplosion(enemy.x, enemy.y, enemy.type === 'BOSS' ? '#ff003c' : enemy.type === 'BUTTERFLY' ? '#ff00ff' : '#00ff66');
                gd.score += enemy.points;
                setScore(gd.score);
                gd.enemies.splice(i, 1);
                playExplosionSound(false);
              } else {
                playHitSound();
              }
              return false; // delete bullet
            }
          }
        } else {
          // Enemy lasers hitting player
          if (player.invincibility === 0 && Math.hypot(bullet.x - player.x, bullet.y - player.y) < 14) {
            handlePlayerDeath();
            return false; // delete bullet
          }
        }
        return bullet.y > -20 && bullet.y < canvas.height + 20;
      });

      // Player colliding directly with enemies
      if (player.invincibility === 0) {
        for (let i = gd.enemies.length - 1; i >= 0; i--) {
          const enemy = gd.enemies[i];
          if (Math.hypot(player.x - enemy.x, player.y - enemy.y) < 18) {
            gd.enemies.splice(i, 1);
            createExplosion(enemy.x, enemy.y, '#00ff66', 8);
            handlePlayerDeath();
            break;
          }
        }
      }

      // Update Particles
      gd.particles = gd.particles.filter(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= p.decay;
        
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        return p.alpha > 0;
      });

      // Wave progression
      if (waveCleared) {
        gd.wave++;
        spawnEnemyWave(gd.wave);
      }
    }
  };

  return (
    <>
      <header>
        <h1 className="retro-title">GALAGA BEES</h1>
        <p className="subtitle">小蜜蜂防衛戰</p>
      </header>
      
      <main className="cabinet-wrapper">
        
        {/* Left Side: Game Screen bezel */}
        <section className="screen-bezel">
          <div className="crt-screen">
            
            {/* HUD */}
            <div className="crt-hud">
              <div>SCORE: <span className="score-val">{score}</span></div>
              <div>LIVES: <span className="lives-val">{Math.max(0, lives)}</span></div>
            </div>
            
            {/* HTML5 Canvas Game Frame */}
            <canvas 
              ref={canvasRef} 
              width={400} 
              height={500} 
              className="game-canvas"
            />
            
            {/* 1. START OVERLAY */}
            {gameState === 'START' && (
              <div className="screen-overlay">
                <h2 className="overlay-title">READY PLAYER ONE</h2>
                <p className="overlay-desc">
                  控制您的星際戰機，消滅迎面襲來的所有小蜜蜂！
                </p>
                <button 
                  onClick={startGame} 
                  className="retro-btn btn-cyan"
                  style={{ padding: '15px 30px', fontSize: '1rem' }}
                >
                  開始遊戲
                </button>
              </div>
            )}
            
            {/* 2. GAME OVER OVERLAY */}
            {(gameState === 'GAMEOVER' || gameState === 'SUBMITTING') && (
              <div className="screen-overlay">
                <h2 className="overlay-title game-over-title">GAME OVER</h2>
                <p className="overlay-desc" style={{ marginBottom: '1rem' }}>
                  很遺憾！戰機已毀損。
                </p>
                
                <form onSubmit={handleScoreSubmit} className="retro-form">
                  <div className="form-group">
                    <label className="retro-label">玩家名字 (NAME)</label>
                    <input 
                      type="text" 
                      required
                      maxLength={10}
                      placeholder="輸入姓名"
                      value={playerName} 
                      onChange={(e) => setPlayerName(e.target.value)}
                      className="retro-input"
                      disabled={gameState === 'SUBMITTING'}
                      autoFocus
                    />
                  </div>
                  
                  <div className="form-group" style={{ marginBottom: '10px' }}>
                    <label className="retro-label">最終得分 (SCORE)</label>
                    <input 
                      type="number" 
                      required
                      value={playerScoreInput} 
                      onChange={(e) => setPlayerScoreInput(e.target.value)}
                      className="retro-input"
                      disabled={gameState === 'SUBMITTING'}
                    />
                  </div>
                  
                  <button 
                    type="submit" 
                    className="retro-btn btn-pink"
                    disabled={gameState === 'SUBMITTING'}
                  >
                    {gameState === 'SUBMITTING' ? '傳送中...' : '送出資料'}
                  </button>
                </form>
              </div>
            )}

            {/* 3. SUBMITTED OVERLAY */}
            {gameState === 'SUBMITTED' && (
              <div className="screen-overlay">
                <h2 className="overlay-title" style={{ color: 'var(--neon-green)', textShadow: '0 0 10px var(--neon-green)' }}>
                  SUCCESS!
                </h2>
                <p className="overlay-desc">
                  您的分數已經成功記錄在排行榜上！
                </p>
                <button 
                  onClick={startGame} 
                  className="retro-btn btn-cyan"
                  style={{ padding: '12px 25px' }}
                >
                  再玩一次
                </button>
              </div>
            )}
            
          </div>
        </section>
        
        {/* Right Side: Leaderboard */}
        <aside className="leaderboard-panel">
          <h2 className="panel-header">👑 排行榜 LEADERBOARD</h2>
          <div className="scores-container">
            {highScores.length === 0 ? (
              <p className="no-scores">尚無紀錄</p>
            ) : (
              <table className="leaderboard-table">
                <tbody>
                  {highScores.map((entry, index) => {
                    const isRanked = index < 3;
                    const rankClass = isRanked ? `rank-${index + 1}` : '';
                    const isNewSubmit = entry.id === submittedId;
                    
                    return (
                      <tr 
                        key={entry.id} 
                        className={`leaderboard-row ${isNewSubmit ? 'highlighted' : ''}`}
                      >
                        <td className={`leaderboard-cell rank ${rankClass}`}>
                          {index + 1}ST
                        </td>
                        <td className="leaderboard-cell name">
                          {entry.name}
                        </td>
                        <td className="leaderboard-cell score">
                          {entry.score.toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
          <div style={{ marginTop: '15px', textAlign: 'center' }}>
            <button 
              onClick={fetchScores} 
              className="retro-btn"
              style={{ fontSize: '0.65rem', padding: '8px 12px' }}
            >
              更新排行榜
            </button>
          </div>
        </aside>
        
        {/* Control Desk Panel */}
        <section className="controls-panel">
          <div className="controls-title">SYSTEM CONTROLS</div>
          <div className="keys-wrapper">
            <div className="key-instruction">
              <span className="key-cap">A</span> 或 <span className="key-cap">←</span>
              <span>向左移動</span>
            </div>
            <div className="key-instruction">
              <span className="key-cap">D</span> 或 <span className="key-cap">→</span>
              <span>向右移動</span>
            </div>
            <div className="key-instruction">
              <span className="key-cap space-key">空白鍵 (SPACE)</span>
              <span>發射雷射</span>
            </div>
          </div>
        </section>
        
      </main>
      
      <footer>
        <p>© 2026 Retro Arcade Corp. 採用 HTML5 Canvas 與 Next.js 製作。</p>
        <p style={{ fontSize: '0.75rem', marginTop: '0.3rem', color: '#444d56' }}>
          * Web Audio Synth 已啟動，請確保您的瀏覽器音量正常。
        </p>
      </footer>
    </>
  );
}
