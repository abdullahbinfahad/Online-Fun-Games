// script.js
(function () {
    'use strict';

    // ────────────────────────────────
    // DOM ELEMENTS
    // ────────────────────────────────
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    const hudScore = document.getElementById('hudScore');
    const hudLevel = document.getElementById('hudLevel');
    const hudBest = document.getElementById('hudBest');
    const comboDisplay = document.getElementById('comboDisplay');
    const levelUpMessage = document.getElementById('levelUpMessage');
    const streakIndicator = document.getElementById('streakIndicator');
    const balloonContainer = document.getElementById('balloonContainer');

    // ────────────────────────────────
    // CANVAS SETUP
    // ────────────────────────────────
    const MAX_DPR = 2;
    let W, H, DPR;

    function resizeCanvas() {
        DPR = Math.min(window.devicePixelRatio || 1, MAX_DPR);
        W = window.innerWidth;
        H = window.innerHeight;
        canvas.width = Math.floor(W * DPR);
        canvas.height = Math.floor(H * DPR);
        canvas.style.width = W + 'px';
        canvas.style.height = H + 'px';
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(DPR, DPR);
    }
    resizeCanvas();
    window.addEventListener('resize', () => {
        const prevW = W;
        const prevH = H;
        resizeCanvas();
        bird.x = (bird.x / prevW) * W;
        bird.y = Math.min(bird.y, H - GROUND_H - BIRD_R);
        pipes.forEach(p => {
            p.x = (p.x / prevW) * W;
            p.width = PIPE_W;
            p.capH = PIPE_CAP_H;
        });
        updateDimensions();
        positionBalloon();
    });
    window.addEventListener('orientationchange', () => setTimeout(() => {
        resizeCanvas();
        updateDimensions();
        positionBalloon();
    }, 300));

    // ────────────────────────────────
    // GAME DIMENSIONS
    // ────────────────────────────────
    let BIRD_R, PIPE_W, PIPE_GAP, GROUND_H, PIPE_CAP_H;
    let PIPE_SPEED, GRAVITY, JUMP_VEL, MAX_FALL, SPAWN_INTERVAL;

    function updateDimensions() {
        BIRD_R = Math.max(12, Math.min(25, H * 0.04));
        PIPE_W = Math.max(36, Math.min(70, W * 0.09));
        PIPE_GAP = Math.max(100, Math.min(185, H * 0.24));
        GROUND_H = Math.max(45, Math.min(85, H * 0.105));
        PIPE_CAP_H = Math.max(16, Math.min(30, H * 0.038));
        PIPE_SPEED = Math.max(1.5, Math.min(3.6, W * 0.004));
        GRAVITY = Math.max(0.26, Math.min(0.6, H * 0.00075));
        JUMP_VEL = Math.max(-6.5, Math.min(-3.8, -H * 0.0088));
        MAX_FALL = Math.max(5, Math.min(10.5, H * 0.014));
        SPAWN_INTERVAL = Math.max(160, Math.min(330, W * 0.38));
    }
    updateDimensions();

    // ────────────────────────────────
    // GAME STATE
    // ────────────────────────────────
    const STATE = { PRE: 'prestart', RUN: 'running', OVER: 'over' };
    let gameMode = STATE.PRE;
    let score = 0;
    let currentLevel = 1;
    let bestScore = 0;
    let pipes = [];
    let particles = [];
    let clouds = [];
    let stars = [];
    let groundOffset = 0;
    let shakeMag = 0;
    let flashAlpha = 0;
    let timeOver = null;
    let frameCount = 0;
    let comboCount = 0;
    let comboTimer = 0;
    let streakCount = 0;
    let nearMissCount = 0;
    let lastPipePassedIndex = -1;
    let levelUpShown = false;
    let levelMessageTimer = 0;

    // Level messages from ABDULLAH BIN FAHAD
    const levelMessages = [
        "ABDULLAH BIN FAHAD\nTHINKS YOU'RE GREAT! 🌟",
        "ABDULLAH BIN FAHAD\nSAYS YOU'RE A GENIUS! 🧠",
        "ABDULLAH BIN FAHAD\nTHINKS YOU'RE AMAZING! 💫",
        "ABDULLAH BIN FAHAD\nCALLS YOU A LEGEND! 👑",
        "ABDULLAH BIN FAHAD\nSAYS YOU'RE UNSTOPPABLE! 🔥",
        "ABDULLAH BIN FAHAD\nTHINKS YOU'RE INCREDIBLE! ⚡",
        "ABDULLAH BIN FAHAD\nSAYS YOU'RE A MASTER! 🏆",
        "ABDULLAH BIN FAHAD\nTHINKS YOU'RE PHENOMENAL! 🌈",
        "ABDULLAH BIN FAHAD\nSAYS YOU'RE THE BEST! 💎",
        "ABDULLAH BIN FAHAD\nTHINKS YOU'RE A PRODIGY! 🎯",
    ];

    try {
        bestScore = parseInt(localStorage.getItem('flappyABF_best') || '0');
    } catch (e) {
        bestScore = 0;
    }
    hudBest.textContent = bestScore;

    // ────────────────────────────────
    // BIRD
    // ────────────────────────────────
    const bird = {
        x: 0,
        y: 0,
        vy: 0,
        angle: 0,
        wingPhase: 0,
        trailPositions: [],
    };

    function resetBird() {
        bird.x = W * 0.26;
        bird.y = H * 0.42;
        bird.vy = 0;
        bird.angle = 0;
        bird.wingPhase = 0;
        bird.trailPositions = [];
    }

    // ────────────────────────────────
    // PIPES
    // ────────────────────────────────
    function spawnPipe(x) {
        const gy = H - GROUND_H;
        const minTop = PIPE_CAP_H + 22;
        const maxTop = gy - PIPE_GAP - PIPE_CAP_H - 22;
        const gapCenter = minTop + Math.random() * (maxTop - minTop);
        pipes.push({
            x: x,
            topH: gapCenter - PIPE_GAP / 2,
            bottomY: gapCenter + PIPE_GAP / 2,
            width: PIPE_W,
            capH: PIPE_CAP_H,
            passed: false,
            nearMissed: false,
        });
    }

    function resetPipes() {
        pipes = [];
        const startX = W + 100;
        for (let i = 0; i < 5; i++) {
            spawnPipe(startX + i * SPAWN_INTERVAL);
        }
    }

    // ────────────────────────────────
    // STARS & CLOUDS
    // ────────────────────────────────
    function generateStars() {
        stars = [];
        for (let i = 0; i < 80; i++) {
            stars.push({
                x: Math.random() * W,
                y: Math.random() * H * 0.5,
                r: Math.random() * 1.6 + 0.4,
                twinkleSpeed: Math.random() * 0.03 + 0.01,
                twinkleOffset: Math.random() * Math.PI * 2,
                baseAlpha: Math.random() * 0.5 + 0.3,
            });
        }
    }
    generateStars();

    function generateClouds() {
        clouds = [];
        const count = Math.floor(W / 150) + 4;
        for (let i = 0; i < count; i++) {
            clouds.push({
                x: Math.random() * W * 1.3,
                y: Math.random() * H * 0.4 + H * 0.04,
                w: Math.random() * 85 + 50,
                h: Math.random() * 26 + 14,
                speed: Math.random() * 0.28 + 0.1,
                opacity: Math.random() * 0.28 + 0.12,
                bubbles: [
                    { rx: 0, ry: 0, r: Math.random() * 15 + 13 },
                    { rx: Math.random() * 32 + 10, ry: Math.random() * 10 - 5, r: Math.random() * 19 + 14 },
                    { rx: Math.random() * 32 + 14, ry: Math.random() * 9 - 4, r: Math.random() * 17 + 11 },
                    { rx: -Math.random() * 26 - 7, ry: Math.random() * 7 - 3, r: Math.random() * 17 + 9 },
                ],
            });
        }
    }
    generateClouds();

    // ────────────────────────────────
    // PARTICLES
    // ────────────────────────────────
    function emitParticles(x, y, count, colors, spread, life) {
        for (let i = 0; i < count; i++) {
            const a = Math.random() * Math.PI * 2;
            const s = Math.random() * spread + spread * 0.3;
            const color = colors[Math.floor(Math.random() * colors.length)];
            particles.push({
                x,
                y,
                vx: Math.cos(a) * s,
                vy: Math.sin(a) * s,
                life: life + Math.random() * life * 0.5,
                maxLife: life * 1.5,
                color,
                r: Math.random() * 3.5 + 1.5,
            });
        }
    }

    function updateParticles(dt) {
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vy += GRAVITY * 0.4 * dt;
            p.life -= dt;
            if (p.life <= 0) particles.splice(i, 1);
        }
    }

    // ────────────────────────────────
    // COLLISION
    // ────────────────────────────────
    function rectCircleOverlap(rx, ry, rw, rh, cx, cy, cr) {
        const closestX = Math.max(rx, Math.min(cx, rx + rw));
        const closestY = Math.max(ry, Math.min(cy, ry + rh));
        return ((cx - closestX) ** 2 + (cy - closestY) ** 2) < (cr * cr);
    }

    function checkCollisions() {
        const gy = H - GROUND_H;
        if (bird.y + BIRD_R >= gy || bird.y - BIRD_R <= 0) return true;
        for (const p of pipes) {
            if (
                rectCircleOverlap(p.x, 0, p.width, p.topH, bird.x, bird.y, BIRD_R * 0.82) ||
                rectCircleOverlap(p.x, p.bottomY, p.width, gy - p.bottomY, bird.x, bird.y, BIRD_R * 0.82)
            ) return true;
        }
        return false;
    }

    function checkNearMiss(pipe) {
        if (pipe.nearMissed) return false;
        const birdRight = bird.x + BIRD_R;
        const pipeLeft = pipe.x;
        const pipeRight = pipe.x + pipe.width;
        if (birdRight > pipeRight && bird.x - BIRD_R < pipeRight + 15 && !pipe.passed) {
            const gapCenter = pipe.topH + PIPE_GAP / 2;
            const distFromGap = Math.abs(bird.y - gapCenter);
            if (distFromGap < PIPE_GAP * 0.7 && distFromGap > PIPE_GAP * 0.35) {
                pipe.nearMissed = true;
                return true;
            }
        }
        return false;
    }

    // ────────────────────────────────
    // GAME FLOW
    // ────────────────────────────────
    function startGame() {
        resetBird();
        resetPipes();
        score = 0;
        currentLevel = 1;
        comboCount = 0;
        comboTimer = 0;
        streakCount = 0;
        nearMissCount = 0;
        lastPipePassedIndex = -1;
        levelUpShown = false;
        levelMessageTimer = 0;
        particles = [];
        groundOffset = 0;
        shakeMag = 0;
        flashAlpha = 0;
        timeOver = null;
        gameMode = STATE.RUN;
        hudScore.textContent = '0';
        hudLevel.textContent = '1';
        comboDisplay.classList.remove('active', 'super');
        comboDisplay.textContent = '';
        streakIndicator.classList.remove('active');
        streakIndicator.textContent = '';
        levelUpMessage.classList.remove('show');
        bird.vy = JUMP_VEL;
        emitParticles(bird.x, bird.y + BIRD_R * 0.6, 16, ['#ffffff', '#ffd700', '#39ff14'], 5, 0.5);
    }

    function endGame() {
        if (gameMode !== STATE.RUN) return;
        gameMode = STATE.OVER;
        timeOver = Date.now();
        shakeMag = 18;
        flashAlpha = 0.65;
        if (score > bestScore) {
            bestScore = score;
            try { localStorage.setItem('flappyABF_best', bestScore); } catch (e) {}
            hudBest.textContent = bestScore;
        }
        comboDisplay.classList.remove('active', 'super');
        streakIndicator.classList.remove('active');
        levelUpMessage.classList.remove('show');
        emitParticles(bird.x, bird.y, 35, ['#ffd700', '#ff6b35', '#ff2d78', '#ffffff'], 6.5, 0.8);
        emitParticles(bird.x, bird.y, 25, ['#ff2d78', '#ff6b35', '#ffd700'], 5, 0.6);
        emitParticles(bird.x, bird.y, 20, ['#ffffff', '#39ff14'], 4, 0.5);
    }

    function triggerLevelUp() {
        const msgIndex = Math.min(currentLevel - 2, levelMessages.length - 1);
        const msg = levelMessages[Math.max(0, msgIndex)];
        levelUpMessage.textContent = msg.replace(/\n/g, ' ');
        levelUpMessage.classList.remove('show');
        void levelUpMessage.offsetWidth;
        levelUpMessage.innerHTML = msg.replace(/\n/g, '<br>');
        levelUpMessage.classList.add('show');
        levelMessageTimer = 80;
        levelUpShown = true;
        emitParticles(W / 2, H * 0.35, 40, ['#ffd700', '#ff2d78', '#39ff14', '#ffffff', '#00e5ff'], 8, 1);
        shakeMag = 8;
        flashAlpha = 0.3;
    }

    // ────────────────────────────────
    // BALLOON POSITION
    // ────────────────────────────────
    function positionBalloon() {
        const balloonX = W * 0.08;
        const balloonY = H * 0.15;
        balloonContainer.style.left = balloonX + 'px';
        balloonContainer.style.top = balloonY + 'px';
    }
    positionBalloon();

    // ────────────────────────────────
    // INPUT
    // ────────────────────────────────
    function handleInput(e) {
        if (e) e.preventDefault();
        switch (gameMode) {
            case STATE.PRE:
                startGame();
                break;
            case STATE.RUN:
                bird.vy = JUMP_VEL;
                bird.wingPhase = -1.3;
                emitParticles(bird.x, bird.y + BIRD_R * 0.5, 9, ['#ffffff', '#ffd700'], 4, 0.4);
                break;
            case STATE.OVER:
                if (timeOver && Date.now() - timeOver > 500) {
                    startGame();
                }
                break;
        }
    }

    canvas.addEventListener('touchstart', handleInput, { passive: false });
    canvas.addEventListener('touchend', (e) => e.preventDefault(), { passive: false });
    canvas.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
    canvas.addEventListener('mousedown', handleInput);
    document.addEventListener('keydown', (e) => {
        if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') handleInput(e);
    });
    document.addEventListener('gesturestart', (e) => e.preventDefault());
    document.addEventListener('gesturechange', (e) => e.preventDefault());
    document.addEventListener('gestureend', (e) => e.preventDefault());

    // ────────────────────────────────
    // DRAWING
    // ────────────────────────────────
    function drawSky() {
        const grad = ctx.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, '#0a0a20');
        grad.addColorStop(0.18, '#0d1b3e');
        grad.addColorStop(0.38, '#152a55');
        grad.addColorStop(0.55, '#1e3f6e');
        grad.addColorStop(0.72, '#3b6fa0');
        grad.addColorStop(0.88, '#5a9ec0');
        grad.addColorStop(1, '#8dc8e0');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);

        // Stars
        stars.forEach(s => {
            const alpha = s.baseAlpha + Math.sin(frameCount * s.twinkleSpeed + s.twinkleOffset) * 0.35;
            ctx.fillStyle = `rgba(255,255,255,${Math.max(0.08, alpha)})`;
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
            ctx.fill();
        });

        // Horizon glow
        const glow = ctx.createRadialGradient(W * 0.5, H * 0.7, H * 0.03, W * 0.5, H * 0.76, H * 0.6);
        glow.addColorStop(0, 'rgba(255,200,150,0.2)');
        glow.addColorStop(0.5, 'rgba(255,180,130,0.06)');
        glow.addColorStop(1, 'rgba(255,150,100,0)');
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, W, H);
    }

    function drawClouds() {
        clouds.forEach(c => {
            ctx.save();
            ctx.globalAlpha = c.opacity;
            c.bubbles.forEach(b => {
                const cx = c.x + b.rx;
                const cy = c.y + b.ry;
                const g = ctx.createRadialGradient(cx - b.r * 0.2, cy - b.r * 0.25, b.r * 0.06, cx, cy, b.r);
                g.addColorStop(0, 'rgba(255,255,255,0.9)');
                g.addColorStop(0.4, 'rgba(255,255,255,0.55)');
                g.addColorStop(1, 'rgba(255,255,255,0)');
                ctx.fillStyle = g;
                ctx.beginPath();
                ctx.arc(cx, cy, b.r, 0, Math.PI * 2);
                ctx.fill();
            });
            ctx.restore();
        });
    }

    function drawGround() {
        const gy = H - GROUND_H;
        const earthGrad = ctx.createLinearGradient(0, gy, 0, H);
        earthGrad.addColorStop(0, '#4a3020');
        earthGrad.addColorStop(0.25, '#3d2616');
        earthGrad.addColorStop(0.6, '#2d1a0e');
        earthGrad.addColorStop(1, '#1a0e06');
        ctx.fillStyle = earthGrad;
        ctx.fillRect(0, gy, W, GROUND_H);

        const grassGrad = ctx.createLinearGradient(0, gy - 3, 0, gy + 10);
        grassGrad.addColorStop(0, '#5cb84a');
        grassGrad.addColorStop(0.3, '#4a9e3a');
        grassGrad.addColorStop(0.6, '#3d7a2d');
        grassGrad.addColorStop(1, '#2d5a1e');
        ctx.fillStyle = grassGrad;
        ctx.fillRect(0, gy - 1, W, 13);

        ctx.strokeStyle = 'rgba(150,220,130,0.4)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(W, gy);
        ctx.stroke();

        const spacing = 15;
        const off = groundOffset % spacing;
        ctx.fillStyle = '#7cc96c';
        for (let x = -off; x < W + spacing; x += spacing) {
            const bh = 6 + Math.sin(x * 0.5 + groundOffset * 0.07) * 3.5;
            ctx.beginPath();
            ctx.moveTo(x, gy);
            ctx.lineTo(x + 2.5, gy - bh);
            ctx.lineTo(x - 2.5, gy - bh);
            ctx.closePath();
            ctx.fill();
        }
        ctx.fillStyle = '#3d8a30';
        for (let x = -off + 7; x < W + spacing; x += spacing) {
            const bh = 3.5 + Math.cos(x * 0.45 + groundOffset * 0.06) * 2.5;
            ctx.beginPath();
            ctx.moveTo(x, gy);
            ctx.lineTo(x + 2, gy - bh);
            ctx.lineTo(x - 2, gy - bh);
            ctx.closePath();
            ctx.fill();
        }

        // Ground top shadow
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(0, gy - 2, W, 3);
    }

    function drawPipeBody(x, y, w, h, capH, isBottom) {
        const capY = isBottom ? y : y + h - capH;
        const bodyTop = isBottom ? y + capH : y;
        const bodyH = h - capH;
        const overhang = w * 0.15;

        // Body
        const bodyGrad = ctx.createLinearGradient(x, 0, x + w, 0);
        bodyGrad.addColorStop(0, '#1a5c1a');
        bodyGrad.addColorStop(0.28, '#3da83d');
        bodyGrad.addColorStop(0.48, '#5dd85d');
        bodyGrad.addColorStop(0.68, '#3da83d');
        bodyGrad.addColorStop(1, '#1a4a1a');
        ctx.fillStyle = bodyGrad;
        ctx.fillRect(x, bodyTop, w, bodyH);

        // Highlight
        const hlGrad = ctx.createLinearGradient(x, 0, x + w, 0);
        hlGrad.addColorStop(0, 'rgba(255,255,255,0)');
        hlGrad.addColorStop(0.2, 'rgba(255,255,255,0.14)');
        hlGrad.addColorStop(0.38, 'rgba(255,255,255,0.22)');
        hlGrad.addColorStop(0.5, 'rgba(255,255,255,0.08)');
        hlGrad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = hlGrad;
        ctx.fillRect(x, bodyTop, w, bodyH);

        // Dark edge
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(x + w - 2, bodyTop, 2, bodyH);

        // Cap
        const capGrad = ctx.createLinearGradient(x - overhang, 0, x + w + overhang, 0);
        capGrad.addColorStop(0, '#1a4a1a');
        capGrad.addColorStop(0.3, '#3da83d');
        capGrad.addColorStop(0.5, '#5dd85d');
        capGrad.addColorStop(0.7, '#3da83d');
        capGrad.addColorStop(1, '#1a4a1a');
        ctx.fillStyle = capGrad;
        ctx.fillRect(x - overhang, capY, w + overhang * 2, capH);

        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(x - overhang, capY + capH - 2, w + overhang * 2, 2);
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.fillRect(x - overhang, capY, w + overhang * 2, 1.5);
    }

    function drawPipe(pipe) {
        const gy = H - GROUND_H;
        drawPipeBody(pipe.x, 0, pipe.width, pipe.topH, pipe.capH, false);
        drawPipeBody(pipe.x, pipe.bottomY, pipe.width, gy - pipe.bottomY, pipe.capH, true);
    }

    function drawBird() {
        // Trail
        bird.trailPositions.forEach((t, i) => {
            const alpha = (i / bird.trailPositions.length) * 0.3;
            ctx.fillStyle = `rgba(255,215,0,${alpha})`;
            ctx.beginPath();
            ctx.arc(t.x, t.y, BIRD_R * 0.5 * (i / bird.trailPositions.length), 0, Math.PI * 2);
            ctx.fill();
        });

        ctx.save();
        ctx.translate(bird.x, bird.y);
        ctx.rotate((bird.angle * Math.PI) / 180);
        const r = BIRD_R;

        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.beginPath();
        ctx.arc(2, 2.5, r, 0, Math.PI * 2);
        ctx.fill();

        // Body
        const bodyGrad = ctx.createRadialGradient(-r * 0.2, -r * 0.3, r * 0.06, 0, 0, r);
        bodyGrad.addColorStop(0, '#ffe980');
        bodyGrad.addColorStop(0.4, '#ffd700');
        bodyGrad.addColorStop(0.75, '#f0b800');
        bodyGrad.addColorStop(1, '#c88200');
        ctx.fillStyle = bodyGrad;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();

        // Highlight
        const hlGrad = ctx.createRadialGradient(-r * 0.28, -r * 0.35, r * 0.03, 0, 0, r);
        hlGrad.addColorStop(0, 'rgba(255,255,255,0.55)');
        hlGrad.addColorStop(0.5, 'rgba(255,255,255,0.1)');
        hlGrad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = hlGrad;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();

        // Wing
        ctx.save();
        ctx.translate(r * 0.1, -r * 0.18);
        ctx.rotate(bird.wingPhase);
        const wingGrad = ctx.createLinearGradient(0, -r * 0.6, 0, r * 0.3);
        wingGrad.addColorStop(0, '#f5c400');
        wingGrad.addColorStop(0.5, '#e8a800');
        wingGrad.addColorStop(1, '#b87000');
        ctx.fillStyle = wingGrad;
        ctx.beginPath();
        ctx.ellipse(0, r * 0.03, r * 0.48, r * 0.6, -0.12, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.1)';
        ctx.lineWidth = 0.7;
        ctx.stroke();
        ctx.restore();

        // Tail
        ctx.fillStyle = '#e8a800';
        ctx.beginPath();
        ctx.moveTo(-r * 0.7, -r * 0.22);
        ctx.lineTo(-r * 1.25, -r * 0.45);
        ctx.lineTo(-r * 1.1, r * 0.1);
        ctx.lineTo(-r * 0.6, r * 0.2);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#b87000';
        ctx.beginPath();
        ctx.moveTo(-r * 0.65, -r * 0.1);
        ctx.lineTo(-r * 1.15, -r * 0.18);
        ctx.lineTo(-r * 1.0, r * 0.18);
        ctx.lineTo(-r * 0.55, r * 0.24);
        ctx.closePath();
        ctx.fill();

        // Eye
        const ex = r * 0.36;
        const ey = -r * 0.27;
        const er = r * 0.28;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(ex, ey, er, 0, Math.PI * 2);
        ctx.fill();
        const pr = er * 0.5;
        ctx.fillStyle = '#111';
        ctx.beginPath();
        ctx.arc(ex + er * 0.16, ey, pr, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(ex + er * 0.03, ey - pr * 0.3, pr * 0.3, 0, Math.PI * 2);
        ctx.fill();

        // Cheek
        const chx = ex + er + r * 0.1;
        const chy = ey + r * 0.26;
        const chr = r * 0.17;
        const chGrad = ctx.createRadialGradient(chx, chy, chr * 0.06, chx, chy, chr);
        chGrad.addColorStop(0, 'rgba(255,130,130,0.5)');
        chGrad.addColorStop(1, 'rgba(255,130,130,0)');
        ctx.fillStyle = chGrad;
        ctx.beginPath();
        ctx.arc(chx, chy, chr, 0, Math.PI * 2);
        ctx.fill();

        // Beak
        const bx = r * 0.78;
        const by = -r * 0.03;
        const beakGrad = ctx.createLinearGradient(bx, by - r * 0.18, bx + r * 0.48, by);
        beakGrad.addColorStop(0, '#ff6b35');
        beakGrad.addColorStop(1, '#e8351a');
        ctx.fillStyle = beakGrad;
        ctx.beginPath();
        ctx.moveTo(bx, by - r * 0.15);
        ctx.lineTo(bx + r * 0.48, by);
        ctx.lineTo(bx, by + r * 0.12);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
    }

    function drawParticles() {
        particles.forEach(p => {
            const alpha = Math.max(0, p.life / p.maxLife);
            ctx.globalAlpha = alpha;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r * (0.5 + alpha * 0.5), 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.globalAlpha = 1;
    }

    function drawOverlay() {
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(0, 0, W, H);

        const pw = Math.min(340, W * 0.8);
        const ph = Math.min(260, H * 0.4);
        const px = W / 2 - pw / 2;
        const py = H / 2 - ph / 2 - H * 0.03;
        const pr = 20;

        ctx.fillStyle = 'rgba(18,20,40,0.9)';
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        roundRect(px, py, pw, ph, pr);
        ctx.fill();
        ctx.stroke();

        const goSize = Math.max(26, Math.min(46, H * 0.058));
        ctx.font = `bold ${goSize}px 'Fredoka One', 'Poppins', cursive, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ff3b5c';
        ctx.fillText('Game Over', W / 2, py + ph * 0.3);

        const scSize = Math.max(19, Math.min(34, H * 0.043));
        ctx.font = `bold ${scSize}px 'Poppins', sans-serif`;
        ctx.fillStyle = '#ffffff';
        ctx.fillText('Score: ' + score, W / 2, py + ph * 0.52);
        ctx.fillText('Level: ' + currentLevel, W / 2, py + ph * 0.64);

        const bsSize = Math.max(12, Math.min(18, H * 0.024));
        ctx.font = `${bsSize}px 'Poppins', sans-serif`;
        ctx.fillStyle = '#ffd700';
        ctx.fillText('Best: ' + bestScore, W / 2, py + ph * 0.76);

        if (score >= bestScore && score > 0) {
            const alpha = 0.5 + Math.sin(Date.now() / 350) * 0.4;
            ctx.fillStyle = `rgba(255,229,100,${alpha})`;
            ctx.fillText('⭐ New Best! ⭐', W / 2, py + ph * 0.88);
        }

        const hintSize = Math.max(11, Math.min(16, H * 0.021));
        ctx.font = `${hintSize}px 'Poppins', sans-serif`;
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.fillText('Tap to restart', W / 2, py + ph + hintSize * 3);
    }

    function drawStartScreen() {
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.fillRect(0, 0, W, H);

        const titleSize = Math.max(34, Math.min(60, H * 0.07));
        ctx.font = `bold ${titleSize}px 'Fredoka One', 'Poppins', cursive, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillText('Flappy Bird', W / 2 + 2, H * 0.26 + 2);
        const tGrad = ctx.createLinearGradient(0, H * 0.18, 0, H * 0.32);
        tGrad.addColorStop(0, '#ffe980');
        tGrad.addColorStop(0.5, '#ffd700');
        tGrad.addColorStop(1, '#f0a500');
        ctx.fillStyle = tGrad;
        ctx.fillText('Flappy Bird', W / 2, H * 0.26);

        const subSize = Math.max(11, Math.min(18, H * 0.022));
        ctx.font = `${subSize}px 'Poppins', sans-serif`;
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.fillText('ABDULLAH BIN FAHAD Edition', W / 2, H * 0.33);

        const instrSize = Math.max(14, Math.min(22, H * 0.028));
        ctx.font = `600 ${instrSize}px 'Poppins', sans-serif`;
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.fillText('Tap, Click or Space to Fly', W / 2, H * 0.44);

        if (bestScore > 0) {
            const bSize = Math.max(12, Math.min(19, H * 0.025));
            ctx.font = `${bSize}px 'Poppins', sans-serif`;
            ctx.fillStyle = '#ffd700';
            ctx.fillText('Best: ' + bestScore + ' | Level ' + Math.max(1, Math.floor(bestScore / 5) + 1),
                W / 2, H * 0.51);
        }

        const pulse = 0.4 + Math.sin(Date.now() / 500) * 0.35;
        ctx.strokeStyle = `rgba(255,255,255,${pulse})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(W / 2, H * 0.6, 24, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = `rgba(255,255,255,${pulse * 0.35})`;
        ctx.beginPath();
        ctx.arc(W / 2, H * 0.6, 13, 0, Math.PI * 2);
        ctx.fill();
    }

    function roundRect(x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
    }

    // ────────────────────────────────
    // UPDATE
    // ────────────────────────────────
    let lastTime = performance.now();

    function update(dt) {
        frameCount++;

        // Stars twinkle
        stars.forEach(s => {
            s.x -= 0.02 * dt;
            if (s.x < -5) s.x = W + 5;
        });

        // Clouds
        clouds.forEach(c => {
            c.x -= c.speed * dt;
            if (c.x + 140 < -40) {
                c.x = W + Math.random() * 80;
                c.y = Math.random() * H * 0.4 + H * 0.04;
            }
        });

        updateParticles(dt);

        if (shakeMag > 0) { shakeMag *= 0.84; if (shakeMag < 0.2) shakeMag = 0; }
        if (flashAlpha > 0) { flashAlpha *= 0.86; if (flashAlpha < 0.006) flashAlpha = 0; }

        // Combo timer
        if (comboTimer > 0) {
            comboTimer -= dt;
            if (comboTimer <= 0) {
                comboCount = 0;
                comboDisplay.classList.remove('active', 'super');
                comboDisplay.textContent = '';
            }
        }

        // Level message timer
        if (levelMessageTimer > 0) {
            levelMessageTimer -= dt;
            if (levelMessageTimer <= 0) {
                levelUpMessage.classList.remove('show');
                levelUpShown = false;
            }
        }

        switch (gameMode) {
            case STATE.PRE:
                bird.y = H * 0.42 + Math.sin(Date.now() / 700) * 7;
                bird.wingPhase = Math.sin(Date.now() / 300) * 0.26;
                bird.angle = Math.sin(Date.now() / 600) * 2.2;
                groundOffset -= PIPE_SPEED * 0.4 * dt;
                if (groundOffset < -W) groundOffset += W;
                break;

            case STATE.RUN:
                bird.vy += GRAVITY * dt;
                if (bird.vy > MAX_FALL) bird.vy = MAX_FALL;
                bird.y += bird.vy * dt;

                const targetAngle = bird.vy < 0 ? -18 : Math.min(70, bird.vy * 7);
                bird.angle += (targetAngle - bird.angle) * 0.15 * dt;

                const wingTarget = bird.vy < -1 ? -0.6 : bird.vy > 2 ? 0.48 : 0;
                bird.wingPhase += (wingTarget - bird.wingPhase) * 0.3 * dt;

                // Trail
                if (frameCount % 3 === 0) {
                    bird.trailPositions.push({ x: bird.x, y: bird.y });
                    if (bird.trailPositions.length > 8) bird.trailPositions.shift();
                }

                const speed = PIPE_SPEED * dt;
                pipes.forEach(p => (p.x -= speed));

                while (pipes.length && pipes[0].x + pipes[0].width < -60) pipes.shift();

                const last = pipes[pipes.length - 1];
                if (!last || last.x < W - SPAWN_INTERVAL) {
                    spawnPipe(last ? last.x + SPAWN_INTERVAL : W + 120);
                }

                // Score & combo
                pipes.forEach((p, idx) => {
                    if (!p.passed && p.x + p.width / 2 < bird.x) {
                        p.passed = true;
                        score++;
                        comboCount++;
                        comboTimer = 90;
                        streakCount++;
                        hudScore.textContent = score;
                        hudScore.parentElement.style.transform = 'scale(1.2)';
                        setTimeout(() => { hudScore.parentElement.style.transform = 'scale(1)'; }, 150);

                        emitParticles(bird.x + BIRD_R, bird.y, 8, ['#ffd700', '#ffffff', '#39ff14'], 3.5, 0.35);

                        // Combo display
                        if (comboCount >= 8) {
                            comboDisplay.textContent = '🔥 ' + comboCount + 'x COMBO!';
                            comboDisplay.classList.add('super');
                            comboDisplay.classList.remove('active');
                            void comboDisplay.offsetWidth;
                            comboDisplay.classList.add('super');
                            emitParticles(W * 0.85, H * 0.5, 15, ['#ff2d78', '#ffd700'], 5, 0.5);
                        } else if (comboCount >= 4) {
                            comboDisplay.textContent = comboCount + 'x COMBO!';
                            comboDisplay.classList.add('active');
                            comboDisplay.classList.remove('super');
                            void comboDisplay.offsetWidth;
                            comboDisplay.classList.add('active');
                        } else if (comboCount >= 2) {
                            comboDisplay.textContent = 'NICE!';
                            comboDisplay.classList.add('active');
                            comboDisplay.classList.remove('super');
                            void comboDisplay.offsetWidth;
                            comboDisplay.classList.add('active');
                        }

                        // Streak
                        if (streakCount >= 10 && streakCount % 5 === 0) {
                            streakIndicator.textContent = '⚡ ' + streakCount + ' STREAK! INCREDIBLE!';
                            streakIndicator.classList.add('active');
                            setTimeout(() => streakIndicator.classList.remove('active'), 1800);
                            emitParticles(W / 2, H * 0.7, 20, ['#ffd700', '#00e5ff', '#ff2d78'], 6, 0.6);
                        } else if (streakCount >= 5 && streakCount < 10) {
                            streakIndicator.textContent = '🔥 ' + streakCount + ' STREAK!';
                            streakIndicator.classList.add('active');
                            setTimeout(() => streakIndicator.classList.remove('active'), 1500);
                        }

                        // Level up every 5 points
                        const newLevel = Math.floor(score / 5) + 1;
                        if (newLevel > currentLevel) {
                            currentLevel = newLevel;
                            hudLevel.textContent = currentLevel;
                            hudLevel.parentElement.style.transform = 'scale(1.3)';
                            setTimeout(() => { hudLevel.parentElement.style.transform = 'scale(1)'; }, 200);
                            triggerLevelUp();
                            // Increase difficulty slightly
                            PIPE_SPEED = Math.min(PIPE_SPEED + 0.15, PIPE_SPEED * 1.6);
                            SPAWN_INTERVAL = Math.max(130, SPAWN_INTERVAL - 8);
                        }
                    }

                    // Near miss detection
                    if (checkNearMiss(p)) {
                        nearMissCount++;
                        emitParticles(bird.x, bird.y, 6, ['#00e5ff', '#ffffff'], 3, 0.3);
                        if (nearMissCount % 3 === 0) {
                            streakIndicator.textContent = '😱 CLOSE CALL!';
                            streakIndicator.classList.add('active');
                            setTimeout(() => streakIndicator.classList.remove('active'), 1200);
                        }
                    }
                });

                groundOffset -= speed;
                if (groundOffset < -W) groundOffset += W;

                if (checkCollisions()) endGame();
                break;

            case STATE.OVER:
                const gy = H - GROUND_H;
                if (bird.y + BIRD_R < gy) {
                    bird.vy += GRAVITY * dt;
                    if (bird.vy > MAX_FALL) bird.vy = MAX_FALL;
                    bird.y += bird.vy * dt;
                    bird.angle = Math.min(80, bird.angle + 2.5 * dt);
                } else {
                    bird.y = gy - BIRD_R;
                    bird.vy = 0;
                    bird.angle = 76;
                }
                bird.wingPhase = 0.48;
                bird.trailPositions = [];
                groundOffset -= PIPE_SPEED * 0.2 * dt;
                if (groundOffset < -W) groundOffset += W;
                break;
        }
    }

    function render() {
        ctx.clearRect(0, 0, W, H);

        let sx = 0,
            sy = 0;
        if (shakeMag > 0) {
            sx = (Math.random() - 0.5) * shakeMag * 2;
            sy = (Math.random() - 0.5) * shakeMag * 2;
        }

        ctx.save();
        ctx.translate(sx, sy);
        drawSky();
        drawClouds();
        pipes.forEach(p => { if (p.x + p.width > -30 && p.x < W + 30) drawPipe(p); });
        drawGround();
        drawParticles();
        drawBird();
        ctx.restore();

        if (flashAlpha > 0) {
            ctx.fillStyle = `rgba(255,255,255,${flashAlpha})`;
            ctx.fillRect(0, 0, W, H);
        }

        if (gameMode === STATE.PRE) drawStartScreen();
        if (gameMode === STATE.OVER) drawOverlay();
    }

    function gameLoop(timestamp) {
        let dt = (timestamp - lastTime) / 16.667;
        if (dt <= 0) dt = 0.016;
        if (dt > 3.5) dt = 3.5;
        lastTime = timestamp;
        update(dt);
        render();
        requestAnimationFrame(gameLoop);
    }

    // ────────────────────────────────
    // INIT
    // ────────────────────────────────
    function init() {
        resizeCanvas();
        updateDimensions();
        resetBird();
        resetPipes();
        generateStars();
        generateClouds();
        positionBalloon();
        particles = [];
        score = 0;
        currentLevel = 1;
        gameMode = STATE.PRE;
        groundOffset = 0;
        shakeMag = 0;
        flashAlpha = 0;
        timeOver = null;
        comboCount = 0;
        comboTimer = 0;
        streakCount = 0;
        nearMissCount = 0;
        levelUpShown = false;
        levelMessageTimer = 0;
        hudScore.textContent = '0';
        hudLevel.textContent = '1';
        hudBest.textContent = bestScore;
        comboDisplay.classList.remove('active', 'super');
        comboDisplay.textContent = '';
        streakIndicator.classList.remove('active');
        streakIndicator.textContent = '';
        levelUpMessage.classList.remove('show');
    }

    init();
    requestAnimationFrame(gameLoop);

    console.log('🐦 Flappy Bird • ABDULLAH BIN FAHAD Edition');
    console.log('   Full viewport • Level system • Combo rewards');
    console.log('   Screen:', Math.round(W) + '×' + Math.round(H), '@' + DPR + 'x');
})();
