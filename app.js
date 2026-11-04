(() => {
  const $ = id => document.getElementById(id);
  const canvas = $('scene');
  const screen = canvas.getContext('2d', {alpha:false});
  const controls = Object.fromEntries(['density','pointSize','opacity','depth','colorMode','customColor','scenario','speed','amplitude','duration','scatterPower','floatPower','wind','orbit','pulse','wave','turbulence','scan','magnet','zoom','markerCount','links','frame','format','fps'].map(id=>[id,$(id)]));
  const state = {source:'sphere',points:[],yaw:0,pitch:0,time:0,playing:true,last:performance.now(),busy:false,seed:19};
  const TAU = Math.PI*2;
  const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
  const number=id=>Number(controls[id].value);
  const mix=(a,b,t)=>a+(b-a)*t;
  const smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t)};
  const noise=n=>{const s=Math.sin(n*127.1+state.seed*3.7)*43758.5453;return s-Math.floor(s)};

  function makeSphere(){
    const count=Math.round(number('density')*190);
    const points=[];
    for(let i=0;i<count;i++){
      const v=1-2*(i+.5)/count;
      const radius=Math.sqrt(1-v*v);
      const angle=i*2.399963229728653;
      const x=Math.cos(angle)*radius,y=v,z=Math.sin(angle)*radius;
      const light=clamp(.58+.32*(-x+y*.5+z),.25,1);
      points.push({x:x*150,y:y*150,z:z*150,color:[Math.round(155*light),Math.round(95*light),Math.round(245*light)],seed:i});
    }
    state.points=points;
  }

  function pointsFromImage(image,isText=false){
    const off=document.createElement('canvas');off.width=520;off.height=260;
    const c=off.getContext('2d',{willReadFrequently:true});c.clearRect(0,0,520,260);
    const scale=Math.min(480/image.width,220/image.height);
    const w=image.width*scale,h=image.height*scale;
    c.drawImage(image,(520-w)/2,(260-h)/2,w,h);
    const pixels=c.getImageData(0,0,520,260).data;
    const step=isText?clamp(Math.round(5-number('density')/45),2,4):clamp(Math.round(12-number('density')/18),3,10);
    const points=[];
    for(let y=2;y<258;y+=step)for(let x=2;x<518;x+=step){
      const p=(y*520+x)*4,alpha=pixels[p+3];
      if(alpha<75)continue;
      const r=pixels[p],g=pixels[p+1],b=pixels[p+2],bright=(r+g+b)/3;
      if(isText&&bright<45)continue;
      const jitter=(noise(x*1000+y)-.5)*step*.55;
      const spread=isText?1.15:.62;
      points.push({x:(x-260)*spread+jitter,y:(130-y)*spread,z:(bright/255-.5)*40, color:[r,g,b],seed:y*520+x});
    }
    state.points=points;
  }

  function makeText(value){
    const off=document.createElement('canvas');off.width=1200;off.height=450;
    const c=off.getContext('2d');c.font='800 220px Manrope, sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillStyle='#fff';
    c.fillText(value||phrase('defaultText'),600,225,1120);
    pointsFromImage(off,true);
  }

  async function loadImage(file){
    if(!file||!file.type.startsWith('image/'))return;
    try{
      const image=await createImageBitmap(file);
      state.source='image';setSourceButtons();pointsFromImage(image);image.close();
    }catch{setStatus(phrase('imageError'))}
  }

  function setSourceButtons(){document.querySelectorAll('[data-source]').forEach(button=>button.classList.toggle('selected',button.dataset.source===state.source));$('sourceSelect').value=state.source;document.body.dataset.source=state.source;$('textRow').hidden=state.source!=='text'}
  $('sourceSelect').addEventListener('change',e=>{const source=e.target.value;if(source==='image'){$('imageInput').click();e.target.value=state.source;return}state.source=source;setSourceButtons();if(source==='sphere')makeSphere();else makeText(source==='brand'?'GEORGRAD':$('textInput').value.trim())});
  document.querySelectorAll('[data-source]').forEach(button=>button.addEventListener('click',()=>{
    state.source=button.dataset.source;setSourceButtons();
    if(state.source==='sphere')makeSphere();
    else makeText(state.source==='brand'?'GEORGRAD':$('textInput').value.trim());
  }));
  $('imageInput').addEventListener('change',e=>loadImage(e.target.files[0]));
  let textTimer;
  $('textInput').addEventListener('input',()=>{clearTimeout(textTimer);textTimer=setTimeout(()=>{if(state.source==='text')makeText($('textInput').value.trim())},170)});
  controls.density.addEventListener('change',()=>{if(state.source==='sphere')makeSphere();else if(state.source==='brand')makeText('GEORGRAD');else if(state.source==='text')makeText($('textInput').value.trim())});

  function scatterAmount(t){
    const phase=t/number('duration');const power=number('scatterPower');
    switch(controls.scenario.value){
      case 'assemble':return power*(1-smooth(phase));
      case 'scatter':return power*smooth(phase);
      case 'cycle':return power*(phase<.5?1-smooth(phase*2):smooth((phase-.5)*2));
      default:return 0;
    }
  }
  function project(point,t,width,height){
    const phase=t/number('duration')*TAU*number('speed'),seed=point.seed;
    const still=controls.scenario.value==='still';
    const f=still?0:number('floatPower');
    let x=point.x+Math.sin(phase+seed*.013)*f*7;
    let y=point.y+Math.cos(phase+seed*.009)*f*7;
    let z=point.z*number('depth');
    const scatter=scatterAmount(t);
    x+=(noise(seed+2)-.5)*scatter*310;
    y+=(noise(seed+9)-.5)*scatter*310;
    z+=(noise(seed+33)-.5)*scatter*190;
    x+=Math.sin(phase+y*.01)*number('wind')*12;
    if(controls.pulse.checked){const k=1+.08*Math.sin(phase*3+Math.hypot(x,y)*.026);x*=k;y*=k;z*=k}
    if(controls.scenario.value==='wave'){const w=Math.sin(y*.024+x*.01-phase*2);z+=w*38*number('amplitude');x+=w*5*number('amplitude')}
    if(controls.wave.checked)z+=18*Math.sin(Math.hypot(x,y)*.05-phase*3);
    if(controls.turbulence.checked){x+=Math.sin(y*.04+phase*2+seed*.01)*10;y+=Math.cos(x*.04-phase*2)*10}
    if(controls.magnet.checked){const mx=Math.sin(phase)*95,my=Math.cos(phase*2)*65;const dx=x-mx,dy=y-my,d=Math.hypot(dx,dy);if(d<85){const k=(1-d/85)*25;x+=dx/(d||1)*k;y+=dy/(d||1)*k}}
    const orbit=still?0:Math.sin(phase)*number('orbit')*.55;
    const cy=Math.cos(state.yaw+orbit),sy=Math.sin(state.yaw+orbit);
    const cx=Math.cos(state.pitch),sx=Math.sin(state.pitch);
    const rx=x*cy+z*sy,rz=z*cy-x*sy;
    const ry=y*cx-rz*sx,depth=y*sx+rz*cx;
    const scale=Math.min(width/520,height/350)*number('zoom')*410/(410-depth);
    return {x:width/2+rx*scale,y:height/2-ry*scale,z:depth,scale};
  }

  function paint(target,t){
    const ctx=target.getContext('2d',{alpha:false});
    const width=target.width,height=target.height;
    ctx.fillStyle='#05020b';ctx.fillRect(0,0,width,height);
    const glow=ctx.createRadialGradient(width/2,height/2,0,width/2,height/2,Math.max(width,height)*.47);
    glow.addColorStop(0,'rgba(71,30,120,.2)');glow.addColorStop(1,'rgba(4,2,10,0)');ctx.fillStyle=glow;ctx.fillRect(0,0,width,height);
    const size=number('pointSize')*Math.min(width/650,height/450);
    const mode=controls.colorMode.value;
    const custom=controls.customColor.value;const customRgb=[1,3,5].map(i=>parseInt(custom.slice(i,i+2),16));
    const scanY=height*(t/number('duration'));
    const markers=[];
    for(let i=0;i<state.points.length;i++){
      const point=state.points[i];const p=project(point,t,width,height);
      if(p.x<0||p.x>width||p.y<0||p.y>height)continue;
      if(controls.scan.checked&&Math.abs(p.y-scanY)>height*.055)continue;
      let color;
      if(mode==='original')color=point.color;
      else if(mode==='white')color=[238,230,255];
      else if(mode==='cyan')color=[80,229,242];
      else if(mode==='custom')color=customRgb;
      else color=[154,77,255];
      const alpha=clamp(.65+(p.z+160)/600,.45,1)*number('opacity');
      ctx.fillStyle=`rgba(${color[0]},${color[1]},${color[2]},${alpha})`;
      const radius=Math.max(.5,size*clamp(p.scale,.65,1.6));
      ctx.fillRect(p.x-radius/2,p.y-radius/2,radius,radius);
      if(markers.length<number('markerCount')&&i%Math.max(1,Math.floor(state.points.length/Math.max(1,number('markerCount'))))===0)markers.push(p);
    }
    if(markers.length){
      ctx.strokeStyle='rgba(194,151,255,.48)';ctx.lineWidth=Math.max(1,width/1100);
      if(controls.links.checked){ctx.beginPath();markers.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.stroke()}
      markers.forEach((p,i)=>{ctx.strokeStyle='rgba(221,191,255,.85)';ctx.strokeRect(p.x-5,p.y-5,10,10);ctx.fillStyle='rgba(238,221,255,.8)';ctx.font=`${Math.max(8,width/130)}px Manrope`;ctx.fillText(String(i+1).padStart(2,'0'),p.x+9,p.y-6)})
    }
    if(controls.frame.checked){const m=Math.min(width,height)*.035,L=m*.75;ctx.strokeStyle='rgba(177,143,218,.55)';ctx.lineWidth=Math.max(1,width/1100);ctx.beginPath();for(const [x,y,dx,dy] of [[m,m,1,1],[width-m,m,-1,1],[m,height-m,1,-1],[width-m,height-m,-1,-1]]){ctx.moveTo(x,y+dy*L);ctx.lineTo(x,y);ctx.lineTo(x+dx*L,y)}ctx.stroke();ctx.fillStyle='rgba(196,163,229,.8)';ctx.font=`${Math.max(9,width/120)}px Manrope`;ctx.fillText(`GEORGRAD  ·  ${state.points.length.toLocaleString()} PTS`,m,height-m-8)}
  }

  function resize(){const rect=canvas.getBoundingClientRect();const ratio=Math.min(2,devicePixelRatio||1);const w=Math.max(1,Math.round(rect.width*ratio)),h=Math.max(1,Math.round(rect.height*ratio));if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h}}
  new ResizeObserver(resize).observe(canvas);resize();
  function showTime(){const duration=number('duration');const time=Math.floor(state.time);$('clock').textContent=`0:${String(time).padStart(2,'0')} / 0:${String(Math.floor(duration)).padStart(2,'0')}`;$('timeline').value=Math.round(state.time/duration*1000)}
  function tick(now){if(!state.busy){if(state.playing)state.time=(state.time+Math.min(.08,(now-state.last)/1000))%number('duration');resize();paint(canvas,state.time);showTime()}state.last=now;requestAnimationFrame(tick)}
  requestAnimationFrame(tick);
  $('play').addEventListener('click',()=>{state.playing=!state.playing;updatePlay()});
  function updatePlay(){$('play').textContent=state.playing?'Ⅱ':'▶';$('play').setAttribute('aria-label',phrase(state.playing?'pause':'play'))}
  $('timeline').addEventListener('input',e=>{state.time=Number(e.target.value)/1000*number('duration');state.playing=false;updatePlay()});
  $('resetView').addEventListener('click',()=>{state.yaw=0;state.pitch=0;controls.zoom.value='1';updateOutput(controls.zoom)});
  document.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>{const views={front:[0,0],left:[-.7,0],right:[.7,0],top:[0,-.55]};[state.yaw,state.pitch]=views[button.dataset.view]}));
  let pointer=null;
  canvas.addEventListener('pointerdown',e=>{pointer={x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId)});
  canvas.addEventListener('pointermove',e=>{if(!pointer)return;state.yaw=clamp(state.yaw+(e.clientX-pointer.x)*.007,-1.5,1.5);state.pitch=clamp(state.pitch+(e.clientY-pointer.y)*.007,-.9,.9);pointer={x:e.clientX,y:e.clientY}});
  canvas.addEventListener('pointerup',()=>pointer=null);
  canvas.addEventListener('dblclick',()=>{state.yaw=0;state.pitch=0});

  function updateOutput(input){const out=document.querySelector(`output[for="${input.id}"]`);if(!out)return;const n=Number(input.value);out.textContent=input.id==='duration'?`${n} ${currentLanguage==='ru'?'с':'s'}`:input.id==='zoom'?`${n.toFixed(2)}×`:['pointSize','depth','scatterPower','floatPower','wind','orbit','opacity','speed','amplitude'].includes(input.id)?n.toFixed(['pointSize','depth','wind'].includes(input.id)?1:2):String(n)}
  document.querySelectorAll('input[type="range"]').forEach(input=>{if(input.id!=='timeline'){input.addEventListener('input',()=>updateOutput(input));updateOutput(input)}});
  document.addEventListener('georgrad:language',()=>{updatePlay();document.querySelectorAll('input[type="range"]').forEach(updateOutput);updateThemeButton()});

  let theme='dark';try{theme=localStorage.getItem('georgrad-theme')==='light'?'light':'dark'}catch{}
  function updateThemeButton(){document.documentElement.dataset.theme=theme;$('themeText').textContent=phrase(theme==='dark'?'lightTheme':'darkTheme');$('theme').setAttribute('aria-label',phrase(theme==='dark'?'lightTheme':'darkTheme'))}
  controls.customColor.addEventListener('input',()=>{$('colorHex').value=controls.customColor.value.toUpperCase();controls.colorMode.value='custom'});
  $('colorHex').addEventListener('change',e=>{const value=e.target.value.trim();if(/^#[0-9a-f]{6}$/i.test(value)){controls.customColor.value=value;controls.colorMode.value='custom'}e.target.value=controls.customColor.value.toUpperCase()});
  for(const id of ['depth','duration','scatterPower','floatPower','wind','orbit'])$('advancedBody').append(controls[id].closest('.control'));
  $('theme').addEventListener('click',()=>{theme=theme==='dark'?'light':'dark';try{localStorage.setItem('georgrad-theme',theme)}catch{}updateThemeButton()});updateThemeButton();

  function setStatus(text){$('status').textContent=text}
  function setProgress(value){$('progress').style.width=`${Math.round(value*100)}%`}
  function download(blob,extension){const old=$('downloadFallback').href;if(old?.startsWith('blob:'))URL.revokeObjectURL(old);const url=URL.createObjectURL(blob),name=`georgrad-point-field.${extension}`;const link=$('downloadFallback');link.href=url;link.download=name;link.hidden=false;const a=document.createElement('a');a.href=url;a.download=name;a.click()}
  const pause=()=>new Promise(resolve=>setTimeout(resolve,0));
  async function mp4(width,height,fps,frames){
    if(!window.VideoEncoder||!window.Mp4Muxer)throw Error(phrase('noVideo'));
    const codec=['avc1.42003e','avc1.4d0033','avc1.640033'];let config;
    for(const candidate of codec){const test={codec:candidate,width,height,bitrate:10000000,framerate:fps,avc:{format:'avc'}};try{if((await VideoEncoder.isConfigSupported(test)).supported){config=test;break}}catch{}}
    if(!config)throw Error(phrase('noVideo'));
    const target=new Mp4Muxer.ArrayBufferTarget();const muxer=new Mp4Muxer.Muxer({target,video:{codec:'avc',width,height,frameRate:fps},fastStart:'in-memory'});
    let failure;const encoder=new VideoEncoder({output:(chunk,meta)=>muxer.addVideoChunk(chunk,meta),error:error=>failure=error});encoder.configure(config);
    const output=document.createElement('canvas');output.width=width;output.height=height;
    for(let i=0;i<frames;i++){
      if(failure)throw failure;
      paint(output,i/fps);
      const frame=new VideoFrame(output,{timestamp:Math.round(i*1000000/fps)});encoder.encode(frame,{keyFrame:i%(fps*2)===0});frame.close();
      if(encoder.encodeQueueSize>8)await encoder.flush();
      if(i%3===0){setProgress(i/frames);setStatus(phrase('rendering',{current:i+1,total:frames}));await pause()}
    }
    await encoder.flush();encoder.close();muxer.finalize();return new Blob([target.buffer],{type:'video/mp4'});
  }
  async function gif(width,height,fps,frames){
    const {GIFEncoder,quantize,applyPalette}=await import('./vendor/gifenc.esm.js');
    const encoder=GIFEncoder(),output=document.createElement('canvas');output.width=width;output.height=height;
    const c=output.getContext('2d',{willReadFrequently:true});
    for(let i=0;i<frames;i++){
      paint(output,i/fps);const rgba=c.getImageData(0,0,width,height).data;const palette=quantize(rgba,256);encoder.writeFrame(applyPalette(rgba,palette),width,height,{palette,delay:Math.round(1000/fps)});
      if(i%2===0){setProgress(i/frames);setStatus(phrase('gifRendering',{current:i+1,total:frames}));await pause()}
    }
    encoder.finish();return new Blob([encoder.bytes()],{type:'image/gif'});
  }
  async function exportFile(kind){
    if(state.busy)return;state.busy=true;$('exportVideo').disabled=$('exportGif').disabled=true;setProgress(0);$('downloadFallback').hidden=true;
    try{
      const [baseW,baseH]=controls.format.value.split('x').map(Number),duration=number('duration');
      let blob;
      if(kind==='gif'){const width=480,height=Math.round(width*baseH/baseW/2)*2,fps=15;blob=await gif(width,height,fps,Math.round(duration*fps))}
      else blob=await mp4(baseW,baseH,number('fps'),Math.round(duration*number('fps')));
      download(blob,kind);setProgress(1);setStatus(phrase('done'));
    }catch(error){setStatus(phrase('failed',{message:error?.message||String(error)}))}
    finally{state.busy=false;$('exportVideo').disabled=$('exportGif').disabled=false}
  }
  $('exportVideo').addEventListener('click',()=>exportFile('mp4'));
  $('exportGif').addEventListener('click',()=>exportFile('gif'));

  makeSphere();setSourceButtons();updatePlay();
})();
