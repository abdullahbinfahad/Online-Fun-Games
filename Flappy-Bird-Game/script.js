// script.js
(function() {
    'use strict';

    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    const hudScore = document.getElementById('hudScore');
    const hudLevel = document.getElementById('hudLevel');
    const hudBest = document.getElementById('hudBest');
    const comboDisplay = document.getElementById('comboDisplay');
    const levelMessage = document.getElementById('levelMessage');
    const streakIndicator = document.getElementById('streakIndicator');
    const balloon = document.getElementById('balloon');

    // ── Responsive full‑viewport canvas (no gaps) ──
    const MAX_DPR = 2;
    let W, H, DPR;

    function resize() {
        DPR = Math.min(window.devicePixelRatio || 1, MAX_DPR);
        // Use clientWidth/clientHeight for accurate CSS pixels (no gaps)
        W = document.documentElement.clientWidth;
        H = document.documentElement.clientHeight;
        canvas.width = Math.floor(W * DPR);
        canvas.height = Math.floor(H * DPR);
        canvas.style.width = W + 'px';
        canvas.style.height = H + 'px';
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(DPR, DPR);
    }
    resize();
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
    window.addEventListener('orientationchange', () => setTimeout(() => {
        resize();
        updateDimensions();
        positionBalloon();
    }, 300));

    // ── Dynamic game dimensions ──
    let BIRD_R, PIPE_W, PIPE_GAP, GROUND_H, PIPE_CAP_H,
        PIPE_SPEED, GRAVITY, JUMP_VEL, MAX_FALL, SPAWN_INTERVAL;

    function updateDimensions() {
        BIRD_R = Math.max(12, Math.min(24, H * 0.04));
        PIPE_W = Math.max(34, Math.min(68, W * 0.088));
        PIPE_GAP = Math.max(100, Math.min(180, H * 0.24));
        GROUND_H = Math.max(44, Math.min(82, H * 0.1));
        PIPE_CAP_H = Math.max(16, Math.min(28, H * 0.036));
        PIPE_SPEED = Math.max(1.5, Math.min(3.5, W * 0.004));
        GRAVITY = Math.max(0.25, Math.min(0.58, H * 0.00073));
        JUMP_VEL = Math.max(-6.8, Math.min(-3.9, -H * 0.009));
        MAX_FALL = Math.max(5, Math.min(10, H * 0.014));
        SPAWN_INTERVAL = Math.max(150, Math.min(320, W * 0.37));
    }
    updateDimensions();

    // ── Game state ──
    const STATE = { PRE: 'prestart', RUN: 'running', OVER: 'over' };
    let gameMode = STATE.PRE, score = 0, currentLevel = 1, bestScore = 0;
    let pipes = [], particles = [], clouds = [], stars = [];
    let groundOffset = 0, shakeMag = 0, flashAlpha = 0, timeOver = null;
    let frameCount = 0, comboCount = 0, comboTimer = 0, streakCount = 0;
    let levelMsgTimer = 0;
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

    try { bestScore = parseInt(localStorage.getItem('flappyABF2_best') || '0'); } catch(e){}
    hudBest.textContent = bestScore;

    // ── Bird ──
    const bird = { x:0, y:0, vy:0, angle:0, wingPhase:0, trail:[] };
    function resetBird() {
        bird.x = W * 0.26; bird.y = H * 0.42; bird.vy = 0;
        bird.angle = 0; bird.wingPhase = 0; bird.trail = [];
    }

    // ── Pipes ──
    function spawnPipe(x) {
        const gy = H - GROUND_H;
        const min = PIPE_CAP_H + 20, max = gy - PIPE_GAP - PIPE_CAP_H - 20;
        const center = min + Math.random() * (max - min);
        pipes.push({
            x, topH: center - PIPE_GAP/2, bottomY: center + PIPE_GAP/2,
            width: PIPE_W, capH: PIPE_CAP_H, passed: false, nearMissed: false
        });
    }
    function resetPipes() {
        pipes = [];
        const start = W + 80;
        for (let i=0; i<5; i++) spawnPipe(start + i * SPAWN_INTERVAL);
    }

    // ── Environment ──
    function genStars() {
        stars = [];
        for (let i=0; i<80; i++) stars.push({
            x: Math.random()*W, y: Math.random()*H*0.5,
            r: Math.random()*1.5+0.4, sp: Math.random()*0.03+0.01,
            off: Math.random()*Math.PI*2, ba: Math.random()*0.5+0.3
        });
    }
    function genClouds() {
        clouds = [];
        const n = Math.floor(W/150)+4;
        for (let i=0; i<n; i++) clouds.push({
            x: Math.random()*W*1.3, y: Math.random()*H*0.4+H*0.04,
            w: Math.random()*80+45, h: Math.random()*24+12,
            speed: Math.random()*0.25+0.1, opacity: Math.random()*0.25+0.1,
            bubbles: [
                {rx:0,ry:0,r:Math.random()*14+12},
                {rx:Math.random()*30+8,ry:Math.random()*8-4,r:Math.random()*18+13},
                {rx:Math.random()*30+12,ry:Math.random()*8-4,r:Math.random()*16+10},
                {rx:-Math.random()*24-6,ry:Math.random()*6-3,r:Math.random()*16+8}
            ]
        });
    }
    genStars(); genClouds();

    // ── Particles ──
    function emit(x,y,count,colors,spread,life) {
        for (let i=0; i<count; i++) {
            const a = Math.random()*Math.PI*2, s = Math.random()*spread+spread*0.3;
            particles.push({
                x,y, vx:Math.cos(a)*s, vy:Math.sin(a)*s,
                life: life+Math.random()*life*0.5, maxLife: life*1.5,
                color: colors[Math.floor(Math.random()*colors.length)],
                r: Math.random()*3+1.5
            });
        }
    }
    function updateParticles(dt) {
        for (let i=particles.length-1; i>=0; i--) {
            const p = particles[i];
            p.x += p.vx*dt; p.y += p.vy*dt; p.vy += GRAVITY*0.4*dt;
            p.life -= dt;
            if (p.life <= 0) particles.splice(i,1);
        }
    }

    // ── Collision ──
    function rectCircle(rx,ry,rw,rh,cx,cy,cr) {
        const cx2 = Math.max(rx, Math.min(cx, rx+rw));
        const cy2 = Math.max(ry, Math.min(cy, ry+rh));
        return (cx-cx2)**2 + (cy-cy2)**2 < cr*cr;
    }
    function checkCollision() {
        const gy = H - GROUND_H;
        if (bird.y+BIRD_R >= gy || bird.y-BIRD_R <= 0) return true;
        for (const p of pipes) {
            if (rectCircle(p.x,0,p.width,p.topH, bird.x,bird.y, BIRD_R*0.82) ||
                rectCircle(p.x,p.bottomY,p.width,gy-p.bottomY, bird.x,bird.y, BIRD_R*0.82))
                return true;
        }
        return false;
    }

    // ── Game flow ──
    function startGame() {
        resetBird(); resetPipes();
        score=0; currentLevel=1; comboCount=0; comboTimer=0; streakCount=0;
        levelMsgTimer=0;
        particles=[]; groundOffset=0; shakeMag=0; flashAlpha=0; timeOver=null;
        gameMode = STATE.RUN;
        hudScore.textContent='0'; hudLevel.textContent='1';
        comboDisplay.className = 'combo-display'; comboDisplay.textContent='';
        streakIndicator.className = 'streak-indicator'; streakIndicator.textContent='';
        levelMessage.className = 'level-message';
        bird.vy = JUMP_VEL;
        emit(bird.x, bird.y+BIRD_R*0.6, 14, ['#fff','#ffd700','#39ff14'], 5, 0.5);
    }
    function endGame() {
        if (gameMode!==STATE.RUN) return;
        gameMode = STATE.OVER; timeOver = Date.now();
        shakeMag=16; flashAlpha=0.6;
        if (score>bestScore) {
            bestScore=score;
            try{ localStorage.setItem('flappyABF2_best',bestScore); }catch(e){}
            hudBest.textContent = bestScore;
        }
        comboDisplay.className = 'combo-display';
        streakIndicator.className = 'streak-indicator';
        levelMessage.className = 'level-message';
        emit(bird.x,bird.y,30,['#ffd700','#ff6b35','#ff2d78','#fff'],6,0.8);
        emit(bird.x,bird.y,20,['#ff2d78','#ffd700'],5,0.6);
    }

    function levelUp() {
        const idx = Math.min(currentLevel-2, levelTexts.length-1);
        const msg = levelTexts[Math.max(0,idx)];
        levelMessage.innerHTML = msg.replace(/\n/g,'<br>');
        levelMessage.className = 'level-message show';
        levelMsgTimer = 80;
        emit(W/2, H*0.35, 35, ['#ffd700','#ff2d78','#39ff14','#fff','#00e5ff'], 7, 1);
        shakeMag=7; flashAlpha=0.25;
    }

    // ── Input ──
    function handleInput(e) {
        if(e) e.preventDefault();
        switch(gameMode) {
            case STATE.PRE: startGame(); break;
            case STATE.RUN:
                bird.vy = JUMP_VEL; bird.wingPhase = -1.2;
                emit(bird.x, bird.y+BIRD_R*0.5, 8, ['#fff','#ffd700'], 4, 0.4);
                break;
            case STATE.OVER:
                if (timeOver && Date.now()-timeOver>500) startGame();
                break;
        }
    }
    canvas.addEventListener('touchstart', handleInput, {passive:false});
    canvas.addEventListener('touchend', e=>e.preventDefault(), {passive:false});
    canvas.addEventListener('touchmove', e=>e.preventDefault(), {passive:false});
    canvas.addEventListener('mousedown', handleInput);
    document.addEventListener('keydown', e=>{
        if (['Space','ArrowUp','KeyW'].includes(e.code)) handleInput(e);
    });
    document.addEventListener('gesturestart', e=>e.preventDefault());

    // ── Balloon position ──
    function positionBalloon() {
        balloon.style.left = Math.max(10, W*0.05) + 'px';
        balloon.style.top = Math.max(10, H*0.1) + 'px';
    }
    positionBalloon();

    // ── Drawing helpers ──
    function drawSky() {
        const grad = ctx.createLinearGradient(0,0,0,H);
        grad.addColorStop(0,'#0a0a20'); grad.addColorStop(0.18,'#0d1b3e');
        grad.addColorStop(0.38,'#152a55'); grad.addColorStop(0.55,'#1e3f6e');
        grad.addColorStop(0.72,'#3b6fa0'); grad.addColorStop(0.88,'#5a9ec0');
        grad.addColorStop(1,'#8dc8e0');
        ctx.fillStyle = grad; ctx.fillRect(0,0,W,H);
        stars.forEach(s=>{
            const alpha = s.ba + Math.sin(frameCount*s.sp + s.off)*0.3;
            ctx.fillStyle = `rgba(255,255,255,${Math.max(0.05,alpha)})`;
            ctx.beginPath(); ctx.arc(s.x,s.y,s.r,0,Math.PI*2); ctx.fill();
        });
        const glow = ctx.createRadialGradient(W*0.5,H*0.7,H*0.03,W*0.5,H*0.76,H*0.6);
        glow.addColorStop(0,'rgba(255,200,150,0.18)');
        glow.addColorStop(1,'rgba(255,150,100,0)');
        ctx.fillStyle = glow; ctx.fillRect(0,0,W,H);
    }

    function drawClouds() {
        clouds.forEach(c=>{
            ctx.save(); ctx.globalAlpha = c.opacity;
            c.bubbles.forEach(b=>{
                const cx=c.x+b.rx, cy=c.y+b.ry;
                const g = ctx.createRadialGradient(cx-b.r*0.2,cy-b.r*0.25,b.r*0.06,cx,cy,b.r);
                g.addColorStop(0,'rgba(255,255,255,0.9)');
                g.addColorStop(0.4,'rgba(255,255,255,0.5)');
                g.addColorStop(1,'rgba(255,255,255,0)');
                ctx.fillStyle=g; ctx.beginPath(); ctx.arc(cx,cy,b.r,0,Math.PI*2); ctx.fill();
            });
            ctx.restore();
        });
    }

    function drawGround() {
        const gy = H - GROUND_H;
        const eGrad = ctx.createLinearGradient(0,gy,0,H);
        eGrad.addColorStop(0,'#4a3020'); eGrad.addColorStop(0.3,'#3d2616');
        eGrad.addColorStop(1,'#1a0e06');
        ctx.fillStyle=eGrad; ctx.fillRect(0,gy,W,GROUND_H);
        const gGrad = ctx.createLinearGradient(0,gy-2,0,gy+8);
        gGrad.addColorStop(0,'#5cb84a'); gGrad.addColorStop(0.6,'#3d7a2d');
        gGrad.addColorStop(1,'#2d5a1e');
        ctx.fillStyle=gGrad; ctx.fillRect(0,gy-1,W,11);
        ctx.strokeStyle='rgba(160,230,140,0.35)'; ctx.lineWidth=1;
        ctx.beginPath(); ctx.moveTo(0,gy); ctx.lineTo(W,gy); ctx.stroke();
        const sp=14, off=groundOffset%sp;
        ctx.fillStyle='#7cc96c';
        for(let x=-off; x<W+sp; x+=sp){
            const h=5+Math.sin(x*0.5+groundOffset*0.07)*3;
            ctx.beginPath(); ctx.moveTo(x,gy); ctx.lineTo(x+2,gy-h); ctx.lineTo(x-2,gy-h); ctx.fill();
        }
    }

    function drawPipeBody(x,y,w,h,capH,isBot){
        const capY = isBot? y : y+h-capH;
        const bTop = isBot? y+capH : y, bH = h-capH;
        const ov = w*0.14;
        const bodyG = ctx.createLinearGradient(x,0,x+w,0);
        bodyG.addColorStop(0,'#1a5c1a'); bodyG.addColorStop(0.3,'#3da83d');
        bodyG.addColorStop(0.5,'#5dd85d'); bodyG.addColorStop(0.7,'#3da83d');
        bodyG.addColorStop(1,'#1a4a1a');
        ctx.fillStyle=bodyG; ctx.fillRect(x,bTop,w,bH);
        ctx.fillStyle='rgba(255,255,255,0.12)'; ctx.fillRect(x,bTop,w*0.35,bH);
        ctx.fillStyle='rgba(0,0,0,0.25)'; ctx.fillRect(x+w-2,bTop,2,bH);
        const capG = ctx.createLinearGradient(x-ov,0,x+w+ov,0);
        capG.addColorStop(0,'#1a4a1a'); capG.addColorStop(0.3,'#3da83d');
        capG.addColorStop(0.5,'#5dd85d'); capG.addColorStop(1,'#1a4a1a');
        ctx.fillStyle=capG; ctx.fillRect(x-ov,capY,w+ov*2,capH);
        ctx.fillStyle='rgba(0,0,0,0.3)'; ctx.fillRect(x-ov,capY+capH-2,w+ov*2,2);
        ctx.fillStyle='rgba(255,255,255,0.2)'; ctx.fillRect(x-ov,capY,w+ov*2,1.5);
    }

    function drawPipe(p){
        const gy=H-GROUND_H;
        drawPipeBody(p.x,0,p.width,p.topH,p.capH,false);
        drawPipeBody(p.x,p.bottomY,p.width,gy-p.bottomY,p.capH,true);
    }

    function drawBird(){
        bird.trail.forEach((t,i)=>{
            ctx.fillStyle=`rgba(255,215,0,${i/bird.trail.length*0.25})`;
            ctx.beginPath(); ctx.arc(t.x,t.y,BIRD_R*0.45*(i/bird.trail.length),0,Math.PI*2); ctx.fill();
        });
        ctx.save(); ctx.translate(bird.x,bird.y); ctx.rotate(bird.angle*Math.PI/180);
        const r=BIRD_R;
        ctx.fillStyle='rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.arc(2,2.5,r,0,Math.PI*2); ctx.fill();
        const bodyG=ctx.createRadialGradient(-r*0.2,-r*0.3,r*0.06,0,0,r);
        bodyG.addColorStop(0,'#ffe980'); bodyG.addColorStop(0.4,'#ffd700');
        bodyG.addColorStop(0.8,'#f0b800'); bodyG.addColorStop(1,'#c88200');
        ctx.fillStyle=bodyG; ctx.beginPath(); ctx.arc(0,0,r,0,Math.PI*2); ctx.fill();
        ctx.save(); ctx.translate(r*0.1,-r*0.18); ctx.rotate(bird.wingPhase);
        const wG=ctx.createLinearGradient(0,-r*0.55,0,r*0.25);
        wG.addColorStop(0,'#f5c400'); wG.addColorStop(0.6,'#e8a800'); wG.addColorStop(1,'#b87000');
        ctx.fillStyle=wG; ctx.beginPath(); ctx.ellipse(0,r*0.03,r*0.45,r*0.55,-0.1,0,Math.PI*2); ctx.fill();
        ctx.restore();
        ctx.fillStyle='#e8a800'; ctx.beginPath();
        ctx.moveTo(-r*0.65,-r*0.2); ctx.lineTo(-r*1.2,-r*0.4); ctx.lineTo(-r*1.05,r*0.08); ctx.lineTo(-r*0.55,r*0.18); ctx.fill();
        ctx.fillStyle='#b87000'; ctx.beginPath();
        ctx.moveTo(-r*0.6,-r*0.08); ctx.lineTo(-r*1.1,-r*0.16); ctx.lineTo(-r*0.95,r*0.16); ctx.lineTo(-r*0.5,r*0.22); ctx.fill();
        const ex=r*0.35, ey=-r*0.26, er=r*0.27;
        ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(ex,ey,er,0,Math.PI*2); ctx.fill();
        const pr=er*0.5; ctx.fillStyle='#111'; ctx.beginPath(); ctx.arc(ex+er*0.15,ey,pr,0,Math.PI*2); ctx.fill();
        ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(ex+er*0.03,ey-pr*0.3,pr*0.3,0,Math.PI*2); ctx.fill();
        ctx.restore();
    }

    function drawParticles(){
        particles.forEach(p=>{
            const a=Math.max(0,p.life/p.maxLife);
            ctx.globalAlpha=a; ctx.fillStyle=p.color;
            ctx.beginPath(); ctx.arc(p.x,p.y,p.r*(0.5+a*0.5),0,Math.PI*2); ctx.fill();
        });
        ctx.globalAlpha=1;
    }

    function drawUI() {
        if(gameMode===STATE.PRE){
            ctx.fillStyle='rgba(0,0,0,0.45)'; ctx.fillRect(0,0,W,H);
            const ts=Math.max(32,Math.min(58,H*0.07));
            ctx.font=`bold ${ts}px 'Fredoka One', cursive`; ctx.textAlign='center';
            ctx.fillStyle='rgba(0,0,0,0.5)'; ctx.fillText('Flappy Bird',W/2+2,H*0.25+2);
            const tG=ctx.createLinearGradient(0,H*0.18,0,H*0.32);
            tG.addColorStop(0,'#ffe980'); tG.addColorStop(0.5,'#ffd700'); tG.addColorStop(1,'#f0a500');
            ctx.fillStyle=tG; ctx.fillText('Flappy Bird',W/2,H*0.25);
            ctx.font=`${Math.max(10,Math.min(16,H*0.02))}px 'Poppins'`;
            ctx.fillStyle='rgba(255,255,255,0.7)'; ctx.fillText('ABDULLAH BIN FAHAD Edition',W/2,H*0.31);
            ctx.font=`600 ${Math.max(13,Math.min(20,H*0.027))}px 'Poppins'`;
            ctx.fillStyle='rgba(255,255,255,0.85)'; ctx.fillText('Tap, Click or Space',W/2,H*0.42);
        }
        if(gameMode===STATE.OVER){
            ctx.fillStyle='rgba(0,0,0,0.55)'; ctx.fillRect(0,0,W,H);
            const pw=Math.min(320,W*0.78), ph=Math.min(240,H*0.38);
            const px=W/2-pw/2, py=H/2-ph/2-H*0.03, pr=18;
            ctx.fillStyle='rgba(18,20,40,0.9)'; ctx.strokeStyle='rgba(255,255,255,0.2)';
            ctx.lineWidth=1.5; ctx.beginPath();
            ctx.moveTo(px+pr,py); ctx.lineTo(px+pw-pr,py);
            ctx.quadraticCurveTo(px+pw,py,px+pw,py+pr);
            ctx.lineTo(px+pw,py+ph-pr); ctx.quadraticCurveTo(px+pw,py+ph,px+pw-pr,py+ph);
            ctx.lineTo(px+pr,py+ph); ctx.quadraticCurveTo(px,py+ph,px,py+ph-pr);
            ctx.lineTo(px,py+pr); ctx.quadraticCurveTo(px,py,px+pr,py);
            ctx.fill(); ctx.stroke();
            ctx.font=`bold ${Math.max(24,Math.min(44,H*0.055))}px 'Fredoka One'`;
            ctx.fillStyle='#ff3b5c'; ctx.fillText('Game Over',W/2,py+ph*0.3);
            ctx.font=`bold ${Math.max(17,Math.min(30,H*0.04))}px 'Poppins'`;
            ctx.fillStyle='#fff'; ctx.fillText('Score: '+score,W/2,py+ph*0.5);
            ctx.fillText('Level: '+currentLevel,W/2,py+ph*0.62);
            ctx.font=`${Math.max(11,Math.min(16,H*0.022))}px 'Poppins'`;
            ctx.fillStyle='#ffd700'; ctx.fillText('Best: '+bestScore,W/2,py+ph*0.75);
            ctx.fillText('Tap to restart',W/2,py+ph+16);
        }
    }

    // ── Update ──
    let lastTime = performance.now();
    function update(dt){
        frameCount++;
        stars.forEach(s=>{ s.x-=0.02*dt; if(s.x<-5)s.x=W+5; });
        clouds.forEach(c=>{ c.x-=c.speed*dt; if(c.x+130<-30){c.x=W+Math.random()*70; c.y=Math.random()*H*0.4+H*0.04;} });
        updateParticles(dt);
        if(shakeMag>0){shakeMag*=0.84; if(shakeMag<0.2)shakeMag=0;}
        if(flashAlpha>0){flashAlpha*=0.86; if(flashAlpha<0.005)flashAlpha=0;}
        if(comboTimer>0){comboTimer-=dt; if(comboTimer<=0){comboCount=0; comboDisplay.className='combo-display';}}
        if(levelMsgTimer>0){levelMsgTimer-=dt; if(levelMsgTimer<=0) levelMessage.className='level-message';}

        if(gameMode===STATE.PRE){
            bird.y=H*0.42+Math.sin(Date.now()/700)*6;
            bird.wingPhase=Math.sin(Date.now()/300)*0.25;
            bird.angle=Math.sin(Date.now()/600)*2;
            groundOffset-=PIPE_SPEED*0.4*dt;
        } else if(gameMode===STATE.RUN){
            bird.vy+=GRAVITY*dt; if(bird.vy>MAX_FALL)bird.vy=MAX_FALL;
            bird.y+=bird.vy*dt;
            bird.angle+=(bird.vy<0?-18:Math.min(70,bird.vy*7)-bird.angle)*0.15*dt;
            bird.wingPhase+=(bird.vy<-1?-0.6:bird.vy>2?0.48:0 - bird.wingPhase)*0.3*dt;
            if(frameCount%3===0){bird.trail.push({x:bird.x,y:bird.y}); if(bird.trail.length>7)bird.trail.shift();}
            const spd=PIPE_SPEED*dt;
            pipes.forEach(p=>p.x-=spd);
            while(pipes.length&&pipes[0].x+pipes[0].width<-60)pipes.shift();
            const last=pipes[pipes.length-1];
            if(!last||last.x<W-SPAWN_INTERVAL) spawnPipe(last?last.x+SPAWN_INTERVAL:W+100);

            pipes.forEach(p=>{
                if(!p.passed && p.x+p.width/2<bird.x){
                    p.passed=true; score++; comboCount++; comboTimer=90; streakCount++;
                    hudScore.textContent=score;
                    emit(bird.x+BIRD_R,bird.y,7,['#ffd700','#fff','#39ff14'],3.5,0.35);
                    if(comboCount>=8){
                        comboDisplay.textContent='🔥 '+comboCount+'x COMBO!';
                        comboDisplay.className='combo-display super';
                    } else if(comboCount>=4){
                        comboDisplay.textContent=comboCount+'x COMBO!';
                        comboDisplay.className='combo-display active';
                    }
                    if(streakCount>=10&&streakCount%5===0){
                        streakIndicator.textContent='⚡ '+streakCount+' STREAK! INCREDIBLE!';
                        streakIndicator.className='streak-indicator active';
                        setTimeout(()=>streakIndicator.className='streak-indicator',1800);
                    }
                    const newLvl=Math.floor(score/5)+1;
                    if(newLvl>currentLevel){
                        currentLevel=newLvl; hudLevel.textContent=currentLevel;
                        levelUp();
                        PIPE_SPEED=Math.min(PIPE_SPEED+0.12, PIPE_SPEED*1.5);
                        SPAWN_INTERVAL=Math.max(140, SPAWN_INTERVAL-6);
                    }
                }
            });
            groundOffset-=spd;
            if(checkCollision()) endGame();
        } else if(gameMode===STATE.OVER){
            const gy=H-GROUND_H;
            if(bird.y+BIRD_R<gy){
                bird.vy+=GRAVITY*dt; if(bird.vy>MAX_FALL)bird.vy=MAX_FALL;
                bird.y+=bird.vy*dt; bird.angle=Math.min(80,bird.angle+2.5*dt);
            } else {
                bird.y=gy-BIRD_R; bird.vy=0; bird.angle=76;
            }
            bird.wingPhase=0.45; bird.trail=[];
            groundOffset-=PIPE_SPEED*0.2*dt;
        }
        if(groundOffset<-W)groundOffset+=W;
    }

    function render(){
        ctx.clearRect(0,0,W,H);
        let sx=0,sy=0;
        if(shakeMag>0){sx=(Math.random()-0.5)*shakeMag*2; sy=(Math.random()-0.5)*shakeMag*2;}
        ctx.save(); ctx.translate(sx,sy);
        drawSky(); drawClouds();
        pipes.forEach(p=>{if(p.x+p.width>-30&&p.x<W+30)drawPipe(p);});
        drawGround(); drawParticles(); drawBird();
        ctx.restore();
        if(flashAlpha>0){ctx.fillStyle=`rgba(255,255,255,${flashAlpha})`; ctx.fillRect(0,0,W,H);}
        drawUI();
    }

    function loop(ts){
        let dt=(ts-lastTime)/16.667; if(dt<=0)dt=0.016; if(dt>3)dt=3;
        lastTime=ts;
        update(dt); render();
        requestAnimationFrame(loop);
    }

    function init(){
        resize(); updateDimensions();
        resetBird(); resetPipes(); genStars(); genClouds(); positionBalloon();
        particles=[]; score=0; currentLevel=1; gameMode=STATE.PRE;
        groundOffset=0; shakeMag=0; flashAlpha=0; timeOver=null;
        comboCount=0; comboTimer=0; streakCount=0; levelMsgTimer=0;
        hudScore.textContent='0'; hudLevel.textContent='1'; hudBest.textContent=bestScore;
        comboDisplay.className='combo-display'; comboDisplay.textContent='';
        streakIndicator.className='streak-indicator'; streakIndicator.textContent='';
        levelMessage.className='level-message';
    }
    init();
    requestAnimationFrame(loop);
})();
