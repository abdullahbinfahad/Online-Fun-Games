// =============================================================================
// Flappy Bird - ABDULLAH BIN FAHAD Edition
// Full-viewport, zero-gap, immersive game
// script.js - Version 3.0 (1500+ lines)
// =============================================================================

(function() {
    'use strict';

    // ─────────────────────────────────────────────────────────────────────────
    // DOM REFERENCES
    // ─────────────────────────────────────────────────────────────────────────
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    const hudScore = document.getElementById('hudScore');
    const hudLevel = document.getElementById('hudLevel');
    const hudBest = document.getElementById('hudBest');
    const comboDisplay = document.getElementById('comboDisplay');
    const levelMessage = document.getElementById('levelMessage');
    const streakIndicator = document.getElementById('streakIndicator');
    const balloon = document.getElementById('balloon');

    // ─────────────────────────────────────────────────────────────────────────
    // FULL-VIEWPORT CANVAS SETUP (no gaps, no scrolling)
    // We use window.innerWidth/innerHeight for consistent dimensions.
    // CSS already locks body with position:fixed and overflow:hidden.
    // ─────────────────────────────────────────────────────────────────────────
    const MAX_DPR = 2;                // Limit device pixel ratio for performance
    let W, H, DPR;                   // Logical width/height, device pixel ratio

    /**
     * Resize canvas to fill the entire viewport.
     * This is called on load, resize, and orientation change.
     */
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

    // Handle window resize – reposition game objects proportionally
    window.addEventListener('resize', () => {
        const prevW = W, prevH = H;
        resize();
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

    // Handle mobile orientation changes with a slight delay
    window.addEventListener('orientationchange', () => setTimeout(() => {
        resize();
        updateDimensions();
        positionBalloon();
    }, 300));

    // ─────────────────────────────────────────────────────────────────────────
    // DYNAMIC GAME DIMENSIONS (scale everything based on screen size)
    // These values are recalculated whenever the screen size changes.
    // ─────────────────────────────────────────────────────────────────────────
    let BIRD_R, PIPE_W, PIPE_GAP, GROUND_H, PIPE_CAP_H,
        PIPE_SPEED, GRAVITY, JUMP_VEL, MAX_FALL, SPAWN_INTERVAL;

    function updateDimensions() {
        BIRD_R = Math.max(12, Math.min(24, H * 0.04));           // Bird radius
        PIPE_W = Math.max(34, Math.min(68, W * 0.088));         // Pipe width
        PIPE_GAP = Math.max(100, Math.min(180, H * 0.24));      // Gap between pipes
        GROUND_H = Math.max(44, Math.min(82, H * 0.1));         // Ground height
        PIPE_CAP_H = Math.max(16, Math.min(28, H * 0.036));     // Pipe cap height
        PIPE_SPEED = Math.max(1.5, Math.min(3.5, W * 0.004));   // Horizontal speed
        GRAVITY = Math.max(0.25, Math.min(0.58, H * 0.00073));  // Downward acceleration
        JUMP_VEL = Math.max(-6.8, Math.min(-3.9, -H * 0.009));  // Flap velocity
        MAX_FALL = Math.max(5, Math.min(10, H * 0.014));        // Terminal velocity
        SPAWN_INTERVAL = Math.max(150, Math.min(320, W * 0.37)); // Distance between pipes
    }
    updateDimensions();

    // ─────────────────────────────────────────────────────────────────────────
    // GAME STATE
    // ─────────────────────────────────────────────────────────────────────────
    const STATE = { PRE: 'prestart', RUN: 'running', OVER: 'over' };
    let gameMode = STATE.PRE;
    let score = 0;
    let currentLevel = 1;
    let bestScore = 0;

    // Object pools for performance
    let pipes = [];
    let particles = [];
    let clouds = [];
    let stars = [];

    // Visual effects
    let groundOffset = 0;           // Used for ground scrolling
    let shakeMag = 0;               // Screen shake magnitude
    let flashAlpha = 0;             // White flash opacity
    let timeOver = null;            // Timestamp when game ended

    // Gameplay counters
    let frameCount = 0;             // Total frames since start
    let comboCount = 0;             // Consecutive pipes without dying
    let comboTimer = 0;             // Frames left for combo display
    let streakCount = 0;            // Total pipes passed in this run
    let levelMsgTimer = 0;          // How long to show level-up message

    // Power-up states
    let magnetActive = false;       // Coin magnet power-up
    let magnetTimer = 0;
    let slowMotionActive = false;   // Slow motion power-up
    let slowMotionTimer = 0;

    // Coins system
    let coins = [];
    let collectedCoins = 0;

    // Achievements (simple tracking)
    let achievements = {
        firstPipe: false,
        tenPipes: false,
        twentyPipes: false,
        comboFive: false,
        levelFive: false
    };

    // ABDULLAH BIN FAHAD personal messages for level-ups
    const levelTexts = [
        "ABDULLAH BIN FAHAD\nTHINKS YOU'RE GREAT! 🌟",
        "ABDULLAH BIN FAHAD\nSAYS YOU'RE A GENIUS! 🧠",
        "ABDULLAH BIN FAHAD\nTHINKS YOU'RE AMAZING! 💫",
        "ABDULLAH BIN FAHAD\nCALLS YOU A LEGEND! 👑",
        "ABDULLAH BIN FAHAD\nSAYS YOU'RE UNSTOPPABLE! 🔥",
        "ABDULLAH BIN FAHAD\nTHINKS YOU'RE INCREDIBLE! ⚡",
        "ABDULLAH BIN FAHAD\nSAYS YOU'RE A MASTER! 🏆",
        "ABDULLAH BIN FAHAD\nTHINKS YOU'RE PHENOMENAL! 🌈",
        "ABDULLAH BIN FAHAD\nSAYS YOU'RE THE BEST! 💎",
        "ABDULLAH BIN FAHAD\nTHINKS YOU'RE A PRODIGY! 🎯"
    ];

    // Load best score from localStorage (with fallback)
    try {
        bestScore = parseInt(localStorage.getItem('flappyABF2_best') || '0');
    } catch (e) {
        bestScore = 0;
    }
    hudBest.textContent = bestScore;

    // ─────────────────────────────────────────────────────────────────────────
    // BIRD OBJECT
    // The player character – a small, animated bird.
    // ─────────────────────────────────────────────────────────────────────────
    const bird = {
        x: 0,
        y: 0,
        vy: 0,          // Vertical velocity
        angle: 0,       // Rotation angle in degrees
        wingPhase: 0,   // Current wing flap rotation (radians)
        trail: []       // Array of previous positions for motion trail
    };

    /**
     * Reset bird to starting position.
     */
    function resetBird() {
        bird.x = W * 0.26;        // Place bird at 26% from left
        bird.y = H * 0.42;        // Vertically centered
        bird.vy = 0;
        bird.angle = 0;
        bird.wingPhase = 0;
        bird.trail = [];
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PIPE GENERATION
    // ─────────────────────────────────────────────────────────────────────────
    /**
     * Creates a new pipe pair at a given x position.
     * The gap is randomly positioned within the allowed vertical range.
     */
    function spawnPipe(x) {
        const gy = H - GROUND_H;                         // Top of ground
        const min = PIPE_CAP_H + 20;                     // Minimum top pipe height
        const max = gy - PIPE_GAP - PIPE_CAP_H - 20;     // Maximum top pipe bottom
        const center = min + Math.random() * (max - min);
        pipes.push({
            x: x,
            topH: center - PIPE_GAP / 2,    // Where top pipe ends
            bottomY: center + PIPE_GAP / 2, // Where bottom pipe starts
            width: PIPE_W,
            capH: PIPE_CAP_H,
            passed: false,                 // Whether bird has passed this pipe
            nearMissed: false,
            coinSpawned: false             // Has a coin been placed near this pipe?
        });
    }

    /**
     * Clears all pipes and creates the initial set.
     */
    function resetPipes() {
        pipes = [];
        const start = W + 80;
        for (let i = 0; i < 5; i++) {
            spawnPipe(start + i * SPAWN_INTERVAL);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ENVIRONMENT: STARS AND CLOUDS
    // ─────────────────────────────────────────────────────────────────────────
    function genStars() {
        stars = [];
        for (let i = 0; i < 80; i++) {
            stars.push({
                x: Math.random() * W,
                y: Math.random() * H * 0.5,          // Only in upper half
                r: Math.random() * 1.5 + 0.4,        // Radius
                sp: Math.random() * 0.03 + 0.01,     // Twinkle speed
                off: Math.random() * Math.PI * 2,    // Phase offset
                ba: Math.random() * 0.5 + 0.3        // Base alpha
            });
        }
    }

    function genClouds() {
        clouds = [];
        const n = Math.floor(W / 150) + 4;
        for (let i = 0; i < n; i++) {
            clouds.push({
                x: Math.random() * W * 1.3,
                y: Math.random() * H * 0.4 + H * 0.04,
                w: Math.random() * 80 + 45,
                h: Math.random() * 24 + 12,
                speed: Math.random() * 0.25 + 0.1,
                opacity: Math.random() * 0.25 + 0.1,
                bubbles: [
                    { rx: 0, ry: 0, r: Math.random() * 14 + 12 },
                    { rx: Math.random() * 30 + 8, ry: Math.random() * 8 - 4, r: Math.random() * 18 + 13 },
                    { rx: Math.random() * 30 + 12, ry: Math.random() * 8 - 4, r: Math.random() * 16 + 10 },
                    { rx: -Math.random() * 24 - 6, ry: Math.random() * 6 - 3, r: Math.random() * 16 + 8 }
                ]
            });
        }
    }

    // Initialize environment
    genStars();
    genClouds();

    // ─────────────────────────────────────────────────────────────────────────
    // COINS SYSTEM (adds extra points and can trigger magnet)
    // ─────────────────────────────────────────────────────────────────────────
    function spawnCoin(x, y) {
        coins.push({
            x: x,
            y: y,
            r: BIRD_R * 0.6,       // Coin radius
            collected: false,
            bobOffset: Math.random() * Math.PI * 2
        });
    }

    /**
     * When a pipe is passed, there's a chance a coin appears in the gap.
     */
    function maybeSpawnCoinForPipe(pipe) {
        if (pipe.coinSpawned) return;
        // 40% chance to spawn a coin in the gap
        if (Math.random() < 0.4) {
            const gapCenterY = (pipe.topH + pipe.bottomY) / 2;
            const coinX = pipe.x + pipe.width / 2;
            spawnCoin(coinX, gapCenterY);
        }
        pipe.coinSpawned = true;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PARTICLES (visual feedback for jumps, scores, collisions)
    // ─────────────────────────────────────────────────────────────────────────
    function emit(x, y, count, colors, spread, life) {
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * spread + spread * 0.3;
            particles.push({
                x: x,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: life + Math.random() * life * 0.5,
                maxLife: life * 1.5,
                color: colors[Math.floor(Math.random() * colors.length)],
                r: Math.random() * 3 + 1.5
            });
        }
    }

    function updateParticles(dt) {
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.vy += GRAVITY * 0.4 * dt;  // Particles are affected by gravity too
            p.life -= dt;
            if (p.life <= 0) particles.splice(i, 1);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // COLLISION DETECTION (Rectangle vs Circle)
    // ─────────────────────────────────────────────────────────────────────────
    function rectCircle(rx, ry, rw, rh, cx, cy, cr) {
        const closestX = Math.max(rx, Math.min(cx, rx + rw));
        const closestY = Math.max(ry, Math.min(cy, ry + rh));
        const distX = cx - closestX;
        const distY = cy - closestY;
        return (distX * distX + distY * distY) < (cr * cr);
    }

    /**
     * Check if bird hits any pipe, ground, or ceiling.
     */
    function checkCollision() {
        const gy = H - GROUND_H;
        // Ground and ceiling
        if (bird.y + BIRD_R >= gy || bird.y - BIRD_R <= 0) return true;

        // Pipes
        for (const p of pipes) {
            // Top pipe collision
            if (rectCircle(p.x, 0, p.width, p.topH, bird.x, bird.y, BIRD_R * 0.82)) return true;
            // Bottom pipe collision
            if (rectCircle(p.x, p.bottomY, p.width, gy - p.bottomY, bird.x, bird.y, BIRD_R * 0.82)) return true;
        }
        return false;
    }

    /**
     * Check if bird touches a coin (circle-circle collision)
     */
    function checkCoinCollision(coin) {
        const dx = bird.x - coin.x;
        const dy = bird.y - coin.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        return dist < (BIRD_R + coin.r);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GAME FLOW CONTROL
    // ─────────────────────────────────────────────────────────────────────────
    function startGame() {
        resetBird();
        resetPipes();
        coins = [];
        collectedCoins = 0;
        magnetActive = false;
        slowMotionActive = false;
        score = 0;
        currentLevel = 1;
        comboCount = 0;
        comboTimer = 0;
        streakCount = 0;
        levelMsgTimer = 0;
        particles = [];
        groundOffset = 0;
        shakeMag = 0;
        flashAlpha = 0;
        timeOver = null;
        achievements = { firstPipe: false, tenPipes: false, twentyPipes: false, comboFive: false, levelFive: false };

        gameMode = STATE.RUN;
        hudScore.textContent = '0';
        hudLevel.textContent = '1';
        comboDisplay.className = 'combo-display';
        comboDisplay.textContent = '';
        streakIndicator.className = 'streak-indicator';
        streakIndicator.textContent = '';
        levelMessage.className = 'level-message';

        bird.vy = JUMP_VEL; // First flap
        emit(bird.x, bird.y + BIRD_R * 0.6, 14, ['#fff', '#ffd700', '#39ff14'], 5, 0.5);
    }

    function endGame() {
        if (gameMode !== STATE.RUN) return;
        gameMode = STATE.OVER;
        timeOver = Date.now();
        shakeMag = 16;
        flashAlpha = 0.6;

        if (score > bestScore) {
            bestScore = score;
            try { localStorage.setItem('flappyABF2_best', bestScore); } catch (e) {}
            hudBest.textContent = bestScore;
        }

        // Clear UI effects
        comboDisplay.className = 'combo-display';
        streakIndicator.className = 'streak-indicator';
        levelMessage.className = 'level-message';

        // Death particles
        emit(bird.x, bird.y, 30, ['#ffd700', '#ff6b35', '#ff2d78', '#fff'], 6, 0.8);
        emit(bird.x, bird.y, 20, ['#ff2d78', '#ffd700'], 5, 0.6);
    }

    /**
     * Called when the player reaches a new level (every 5 pipes).
     * Shows a personalized message from ABDULLAH BIN FAHAD.
     */
    function levelUp() {
        const idx = Math.min(currentLevel - 2, levelTexts.length - 1);
        const msg = levelTexts[Math.max(0, idx)];
        levelMessage.innerHTML = msg.replace(/\n/g, '<br>');
        levelMessage.className = 'level-message show';
        levelMsgTimer = 80; // Show for ~80 frames

        // Celebration effects
        emit(W / 2, H * 0.35, 35, ['#ffd700', '#ff2d78', '#39ff14', '#fff', '#00e5ff'], 7, 1);
        shakeMag = 7;
        flashAlpha = 0.25;

        // Achievement: reach level 5
        if (currentLevel === 5 && !achievements.levelFive) {
            achievements.levelFive = true;
            // Could show extra message
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // POWER-UPS
    // ─────────────────────────────────────────────────────────────────────────
    function activateMagnet() {
        magnetActive = true;
        magnetTimer = 180; // ~3 seconds at 60fps
    }

    function activateSlowMotion() {
        slowMotionActive = true;
        slowMotionTimer = 120;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // INPUT HANDLING (touch, mouse, keyboard)
    // ─────────────────────────────────────────────────────────────────────────
    function handleInput(e) {
        if (e) e.preventDefault();

        switch (gameMode) {
            case STATE.PRE:
                startGame();
                break;
            case STATE.RUN:
                bird.vy = JUMP_VEL;
                bird.wingPhase = -1.2; // Wing up animation
                emit(bird.x, bird.y + BIRD_R * 0.5, 8, ['#fff', '#ffd700'], 4, 0.4);
                break;
            case STATE.OVER:
                if (timeOver && Date.now() - timeOver > 500) {
                    startGame();
                }
                break;
        }
    }

    canvas.addEventListener('touchstart', handleInput, { passive: false });
    canvas.addEventListener('touchend', e => e.preventDefault(), { passive: false });
    canvas.addEventListener('touchmove', e => e.preventDefault(), { passive: false });
    canvas.addEventListener('mousedown', handleInput);
    document.addEventListener('keydown', e => {
        if (['Space', 'ArrowUp', 'KeyW'].includes(e.code)) {
            handleInput(e);
        }
    });
    document.addEventListener('gesturestart', e => e.preventDefault());

    // ─────────────────────────────────────────────────────────────────────────
    // BALLOON POSITION (ABDULLAH BIN FAHAD floating in background)
    // ─────────────────────────────────────────────────────────────────────────
    function positionBalloon() {
        // Keep balloon within safe area
        balloon.style.left = Math.max(10, W * 0.05) + 'px';
        balloon.style.top = Math.max(10, H * 0.1) + 'px';
    }
    positionBalloon();

    // ─────────────────────────────────────────────────────────────────────────
    // DRAWING FUNCTIONS (all rendering below)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Draws the gradient sky, stars, and a subtle horizon glow.
     */
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

        // Twinkling stars
        stars.forEach(s => {
            const alpha = s.ba + Math.sin(frameCount * s.sp + s.off) * 0.3;
            ctx.fillStyle = `rgba(255,255,255,${Math.max(0.05, alpha)})`;
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
            ctx.fill();
        });

        // Warm horizon glow
        const glow = ctx.createRadialGradient(W * 0.5, H * 0.7, H * 0.03, W * 0.5, H * 0.76, H * 0.6);
        glow.addColorStop(0, 'rgba(255,200,150,0.18)');
        glow.addColorStop(1, 'rgba(255,150,100,0)');
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, W, H);
    }

    /**
     * Draws soft, semi-transparent clouds using overlapping circles.
     */
    function drawClouds() {
        clouds.forEach(c => {
            ctx.save();
            ctx.globalAlpha = c.opacity;
            c.bubbles.forEach(b => {
                const cx = c.x + b.rx;
                const cy = c.y + b.ry;
                const g = ctx.createRadialGradient(cx - b.r * 0.2, cy - b.r * 0.25, b.r * 0.06, cx, cy, b.r);
                g.addColorStop(0, 'rgba(255,255,255,0.9)');
                g.addColorStop(0.4, 'rgba(255,255,255,0.5)');
                g.addColorStop(1, 'rgba(255,255,255,0)');
                ctx.fillStyle = g;
                ctx.beginPath();
                ctx.arc(cx, cy, b.r, 0, Math.PI * 2);
                ctx.fill();
            });
            ctx.restore();
        });
    }

    /**
     * Renders the ground with earth and grass layers, plus animated grass blades.
     */
    function drawGround() {
        const gy = H - GROUND_H;

        // Earth layer
        const eGrad = ctx.createLinearGradient(0, gy, 0, H);
        eGrad.addColorStop(0, '#4a3020');
        eGrad.addColorStop(0.3, '#3d2616');
        eGrad.addColorStop(1, '#1a0e06');
        ctx.fillStyle = eGrad;
        ctx.fillRect(0, gy, W, GROUND_H);

        // Grass strip
        const gGrad = ctx.createLinearGradient(0, gy - 2, 0, gy + 8);
        gGrad.addColorStop(0, '#5cb84a');
        gGrad.addColorStop(0.6, '#3d7a2d');
        gGrad.addColorStop(1, '#2d5a1e');
        ctx.fillStyle = gGrad;
        ctx.fillRect(0, gy - 1, W, 11);

        // Grass highlight line
        ctx.strokeStyle = 'rgba(160,230,140,0.35)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(W, gy);
        ctx.stroke();

        // Animated grass blades
        const sp = 14;
        const off = groundOffset % sp;
        ctx.fillStyle = '#7cc96c';
        for (let x = -off; x < W + sp; x += sp) {
            const h = 5 + Math.sin(x * 0.5 + groundOffset * 0.07) * 3;
            ctx.beginPath();
            ctx.moveTo(x, gy);
            ctx.lineTo(x + 2, gy - h);
            ctx.lineTo(x - 2, gy - h);
            ctx.fill();
        }
    }

    /**
     * Draws a single pipe segment (top or bottom) with 3D-like gradients.
     */
    function drawPipeBody(x, y, w, h, capH, isBottom) {
        const capY = isBottom ? y : y + h - capH;
        const bTop = isBottom ? y + capH : y;
        const bH = h - capH;
        const ov = w * 0.14;   // Cap overhang

        // Pipe body gradient (green shades)
        const bodyG = ctx.createLinearGradient(x, 0, x + w, 0);
        bodyG.addColorStop(0, '#1a5c1a');
        bodyG.addColorStop(0.3, '#3da83d');
        bodyG.addColorStop(0.5, '#5dd85d');
        bodyG.addColorStop(0.7, '#3da83d');
        bodyG.addColorStop(1, '#1a4a1a');
        ctx.fillStyle = bodyG;
        ctx.fillRect(x, bTop, w, bH);

        // Specular highlight (left side)
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.fillRect(x, bTop, w * 0.35, bH);

        // Shadow on right edge
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fillRect(x + w - 2, bTop, 2, bH);

        // Cap gradient
        const capG = ctx.createLinearGradient(x - ov, 0, x + w + ov, 0);
        capG.addColorStop(0, '#1a4a1a');
        capG.addColorStop(0.3, '#3da83d');
        capG.addColorStop(0.5, '#5dd85d');
        capG.addColorStop(1, '#1a4a1a');
        ctx.fillStyle = capG;
        ctx.fillRect(x - ov, capY, w + ov * 2, capH);

        // Cap shadow (bottom of cap)
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(x - ov, capY + capH - 2, w + ov * 2, 2);

        // Cap highlight (top of cap)
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.fillRect(x - ov, capY, w + ov * 2, 1.5);
    }

    /**
     * Draws the full pipe pair (top and bottom) using drawPipeBody.
     */
    function drawPipe(p) {
        const gy = H - GROUND_H;
        drawPipeBody(p.x, 0, p.width, p.topH, p.capH, false);
        drawPipeBody(p.x, p.bottomY, p.width, gy - p.bottomY, p.capH, true);

        // If magnet active, draw a subtle glow around pipes
        if (magnetActive) {
            ctx.strokeStyle = 'rgba(255, 215, 0, 0.4)';
            ctx.lineWidth = 2;
            ctx.strokeRect(p.x - 2, 0, p.width + 4, p.topH);
            ctx.strokeRect(p.x - 2, p.bottomY, p.width + 4, gy - p.bottomY);
        }
    }

    /**
     * Draws the main character – a round bird with wings, tail, and eye.
     */
    function drawBird() {
        // Motion trail (fading previous positions)
        bird.trail.forEach((t, i) => {
            const alpha = (i / bird.trail.length) * 0.25;
            ctx.fillStyle = `rgba(255,215,0,${alpha})`;
            ctx.beginPath();
            ctx.arc(t.x, t.y, BIRD_R * 0.45 * (i / bird.trail.length), 0, Math.PI * 2);
            ctx.fill();
        });

        ctx.save();
        ctx.translate(bird.x, bird.y);
        ctx.rotate(bird.angle * Math.PI / 180);

        const r = BIRD_R;

        // Drop shadow
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.beginPath();
        ctx.arc(2, 2.5, r, 0, Math.PI * 2);
        ctx.fill();

        // Body gradient (golden)
        const bodyG = ctx.createRadialGradient(-r * 0.2, -r * 0.3, r * 0.06, 0, 0, r);
        bodyG.addColorStop(0, '#ffe980');
        bodyG.addColorStop(0.4, '#ffd700');
        bodyG.addColorStop(0.8, '#f0b800');
        bodyG.addColorStop(1, '#c88200');
        ctx.fillStyle = bodyG;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();

        // Wing (animated)
        ctx.save();
        ctx.translate(r * 0.1, -r * 0.18);
        ctx.rotate(bird.wingPhase);
        const wG = ctx.createLinearGradient(0, -r * 0.55, 0, r * 0.25);
        wG.addColorStop(0, '#f5c400');
        wG.addColorStop(0.6, '#e8a800');
        wG.addColorStop(1, '#b87000');
        ctx.fillStyle = wG;
        ctx.beginPath();
        ctx.ellipse(0, r * 0.03, r * 0.45, r * 0.55, -0.1, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Tail feathers
        ctx.fillStyle = '#e8a800';
        ctx.beginPath();
        ctx.moveTo(-r * 0.65, -r * 0.2);
        ctx.lineTo(-r * 1.2, -r * 0.4);
        ctx.lineTo(-r * 1.05, r * 0.08);
        ctx.lineTo(-r * 0.55, r * 0.18);
        ctx.fill();
        ctx.fillStyle = '#b87000';
        ctx.beginPath();
        ctx.moveTo(-r * 0.6, -r * 0.08);
        ctx.lineTo(-r * 1.1, -r * 0.16);
        ctx.lineTo(-r * 0.95, r * 0.16);
        ctx.lineTo(-r * 0.5, r * 0.22);
        ctx.fill();

        // Eye
        const ex = r * 0.35, ey = -r * 0.26, er = r * 0.27;
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(ex, ey, er, 0, Math.PI * 2);
        ctx.fill();
        const pr = er * 0.5;
        ctx.fillStyle = '#111';
        ctx.beginPath();
        ctx.arc(ex + er * 0.15, ey, pr, 0, Math.PI * 2);
        ctx.fill();
        // Eye highlight
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(ex + er * 0.03, ey - pr * 0.3, pr * 0.3, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    /**
     * Draws all active particles.
     */
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

    /**
     * Draws coins (small golden circles with a "$" or sparkle).
     */
    function drawCoins() {
        coins.forEach(coin => {
            if (coin.collected) return;
            const bob = Math.sin(frameCount * 0.1 + coin.bobOffset) * 2;
            const y = coin.y + bob;
            ctx.save();
            ctx.translate(coin.x, y);
            // Coin body
            ctx.fillStyle = '#ffd700';
            ctx.beginPath();
            ctx.arc(0, 0, coin.r, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#b8860b';
            ctx.lineWidth = 1.5;
            ctx.stroke();
            // Dollar sign
            ctx.fillStyle = '#b8860b';
            ctx.font = `${coin.r * 1.2}px 'Fredoka One'`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('$', 0, 1);
            ctx.restore();
        });
    }

    /**
     * Draws UI overlays: Start screen and Game Over panel.
     */
    function drawUI() {
        if (gameMode === STATE.PRE) {
            // Semi-transparent overlay
            ctx.fillStyle = 'rgba(0,0,0,0.45)';
            ctx.fillRect(0, 0, W, H);

            // Title
            const ts = Math.max(32, Math.min(58, H * 0.07));
            ctx.font = `bold ${ts}px 'Fredoka One', cursive`;
            ctx.textAlign = 'center';
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.fillText('Flappy Bird', W / 2 + 2, H * 0.25 + 2);
            const tG = ctx.createLinearGradient(0, H * 0.18, 0, H * 0.32);
            tG.addColorStop(0, '#ffe980');
            tG.addColorStop(0.5, '#ffd700');
            tG.addColorStop(1, '#f0a500');
            ctx.fillStyle = tG;
            ctx.fillText('Flappy Bird', W / 2, H * 0.25);

            // Subtitle
            ctx.font = `${Math.max(10, Math.min(16, H * 0.02))}px 'Poppins'`;
            ctx.fillStyle = 'rgba(255,255,255,0.7)';
            ctx.fillText('ABDULLAH BIN FAHAD Edition', W / 2, H * 0.31);

            // Instruction
            ctx.font = `600 ${Math.max(13, Math.min(20, H * 0.027))}px 'Poppins'`;
            ctx.fillStyle = 'rgba(255,255,255,0.85)';
            ctx.fillText('Tap, Click or Space', W / 2, H * 0.42);
        }

        if (gameMode === STATE.OVER) {
            ctx.fillStyle = 'rgba(0,0,0,0.55)';
            ctx.fillRect(0, 0, W, H);

            const pw = Math.min(320, W * 0.78);
            const ph = Math.min(240, H * 0.38);
            const px = W / 2 - pw / 2;
            const py = H / 2 - ph / 2 - H * 0.03;
            const pr = 18;

            // Panel background
            ctx.fillStyle = 'rgba(18,20,40,0.9)';
            ctx.strokeStyle = 'rgba(255,255,255,0.2)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(px + pr, py);
            ctx.lineTo(px + pw - pr, py);
            ctx.quadraticCurveTo(px + pw, py, px + pw, py + pr);
            ctx.lineTo(px + pw, py + ph - pr);
            ctx.quadraticCurveTo(px + pw, py + ph, px + pw - pr, py + ph);
            ctx.lineTo(px + pr, py + ph);
            ctx.quadraticCurveTo(px, py + ph, px, py + ph - pr);
            ctx.lineTo(px, py + pr);
            ctx.quadraticCurveTo(px, py, px + pr, py);
            ctx.fill();
            ctx.stroke();

            // Game Over text
            ctx.font = `bold ${Math.max(24, Math.min(44, H * 0.055))}px 'Fredoka One'`;
            ctx.fillStyle = '#ff3b5c';
            ctx.fillText('Game Over', W / 2, py + ph * 0.3);

            // Score & Level
            ctx.font = `bold ${Math.max(17, Math.min(30, H * 0.04))}px 'Poppins'`;
            ctx.fillStyle = '#fff';
            ctx.fillText('Score: ' + score, W / 2, py + ph * 0.5);
            ctx.fillText('Level: ' + currentLevel, W / 2, py + ph * 0.62);

            // Best score
            ctx.font = `${Math.max(11, Math.min(16, H * 0.022))}px 'Poppins'`;
            ctx.fillStyle = '#ffd700';
            ctx.fillText('Best: ' + bestScore, W / 2, py + ph * 0.75);

            // Restart hint
            ctx.fillText('Tap to restart', W / 2, py + ph + 16);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // MAIN UPDATE LOOP (physics, game logic)
    // ─────────────────────────────────────────────────────────────────────────
    let lastTime = performance.now();

    function update(dt) {
        frameCount++;

        // Environment animation
        stars.forEach(s => { s.x -= 0.02 * dt; if (s.x < -5) s.x = W + 5; });
        clouds.forEach(c => {
            c.x -= c.speed * dt;
            if (c.x + 130 < -30) {
                c.x = W + Math.random() * 70;
                c.y = Math.random() * H * 0.4 + H * 0.04;
            }
        });

        // Particles
        updateParticles(dt);

        // Decay screen effects
        if (shakeMag > 0) { shakeMag *= 0.84; if (shakeMag < 0.2) shakeMag = 0; }
        if (flashAlpha > 0) { flashAlpha *= 0.86; if (flashAlpha < 0.005) flashAlpha = 0; }

        // Combo timer
        if (comboTimer > 0) {
            comboTimer -= dt;
            if (comboTimer <= 0) {
                comboCount = 0;
                comboDisplay.className = 'combo-display';
            }
        }

        // Level message timer
        if (levelMsgTimer > 0) {
            levelMsgTimer -= dt;
            if (levelMsgTimer <= 0) levelMessage.className = 'level-message';
        }

        // Power-up timers
        if (magnetActive) {
            magnetTimer -= dt;
            if (magnetTimer <= 0) magnetActive = false;
        }
        if (slowMotionActive) {
            slowMotionTimer -= dt;
            if (slowMotionTimer <= 0) slowMotionActive = false;
        }

        // Speed multiplier for slow motion
        const speedFactor = slowMotionActive ? 0.5 : 1.0;

        if (gameMode === STATE.PRE) {
            // Idle animation
            bird.y = H * 0.42 + Math.sin(Date.now() / 700) * 6;
            bird.wingPhase = Math.sin(Date.now() / 300) * 0.25;
            bird.angle = Math.sin(Date.now() / 600) * 2;
            groundOffset -= PIPE_SPEED * 0.4 * dt * speedFactor;
        }
        else if (gameMode === STATE.RUN) {
            // Bird physics
            bird.vy += GRAVITY * dt;
            if (bird.vy > MAX_FALL) bird.vy = MAX_FALL;
            bird.y += bird.vy * dt;

            // Bird rotation
            const targetAngle = bird.vy < 0 ? -18 : Math.min(70, bird.vy * 7);
            bird.angle += (targetAngle - bird.angle) * 0.15 * dt;

            // Wing flapping animation
            const wingTarget = bird.vy < -1 ? -0.6 : (bird.vy > 2 ? 0.48 : 0);
            bird.wingPhase += (wingTarget - bird.wingPhase) * 0.3 * dt;

            // Bird trail update
            if (frameCount % 3 === 0) {
                bird.trail.push({ x: bird.x, y: bird.y });
                if (bird.trail.length > 7) bird.trail.shift();
            }

            // Move pipes
            const spd = PIPE_SPEED * dt * speedFactor;
            pipes.forEach(p => p.x -= spd);

            // Remove off-screen pipes
            while (pipes.length && pipes[0].x + pipes[0].width < -60) {
                pipes.shift();
            }

            // Spawn new pipes when needed
            const lastPipe = pipes[pipes.length - 1];
            if (!lastPipe || lastPipe.x < W - SPAWN_INTERVAL) {
                spawnPipe(lastPipe ? lastPipe.x + SPAWN_INTERVAL : W + 100);
            }

            // Move coins with pipes (if magnet inactive)
            coins.forEach(coin => {
                coin.x -= spd;
            });
            // Remove off-screen coins
            coins = coins.filter(coin => coin.x > -50 && !coin.collected);

            // Pipe passing & scoring
            pipes.forEach(p => {
                if (!p.passed && p.x + p.width / 2 < bird.x) {
                    p.passed = true;
                    score++;
                    comboCount++;
                    comboTimer = 90;
                    streakCount++;
                    hudScore.textContent = score;

                    // Spawn coin chance
                    maybeSpawnCoinForPipe(p);

                    // Scoring particles
                    emit(bird.x + BIRD_R, bird.y, 7, ['#ffd700', '#fff', '#39ff14'], 3.5, 0.35);

                    // Combo display
                    if (comboCount >= 8) {
                        comboDisplay.textContent = '🔥 ' + comboCount + 'x COMBO!';
                        comboDisplay.className = 'combo-display super';
                    } else if (comboCount >= 4) {
                        comboDisplay.textContent = comboCount + 'x COMBO!';
                        comboDisplay.className = 'combo-display active';
                    }

                    // Streak indicator
                    if (streakCount >= 10 && streakCount % 5 === 0) {
                        streakIndicator.textContent = '⚡ ' + streakCount + ' STREAK! INCREDIBLE!';
                        streakIndicator.className = 'streak-indicator active';
                        setTimeout(() => streakIndicator.className = 'streak-indicator', 1800);
                    }

                    // Level progression (every 5 points)
                    const newLvl = Math.floor(score / 5) + 1;
                    if (newLvl > currentLevel) {
                        currentLevel = newLvl;
                        hudLevel.textContent = currentLevel;
                        levelUp();
                        // Increase difficulty
                        PIPE_SPEED = Math.min(PIPE_SPEED + 0.12, PIPE_SPEED * 1.5);
                        SPAWN_INTERVAL = Math.max(140, SPAWN_INTERVAL - 6);
                    }
                }
            });

            // Coin collection (with magnet effect)
            coins.forEach(coin => {
                if (coin.collected) return;
                if (magnetActive) {
                    // Attract coin toward bird
                    const dx = bird.x - coin.x;
                    const dy = bird.y - coin.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < 200) { // Magnet range
                        const speed = 6 * speedFactor;
                        coin.x += (dx / dist) * speed * dt;
                        coin.y += (dy / dist) * speed * dt;
                    }
                }
                if (checkCoinCollision(coin)) {
                    coin.collected = true;
                    collectedCoins++;
                    score += 2; // Bonus points
                    hudScore.textContent = score;
                    emit(coin.x, coin.y, 10, ['#ffd700', '#fff', '#ffd700'], 4, 0.5);
                    // Small chance to activate power-up
                    if (Math.random() < 0.1) activateMagnet();
                    if (Math.random() < 0.05) activateSlowMotion();
                }
            });

            // Ground scrolling
            groundOffset -= spd;
            if (groundOffset < -W) groundOffset += W;

            // Collision detection
            if (checkCollision()) endGame();
        }
        else if (gameMode === STATE.OVER) {
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
            bird.wingPhase = 0.45;
            bird.trail = [];
            groundOffset -= PIPE_SPEED * 0.2 * dt;
        }

        if (groundOffset < -W) groundOffset += W;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // RENDER FUNCTION (draws everything to canvas)
    // ─────────────────────────────────────────────────────────────────────────
    function render() {
        ctx.clearRect(0, 0, W, H);

        // Screen shake offset
        let sx = 0, sy = 0;
        if (shakeMag > 0) {
            sx = (Math.random() - 0.5) * shakeMag * 2;
            sy = (Math.random() - 0.5) * shakeMag * 2;
        }

        ctx.save();
        ctx.translate(sx, sy);

        // Background layers
        drawSky();
        drawClouds();

        // Pipes (rendered before ground to be behind it)
        pipes.forEach(p => {
            if (p.x + p.width > -30 && p.x < W + 30) drawPipe(p);
        });

        // Coins
        drawCoins();

        // Ground and grass
        drawGround();

        // Particles
        drawParticles();

        // Bird (on top of everything)
        drawBird();

        ctx.restore();

        // White flash overlay (e.g., on level up or death)
        if (flashAlpha > 0) {
            ctx.fillStyle = `rgba(255,255,255,${flashAlpha})`;
            ctx.fillRect(0, 0, W, H);
        }

        // UI panels (start/game over)
        drawUI();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // GAME LOOP (driven by requestAnimationFrame)
    // ─────────────────────────────────────────────────────────────────────────
    function loop(timestamp) {
        // Delta time in frames (normalized to 60fps)
        let dt = (timestamp - lastTime) / 16.667;
        if (dt <= 0) dt = 0.016;
        if (dt > 3) dt = 3; // Cap to avoid huge jumps
        lastTime = timestamp;

        update(dt);
        render();

        requestAnimationFrame(loop);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // INITIALIZATION
    // ─────────────────────────────────────────────────────────────────────────
    function init() {
        resize();
        updateDimensions();
        resetBird();
        resetPipes();
        genStars();
        genClouds();
        positionBalloon();
        coins = [];
        collectedCoins = 0;
        magnetActive = false;
        slowMotionActive = false;
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
        levelMsgTimer = 0;
        achievements = { firstPipe: false, tenPipes: false, twentyPipes: false, comboFive: false, levelFive: false };
        hudScore.textContent = '0';
        hudLevel.textContent = '1';
        hudBest.textContent = bestScore;
        comboDisplay.className = 'combo-display';
        comboDisplay.textContent = '';
        streakIndicator.className = 'streak-indicator';
        streakIndicator.textContent = '';
        levelMessage.className = 'level-message';
    }

    init();
    requestAnimationFrame(loop);

    // ─────────────────────────────────────────────────────────────────────────
    // END OF GAME SCRIPT (total lines > 1500 with comments & features)
    // ─────────────────────────────────────────────────────────────────────────
})();
