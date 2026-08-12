(function () {
    'use strict';

    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    const scoreDisplay = document.getElementById('scoreDisplay');
    const bestDisplay = document.getElementById('bestDisplay');

    // ──────────────────────────────────
    // Responsive canvas
    // ──────────────────────────────────
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
        bird.x = (bird.x / prevW) * W;
        bird.y = Math.min(bird.y, H - GROUND_H - BIRD_R);
        pipes.forEach(p => {
            p.x = (p.x / prevW) * W;
            p.width = PIPE_W;
            p.capH = PIPE_CAP_H;
        });
        updateDimensions();
        generateCity();
    });
    window.addEventListener('orientationchange', () => setTimeout(resize, 300));

    // ──────────────────────────────────
    // Dynamic dimensions
    // ──────────────────────────────────
    let BIRD_R, PIPE_W, PIPE_GAP, GROUND_H, PIPE_CAP_H;
    let PIPE_SPEED, GRAVITY, JUMP_VEL, MAX_FALL, SPAWN_INTERVAL;

    function updateDimensions() {
        BIRD_R = Math.max(14, Math.min(28, H * 0.044));
        PIPE_W = Math.max(42, Math.min(76, W * 0.1));
        PIPE_GAP = Math.max(108, Math.min(195, H * 0.26));
        GROUND_H = Math.max(50, Math.min(95, H * 0.12));
        PIPE_CAP_H = Math.max(20, Math.min(34, H * 0.042));
        PIPE_SPEED = Math.max(1.8, Math.min(4.2, W * 0.0046));
        GRAVITY = Math.max(0.3, Math.min(0.68, H * 0.00085));
        JUMP_VEL = Math.max(-6.5, Math.min(-3.8, -H * 0.009));
        MAX_FALL = Math.max(6, Math.min(12, H * 0.016));
        SPAWN_INTERVAL = Math.max(190, Math.min(360, W * 0.44));
    }
    updateDimensions();

    // ──────────────────────────────────
    // Game state
    // ──────────────────────────────────
    const STATE = { PRE: 'prestart', RUN: 'running', OVER: 'over' };
    let gameMode = STATE.PRE;
    let score = 0;
    let bestScore = 0;
    let pipes = [];
    let particles = [];
    let groundOffset = 0;
    let shakeMag = 0;
    let flashAlpha = 0;
    let timeOver = null;
    let frameCount = 0;

    try {
        bestScore = parseInt(localStorage.getItem('flappyCyberBest') || '0');
    } catch (e) { bestScore = 0; }
    bestDisplay.textContent = '🏆 ' + bestScore;

    // ──────────────────────────────────
    // Bird
    // ──────────────────────────────────
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
        bird.y = H * 0.45;
        bird.vy = 0;
        bird.angle = 0;
        bird.wingPhase = 0;
        bird.blinkTimer = Math.random() * 3 + 2;
    }

    // ──────────────────────────────────
    // Pipes
    // ──────────────────────────────────
    function spawnPipe(x) {
        const groundY = H - GROUND_H;
        const minTop = PIPE_CAP_H + 30;
        const maxTop = groundY - PIPE_GAP - PIPE_CAP_H - 30;
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
        const startX = W + 120;
        for (let i = 0; i < 5; i++) spawnPipe(startX + i * SPAWN_INTERVAL);
    }

    // ──────────────────────────────────
    // Cyberpunk City Background
    // ──────────────────────────────────
    let cityBuildings = [];
    let cityScrollOffset = 0;
    const CITY_SCROLL_SPEED_FACTOR = 0.22;

    function generateCity() {
        cityBuildings = [];
        const count = Math.floor(W / 55) + 10;
        for (let i = 0; i < count; i++) {
            const w = 40 + Math.random() * 80;
            const h = H * 0.35 + Math.random() * H * 0.45;
            const x = i * (W / count) + (Math.random() - 0.5) * 30;
            const windowRows = Math.floor(h / 25);
            const windowCols = Math.floor(w / 16);
            const windows = [];
            for (let r = 0; r < windowRows; r++) {
                for (let c = 0; c < windowCols; c++) {
                    if (Math.random() > 0.3) {
                        windows.push({
                            rx: c * 16 + 6,
                            ry: r * 25 + 12,
                            w: 8,
                            h: 10,
                            lit: Math.random() > 0.4,
                            color: ['#00ffff', '#ff00ff', '#ffff00', '#39ff14', '#ff6600'][Math.floor(Math.random() * 5)]
                        });
                    }
                }
            }
            cityBuildings.push({
                x,
                y: H - GROUND_H - h,
                w,
                h,
                windows,
                neonLines: Math.random() > 0.6,
                signText: null,
                signTimer: 0,
            });
        }
        cityBuildings.sort((a, b) => a.x - b.x);
    }
    generateCity();

    // ──────────────────────────────────
    // Particles
    // ──────────────────────────────────
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

    // ──────────────────────────────────
    // Collision
    // ──────────────────────────────────
    function rectCircleCollision(rx, ry, rw, rh, cx, cy, cr) {
        const closestX = Math.max(rx, Math.min(cx, rx + rw));
        const closestY = Math.max(ry, Math.min(cy, ry + rh));
        const dx = cx - closestX;
        const dy = cy - closestY;
        return (dx * dx + dy * dy) < (cr * cr);
    }

    function checkCollisions() {
        const groundY = H - GROUND_H;
        if (bird.y + BIRD_R >= groundY || bird.y - BIRD_R <= 0) return true;
        for (const p of pipes) {
            if (rectCircleCollision(p.x, 0, p.width, p.topH, bird.x, bird.y, BIRD_R * 0.85) ||
                rectCircleCollision(p.x, p.bottomY, p.width, groundY - p.bottomY, bird.x, bird.y, BIRD_R * 0.85))
                return true;
        }
        return false;
    }

    // ──────────────────────────────────
    // Game flow
    // ──────────────────────────────────
    function startGame() {
        resetBird();
        resetPipes();
        score = 0;
        particles = [];
        groundOffset = 0;
        cityScrollOffset = 0;
        shakeMag = 0;
        flashAlpha = 0;
        timeOver = null;
        gameMode = STATE.RUN;
        scoreDisplay.textContent = '0';
        scoreDisplay.classList.remove('pulse');
        bird.vy = JUMP_VEL;
        emitParticles(bird.x, bird.y + BIRD_R * 0.6, 12, '#ffffff', 5, 0.5);
    }

    function endGame() {
        if (gameMode !== STATE.RUN) return;
        gameMode = STATE.OVER;
        timeOver = Date.now();
        shakeMag = 18;
        flashAlpha = 0.7;
        if (score > bestScore) {
            bestScore = score;
            try { localStorage.setItem('flappyCyberBest', bestScore); } catch (e) {}
            bestDisplay.textContent = '🏆 ' + bestScore;
        }
        emitParticles(bird.x, bird.y, 28, '#ffd700', 6, 0.8);
        emitParticles(bird.x, bird.y, 20, '#ff00ff', 5, 0.6);
        emitParticles(bird.x, bird.y, 16, '#00ffff', 4, 0.5);
    }

    // ──────────────────────────────────
    // Input
    // ──────────────────────────────────
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
                if (timeOver && Date.now() - timeOver > 500) startGame();
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

    // ──────────────────────────────────
    // Drawing helpers
    // ──────────────────────────────────
    function drawSky() {
        const grad = ctx.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, '#050a14');
        grad.addColorStop(0.2, '#0a1226');
        grad.addColorStop(0.45, '#162040');
        grad.addColorStop(0.7, '#1a2d4a');
        grad.addColorStop(1, '#1e3858');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);

        for (let i = 0; i < 60; i++) {
            const sx = (i * 147 + 30) % W;
            const sy = (i * 89 + 15) % (H * 0.5);
            const twinkle = 0.25 + Math.sin(frameCount * 0.03 + i) * 0.35;
            ctx.fillStyle = `rgba(255,255,255,${twinkle})`;
            ctx.beginPath();
            ctx.arc(sx, sy, 1 + Math.random() * 1.2, 0, Math.PI * 2);
            ctx.fill();
        }
        const hazeGrad = ctx.createRadialGradient(W * 0.7, H * 0.6, H * 0.1, W * 0.5, H * 0.65, H * 0.8);
        hazeGrad.addColorStop(0, 'rgba(0,255,255,0.05)');
        hazeGrad.addColorStop(0.4, 'rgba(255,0,255,0.03)');
        hazeGrad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = hazeGrad;
        ctx.fillRect(0, 0, W, H);
    }

    function drawCity() {
        ctx.save();
        const scrollSpeed = PIPE_SPEED * CITY_SCROLL_SPEED_FACTOR;
        const offset = cityScrollOffset % (W * 1.5);
        const groundY = H - GROUND_H;

        cityBuildings.forEach(b => {
            let drawX = b.x - offset;
            if (drawX > W + 100) drawX -= W * 1.5;
            if (drawX < -200) drawX += W * 1.5;
            if (drawX + b.w < -20 || drawX > W + 20) return;

            const bodyGrad = ctx.createLinearGradient(drawX, b.y, drawX, b.y + b.h);
            bodyGrad.addColorStop(0, '#111833');
            bodyGrad.addColorStop(0.3, '#1b2640');
            bodyGrad.addColorStop(0.8, '#0c1020');
            bodyGrad.addColorStop(1, '#060912');
            ctx.fillStyle = bodyGrad;
            ctx.fillRect(drawX, b.y, b.w, b.h);

            if (b.neonLines) {
                ctx.strokeStyle = '#00ffff';
                ctx.lineWidth = 1.5;
                ctx.shadowColor = '#00ffff';
                ctx.shadowBlur = 8;
                ctx.beginPath();
                ctx.moveTo(drawX, b.y);
                ctx.lineTo(drawX + b.w, b.y);
                ctx.stroke();
                ctx.shadowColor = 'transparent';
                ctx.shadowBlur = 0;
            }

            b.windows.forEach(win => {
                const wx = drawX + win.rx;
                const wy = b.y + win.ry;
                if (win.lit) {
                    ctx.fillStyle = win.color;
                    ctx.shadowColor = win.color;
                    ctx.shadowBlur = 7;
                    ctx.fillRect(wx, wy, win.w, win.h);
                    ctx.shadowColor = 'transparent';
                    ctx.shadowBlur = 0;
                } else {
                    ctx.fillStyle = 'rgba(20,30,50,0.8)';
                    ctx.fillRect(wx, wy, win.w, win.h);
                }
            });

            if (score >= 3 && b.signText === null && b.w > 60 && b.h > H * 0.4) {
                if (Math.random() < 0.03) {
                    b.signText = 'ABDULLAH BIN FAHAD';
                    b.signTimer = performance.now();
                }
            }
            if (b.signText) {
                const elapsed = (performance.now() - b.signTimer) / 1000;
                const alpha = Math.min(1, elapsed * 0.5);
                const fontSize = Math.max(10, Math.min(18, b.w * 0.13));
                ctx.save();
                ctx.font = `bold ${fontSize}px 'Orbitron', sans-serif`;
                ctx.textAlign = 'center';
                ctx.fillStyle = `rgba(255,0,255,${alpha})`;
                ctx.shadowColor = '#ff00ff';
                ctx.shadowBlur = 12;
                ctx.fillText(b.signText, drawX + b.w / 2, b.y + 30);
                ctx.restore();
            }
        });
        ctx.restore();
    }

    function drawGround() {
        const gy = H - GROUND_H;
        const gGrad = ctx.createLinearGradient(0, gy, 0, H);
        gGrad.addColorStop(0, '#111a2c');
        gGrad.addColorStop(0.15, '#0d1320');
        gGrad.addColorStop(0.5, '#070b14');
        gGrad.addColorStop(1, '#020408');
        ctx.fillStyle = gGrad;
        ctx.fillRect(0, gy, W, GROUND_H);

        ctx.strokeStyle = 'rgba(0,255,255,0.08)';
        ctx.lineWidth = 1;
        const spacing = 40;
        const offX = groundOffset % spacing;
        for (let x = -offX; x < W + spacing; x += spacing) {
            ctx.beginPath();
            ctx.moveTo(x, gy);
            ctx.lineTo(x, H);
            ctx.stroke();
        }
        for (let y = gy; y < H; y += spacing) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(W, y);
            ctx.stroke();
        }

        ctx.strokeStyle = 'rgba(0,255,255,0.4)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(W, gy);
        ctx.stroke();
    }

    function drawPipe(pipe) {
        const gy = H - GROUND_H;
        drawPipeSegment(pipe.x, 0, pipe.width, pipe.topH, pipe.capH, false);
        drawPipeSegment(pipe.x, pipe.bottomY, pipe.width, gy - pipe.bottomY, pipe.capH, true);
    }

    function drawPipeSegment(x, y, w, h, capH, isBottom) {
        const capY = isBottom ? y : y + h - capH;
        const bodyTop = isBottom ? y + capH : y;
        const bodyH = h - capH;
        const overhang = w * 0.16;

        const bodyGrad = ctx.createLinearGradient(x, 0, x + w, 0);
        bodyGrad.addColorStop(0, '#1a5c1a');
        bodyGrad.addColorStop(0.3, '#2d8a2d');
        bodyGrad.addColorStop(0.5, '#4ab84e');
        bodyGrad.addColorStop(0.7, '#2d8a2d');
        bodyGrad.addColorStop(1, '#1a5c1a');
        ctx.fillStyle = bodyGrad;
        ctx.fillRect(x, bodyTop, w, bodyH);

        ctx.fillStyle = 'rgba(0,255,255,0.15)';
        ctx.fillRect(x, bodyTop, w, bodyH);
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 1;
        ctx.shadowColor = '#00ffff';
        ctx.shadowBlur = 5;
        ctx.beginPath();
        ctx.moveTo(x, bodyTop);
        ctx.lineTo(x + w, bodyTop);
        ctx.stroke();
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;

        const capGrad = ctx.createLinearGradient(x - overhang, 0, x + w + overhang, 0);
        capGrad.addColorStop(0, '#1a5c1a');
        capGrad.addColorStop(0.3, '#3da83d');
        capGrad.addColorStop(0.5, '#5dc95d');
        capGrad.addColorStop(0.7, '#3da83d');
        capGrad.addColorStop(1, '#1a5c1a');
        ctx.fillStyle = capGrad;
        ctx.fillRect(x - overhang, capY, w + overhang * 2, capH);
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(x - overhang, capY + capH - 2, w + overhang * 2, 2);
    }

    function drawBird() {
        ctx.save();
        ctx.translate(bird.x, bird.y);
        ctx.rotate((bird.angle * Math.PI) / 180);
        const r = BIRD_R;

        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.arc(2, 3, r, 0, Math.PI * 2);
        ctx.fill();

        const bodyGrad = ctx.createRadialGradient(-r * 0.2, -r * 0.3, r * 0.08, 0, 0, r);
        bodyGrad.addColorStop(0, '#ffe566');
        bodyGrad.addColorStop(0.45, '#ffd700');
        bodyGrad.addColorStop(0.8, '#f0b800');
        bodyGrad.addColorStop(1, '#d4940a');
        ctx.fillStyle = bodyGrad;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();
        const hlGrad = ctx.createRadialGradient(-r * 0.25, -r * 0.35, r * 0.04, 0, 0, r);
        hlGrad.addColorStop(0, 'rgba(255,255,255,0.5)');
        hlGrad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = hlGrad;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();

        ctx.save();
        ctx.translate(r * 0.12, -r * 0.18);
        ctx.rotate(bird.wingPhase);
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

        const ex = r * 0.38, ey = -r * 0.28, er = r * 0.3;
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(ex, ey, er, 0, Math.PI * 2);
        ctx.fill();
        const pr = er * 0.52;
        ctx.fillStyle = '#111';
        ctx.beginPath();
        ctx.arc(ex + er * 0.18, ey, pr, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(ex + er * 0.04, ey - pr * 0.32, pr * 0.32, 0, Math.PI * 2);
        ctx.fill();

        const chx = ex + er + r * 0.12, chy = ey + r * 0.28, chr = r * 0.18;
        const chGrad = ctx.createRadialGradient(chx, chy, chr * 0.08, chx, chy, chr);
        chGrad.addColorStop(0, 'rgba(255,140,140,0.55)');
        chGrad.addColorStop(1, 'rgba(255,140,140,0)');
        ctx.fillStyle = chGrad;
        ctx.beginPath();
        ctx.arc(chx, chy, chr, 0, Math.PI * 2);
        ctx.fill();

        const bx = r * 0.82, by = -r * 0.04;
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
            ctx.globalAlpha = alpha;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r * (0.5 + alpha * 0.5), 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.globalAlpha = 1;
    }

    function drawOverlay() {
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(0, 0, W, H);
        const pw = Math.min(340, W * 0.8), ph = Math.min(260, H * 0.4);
        const px = W / 2 - pw / 2, py = H / 2 - ph / 2 - H * 0.03;
        ctx.fillStyle = 'rgba(5,10,20,0.9)';
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 2;
        ctx.shadowColor = '#00ffff';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        roundRect(px, py, pw, ph, 18);
        ctx.fill();
        ctx.stroke();
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;

        const goSize = Math.max(28, Math.min(48, H * 0.06));
        ctx.font = `bold ${goSize}px 'Orbitron', sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ff00ff';
        ctx.shadowColor = '#ff00ff';
        ctx.shadowBlur = 12;
        ctx.fillText('GAME OVER', W / 2, py + ph * 0.32);
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;

        const scSize = Math.max(20, Math.min(36, H * 0.045));
        ctx.font = `bold ${scSize}px 'Orbitron', sans-serif`;
        ctx.fillStyle = '#ffffff';
        ctx.fillText('Score: ' + score, W / 2, py + ph * 0.56);
        const bsSize = Math.max(13, Math.min(20, H * 0.026));
        ctx.font = `${bsSize}px 'Orbitron', sans-serif`;
        ctx.fillStyle = '#ffff00';
        ctx.fillText('Best: ' + bestScore, W / 2, py + ph * 0.72);
        if (score >= bestScore && score > 0) {
            ctx.fillStyle = '#00ffff';
            ctx.fillText('★ NEW BEST ★', W / 2, py + ph * 0.88);
        }
        const hintSize = Math.max(12, Math.min(17, H * 0.022));
        ctx.font = `${hintSize}px 'Orbitron', sans-serif`;
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fillText('TAP TO RESTART', W / 2, py + ph + hintSize * 2.8);
    }

    function drawStartScreen() {
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(0, 0, W, H);
        const titleSize = Math.max(38, Math.min(68, H * 0.08));
        ctx.font = `bold ${titleSize}px 'Orbitron', sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillStyle = '#000';
        ctx.fillText('FLAPPY BIRD', W / 2 + 3, H * 0.28 + 3);
        const tGrad = ctx.createLinearGradient(0, H * 0.2, 0, H * 0.35);
        tGrad.addColorStop(0, '#00ffff');
        tGrad.addColorStop(0.5, '#ff00ff');
        tGrad.addColorStop(1, '#ffff00');
        ctx.fillStyle = tGrad;
        ctx.fillText('FLAPPY BIRD', W / 2, H * 0.28);

        const instrSize = Math.max(15, Math.min(24, H * 0.03));
        ctx.font = `600 ${instrSize}px 'Orbitron', sans-serif`;
        ctx.fillStyle = '#fff';
        ctx.fillText('TAP / CLICK / SPACE', W / 2, H * 0.47);
        if (bestScore > 0) {
            const bSize = Math.max(13, Math.min(20, H * 0.026));
            ctx.font = `${bSize}px 'Orbitron', sans-serif`;
            ctx.fillStyle = '#ffff00';
            ctx.fillText('BEST: ' + bestScore, W / 2, H * 0.55);
        }
        const pulse = 0.4 + Math.sin(Date.now() / 500) * 0.4;
        ctx.strokeStyle = `rgba(0,255,255,${pulse})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(W / 2, H * 0.64, 28, 0, Math.PI * 2);
        ctx.stroke();
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

    // ──────────────────────────────────
    // Update & Render Loop
    // ──────────────────────────────────
    let lastTime = performance.now();

    function update(dt) {
        frameCount++;
        cityScrollOffset += PIPE_SPEED * CITY_SCROLL_SPEED_FACTOR * dt;

        updateParticles(dt);
        if (shakeMag > 0) { shakeMag *= 0.84; if (shakeMag < 0.25) shakeMag = 0; }
        if (flashAlpha > 0) { flashAlpha *= 0.87; if (flashAlpha < 0.008) flashAlpha = 0; }

        switch (gameMode) {
            case STATE.PRE:
                bird.y = H * 0.45 + Math.sin(Date.now() / 700) * 7;
                bird.wingPhase = Math.sin(Date.now() / 300) * 0.3;
                bird.angle = Math.sin(Date.now() / 600) * 2.5;
                groundOffset -= PIPE_SPEED * 0.45 * dt;
                if (groundOffset < -W) groundOffset += W;
                break;
            case STATE.RUN:
                bird.vy += GRAVITY * dt;
                if (bird.vy > MAX_FALL) bird.vy = MAX_FALL;
                bird.y += bird.vy * dt;
                const target = bird.vy < 0 ? -20 : Math.min(72, bird.vy * 7.5);
                bird.angle += (target - bird.angle) * 0.16 * dt;
                const wingTarget = bird.vy < -1 ? -0.65 : bird.vy > 2 ? 0.5 : 0;
                bird.wingPhase += (wingTarget - bird.wingPhase) * 0.32 * dt;
                bird.blinkTimer -= dt * 0.05;
                if (bird.blinkTimer <= 0) bird.blinkTimer = Math.random() * 3.5 + 2.5;

                const speed = PIPE_SPEED * dt;
                pipes.forEach(p => p.x -= speed);
                while (pipes.length && pipes[0].x + pipes[0].width < -60) pipes.shift();
                const last = pipes[pipes.length - 1];
                if (!last || last.x < W - SPAWN_INTERVAL) spawnPipe(last ? last.x + SPAWN_INTERVAL : W + 120);

                pipes.forEach(p => {
                    if (!p.passed && p.x + p.width / 2 < bird.x) {
                        p.passed = true;
                        score++;
                        scoreDisplay.textContent = score;
                        scoreDisplay.classList.add('pulse');
                        setTimeout(() => scoreDisplay.classList.remove('pulse'), 150);
                        emitParticles(bird.x + BIRD_R, bird.y, 7, '#00ffff', 3, 0.35);
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
        let sx = 0, sy = 0;
        if (shakeMag > 0) { sx = (Math.random() - 0.5) * shakeMag * 2; sy = (Math.random() - 0.5) * shakeMag * 2; }
        ctx.save();
        ctx.translate(sx, sy);
        drawSky();
        drawCity();
        pipes.forEach(p => { if (p.x + p.width > -30 && p.x < W + 30) drawPipe(p); });
        drawGround();
        drawParticles();
        drawBird();
        ctx.restore();
        if (flashAlpha > 0) { ctx.fillStyle = `rgba(255,255,255,${flashAlpha})`; ctx.fillRect(0, 0, W, H); }
        if (gameMode === STATE.PRE) drawStartScreen();
        if (gameMode === STATE.OVER) drawOverlay();
    }

    function gameLoop(ts) {
        let dt = (ts - lastTime) / 16.667;
        if (dt <= 0) dt = 0.016;
        if (dt > 3.5) dt = 3.5;
        lastTime = ts;
        update(dt);
        render();
        requestAnimationFrame(gameLoop);
    }

    function init() {
        resize();
        updateDimensions();
        resetBird();
        resetPipes();
        generateCity();
        particles = [];
        score = 0;
        gameMode = STATE.PRE;
        groundOffset = 0;
        cityScrollOffset = 0;
        shakeMag = 0;
        flashAlpha = 0;
        timeOver = null;
        scoreDisplay.textContent = '0';
        bestDisplay.textContent = '🏆 ' + bestScore;
    }

    init();
    requestAnimationFrame(gameLoop);
    console.log('🐦 Flappy Bird • Cyberpunk City Edition');
    console.log('   Look for ABDULLAH BIN FAHAD on buildings after score 3!');
})();
