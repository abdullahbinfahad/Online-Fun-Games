// script.js
(function () {
    'use strict';

    // ──────────────────────────────────────
    // DOM Elements
    // ──────────────────────────────────────
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    const scoreDisplay = document.getElementById('scoreDisplay');
    const bestDisplay = document.getElementById('bestDisplay');

    // ──────────────────────────────────────
    // Responsive Scaling
    // ──────────────────────────────────────
    const MAX_DPR = 2;
    let W, H, DPR;

    function resize() {
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

    resize();
    window.addEventListener('resize', () => {
        const prevW = W;
        const prevH = H;
        resize();
        // Proportional repositioning
        bird.x = (bird.x / prevW) * W;
        bird.y = Math.min(bird.y, H - GROUND_H - BIRD_R);
        pipes.forEach(p => {
            p.x = (p.x / prevW) * W;
            p.width = PIPE_W;
            p.capH = PIPE_CAP_H;
        });
        updateDimensions();
    });
    window.addEventListener('orientationchange', () => setTimeout(resize, 250));

    // ──────────────────────────────────────
    // Game Dimensions (recalculated on resize)
    // ──────────────────────────────────────
    let BIRD_R, PIPE_W, PIPE_GAP, GROUND_H, PIPE_CAP_H;
    let PIPE_SPEED, GRAVITY, JUMP_VEL, MAX_FALL, SPAWN_INTERVAL;

    function updateDimensions() {
        BIRD_R = Math.max(13, Math.min(26, H * 0.042));
        PIPE_W = Math.max(38, Math.min(72, W * 0.095));
        PIPE_GAP = Math.max(105, Math.min(190, H * 0.25));
        GROUND_H = Math.max(48, Math.min(90, H * 0.11));
        PIPE_CAP_H = Math.max(18, Math.min(32, H * 0.04));
        PIPE_SPEED = Math.max(1.6, Math.min(3.8, W * 0.0042));
        GRAVITY = Math.max(0.28, Math.min(0.65, H * 0.0008));
        JUMP_VEL = Math.max(-6.2, Math.min(-3.6, -H * 0.0085));
        MAX_FALL = Math.max(5.5, Math.min(11, H * 0.015));
        SPAWN_INTERVAL = Math.max(170, Math.min(340, W * 0.4));
    }
    updateDimensions();

    // ──────────────────────────────────────
    // Game State
    // ──────────────────────────────────────
    const STATE = { PRE: 'prestart', RUN: 'running', OVER: 'over' };
    let gameMode = STATE.PRE;
    let score = 0;
    let bestScore = 0;
    let pipes = [];
    let particles = [];
    let clouds = [];
    let groundOffset = 0;
    let shakeMag = 0;
    let flashAlpha = 0;
    let timeOver = null;
    let frameCount = 0;

    // Load best score
    try {
        bestScore = parseInt(localStorage.getItem('flappyBest_v2') || '0');
    } catch (e) {
        bestScore = 0;
    }
    bestDisplay.textContent = '🏆 ' + bestScore;

    // ──────────────────────────────────────
    // Bird
    // ──────────────────────────────────────
    const bird = {
        x: 0,
        y: 0,
        vy: 0,
        angle: 0,
        wingPhase: 0,
        blinkTimer: 0,
    };

    function resetBird() {
        bird.x = W * 0.28;
        bird.y = H * 0.44;
        bird.vy = 0;
        bird.angle = 0;
        bird.wingPhase = 0;
        bird.blinkTimer = Math.random() * 3 + 2;
    }

    // ──────────────────────────────────────
    // Pipes
    // ──────────────────────────────────────
    function spawnPipe(x) {
        const groundY = H - GROUND_H;
        const minTop = PIPE_CAP_H + 25;
        const maxTop = groundY - PIPE_GAP - PIPE_CAP_H - 25;
        const gapCenter = minTop + Math.random() * (maxTop - minTop);
        pipes.push({
            x: x,
            topH: gapCenter - PIPE_GAP / 2,
            bottomY: gapCenter + PIPE_GAP / 2,
            width: PIPE_W,
            capH: PIPE_CAP_H,
            passed: false,
        });
    }

    function resetPipes() {
        pipes = [];
        const startX = W + 80;
        for (let i = 0; i < 5; i++) {
            spawnPipe(startX + i * SPAWN_INTERVAL);
        }
    }

    // ──────────────────────────────────────
    // Clouds
    // ──────────────────────────────────────
    function generateClouds() {
        clouds = [];
        const count = Math.floor(W / 160) + 3;
        for (let i = 0; i < count; i++) {
            clouds.push({
                x: Math.random() * W * 1.4,
                y: Math.random() * H * 0.45 + H * 0.03,
                w: Math.random() * 90 + 55,
                h: Math.random() * 28 + 16,
                speed: Math.random() * 0.3 + 0.12,
                opacity: Math.random() * 0.3 + 0.15,
                bubbles: [
                    { rx: 0, ry: 0, r: Math.random() * 16 + 14 },
                    { rx: Math.random() * 35 + 12, ry: Math.random() * 12 - 6, r: Math.random() * 20 + 16 },
                    { rx: Math.random() * 35 + 16, ry: Math.random() * 10 - 5, r: Math.random() * 18 + 12 },
                    { rx: -Math.random() * 28 - 8, ry: Math.random() * 8 - 4, r: Math.random() * 18 + 10 },
                ],
            });
        }
    }
    generateClouds();

    // ──────────────────────────────────────
    // Particles
    // ──────────────────────────────────────
    function emitParticles(x, y, count, color, spread, life) {
        for (let i = 0; i < count; i++) {
            const a = Math.random() * Math.PI * 2;
            const s = Math.random() * spread + spread * 0.3;
            particles.push({
                x,
                y,
                vx: Math.cos(a) * s,
                vy: Math.sin(a) * s,
                life: life + Math.random() * life * 0.5,
                maxLife: life * 1.5,
                color,
                r: Math.random() * 3 + 1.5,
            });
        }
    }

    function updateParticles(dt) {
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vy += GRAVITY * 0.45 * dt;
            p.life -= dt;
            if (p.life <= 0) particles.splice(i, 1);
        }
    }

    // ──────────────────────────────────────
    // Collision
    // ──────────────────────────────────────
    function rectCircleCollision(rx, ry, rw, rh, cx, cy, cr) {
        const closestX = Math.max(rx, Math.min(cx, rx + rw));
        const closestY = Math.max(ry, Math.min(cy, ry + rh));
        const dx = cx - closestX;
        const dy = cy - closestY;
        return (dx * dx + dy * dy) < (cr * cr);
    }

    function checkCollisions() {
        const groundY = H - GROUND_H;
        // Ground / ceiling
        if (bird.y + BIRD_R >= groundY || bird.y - BIRD_R <= 0) return true;
        // Pipes
        for (const p of pipes) {
            if (
                rectCircleCollision(p.x, 0, p.width, p.topH, bird.x, bird.y, BIRD_R * 0.85) ||
                rectCircleCollision(p.x, p.bottomY, p.width, groundY - p.bottomY, bird.x, bird.y, BIRD_R * 0.85)
            ) {
                return true;
            }
        }
        return false;
    }

    // ──────────────────────────────────────
    // Game Flow
    // ──────────────────────────────────────
    function startGame() {
        resetBird();
        resetPipes();
        score = 0;
        particles = [];
        groundOffset = 0;
        shakeMag = 0;
        flashAlpha = 0;
        timeOver = null;
        gameMode = STATE.RUN;
        scoreDisplay.textContent = '0';
        scoreDisplay.classList.remove('pulse');
        bird.vy = JUMP_VEL;
        emitParticles(bird.x, bird.y + BIRD_R * 0.6, 14, '#ffffff', 5, 0.5);
    }

    function endGame() {
        if (gameMode !== STATE.RUN) return;
        gameMode = STATE.OVER;
        timeOver = Date.now();
        shakeMag = 16;
        flashAlpha = 0.6;
        if (score > bestScore) {
            bestScore = score;
            try { localStorage.setItem('flappyBest_v2', bestScore); } catch (e) {}
            bestDisplay.textContent = '🏆 ' + bestScore;
        }
        emitParticles(bird.x, bird.y, 30, '#ffd700', 6, 0.75);
        emitParticles(bird.x, bird.y, 22, '#ff6b35', 4.5, 0.55);
        emitParticles(bird.x, bird.y, 18, '#ffffff', 3.5, 0.45);
    }

    function restartGame() {
        startGame();
    }

    // ──────────────────────────────────────
    // Input
    // ──────────────────────────────────────
    function handleInput(e) {
        if (e) e.preventDefault();
        switch (gameMode) {
            case STATE.PRE:
                startGame();
                break;
            case STATE.RUN:
                bird.vy = JUMP_VEL;
                bird.wingPhase = -1.2;
                emitParticles(bird.x, bird.y + BIRD_R * 0.5, 8, '#ffffff', 4, 0.4);
                break;
            case STATE.OVER:
                if (timeOver && Date.now() - timeOver > 500) {
                    restartGame();
                }
                break;
        }
    }

    canvas.addEventListener('touchstart', handleInput, { passive: false });
    canvas.addEventListener('touchend', (e) => e.preventDefault(), { passive: false });
    canvas.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
    canvas.addEventListener('mousedown', handleInput);
    document.addEventListener('keydown', (e) => {
        if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
            handleInput(e);
        }
    });
    document.addEventListener('gesturestart', (e) => e.preventDefault());
    document.addEventListener('gesturechange', (e) => e.preventDefault());
    document.addEventListener('gestureend', (e) => e.preventDefault());

    // ──────────────────────────────────────
    // Drawing Helpers
    // ──────────────────────────────────────
    function drawSky() {
        const grad = ctx.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, '#0b1a30');
        grad.addColorStop(0.22, '#1a3a5c');
        grad.addColorStop(0.45, '#3d7ea6');
        grad.addColorStop(0.72, '#7ab8d4');
        grad.addColorStop(1, '#b8dff0');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);

        // Warm horizon glow
        const glow = ctx.createRadialGradient(W * 0.55, H * 0.72, H * 0.04, W * 0.5, H * 0.78, H * 0.65);
        glow.addColorStop(0, 'rgba(255,210,160,0.22)');
        glow.addColorStop(0.5, 'rgba(255,190,140,0.07)');
        glow.addColorStop(1, 'rgba(255,170,120,0)');
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, W, H);

        // Stars (subtle, top portion)
        if (gameMode === STATE.PRE) {
            for (let i = 0; i < 35; i++) {
                const sx = (i * 137.5 + 50) % W;
                const sy = (i * 89.3 + 30) % (H * 0.35);
                const twinkle = 0.3 + Math.sin(frameCount * 0.03 + i) * 0.3;
                ctx.fillStyle = `rgba(255,255,255,${twinkle})`;
                ctx.beginPath();
                ctx.arc(sx, sy, 1.2, 0, Math.PI * 2);
                ctx.fill();
            }
        }
    }

    function drawClouds() {
        clouds.forEach(c => {
            ctx.save();
            ctx.globalAlpha = c.opacity;
            c.bubbles.forEach(b => {
                const cx = c.x + b.rx;
                const cy = c.y + b.ry;
                const g = ctx.createRadialGradient(cx - b.r * 0.2, cy - b.r * 0.25, b.r * 0.08, cx, cy, b.r);
                g.addColorStop(0, 'rgba(255,255,255,0.95)');
                g.addColorStop(0.45, 'rgba(255,255,255,0.65)');
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
        // Earth
        const earthGrad = ctx.createLinearGradient(0, gy, 0, H);
        earthGrad.addColorStop(0, '#5c3a1e');
        earthGrad.addColorStop(0.3, '#4a2d14');
        earthGrad.addColorStop(0.7, '#3a2010');
        earthGrad.addColorStop(1, '#241208');
        ctx.fillStyle = earthGrad;
        ctx.fillRect(0, gy, W, GROUND_H);

        // Grass band
        const grassGrad = ctx.createLinearGradient(0, gy - 4, 0, gy + 12);
        grassGrad.addColorStop(0, '#5ca84a');
        grassGrad.addColorStop(0.35, '#4a9438');
        grassGrad.addColorStop(0.6, '#3d7a2d');
        grassGrad.addColorStop(1, '#2d5a1e');
        ctx.fillStyle = grassGrad;
        ctx.fillRect(0, gy - 1, W, 14);

        // Grass highlight line
        ctx.strokeStyle = 'rgba(160,220,140,0.45)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(W, gy);
        ctx.stroke();

        // Grass blades
        const spacing = 16;
        const off = groundOffset % spacing;
        ctx.fillStyle = '#7cc96c';
        for (let x = -off; x < W + spacing; x += spacing) {
            const bh = 7 + Math.sin(x * 0.5 + groundOffset * 0.08) * 4;
            ctx.beginPath();
            ctx.moveTo(x, gy);
            ctx.lineTo(x + 2.5, gy - bh);
            ctx.lineTo(x - 2.5, gy - bh);
            ctx.closePath();
            ctx.fill();
        }
        ctx.fillStyle = '#3d8a30';
        for (let x = -off + 8; x < W + spacing; x += spacing) {
            const bh = 4 + Math.cos(x * 0.45 + groundOffset * 0.07) * 3;
            ctx.beginPath();
            ctx.moveTo(x, gy);
            ctx.lineTo(x + 2, gy - bh);
            ctx.lineTo(x - 2, gy - bh);
            ctx.closePath();
            ctx.fill();
        }
    }

    function drawPipeBody(x, y, w, h, capH, isBottom) {
        const capY = isBottom ? y : y + h - capH;
        const bodyTop = isBottom ? y + capH : y;
        const bodyH = h - capH;
        const overhang = w * 0.16;

        // Body gradient
        const bodyGrad = ctx.createLinearGradient(x, 0, x + w, 0);
        bodyGrad.addColorStop(0, '#2d8a2d');
        bodyGrad.addColorStop(0.3, '#4ab84e');
        bodyGrad.addColorStop(0.5, '#5dc95d');
        bodyGrad.addColorStop(0.7, '#4ab84e');
        bodyGrad.addColorStop(1, '#1a5c1a');
        ctx.fillStyle = bodyGrad;
        ctx.fillRect(x, bodyTop, w, bodyH);

        // Highlight stripe
        const hlGrad = ctx.createLinearGradient(x, 0, x + w, 0);
        hlGrad.addColorStop(0, 'rgba(255,255,255,0)');
        hlGrad.addColorStop(0.22, 'rgba(255,255,255,0.16)');
        hlGrad.addColorStop(0.4, 'rgba(255,255,255,0.22)');
        hlGrad.addColorStop(0.5, 'rgba(255,255,255,0.1)');
        hlGrad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = hlGrad;
        ctx.fillRect(x, bodyTop, w, bodyH);

        // Dark edge
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fillRect(x + w - 2.5, bodyTop, 2.5, bodyH);

        // Cap
        const capGrad = ctx.createLinearGradient(x - overhang, 0, x + w + overhang, 0);
        capGrad.addColorStop(0, '#1a5c1a');
        capGrad.addColorStop(0.3, '#3da83d');
        capGrad.addColorStop(0.5, '#5dc95d');
        capGrad.addColorStop(0.7, '#3da83d');
        capGrad.addColorStop(1, '#1a5c1a');
        ctx.fillStyle = capGrad;
        ctx.fillRect(x - overhang, capY, w + overhang * 2, capH);

        // Cap shadow
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(x - overhang, capY + capH - 2.5, w + overhang * 2, 2.5);

        // Cap highlight
        ctx.fillStyle = 'rgba(255,255,255,0.22)';
        ctx.fillRect(x - overhang, capY, w + overhang * 2, 1.5);
    }

    function drawPipe(pipe) {
        const gy = H - GROUND_H;
        drawPipeBody(pipe.x, 0, pipe.width, pipe.topH, pipe.capH, false);
        drawPipeBody(pipe.x, pipe.bottomY, pipe.width, gy - pipe.bottomY, pipe.capH, true);
    }

    function drawBird() {
        ctx.save();
        ctx.translate(bird.x, bird.y);
        ctx.rotate((bird.angle * Math.PI) / 180);

        const r = BIRD_R;

        // Shadow
        ctx.fillStyle = 'rgba(0,0,0,0.22)';
        ctx.beginPath();
        ctx.arc(2, 2.5, r, 0, Math.PI * 2);
        ctx.fill();

        // Body
        const bodyGrad = ctx.createRadialGradient(-r * 0.2, -r * 0.3, r * 0.08, 0, 0, r);
        bodyGrad.addColorStop(0, '#ffe566');
        bodyGrad.addColorStop(0.45, '#ffd700');
        bodyGrad.addColorStop(0.8, '#f0b800');
        bodyGrad.addColorStop(1, '#d4940a');
        ctx.fillStyle = bodyGrad;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();

        // Highlight
        const hlGrad = ctx.createRadialGradient(-r * 0.28, -r * 0.35, r * 0.04, 0, 0, r);
        hlGrad.addColorStop(0, 'rgba(255,255,255,0.5)');
        hlGrad.addColorStop(0.5, 'rgba(255,255,255,0.12)');
        hlGrad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = hlGrad;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();

        // Wing
        const wingFlap = bird.wingPhase;
        ctx.save();
        ctx.translate(r * 0.12, -r * 0.18);
        ctx.rotate(wingFlap);
        const wingGrad = ctx.createLinearGradient(0, -r * 0.65, 0, r * 0.35);
        wingGrad.addColorStop(0, '#f5c400');
        wingGrad.addColorStop(0.55, '#e8a800');
        wingGrad.addColorStop(1, '#c88200');
        ctx.fillStyle = wingGrad;
        ctx.beginPath();
        ctx.ellipse(0, r * 0.04, r * 0.5, r * 0.65, -0.15, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.12)';
        ctx.lineWidth = 0.8;
        ctx.stroke();
        ctx.restore();

        // Tail
        ctx.fillStyle = '#e8a800';
        ctx.beginPath();
        ctx.moveTo(-r * 0.75, -r * 0.25);
        ctx.lineTo(-r * 1.3, -r * 0.5);
        ctx.lineTo(-r * 1.15, r * 0.12);
        ctx.lineTo(-r * 0.65, r * 0.22);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#c88200';
        ctx.beginPath();
        ctx.moveTo(-r * 0.7, -r * 0.12);
        ctx.lineTo(-r * 1.2, -r * 0.2);
        ctx.lineTo(-r * 1.05, r * 0.2);
        ctx.lineTo(-r * 0.6, r * 0.26);
        ctx.closePath();
        ctx.fill();

        // Eye
        const ex = r * 0.38;
        const ey = -r * 0.28;
        const er = r * 0.3;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(ex, ey, er, 0, Math.PI * 2);
        ctx.fill();
        const pr = er * 0.52;
        ctx.fillStyle = '#111111';
        ctx.beginPath();
        ctx.arc(ex + er * 0.18, ey, pr, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(ex + er * 0.04, ey - pr * 0.32, pr * 0.32, 0, Math.PI * 2);
        ctx.fill();

        // Cheek
        const chx = ex + er + r * 0.12;
        const chy = ey + r * 0.28;
        const chr = r * 0.18;
        const chGrad = ctx.createRadialGradient(chx, chy, chr * 0.08, chx, chy, chr);
        chGrad.addColorStop(0, 'rgba(255,140,140,0.55)');
        chGrad.addColorStop(1, 'rgba(255,140,140,0)');
        ctx.fillStyle = chGrad;
        ctx.beginPath();
        ctx.arc(chx, chy, chr, 0, Math.PI * 2);
        ctx.fill();

        // Beak
        const bx = r * 0.82;
        const by = -r * 0.04;
        const beakGrad = ctx.createLinearGradient(bx, by - r * 0.2, bx + r * 0.5, by);
        beakGrad.addColorStop(0, '#ff6b35');
        beakGrad.addColorStop(1, '#e8451a');
        ctx.fillStyle = beakGrad;
        ctx.beginPath();
        ctx.moveTo(bx, by - r * 0.16);
        ctx.lineTo(bx + r * 0.5, by);
        ctx.lineTo(bx, by + r * 0.13);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
    }

    function drawParticles() {
        particles.forEach(p => {
            const alpha = Math.max(0, p.life / p.maxLife);
            const s = 0.5 + alpha * 0.5;
            ctx.globalAlpha = alpha;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r * s, 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.globalAlpha = 1;
    }

    function drawOverlay() {
        // Semi-transparent backdrop
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(0, 0, W, H);

        // Panel
        const pw = Math.min(320, W * 0.78);
        const ph = Math.min(240, H * 0.38);
        const px = W / 2 - pw / 2;
        const py = H / 2 - ph / 2 - H * 0.04;
        const pr = 18;

        ctx.fillStyle = 'rgba(20,22,40,0.88)';
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        roundRect(px, py, pw, ph, pr);
        ctx.fill();
        ctx.stroke();

        // Game Over text
        const goSize = Math.max(28, Math.min(48, H * 0.06));
        ctx.font = `bold ${goSize}px 'Fredoka One', 'Poppins', cursive, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ff5555';
        ctx.fillText('Game Over', W / 2, py + ph * 0.32);

        // Score
        const scSize = Math.max(20, Math.min(36, H * 0.045));
        ctx.font = `bold ${scSize}px 'Poppins', sans-serif`;
        ctx.fillStyle = '#ffffff';
        ctx.fillText('Score: ' + score, W / 2, py + ph * 0.56);

        // Best
        const bsSize = Math.max(13, Math.min(20, H * 0.026));
        ctx.font = `${bsSize}px 'Poppins', sans-serif`;
        ctx.fillStyle = '#ffd700';
        ctx.fillText('Best: ' + bestScore, W / 2, py + ph * 0.72);

        // New best
        if (score >= bestScore && score > 0) {
            const alpha = 0.55 + Math.sin(Date.now() / 350) * 0.4;
            ctx.fillStyle = `rgba(255,229,100,${alpha})`;
            ctx.fillText('⭐ New Best! ⭐', W / 2, py + ph * 0.88);
        }

        // Restart hint
        const hintSize = Math.max(12, Math.min(17, H * 0.022));
        ctx.font = `${hintSize}px 'Poppins', sans-serif`;
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.fillText('Tap to restart', W / 2, py + ph + hintSize * 2.8);
    }

    function drawStartScreen() {
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.fillRect(0, 0, W, H);

        const titleSize = Math.max(36, Math.min(64, H * 0.075));
        ctx.font = `bold ${titleSize}px 'Fredoka One', 'Poppins', cursive, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillText('Flappy Bird', W / 2 + 2, H * 0.27 + 2);
        const tGrad = ctx.createLinearGradient(0, H * 0.2, 0, H * 0.33);
        tGrad.addColorStop(0, '#ffe566');
        tGrad.addColorStop(0.5, '#ffd700');
        tGrad.addColorStop(1, '#f0a500');
        ctx.fillStyle = tGrad;
        ctx.fillText('Flappy Bird', W / 2, H * 0.27);

        const instrSize = Math.max(15, Math.min(24, H * 0.03));
        ctx.font = `600 ${instrSize}px 'Poppins', sans-serif`;
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.fillText('Tap, Click or Space to Fly', W / 2, H * 0.46);

        if (bestScore > 0) {
            const bSize = Math.max(13, Math.min(20, H * 0.026));
            ctx.font = `${bSize}px 'Poppins', sans-serif`;
            ctx.fillStyle = '#ffd700';
            ctx.fillText('Best: ' + bestScore, W / 2, H * 0.54);
        }

        // Pulsing circle
        const pulse = 0.4 + Math.sin(Date.now() / 550) * 0.35;
        ctx.strokeStyle = `rgba(255,255,255,${pulse})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(W / 2, H * 0.63, 26, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = `rgba(255,255,255,${pulse * 0.4})`;
        ctx.beginPath();
        ctx.arc(W / 2, H * 0.63, 14, 0, Math.PI * 2);
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

    // ──────────────────────────────────────
    // Update Loop
    // ──────────────────────────────────────
    let lastTime = performance.now();

    function update(dt) {
        frameCount++;

        // Clouds
        clouds.forEach(c => {
            c.x -= c.speed * dt;
            if (c.x + 140 < -40) {
                c.x = W + Math.random() * 90;
                c.y = Math.random() * H * 0.45 + H * 0.03;
            }
        });

        // Particles
        updateParticles(dt);

        // Shake decay
        if (shakeMag > 0) {
            shakeMag *= 0.84;
            if (shakeMag < 0.25) shakeMag = 0;
        }
        if (flashAlpha > 0) {
            flashAlpha *= 0.87;
            if (flashAlpha < 0.008) flashAlpha = 0;
        }

        switch (gameMode) {
            case STATE.PRE:
                bird.y = H * 0.44 + Math.sin(Date.now() / 750) * 7;
                bird.wingPhase = Math.sin(Date.now() / 320) * 0.28;
                bird.angle = Math.sin(Date.now() / 650) * 2.5;
                groundOffset -= PIPE_SPEED * 0.45 * dt;
                if (groundOffset < -W) groundOffset += W;
                break;

            case STATE.RUN:
                // Bird physics
                bird.vy += GRAVITY * dt;
                if (bird.vy > MAX_FALL) bird.vy = MAX_FALL;
                bird.y += bird.vy * dt;

                // Angle
                const target = bird.vy < 0 ? -20 : Math.min(72, bird.vy * 7.5);
                bird.angle += (target - bird.angle) * 0.16 * dt;

                // Wing
                const wingTarget = bird.vy < -1 ? -0.65 : bird.vy > 2 ? 0.5 : 0;
                bird.wingPhase += (wingTarget - bird.wingPhase) * 0.32 * dt;

                // Blink
                bird.blinkTimer -= dt * 0.05;
                if (bird.blinkTimer <= 0) bird.blinkTimer = Math.random() * 3.5 + 2.5;

                // Move pipes
                const speed = PIPE_SPEED * dt;
                pipes.forEach(p => (p.x -= speed));

                // Remove off-screen
                while (pipes.length && pipes[0].x + pipes[0].width < -60) pipes.shift();

                // Spawn
                const last = pipes[pipes.length - 1];
                if (!last || last.x < W - SPAWN_INTERVAL) {
                    spawnPipe(last ? last.x + SPAWN_INTERVAL : W + 120);
                }

                // Score
                pipes.forEach(p => {
                    if (!p.passed && p.x + p.width / 2 < bird.x) {
                        p.passed = true;
                        score++;
                        scoreDisplay.textContent = score;
                        scoreDisplay.classList.add('pulse');
                        setTimeout(() => scoreDisplay.classList.remove('pulse'), 150);
                        emitParticles(bird.x + BIRD_R, bird.y, 7, '#ffd700', 3, 0.35);
                    }
                });

                // Ground scroll
                groundOffset -= speed;
                if (groundOffset < -W) groundOffset += W;

                // Collisions
                if (checkCollisions()) endGame();
                break;

            case STATE.OVER:
                const gy = H - GROUND_H;
                if (bird.y + BIRD_R < gy) {
                    bird.vy += GRAVITY * dt;
                    if (bird.vy > MAX_FALL) bird.vy = MAX_FALL;
                    bird.y += bird.vy * dt;
                    bird.angle = Math.min(82, bird.angle + 2.8 * dt);
                } else {
                    bird.y = gy - BIRD_R;
                    bird.vy = 0;
                    bird.angle = 78;
                }
                bird.wingPhase = 0.5;
                groundOffset -= PIPE_SPEED * 0.25 * dt;
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

        // Pipes
        pipes.forEach(p => {
            if (p.x + p.width > -30 && p.x < W + 30) drawPipe(p);
        });

        drawGround();
        drawParticles();
        drawBird();

        ctx.restore();

        // Flash
        if (flashAlpha > 0) {
            ctx.fillStyle = `rgba(255,255,255,${flashAlpha})`;
            ctx.fillRect(0, 0, W, H);
        }

        // UI
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

    // ──────────────────────────────────────
    // Init
    // ──────────────────────────────────────
    function init() {
        resize();
        updateDimensions();
        resetBird();
        resetPipes();
        generateClouds();
        particles = [];
        score = 0;
        gameMode = STATE.PRE;
        groundOffset = 0;
        shakeMag = 0;
        flashAlpha = 0;
        timeOver = null;
        scoreDisplay.textContent = '0';
        bestDisplay.textContent = '🏆 ' + bestScore;
    }

    init();
    requestAnimationFrame(gameLoop);

    console.log('🐦 Flappy Bird • Modern Edition ready');
    console.log('   Screen:', Math.round(W) + '×' + Math.round(H), '@' + DPR + 'x');
})();
