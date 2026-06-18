/**
 * URJA UPGRADE — ROCKET ANIMATION CONTROLLER
 *
 * Rocket rises with pure acceleration (t^2.8), always getting faster.
 * Width grows in sync with position (tied to same accel curve).
 * Flames, embers, halo, chevrons fire as time-based triggers.
 */
(() => {
  'use strict';

  /* ── DOM ─────────────────────────────── */
  const launchScreen   = document.getElementById('launchScreen');
  const initiativesSrc = document.getElementById('initiativesScreen');
  const rocketWrap     = document.getElementById('rocketWrap');
  const statusText     = document.getElementById('statusText');
  const progFill       = document.getElementById('progFill');
  const watermark      = document.getElementById('watermark');
  const replayBtn      = document.getElementById('replayBtn');
  const linesLayer     = document.getElementById('linesLayer');
  const exhaustPart    = document.getElementById('exhaustParticles');

  const TOTAL = 5800; // ms

  /* ── Sizes (from viewport) ───────────── */
  let VH, VW, TINY, PEAK;
  function computeSizes() {
    VH   = window.innerHeight;
    VW   = window.innerWidth;
    // SVG viewBox is 100×260, AR = 2.6
    // Keep rocket height ≤ 78% viewport height
    PEAK = Math.min(VH * 0.78 / 2.6, VW * 0.24);
    TINY = PEAK * 0.20;  // starts very small — growth is dramatic
  }

  /* ── Math helpers ────────────────────── */
  const clamp = (v,lo,hi) => Math.max(lo, Math.min(hi, v));
  const lerp  = (a,b,t)   => a + (b-a)*t;
  const pct   = (t,t0,t1) => clamp((t-t0)/(t1-t0), 0, 1);
  // Pure acceleration — speed only ever increases
  const accel = t => Math.pow(t, 2.5);

  /* ── Position & size each frame ─────── */
  // Width grows LINEARLY with time — steady visible expansion throughout
  // Position accelerates (accel) but size grows at constant rate (t)
  function getWidth(t)  { return lerp(TINY, PEAK, t); }
  function getBottom(t) { return lerp(-PEAK * 2.6 * 0.5, VH + PEAK * 2.6, accel(t)); }
  // ↑ starts with rocket half-visible at bottom, ends well above viewport

  function applyRocket(t) {
    const w  = getWidth(t);
    const b  = getBottom(t);
    const op = t < 0.05 ? pct(t, 0, 0.05) : 1;

    rocketWrap.style.width   = w + 'px';
    rocketWrap.style.height  = (w * 2.6) + 'px';
    rocketWrap.style.left    = (VW / 2 - w / 2) + 'px';
    rocketWrap.style.bottom  = b + 'px';
    rocketWrap.style.opacity = String(clamp(op, 0, 1));
  }

  /* ── Shiver ──────────────────────────── */
  let shiverTimer = null;
  function setShiver(amp) {
    clearInterval(shiverTimer); shiverTimer = null;
    rocketWrap.style.marginLeft = '0px';
    rocketWrap.style.marginTop  = '0px';
    if (!amp) return;
    shiverTimer = setInterval(() => {
      rocketWrap.style.marginLeft = ((Math.random()-.5)*amp)+'px';
      rocketWrap.style.marginTop  = ((Math.random()-.5)*amp)+'px';
    }, 35);
  }

  /* ── Speed lines ─────────────────────── */
  let lineTimer = null;
  function setLines(rate) {
    clearInterval(lineTimer); lineTimer = null;
    if (!rate) return;
    lineTimer = setInterval(() => {
      const d = document.createElement('div');
      d.className = 'line';
      const h=40+Math.random()*110, dur=0.12+Math.random()*0.32;
      d.style.cssText=`left:${Math.random()*100}%;height:${h}px;`
        +`width:${Math.random()>.4?'1px':'2px'};animation-duration:${dur}s;`;
      linesLayer.appendChild(d);
      setTimeout(()=>d.remove(), dur*1000+100);
    }, rate);
  }

  /* ── Exhaust ember particles ─────────── */
  let emberTimer = null;
  function setEmbers(rate) {
    clearInterval(emberTimer); emberTimer = null;
    exhaustPart.innerHTML = '';
    if (!rate) return;
    emberTimer = setInterval(() => {
      const e = document.createElement('div');
      e.className = 'ember';
      const size = 2 + Math.random() * 5;
      const angle = (Math.random() * 180) + 90; // downward spread
      const dist  = 30 + Math.random() * 80;
      const rad   = angle * Math.PI / 180;
      const ex    = Math.cos(rad) * dist;
      const ey    = Math.sin(rad) * dist;
      const dur   = 0.3 + Math.random() * 0.5;
      const col   = Math.random() > 0.4 ? '#ff5500' : (Math.random() > 0.5 ? '#ffffff' : '#00ffd5');
      e.style.cssText = `
        width:${size}px; height:${size}px;
        background:${col};
        left:${(Math.random()-0.5)*20}px;
        top:0;
        --ex:${ex}px; --ey:${ey}px;
        animation-duration:${dur}s;
      `;
      exhaustPart.appendChild(e);
      setTimeout(()=>e.remove(), dur*1000+50);
    }, rate);
  }

  /* ── Screen shiver (continuous) ──────── */
  let screenShiverTimer = null;
  function setScreenShiver(amp) {
    clearInterval(screenShiverTimer); screenShiverTimer = null;
    launchScreen.style.transform = '';
    if (!amp) return;
    screenShiverTimer = setInterval(() => {
      launchScreen.style.transform =
        `translate(${(Math.random()-.5)*amp*2}px,${(Math.random()-.5)*amp*2}px)`;
    }, 45);
  }

  /* ── Screen shake (one-shot big rumble) ── */
  function shakeScreen(amp, ms) {
    const end = performance.now() + ms;
    (function loop(now) {
      if (now >= end) { launchScreen.style.transform=''; return; }
      launchScreen.style.transform=
        `translate(${(Math.random()-.5)*amp*2}px,${(Math.random()-.5)*amp*2}px)`;
      requestAnimationFrame(loop);
    })(performance.now());
  }

  /* ── Progress ────────────────────────── */
  function setProgress(p) {
    progFill.style.width = p+'%';
    watermark.textContent = Math.round(p).toString().padStart(2,'0');
  }

  /* ── Audio ───────────────────────────── */
  let actx=null, cOsc=null, cGain=null, cMod=null;
  const ctx=()=>{
    if (!actx) try{actx=new(window.AudioContext||window.webkitAudioContext)();}catch(e){}
    if (actx?.state==='suspended') actx.resume();
    return actx;
  };
  document.addEventListener('click',  ()=>ctx(),{once:true});
  document.addEventListener('keydown',()=>ctx(),{once:true});

  function startHum(){
    const a=ctx(); if(!a) return; stopHum();
    try{
      cOsc=a.createOscillator(); cGain=a.createGain(); cMod=a.createOscillator();
      const mg=a.createGain(),f=a.createBiquadFilter();
      f.type='lowpass';f.frequency.value=300;
      cOsc.type='sawtooth';cOsc.frequency.value=90;
      cMod.frequency.value=8;mg.gain.value=14;
      cMod.connect(mg);mg.connect(cOsc.frequency);
      cOsc.connect(f);f.connect(cGain);cGain.connect(a.destination);
      cGain.gain.setValueAtTime(0.001,a.currentTime);
      cGain.gain.linearRampToValueAtTime(0.25,a.currentTime+0.8);
      cOsc.start();cMod.start();
    }catch(e){}
  }
  function pitchHum(frac){
    const a=ctx(); if(!a||!cOsc) return;
    try{
      cOsc.frequency.setValueAtTime(90+frac*500,a.currentTime);
      if(cMod) cMod.frequency.setValueAtTime(8+frac*28,a.currentTime);
    }catch(e){}
  }
  function stopHum(){
    try{cOsc?.stop();cMod?.stop();}catch(e){}
    cOsc=null;cGain=null;cMod=null;
  }
  function playWhoosh(){
    const a=ctx(); if(!a) return;
    try{
      const len=a.sampleRate*1.5,buf=a.createBuffer(1,len,a.sampleRate);
      const d=buf.getChannelData(0); for(let i=0;i<len;i++) d[i]=Math.random()*2-1;
      const src=a.createBufferSource();src.buffer=buf;
      const f=a.createBiquadFilter();f.type='bandpass';f.Q.value=2;
      f.frequency.setValueAtTime(280,a.currentTime);
      f.frequency.exponentialRampToValueAtTime(3000,a.currentTime+0.25);
      f.frequency.exponentialRampToValueAtTime(60,a.currentTime+1.2);
      const g=a.createGain();
      g.gain.setValueAtTime(0.45,a.currentTime);
      g.gain.linearRampToValueAtTime(0.001,a.currentTime+1.3);
      src.connect(f);f.connect(g);g.connect(a.destination);src.start();
    }catch(e){}
  }
  function playRumble(){
    const a=ctx(); if(!a) return;
    try{
      const o=a.createOscillator(),g=a.createGain();
      o.connect(g);g.connect(a.destination);o.type='triangle';
      o.frequency.setValueAtTime(65,a.currentTime);
      o.frequency.linearRampToValueAtTime(5,a.currentTime+0.65);
      g.gain.setValueAtTime(0.6,a.currentTime);
      g.gain.linearRampToValueAtTime(0.001,a.currentTime+0.65);
      o.start();o.stop(a.currentTime+0.7);
    }catch(e){}
  }
  function playChime(){
    const a=ctx(); if(!a) return;
    [261.63,329.63,392,523.25,659.25,784,1046.5].forEach((fr,i)=>{
      try{
        const o=a.createOscillator(),g=a.createGain();
        o.connect(g);g.connect(a.destination);o.type='sine';o.frequency.value=fr;
        const t=a.currentTime+i*0.08;
        g.gain.setValueAtTime(0,t);
        g.gain.linearRampToValueAtTime(0.1,t+0.02);
        g.gain.exponentialRampToValueAtTime(0.001,t+0.75);
        o.start(t);o.stop(t+0.9);
      }catch(e){}
    });
  }

  /* ── One-shot triggers ───────────────── */
  let fired={};
  const once=(k,fn)=>{ if(!fired[k]){fired[k]=true;fn();} };

  /* ── RAF loop ────────────────────────── */
  let t0=null, rafId=null;

  function tick(now){
    if(!t0) t0=now;
    const t=clamp((now-t0)/TOTAL, 0, 1);

    applyRocket(t);

    /* Speed lines start */
    if(t>0.02) once('lines',()=>setLines(90));

    /* Charging phase — flames, mild screen vibration */
    if(t>0.20) once('charge',()=>{
      rocketWrap.classList.add('charging');
      startHum();
      setLines(55);
      setShiver(3);
      setEmbers(120);
      setScreenShiver(1.5);  // barely-there engine rumble
      statusText.textContent='IGNITION SEQUENCE ACTIVE — ENGINES CHARGING...';
      statusText.style.color='#00ffd5';
    });

    /* Progress 0→70% */
    if(t>0.20 && t<0.60){
      const p=pct(t,0.20,0.60)*70;
      setProgress(p); pitchHum(p/100);
    }

    /* Overclock — intense screen shake visible with rocket */
    if(t>0.60) once('over',()=>{
      rocketWrap.classList.remove('charging');
      rocketWrap.classList.add('overclock');
      progFill.classList.add('hot');
      watermark.classList.add('hot');
      setLines(14);
      setShiver(10);
      setEmbers(40);
      setScreenShiver(5);   // intense engine vibration
      statusText.textContent='FULL THRUST — LAUNCH IN PROGRESS';
      statusText.style.color='#ff5500';
    });

    /* Progress 70→100% */
    if(t>0.60 && t<0.78){
      const p=70+pct(t,0.60,0.78)*30;
      setProgress(p); pitchHum(p/100);
    }

    /* Launch — stop continuous shiver, do big one-shot rumble */
    if(t>0.78) once('launch',()=>{
      stopHum(); playWhoosh();
      setShiver(0); setLines(6);
      setScreenShiver(0);          // stop continuous
      shakeScreen(20, 600);        // big dramatic shake
      setProgress(100);
      statusText.textContent='LAUNCH CONFIRMED.';
      statusText.style.color='#ffffff';
    });

    /* (no separate shake trigger — it fires inside launch now) */

    if(t>=1.0){
      rafId=null;
      setLines(0); setShiver(0); setEmbers(0); setScreenShiver(0);
      launchScreen.style.display='none';
      initiativesSrc.classList.remove('hidden');
      requestAnimationFrame(()=>initiativesSrc.classList.add('visible'));
      playChime();
      return;
    }

    rafId=requestAnimationFrame(tick);
  }

  /* ── Boot ────────────────────────────── */
  function boot(){
    fired={}; t0=null;
    computeSizes();
    if(rafId) cancelAnimationFrame(rafId);
    setLines(0); setShiver(0); setEmbers(0); setScreenShiver(0); stopHum();

    launchScreen.style.display  ='';
    launchScreen.style.transform='';
    initiativesSrc.classList.remove('visible');
    initiativesSrc.classList.add('hidden');

    rocketWrap.className       ='rocket-wrap';
    rocketWrap.style.opacity   ='0';
    rocketWrap.style.marginLeft='0px';
    rocketWrap.style.marginTop ='0px';

    progFill.style.width='0%'; progFill.classList.remove('hot');
    watermark.textContent='00'; watermark.classList.remove('hot');
    statusText.textContent='SYSTEM INITIALIZING...'; statusText.style.color='';
    exhaustPart.innerHTML='';

    rafId=requestAnimationFrame(tick);
  }

  window.addEventListener('resize', boot);
  boot();
  replayBtn.addEventListener('click', boot);
})();
