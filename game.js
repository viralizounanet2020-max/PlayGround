(() => {
  'use strict';
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const $ = (id) => document.getElementById(id);
  const ui = { blue: $('blueScore'), orange: $('orangeScore'), clock: $('clock'), boost: $('boostValue'), fill: $('boostFill'), status: $('statusText'), overlay: $('overlay'), title: $('overlayTitle'), copy: $('overlayCopy'), play: $('playBtn'), toast: $('toast'), pause: $('pauseBtn'), sound: $('soundBtn') };
  const FIELD = { x: 34, y: 34, goal: 8.5 };
  const pads = [
    {x:-16,y:-23,amount:0,active:true},{x:16,y:-23,amount:0,active:true},
    {x:-16,y:23,amount:0,active:true},{x:16,y:23,amount:0,active:true},
    {x:0,y:-29,amount:0,active:true},{x:0,y:29,amount:0,active:true}
  ];
  const keys = new Set();
  const player = makeCar('blue', 0, 20, -Math.PI / 2);
  const rival = makeCar('orange', 0, -20, Math.PI / 2);
  const ball = { x:0, y:0, vx:0, vy:0, z:0, vz:0, spin:0 };
  const state = { running:false, paused:false, countdown:3, timer:180, blue:0, orange:0, boost:100, jump:0, jumpCooldown:0, touchX:0, touchY:0, touchBoost:false, sound:true, last:0, elapsed:0, particles:[], goalFreeze:0, kickoff:true, toastTimer:0, audio:null };
  let W=800,H=450,dpr=1,scale=10,sy=8.6;

  function makeCar(team,x,y,angle){return {team,x,y,vx:0,vy:0,angle,speed:0,z:0,flash:0,trail:[]};}
  function resize(){const r=canvas.getBoundingClientRect();W=r.width;H=r.height;dpr=Math.min(window.devicePixelRatio||1,2);canvas.width=Math.round(W*dpr);canvas.height=Math.round(H*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);scale=Math.min(W/57,H/88);sy=scale*.88;}
  window.addEventListener('resize',resize); resize();
  const px=(x)=>W/2+x*scale; const py=(y)=>H/2+y*sy;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)); const hypot=Math.hypot;
  function showToast(text,duration=1.5){ui.toast.textContent=text;ui.toast.classList.add('show');state.toastTimer=duration;}
  function hideOverlay(){ui.overlay.classList.add('hidden');}
  function showOverlay(title,copy,button){ui.title.innerHTML=title;ui.copy.textContent=copy;ui.play.querySelector('span').textContent=button;ui.overlay.classList.remove('hidden');}
  function startMatch(){state.blue=0;state.orange=0;state.timer=180;state.running=true;state.paused=false;state.countdown=3;state.kickoff=true;state.goalFreeze=0;state.boost=100;resetRound();updateScore();hideOverlay();ui.pause.setAttribute('aria-label','Pause match');}
  function resetRound(){player.x=0;player.y=20;player.vx=player.vy=0;player.angle=-Math.PI/2;player.z=0;player.trail=[];rival.x=0;rival.y=-20;rival.vx=rival.vy=0;rival.angle=Math.PI/2;rival.trail=[];ball.x=ball.y=ball.vx=ball.vy=ball.z=ball.vz=0;state.boost=100;state.jump=0;state.jumpCooldown=0;pads.forEach(p=>{p.active=true;p.amount=0;});updateBoost();}
  function updateScore(){ui.blue.textContent=state.blue;ui.orange.textContent=state.orange;}
  function updateBoost(){ui.boost.textContent=Math.round(state.boost);ui.fill.style.width=state.boost+'%';ui.fill.style.background=state.boost<20?'linear-gradient(90deg,#ff9c5d,#ffd092)':'';}
  function formatTime(t){let n=Math.ceil(Math.max(0,t));return `${Math.floor(n/60)}:${String(n%60).padStart(2,'0')}`;}
  function beginAudio(){if(!state.audio){try{state.audio=new (window.AudioContext||window.webkitAudioContext)();}catch(e){state.sound=false;}}if(state.audio?.state==='suspended')state.audio.resume();}
  function beep(freq=360,duration=.12,type='sine',volume=.035){if(!state.sound||!state.audio)return;const o=state.audio.createOscillator(),g=state.audio.createGain();o.type=type;o.frequency.value=freq;g.gain.setValueAtTime(volume,state.audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,state.audio.currentTime+duration);o.connect(g);g.connect(state.audio.destination);o.start();o.stop(state.audio.currentTime+duration);}
  function score(team){if(state.goalFreeze>0||!state.running)return;state.goalFreeze=2.1;if(team==='blue')state.blue++;else state.orange++;updateScore();showToast(team==='blue'?'GOAL!':'THEY SCORED',1.8);beep(team==='blue'?720:230,.42,'triangle',.07);canvas.parentElement.classList.remove('shake');void canvas.parentElement.offsetWidth;canvas.parentElement.classList.add('shake');state.particles=[];for(let i=0;i<38;i++){const a=Math.random()*Math.PI*2,v=4+Math.random()*12;state.particles.push({x:ball.x,y:ball.y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,z:Math.random()*6,vz:3+Math.random()*7,life:1.2,color:team==='blue'?'#54e8ff':'#ff9b59'});}}
  function finish(){state.running=false;state.paused=false;const result=state.blue===state.orange?'A DEAD-EVEN<br><em>SHOWDOWN.</em>':state.blue>state.orange?'VICTORY<br><em>IS YOURS.</em>':'NEXT TIME,<br><em>CHAMP.</em>';const copy=state.blue===state.orange?`Final score ${state.blue}–${state.orange}. The rematch is calling.`:`Final score ${state.blue}–${state.orange}. ${state.blue>state.orange?'The Neon Rangers take the win!':'The Ember Rockets take the win!'}`;showOverlay(result,copy,'PLAY AGAIN');}
  function controlInput(){let f=(keys.has('KeyW')||keys.has('ArrowUp')?1:0)-(keys.has('KeyS')||keys.has('ArrowDown')?1:0);let steer=(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0);if(state.touchY||state.touchX){f=state.touchY;steer=state.touchX;}return {f,steer,boost:keys.has('ShiftLeft')||keys.has('ShiftRight')||state.touchBoost,jump:keys.has('Space')};}
  function updateCar(car,dt,input,ai=false){const forwardX=Math.cos(car.angle),forwardY=Math.sin(car.angle);const speed=car.vx*forwardX+car.vy*forwardY;const steering=input.steer||0;const steerPower=clamp(Math.abs(speed)/7,.18,1);car.angle+=steering*steerPower*(speed<0?-1:1)*2.65*dt;
    const fx=Math.cos(car.angle),fy=Math.sin(car.angle);let accel=ai?19:18;if(input.f) {car.vx+=fx*input.f*accel*dt;car.vy+=fy*input.f*accel*dt;}
    if(input.boost&&!ai&&state.boost>0&&input.f>-.1){car.vx+=fx*27*dt;car.vy+=fy*27*dt;state.boost=Math.max(0,state.boost-35*dt);if(Math.random()<dt*19){car.trail.push({x:car.x-fx*1.5,y:car.y-fy*1.5,life:.42});}}
    const max=ai?15.7:(input.boost&&state.boost>0?27:19);let sp=hypot(car.vx,car.vy);if(sp>max){car.vx*=max/sp;car.vy*=max/sp;}
    const side=car.vx*(-fy)+car.vy*fx;car.vx-=(-fy)*side*Math.min(1,7*dt);car.vy-=fx*side*Math.min(1,7*dt);
    const drag=Math.exp(-.58*dt);car.vx*=drag;car.vy*=drag;car.x+=car.vx*dt;car.y+=car.vy*dt;
    const bx=FIELD.x-1.6,by=FIELD.y-1.7;if(car.x < -bx){car.x=-bx;car.vx=Math.abs(car.vx)*.35;}if(car.x>bx){car.x=bx;car.vx=-Math.abs(car.vx)*.35;}if(car.y < -by){car.y=-by;car.vy=Math.abs(car.vy)*.35;}if(car.y>by){car.y=by;car.vy=-Math.abs(car.vy)*.35;}
    car.flash=Math.max(0,car.flash-dt);for(const t of car.trail)t.life-=dt;car.trail=car.trail.filter(t=>t.life>0);
  }
  function updateAI(dt){const dx=ball.x-rival.x,dy=ball.y-rival.y;const d=Math.max(.01,hypot(dx,dy));let tx=ball.x,ty=ball.y+3.1;if(d>5){tx=ball.x+(dx/d)*1.3;ty=ball.y+(dy/d)*1.3+2.5;} // aim to push toward the player's goal
    const desired=Math.atan2(ty-rival.y,tx-rival.x);let diff=Math.atan2(Math.sin(desired-rival.angle),Math.cos(desired-rival.angle));const steer=clamp(diff*1.9,-1,1);let f=Math.abs(diff)>2.35?-.4:1;updateCar(rival,dt,{f,steer,boost:false},true);
  }
  function collideCar(car,dt,playerControlled){const dx=ball.x-car.x,dy=ball.y-car.y,d=hypot(dx,dy),reach=2.35+(ball.z*.12);if(d<reach&&d>.001){const nx=dx/d,ny=dy/d;const approach=(car.vx*nx+car.vy*ny);const power=Math.max(5,Math.abs(approach)*.66+7);ball.x=car.x+nx*reach;ball.y=car.y+ny*reach;ball.vx+=nx*power+car.vx*.25;ball.vy+=ny*power+car.vy*.25;ball.vz=Math.max(ball.vz,playerControlled&&state.jump>.05?4.7:1.1);ball.spin+=power*.16;car.flash=.12;beep(170+Math.random()*70,.07,'sine',.018);}
  }
  function update(dt){state.elapsed+=dt;if(state.toastTimer>0){state.toastTimer-=dt;if(state.toastTimer<=0)ui.toast.classList.remove('show');}
    for(const p of pads){if(!p.active){p.amount+=dt;if(p.amount>5){p.active=true;p.amount=0;}continue;}if(hypot(player.x-p.x,player.y-p.y)<2.05){state.boost=Math.min(100,state.boost+34);p.active=false;p.amount=0;showToast('BOOST +34',.75);beep(620,.15,'sine',.045);}}
    if(!state.running||state.paused)return;
    if(state.goalFreeze>0){state.goalFreeze-=dt;if(state.goalFreeze<=0){resetRound();state.countdown=2.4;state.kickoff=true;}return;}
    if(state.countdown>0){state.countdown-=dt;const n=Math.ceil(state.countdown);ui.status.textContent=n>0?`KICKOFF IN ${n}`:'GO!';if(n===0&&state.kickoff){state.kickoff=false;beep(660,.22,'triangle',.05);showToast('GO!',.7);}return;}
    state.timer-=dt;ui.clock.textContent=formatTime(state.timer);if(state.timer<=0){ui.clock.textContent='0:00';finish();return;}
    const input=controlInput();if(input.boost&&input.f>-.1&&state.boost>0){/* consumed in updateCar */}else if(!input.boost||input.f<=-.1){state.boost=Math.min(100,state.boost+7*dt);}
    if(input.jump&&state.jumpCooldown<=0&&state.jump===0){state.jump=.48;state.jumpCooldown=.9;player.vx+=Math.cos(player.angle)*2.2;player.vy+=Math.sin(player.angle)*2.2;beep(280,.09,'triangle',.02);}if(state.jump>0)state.jump=Math.max(0,state.jump-dt);state.jumpCooldown=Math.max(0,state.jumpCooldown-dt);player.z=state.jump>0?Math.sin((.48-state.jump)/.48*Math.PI)*2.8:0;
    updateCar(player,dt,input);updateAI(dt);collideCar(player,dt,true);collideCar(rival,dt,false);
    ball.vy+=0;ball.x+=ball.vx*dt;ball.y+=ball.vy*dt;ball.z+=ball.vz*dt;if(ball.z<0){ball.z=0;ball.vz*=-.48;if(Math.abs(ball.vz)<1)ball.vz=0;}else ball.vz-=12*dt;
    const bd=Math.exp(-.35*dt);ball.vx*=bd;ball.vy*=bd;ball.spin*=Math.exp(-1.3*dt);
    if(Math.abs(ball.x)>FIELD.x-1.2){ball.x=Math.sign(ball.x)*(FIELD.x-1.2);ball.vx=-ball.vx*.72;beep(210,.06,'sine',.014);}
    if(ball.y < -FIELD.y+1&&Math.abs(ball.x)>FIELD.goal){ball.y=-FIELD.y+1;ball.vy=Math.abs(ball.vy)*.72;}else if(ball.y>FIELD.y-1&&Math.abs(ball.x)>FIELD.goal){ball.y=FIELD.y-1;ball.vy=-Math.abs(ball.vy)*.72;}
    if(ball.y < -FIELD.y-1&&Math.abs(ball.x)<FIELD.goal){score('blue');}if(ball.y>FIELD.y+1&&Math.abs(ball.x)<FIELD.goal){score('orange');}
    for(const p of state.particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;p.vz-=10*dt;p.life-=dt;}state.particles=state.particles.filter(p=>p.life>0);
    updateBoost();ui.status.textContent=input.boost&&state.boost>0?'TURBO BOOST':'LIVE MATCH';
  }

  function roundedRect(c,x,y,w,h,r){c.beginPath();c.roundRect(x,y,w,h,r);}
  function drawField(){const left=px(-FIELD.x),right=px(FIELD.x),top=py(-FIELD.y),bottom=py(FIELD.y);const rx=12;
    // stadium floor and luminous perimeter
    const g=ctx.createLinearGradient(0,top,0,bottom);g.addColorStop(0,'#123b47');g.addColorStop(.5,'#0c343e');g.addColorStop(1,'#153e48');
    roundedRect(ctx,left,top,right-left,bottom-top,rx);ctx.fillStyle=g;ctx.fill();ctx.save();ctx.clip();
    // turf bands
    for(let i=0;i<10;i++){let y=top+(bottom-top)*i/10;ctx.fillStyle=i%2?'#ffffff04':'#00171c0b';ctx.fillRect(left,y,right-left,(bottom-top)/10);}
    // subtle technical grid
    ctx.strokeStyle='#9cf5ff0a';ctx.lineWidth=1;for(let x=-20;x<=20;x+=4){ctx.beginPath();ctx.moveTo(px(x),top);ctx.lineTo(px(x),bottom);ctx.stroke();}for(let y=-32;y<=32;y+=4){ctx.beginPath();ctx.moveTo(left,py(y));ctx.lineTo(right,py(y));ctx.stroke();}
    // halves and center marks
    ctx.strokeStyle='#b9e8e94b';ctx.lineWidth=1.35;ctx.beginPath();ctx.moveTo(left,py(0));ctx.lineTo(right,py(0));ctx.stroke();ctx.beginPath();ctx.ellipse(W/2,H/2,5.3*scale,5.3*sy,0,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.ellipse(W/2,H/2,.7*scale,.7*sy,0,0,Math.PI*2);ctx.fillStyle='#d2f3ee';ctx.fill();
    // penalty boxes
    for(const sign of [-1,1]){const goalY=py(sign*(FIELD.y-2.7));const boxY=py(sign*(FIELD.y-9));const y=Math.min(goalY,boxY);ctx.strokeStyle=sign<0?'#64e4fa87':'#ffad7484';ctx.lineWidth=1.2;ctx.strokeRect(px(-10),y,20*scale,Math.abs(goalY-boxY));ctx.beginPath();ctx.ellipse(W/2,py(sign*(FIELD.y-9)),3.3*scale,3.3*sy,0,sign<0?0:Math.PI,sign<0?Math.PI:Math.PI*2);ctx.stroke();}
    // corner ticks / pads
    for(const p of pads)drawPad(p);
    ctx.restore();ctx.strokeStyle='#b7eff28a';ctx.lineWidth=1.4;roundedRect(ctx,left,top,right-left,bottom-top,rx);ctx.stroke();
    // goals integrated beyond end line
    drawGoal(-1);drawGoal(1);
    // arena pylons
    for(let i=0;i<12;i++){const x=left+(right-left)*i/11;for(const y of [top+3,bottom-3]){ctx.fillStyle=i%2?'#52dcec55':'#f8ffff35';ctx.beginPath();ctx.arc(x,y,1.3,0,Math.PI*2);ctx.fill();}}
  }
  function drawGoal(sign){const gx=px(-FIELD.goal),gw=FIELD.goal*2*scale;const lineY=py(sign*FIELD.y);const deep=sy*4.4;const gy=sign<0?lineY-deep:lineY;const color=sign<0?'#42d9fa':'#ff9b5b';ctx.save();ctx.shadowColor=color;ctx.shadowBlur=14;ctx.fillStyle=sign<0?'#35d9f51f':'#ff8b501f';ctx.fillRect(gx,gy,gw,deep);ctx.strokeStyle=color;ctx.lineWidth=2;ctx.strokeRect(gx,gy,gw,deep);ctx.shadowBlur=0;ctx.strokeStyle=color+'77';ctx.lineWidth=1;for(let i=1;i<5;i++){const xx=gx+gw*i/5;ctx.beginPath();ctx.moveTo(xx,gy);ctx.lineTo(xx,gy+deep);ctx.stroke();}for(let i=1;i<3;i++){const yy=gy+deep*i/3;ctx.beginPath();ctx.moveTo(gx,yy);ctx.lineTo(gx+gw,yy);ctx.stroke();}ctx.restore();}
  function drawPad(p){const x=px(p.x),y=py(p.y),r=5.5;if(p.active){ctx.save();ctx.shadowColor='#69f2ff';ctx.shadowBlur=13;ctx.fillStyle='#44dff185';ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#c1fbff';ctx.lineWidth=1.3;ctx.beginPath();ctx.arc(x,y,r*.58,0,Math.PI*2);ctx.stroke();ctx.restore();}else{ctx.fillStyle='#07191d99';ctx.beginPath();ctx.arc(x,y,3.4,0,Math.PI*2);ctx.fill();}}
  function drawCar(car){const x=px(car.x),y=py(car.y),color=car.team==='blue'?'#45daf3':'#ff9859',dark=car.team==='blue'?'#147b9e':'#a34b29';for(const t of car.trail){ctx.globalAlpha=clamp(t.life/.42,0,1)*.4;ctx.fillStyle=color;ctx.beginPath();ctx.arc(px(t.x),py(t.y),2.3*scale,0,Math.PI*2);ctx.fill();}ctx.globalAlpha=1;
    ctx.save();ctx.translate(x,y-car.z*scale*.72);ctx.rotate(car.angle+Math.PI/2);const w=2.4*scale,h=3.9*sy;
    // shadow
    ctx.save();ctx.rotate(-(car.angle+Math.PI/2));ctx.fillStyle='#03111677';ctx.beginPath();ctx.ellipse(0,3*sy,w*.75,h*.58,0,0,Math.PI*2);ctx.fill();ctx.restore();
    // wheels
    ctx.fillStyle='#10171c';for(const wx of [-w*.52,w*.52])for(const wy of [-h*.28,h*.28]){roundedRect(ctx,wx-w*.15,wy-h*.12,w*.3,h*.24,2);ctx.fill();}
    // car body
    ctx.shadowColor=color;ctx.shadowBlur=car.flash?22:9;ctx.fillStyle=dark;ctx.beginPath();ctx.moveTo(0,-h*.61);ctx.quadraticCurveTo(w*.68,-h*.48,w*.55,-h*.1);ctx.lineTo(w*.48,h*.42);ctx.quadraticCurveTo(w*.4,h*.58,0,h*.53);ctx.quadraticCurveTo(-w*.4,h*.58,-w*.48,h*.42);ctx.lineTo(-w*.55,-h*.1);ctx.quadraticCurveTo(-w*.68,-h*.48,0,-h*.61);ctx.fill();ctx.shadowBlur=0;
    const body=ctx.createLinearGradient(-w/2,-h/2,w/2,h/2);body.addColorStop(0,color);body.addColorStop(.55,car.team==='blue'?'#168ab0':'#cf602e');body.addColorStop(1,car.team==='blue'?'#14516e':'#803c29');ctx.fillStyle=body;ctx.beginPath();ctx.moveTo(0,-h*.55);ctx.quadraticCurveTo(w*.55,-h*.43,w*.46,-h*.1);ctx.lineTo(w*.4,h*.39);ctx.quadraticCurveTo(0,h*.62,-w*.4,h*.39);ctx.lineTo(-w*.46,-h*.1);ctx.quadraticCurveTo(-w*.55,-h*.43,0,-h*.55);ctx.fill();
    // windshield and roof detail
    ctx.fillStyle='#0a2631';ctx.beginPath();ctx.moveTo(-w*.31,-h*.23);ctx.quadraticCurveTo(0,-h*.33,w*.31,-h*.23);ctx.lineTo(w*.26,h*.09);ctx.quadraticCurveTo(0,h*.16,-w*.26,h*.09);ctx.closePath();ctx.fill();ctx.fillStyle='#d8fbff8a';ctx.fillRect(-w*.25,-h*.18,w*.5,.8);ctx.fillStyle='#f6ffff';ctx.fillRect(-w*.34,h*.36,w*.18,1.6);ctx.fillRect(w*.16,h*.36,w*.18,1.6);
    // team stripe
    ctx.strokeStyle='#ffffffaa';ctx.lineWidth=1.4;ctx.beginPath();ctx.moveTo(0,-h*.48);ctx.lineTo(0,-h*.29);ctx.stroke();ctx.restore();
    ctx.save();ctx.font=`700 ${Math.max(8,scale*1.05)}px DM Sans`;ctx.textAlign='center';ctx.fillStyle='#e7f8fb';ctx.shadowColor='#001116';ctx.shadowBlur=4;ctx.fillText(car.team==='blue'?'YOU':'CPU',x,y+3.25*sy-car.z*scale*.72);ctx.restore();}
  function drawBall(){const x=px(ball.x),y=py(ball.y),r=Math.max(6,scale*1.13),lift=ball.z*scale*.7;ctx.fillStyle='#04151b77';ctx.beginPath();ctx.ellipse(x,y+3*sy,r*1.25,r*.65,0,0,Math.PI*2);ctx.fill();ctx.save();ctx.translate(x,y-lift);ctx.shadowColor='#e9ffff';ctx.shadowBlur=13;const g=ctx.createRadialGradient(x-r*.35,y-r*.45-lift,r*.1,x,y-lift,r);g.addColorStop(0,'#ffffff');g.addColorStop(.45,'#e1f3eb');g.addColorStop(1,'#879ca0');ctx.fillStyle=g;ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;ctx.strokeStyle='#304851';ctx.lineWidth=1;ctx.beginPath();for(let i=0;i<5;i++){const a=ball.spin+i*Math.PI*2/5;ctx.moveTo(Math.cos(a)*r*.28,Math.sin(a)*r*.28);ctx.lineTo(Math.cos(a+.48)*r*.85,Math.sin(a+.48)*r*.85);}ctx.stroke();ctx.fillStyle='#324a4f';ctx.beginPath();ctx.arc(0,0,r*.17,0,Math.PI*2);ctx.fill();ctx.restore();}
  function drawBackground(){ctx.fillStyle='#08232c';ctx.fillRect(0,0,W,H);const glow=ctx.createRadialGradient(W/2,H/2,Math.min(W,H)*.2,W/2,H/2,Math.max(W,H)*.7);glow.addColorStop(0,'#103b43');glow.addColorStop(1,'#061820');ctx.fillStyle=glow;ctx.fillRect(0,0,W,H);const l=px(-FIELD.x),r=px(FIELD.x),t=py(-FIELD.y),b=py(FIELD.y); // stands and crowd
    for(let side=0;side<2;side++){const y=side===0?t-12:b+12;for(let i=0;i<75;i++){const x=l+((i*37)%Math.max(1,r-l));ctx.fillStyle=['#7dddf326','#ffd09c24','#e7f5eb25','#43d0e322'][i%4];ctx.fillRect(x,y+(i%3)*3,2,2);}}
    ctx.strokeStyle='#58ddeb14';ctx.lineWidth=1;for(let i=0;i<8;i++){const yy=t-17+i*2;ctx.beginPath();ctx.moveTo(l-10,yy);ctx.lineTo(r+10,yy);ctx.stroke();ctx.beginPath();ctx.moveTo(l-10,b+4+i*2);ctx.lineTo(r+10,b+4+i*2);ctx.stroke();}}
  function render(){ctx.clearRect(0,0,W,H);drawBackground();drawField();for(const p of state.particles){ctx.globalAlpha=clamp(p.life,0,1);ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(px(p.x),py(p.y)-p.z*scale,2.4,0,Math.PI*2);ctx.fill();}ctx.globalAlpha=1;drawCar(rival);drawCar(player);drawBall();if(state.running&&!state.paused&&state.countdown>0){ctx.fillStyle='#06141c88';ctx.fillRect(0,0,W,H);ctx.font=`900 ${Math.min(90,W*.13)}px 'Barlow Condensed',sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#f2feff';ctx.shadowColor='#4edff5';ctx.shadowBlur=25;ctx.fillText(Math.ceil(state.countdown)>0?Math.ceil(state.countdown):'GO',W/2,H/2);ctx.shadowBlur=0;}}
  function frame(now){const dt=Math.min(.033,(now-(state.last||now))/1000);state.last=now;update(dt);render();requestAnimationFrame(frame);}requestAnimationFrame(frame);

  ui.play.addEventListener('click',()=>{beginAudio();if(state.running&&state.paused){state.paused=false;hideOverlay();ui.pause.setAttribute('aria-label','Pause match');return;}startMatch();});
  function togglePause(){if(!state.running)return;state.paused=!state.paused;if(state.paused){showOverlay('TAKE A<br><em>BREATHER.</em>','Your match is paused. Jump back in when you are ready.','RESUME MATCH');ui.pause.setAttribute('aria-label','Resume match');}else{hideOverlay();ui.pause.setAttribute('aria-label','Pause match');}}
  ui.pause.addEventListener('click',togglePause);
  ui.sound.addEventListener('click',()=>{state.sound=!state.sound;ui.sound.classList.toggle('muted',!state.sound);if(state.sound){beginAudio();beep(500,.1);} });
  window.addEventListener('keydown',e=>{if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();keys.add(e.code);if(e.code==='KeyP'&&!e.repeat)togglePause();if(e.code==='Escape'&&!e.repeat&&state.running)togglePause();},{passive:false});window.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',()=>keys.clear());
  // Touch steering pad for tablets and phones.
  const pad=$('touchPad'),knob=$('touchKnob');let pointer=null;function touchMove(e){if(pointer!==e.pointerId)return;const r=pad.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2;const dx=e.clientX-cx,dy=e.clientY-cy,max=34,len=Math.min(max,hypot(dx,dy));const nx=dx/(hypot(dx,dy)||1),ny=dy/(hypot(dx,dy)||1);knob.style.transform=`translate(${nx*len}px,${ny*len}px)`;state.touchX=clamp(dx/max,-1,1);state.touchY=clamp(-dy/max,-1,1);}
  pad.addEventListener('pointerdown',e=>{pointer=e.pointerId;pad.setPointerCapture(pointer);touchMove(e);});pad.addEventListener('pointermove',touchMove);function touchEnd(){pointer=null;state.touchX=state.touchY=0;knob.style.transform='';}pad.addEventListener('pointerup',touchEnd);pad.addEventListener('pointercancel',touchEnd);const tb=$('touchBoost');tb.addEventListener('pointerdown',e=>{e.preventDefault();state.touchBoost=true;});['pointerup','pointercancel','pointerleave'].forEach(n=>tb.addEventListener(n,()=>state.touchBoost=false));
  ui.clock.textContent=formatTime(state.timer);updateBoost();
})();
