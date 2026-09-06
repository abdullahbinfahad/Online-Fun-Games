/* Arcade Evolution: non-invasive meta progression for classic games */
(() => {
  'use strict';
  const key = `arcade-evolution:${location.pathname}`;
  const folder = location.pathname.split('/').filter(Boolean).slice(-2, -1)[0] || 'arcade';
  const title = (document.title || folder).replace(/\s*[|–-].*$/, '').trim();
  const stories = {
    '2048-Game':'In the Infinity Vault, every merge powers a dormant starship. Reach new sectors by chaining perfect tiles.',
    'Archery-Game':'The Aurora Range is collapsing. Master the wind, land precision shots, and restore the guardian beacon.',
    'Breakout-Game':'A rogue signal has trapped the city in a crystal firewall. Break every layer to reboot the skyline.',
    'Candy-Crush-Game':'The Sugar Nebula is fading. Build brilliant combos to refill its candy-powered sun.',
    'Chess':'Champions from parallel worlds await. Win tactical battles to unlock the next cosmic arena.',
    'Connect-Four-Game':'The gravity core is unstable. Connect your colors and stabilize four dimensions at once.',
    'Corona-Virus-Shotting':'Defend the micro-city and upgrade its shield network through increasingly intense waves.',
    'Dice-Roll-Simulator':'The Fortune Guild has opened its vault. Each roll reveals a new challenge and a rarer reward.',
    'Emoji-Catcher-Game':'A playful storm is raining memories. Catch the rarest icons before they vanish into the cloud.',
    'Fruit-Slicer-Game':'Your neon kitchen is a portal to endless worlds. Slice cleanly to unlock legendary chef kits.',
    'Hangman-Game':'Decode the lost archive one letter at a time and uncover the mystery behind the silent signal.',
    'Insect-Catch-Game':'The garden is full of bio-luminescent visitors. Catch them safely and complete your field journal.',
    'Memory-Card-Game':'The Memory Matrix has fragmented. Restore its patterns to bring the digital city back online.',
    'Minesweeper-Game':'Navigate the abandoned moon base, reading every signal before the next hidden charge activates.',
    'Ping-Pong-Game':'The orbital league is recruiting. Return every impossible serve and climb the zero-gravity circuit.',
    'Quiz-Game':'The Curator will open the knowledge gate only for explorers who can answer under pressure.',
    'Rock-Paper-Scissors':'The triad arena is choosing its next champion. Read the opponent and collect the three relics.',
    'Shape-Clicker-Game':'Shapes are escaping the Prism Lab. Match the signal quickly to keep reality stable.',
    'Simon-Says-Game':'The Echo Temple remembers every move. Follow the sequence to unlock deeper chambers.',
    'Snake-Game':'Pilot the signal serpent through a living circuit. Grow longer, faster, and harder to catch.',
    'Speak-Number-Guessing-Game':'The voice console is locked. Speak the correct number to access the next archive.',
    'Speed-Typing-Game':'The data storm is approaching. Type with precision to outrun the collapse.',
    'Tic-Tac-Toe':'Two quantum tacticians enter the grid; only one can claim the final constellation.',
    'Tilting-Maze-Game':'Guide the energy core through the labyrinth and repair the planet-sized reactor.',
    'Tower-Blocks':'Build above the clouds before the storm arrives. Perfect placement unlocks the skyline kit.',
    'Type-Number-Guessing-Game':'The cipher engine has chosen a hidden key. Narrow the range and crack it quickly.',
    'Typing-Game':'The dojo trains cyber scribes. Keep your rhythm and earn a place in the master archive.',
    'Whack-A-Mole-Game':'The tunnel network is overrun. React fast, protect the garden, and collect the golden badges.'
  };
  const defaults = { coins:0, points:0, level:1, streak:0, best:0, lastDay:'' };
  let state = Object.assign({}, defaults, JSON.parse(localStorage.getItem(key) || '{}'));
  const save = () => localStorage.setItem(key, JSON.stringify(state));
  const day = new Date().toISOString().slice(0,10);
  if (state.lastDay !== day) { state.coins += 25; state.lastDay = day; save(); }
  document.body.classList.add('ae-game-page');
  const hud = document.createElement('aside'); hud.className = 'ae-hud'; hud.setAttribute('aria-label','Arcade progression');
  hud.innerHTML = `<div class="ae-brand"><i class="ae-orb"></i><span class="ae-title">${title || 'Arcade Mission'}</span></div><div class="ae-stats"><span class="ae-stat">COINS <b data-ae="coins">${state.coins}</b></span><span class="ae-stat">XP <b data-ae="points">${state.points}</b></span><span class="ae-stat">LV <b data-ae="level">${state.level}</b></span><span class="ae-stat">STREAK <b data-ae="streak">${state.streak}</b></span></div><div class="ae-actions"><button class="ae-btn" data-action="story" aria-label="Open story">▣ <span>Story</span></button><button class="ae-btn" data-action="sound" aria-label="Toggle sound">♫ <span>Sound</span></button><button class="ae-btn" data-action="gift" aria-label="Open daily gift">🎁 <span>Gift</span></button></div>`;
  const panel = document.createElement('section'); panel.className='ae-panel'; panel.setAttribute('role','dialog'); panel.innerHTML=`<h2>${title || 'Arcade Mission'}</h2><p>${stories[folder] || 'Every round is a new mission. Play, master the mechanics, and unlock a higher tier.'}</p><p><b>Loadout:</b> Prism Kit · Scout Companion · Infinite Run</p><div class="ae-reward">Daily gift: +25 coins has been added to your vault.</div>`;
  const toast = document.createElement('div'); toast.className='ae-toast'; const guide=document.createElement('div'); guide.className='ae-guide'; guide.textContent='Tap, click, or use your keyboard — progress saves automatically';
  document.body.append(hud,panel,toast,guide);
  const refresh=()=>{ ['coins','points','level','streak'].forEach(k=>{const el=hud.querySelector(`[data-ae="${k}"]`); if(el)el.textContent=state[k];}); };
  let toastTimer; const notify=(msg)=>{toast.textContent=msg;toast.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove('show'),2200);};
  let audioOn = localStorage.getItem('arcade-evolution:sound') !== 'off'; let audio;
  const ping=()=>{ if(!audioOn)return; audio ||= new (window.AudioContext||window.webkitAudioContext)(); const o=audio.createOscillator(),g=audio.createGain();o.frequency.value=520;g.gain.setValueAtTime(.04,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.12);o.connect(g).connect(audio.destination);o.start();o.stop(audio.currentTime+.12); };
  const reward=(amount=5)=>{state.points+=amount;state.coins+=Math.max(1,Math.round(amount/5));state.level=1+Math.floor(state.points/100);state.streak++;state.best=Math.max(state.best,state.streak);save();refresh();ping(); if(state.points%100 < amount) notify(`Level ${state.level} unlocked — new kit available!`);};
  document.addEventListener('click', e=>{ const action=e.target.closest('[data-action]')?.dataset.action; if(action==='story'){panel.classList.toggle('open');} if(action==='sound'){audioOn=!audioOn;localStorage.setItem('arcade-evolution:sound',audioOn?'on':'off');notify(audioOn?'Sound enabled':'Sound muted');} if(action==='gift'){state.coins+=10;save();refresh();notify('Gift crate opened: +10 coins');ping();} }, {passive:true});
  ['keydown','pointerdown','touchstart'].forEach(evt=>document.addEventListener(evt,()=>reward(1),{once:true,passive:true}));
  setInterval(()=>{ if(document.visibilityState==='visible') reward(2); }, 45000);
  window.addEventListener('ae:reward', e=>reward(Number(e.detail?.amount)||10));
  window.ArcadeEvolution={reward,notify,getState:()=>({...state})};
  refresh();
})();
