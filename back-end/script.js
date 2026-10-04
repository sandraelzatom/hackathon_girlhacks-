const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const LS=(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d}catch{return d}},SV=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
let me=null, S=null, quiz=[], qi=0, combo=0, cur=null;
const seed=[{id:1,author:'Anonymous Owl',content:'Your hard work tonight will blossom into clarity tomorrow.',likes:18,x:48,y:18},
{id:2,author:'Moon Fox',content:'Breathe. You are far more prepared than your anxiety tells you.',likes:9,x:25,y:30},
{id:3,author:'Archmage Spirit',content:'May the winds of wisdom guide your pen tomorrow!',likes:12,x:72,y:28},
{id:4,author:'Fern Sprite',content:'Rest well tonight, you are doing amazing.',likes:5,x:38,y:50},
{id:5,author:'Star Moth',content:'Hang in there! You will crush your finals!',likes:21,x:62,y:48}];
const SAMPLE="The thalamus routes sensory signals to the cerebral cortex. Neuroplasticity is the brain's ability to reorganize in response to learning. The hippocampus is essential for forming new memories. Photosynthesis converts sunlight into chemical energy inside chloroplasts. Mitochondria produce most of the cell's ATP.";

/* fireflies */
const cv=$('#fireflies'),cx=cv.getContext('2d');let F=[];
function rs(){cv.width=innerWidth;cv.height=innerHeight}rs();onresize=rs;
for(let i=0;i<90;i++)F.push({x:Math.random()*innerWidth,y:Math.random()*innerHeight,r:Math.random()*2.5+1,a:Math.random()*6,s:Math.random()*.5+.2});
(function loop(){cx.clearRect(0,0,cv.width,cv.height);F.forEach(f=>{f.a+=.02;f.x+=Math.cos(f.a)*f.s;f.y+=Math.sin(f.a*.8)*f.s-.15;if(f.y<-9)f.y=cv.height+9;
const g=cx.createRadialGradient(f.x,f.y,0,f.x,f.y,f.r*7);const o=.5+.5*Math.sin(f.a*3);g.addColorStop(0,`rgba(200,255,150,${o})`);g.addColorStop(1,'transparent');cx.fillStyle=g;cx.beginPath();cx.arc(f.x,f.y,f.r*7,0,7);cx.fill()});requestAnimationFrame(loop)})();

/* auth (demo, stored in browser) */
const hash=s=>btoa(unescape(encodeURIComponent(s)));
const PASS='hackit26';
$('#loginForm').onsubmit=e=>{e.preventDefault();const n=$('#name').value.trim();
if($('#pass').value!==PASS){$('#err').textContent='Wrong secret rune. Try again.';return}$('#err').textContent='';me=n;boot()};
$('#logout').onclick=()=>{localStorage.removeItem('session');me=null;boot()};

function boot(){
 const logged=!!me;$('#nav').classList.toggle('hidden',!logged);
 if(!logged){go('login');showLogin();return}
 S=LS('state_'+me,{dew:0,mast:0,bless:0});$('#user').textContent='🧙 '+me;upd();go('trials');renderTree();
}
function showLogin(){const b=$('#cont');if(me){b.textContent='Continue as '+me+' ✦';b.classList.remove('hidden');b.onclick=boot}else b.classList.add('hidden')}
function go(id){$$('.page').forEach(p=>p.classList.toggle('active',p.id===id));$$('#nav a').forEach(a=>a.classList.toggle('on',a.dataset.go===id));if(id==='awaken')upd();scrollTo(0,0)}
$$('#nav a').forEach(a=>a.onclick=()=>go(a.dataset.go));
function save(){SV('state_'+me,S);upd();S.ms=S.ms||[];
 [[100,'dew','✨ 100 Starlight Dew: the Dewdrop Seeker'],[300,'dew','🌙 300 Dew: the Moonlight Keeper'],[600,'dew','🔮 600 Dew: the Rune Weaver'],[1000,'dew','🌟 1000 Dew: the Grove Archmage'],[1500,'dew','👑 1500 Dew: Guardian of the Enchanted Forest'],
 [1,'mast','📜 First concept mastered!'],[3,'mast','🧠 3 concepts mastered: Apprentice Sage'],[5,'mast','🦉 5 concepts: Wise Owl'],[10,'mast','🐉 10 concepts: Dragon Scholar']].forEach(([v,k,t])=>{if(S[k]>=v&&!S.ms.includes(k+v)){S.ms.push(k+v);SV('state_'+me,S);setTimeout(()=>celebrate('🎉 MILESTONE · '+t,40),400)}})}
function celebrate(t,n){const el=$('#toast');el.textContent=t;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),4500);chime();
 for(let i=0;i<n;i++)setTimeout(()=>{const l=document.createElement('i');l.className='leaf big';l.textContent=['⭐','🌟','✨','💫'][i%4];l.style.left=Math.random()*100+'vw';l.style.animationDuration=3+Math.random()*3+'s';document.body.append(l);setTimeout(()=>l.remove(),7000)},i*70)}
function chime(){if(!AC||paused)return;[0,4,7,12,16].forEach((s,i)=>{const o=AC.createOscillator(),g=AC.createGain(),t=AC.currentTime+i*.12;o.frequency.value=523*Math.pow(2,s/12);g.gain.setValueAtTime(.001,t);g.gain.linearRampToValueAtTime(.15,t+.03);g.gain.exponentialRampToValueAtTime(.001,t+1.6);o.connect(g);g.connect(MG);g.connect(RV);o.start(t);o.stop(t+1.7)})}
function upd(){if(!S)return;$('#dew').textContent='✨ '+S.dew;$('#sDew').textContent=S.dew;$('#sMast').textContent=S.mast;$('#sBless').textContent=S.bless;
 const p=Math.min(1,S.dew/1500);$('#bar').style.width=p*100+'%';document.documentElement.style.setProperty('--clear',p);
 $('#stage').textContent=p<.2?'Thick mist still clings to the grove…':p<.6?'The fog is retreating. Whisper Glade stirs.':p<1?'Light floods the clearing…':'The Forest is fully awake. 🌟'}

/* quiz generator (local "magic"; swap in Gemini here if you have an API key) */
function makeQuiz(t){
 const sents=t.split(/(?<=[.!?])\s+/).filter(s=>s.split(' ').length>5);
 const pool=[...new Set(t.match(/\b[A-Za-z]{6,}\b/g)||[])];
 return sents.slice(0,8).map(s=>{const w=s.match(/\b[A-Za-z]{6,}\b/g)||[];const ans=w.sort((a,b)=>b.length-a.length)[0];
  if(!ans)return null;const d=pool.filter(x=>x.toLowerCase()!==ans.toLowerCase()).sort(()=>Math.random()-.5).slice(0,3);
  const o=[ans,...d].sort(()=>Math.random()-.5);return{q:s.replace(ans,'✦ ? ✦'),o,a:o.indexOf(ans),e:s}}).filter(x=>x&&x.o.length>=3)}
$('#demo').onclick=()=>{$('#notes').value=SAMPLE};
$('#gen').onclick=()=>{quiz=makeQuiz($('#notes').value);if(quiz.length<2){alert('Add a few more full sentences of notes.');return}qi=0;combo=0;$('#setup').classList.add('hidden');$('#quiz').classList.remove('hidden');ask()};
function ask(){const q=quiz[qi];$('#qn').textContent=`Trial ${qi+1}/${quiz.length}`;$('#combo').textContent=combo>1?`🔥 Combo x${combo}`:'';$('#q').textContent=q.q;$('#fb').textContent='';$('#next').classList.add('hidden');
 $('#opts').innerHTML='';q.o.forEach((t,i)=>{const b=document.createElement('button');b.textContent=t;b.onclick=()=>pick(i,b);$('#opts').append(b)})}
function pick(i,b){const q=quiz[qi];$$('#opts button').forEach(x=>x.disabled=true);
 if(i===q.a){combo++;const gain=100*Math.max(1,combo);S.dew+=gain;S.mast++;b.classList.add('ok');$('#fb').textContent=`✨ Light burst! +${gain} Starlight Dew`;burst(b)}
 else{combo=0;b.classList.add('no');$$('#opts button')[q.a].classList.add('ok');$('#fb').textContent='🌫 Into the Mist Forest: '+q.e;quiz.push({...q})}
 save();$('#next').classList.remove('hidden')}
$('#next').onclick=()=>{qi++;if(qi>=quiz.length){$('#quiz').classList.add('hidden');$('#setup').classList.remove('hidden');go('awaken')}else ask()};
function burst(el){const r=el.getBoundingClientRect();for(let i=0;i<24;i++)F.push({x:r.left+r.width/2,y:r.top,r:3,a:Math.random()*6,s:Math.random()*2+1})}

/* memory tree */
function notes(){return LS('notes',seed)}
function renderTree(newId){const R=$('#roots'),L=$('#lights');
 if(!R.innerHTML){let r='',l='';for(let i=0;i<30;i++){const x=25+i*12.5+Math.random()*6,y0=190-Math.abs(x-200)*.28,y1=330+Math.random()*80;r+=`<path class="root" stroke-width="${1.5+Math.random()*2}" d="M${x} ${y0}q${Math.random()*16-8} ${(y1-y0)/2} ${Math.random()*8-4} ${y1-y0}" style="animation-delay:${-Math.random()*5}s"/>`}
  for(let i=0;i<90;i++){const x=200+(Math.random()*2-1)*180,y=45+Math.random()*135;if(((x-200)/185)**2+((y-115)/90)**2<1)l+=`<circle class="lt" cx="${x}" cy="${y}" r="${1.5+Math.random()*2}" style="fill:hsl(${Math.random()*360},100%,75%);animation-delay:${-Math.random()*3}s"/>`}
  for(let i=0;i<45;i++){const x=200+(Math.random()*2-1)*175,y=40+Math.random()*130;if(((x-200)/180)**2+((y-115)/88)**2<1)l+=`<path class="lt" transform="translate(${x} ${y}) scale(${.5+Math.random()*.9})" d="M0-6L1.6-2 6-2 2.4 .8 3.7 5 0 2.4-3.7 5-2.4 .8-6-2-1.6-2Z" style="fill:hsl(${Math.random()*360},100%,80%);animation-delay:${-Math.random()*3}s"/>`}R.innerHTML=r;L.innerHTML=l}
 $('#fruits').innerHTML='';notes().forEach(n=>{const y=48+((n.y*1.7)%34),h=document.createElement('div');h.className='hang'+(n.id===newId?' new':'');h.style.cssText=`left:${n.x}%;top:40%;height:${y-40}%;animation-delay:${-(n.id%7)}s`;
 h.innerHTML=`<i class="thr"></i><b class="wstar" style="background:hsl(${(n.id*67)%360},95%,65%);filter:brightness(${1+n.likes/30}) drop-shadow(0 0 ${6+n.likes}px hsl(${(n.id*67)%360},100%,70%))"></b>`;
 h.onclick=()=>{cur=n;$('#mText').textContent='“'+n.content+'”';$('#mBy').textContent='— '+n.author+' · 💛 '+n.likes;$('#modal').classList.remove('hidden')};$('#fruits').append(h)})}
$('#mClose').onclick=()=>$('#modal').classList.add('hidden');
$('#infuse').onclick=()=>{const a=notes();const n=a.find(x=>x.id===cur.id);n.likes++;SV('notes',a);$('#modal').classList.add('hidden');renderTree()};
$('#hang').onclick=()=>{const t=$('#wish').value.trim();if(!t)return;S.bless++;save();const a=notes();a.push({id:Date.now(),author:me,content:t,likes:0,x:15+Math.random()*70,y:Math.random()*20});SV('notes',a);$('#wish').value='';renderTree(a[a.length-1].id);chime();celebrate('🌟 Your wish now shines on the Banyan!',12)};
const poem=['May the winds of wisdom guide you, for ','Let starlight illuminate your path, and know that ','Beneath the ancient boughs, hear this whisper: '];
$('#polish').onclick=()=>{const t=$('#wish').value.trim();if(t)$('#wish').value=poem[Math.floor(Math.random()*3)]+t.charAt(0).toLowerCase()+t.slice(1)+' ✨ May the stars favor those who walk the night.'};
$('#share').onclick=()=>{const m=`I earned ${S.dew} Starlight Dew in the Grove of Trials! 🌳✨`;navigator.clipboard?.writeText(m);alert('Copied: '+m)};
go('login');showLogin();

/* ===== LIVING MUSIC ENGINE: 8 generative calm soundscapes (no files needed) ===== */
const TR=[['Moonlit Glade',196,[0,3,5,7,10],'sine','wind'],['Fairy Chimes',294,[0,2,4,7,9],'triangle','crick'],['Whispering Wind',174,[0,2,5,7,9],'sine','wind'],
['Crystal Brook',262,[0,2,4,7,9],'sine','water'],['Firefly Night',220,[0,3,5,7,10],'triangle','crick'],['Rainy Canopy',185,[0,2,3,7,8],'sine','rain'],
['Ancient Roots',130,[0,3,7,10,12],'sine','wind'],['Dawn Awakening',330,[0,2,4,7,9],'triangle','water'],
['Library Rain',175,[0,2,3,7,9],'sine','rain'],['Focus Waters',247,[0,2,4,7,9],'sine','water'],['Starlit Study',208,[0,3,5,7,10],'triangle','crick'],['Deep Forest Calm',147,[0,3,7,10,12],'sine','wind'],
['Lantern Lake',233,[0,2,4,7,9],'triangle','water'],['Velvet Midnight',165,[0,2,3,5,7],'sine','wind'],['Golden Hour',277,[0,4,7,9,11],'triangle','crick'],['Mist Meadow',196,[0,2,5,7,9],'sine','wind'],
['Twilight Dreaming',220,[0,2,3,7,8],'sine','rain'],['Elven Lullaby',262,[0,3,5,7,10],'triangle','water'],['Cosmic Calm',123,[0,2,7,9,12],'sine','wind'],['Sunrise Glade',311,[0,2,4,7,9],'triangle','crick']];
let AC,MG,RV,live=[],timer,cur_t=-1,paused=false;
function noise(t){const b=AC.createBuffer(1,AC.sampleRate*2,AC.sampleRate),d=b.getChannelData(0);let l=0;for(let i=0;i<d.length;i++){const w=Math.random()*2-1;d[i]=t==='pink'?(l=l*.97+w*.03)*8:w}const n=AC.createBufferSource();n.buffer=b;n.loop=true;return n}
function initAudio(){if(AC)return;AC=new AudioContext();MG=AC.createGain();MG.gain.value=.7;MG.connect(AC.destination);RV=AC.createConvolver();
 const ir=AC.createBuffer(2,AC.sampleRate*3,AC.sampleRate);for(let c=0;c<2;c++){const d=ir.getChannelData(c);for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/d.length,3)}RV.buffer=ir;const rg=AC.createGain();rg.gain.value=.8;RV.connect(rg).connect(MG)}
function stopT(){clearInterval(timer);live.forEach(n=>{try{n.g.gain.linearRampToValueAtTime(0,AC.currentTime+1.5);n.s.stop(AC.currentTime+1.6)}catch{}});live=[]}
function layer(src,g,node){const gn=AC.createGain();gn.gain.value=0;gn.gain.linearRampToValueAtTime(g,AC.currentTime+3);src.connect(node||gn);if(node)node.connect(gn);gn.connect(MG);gn.connect(RV);src.start();live.push({s:src,g:gn})}
function playT(i){initAudio();AC.resume();paused=false;stopT();cur_t=i;const [nm,root,sc,wave,amb]=TR[i];
 [1,1.5,2,2.5].forEach((m,k)=>{const o=AC.createOscillator();o.type='sine';o.frequency.value=root*m/2;o.detune.value=k*4-6;const l=AC.createOscillator(),lg=AC.createGain();l.frequency.value=.05+k*.03;lg.gain.value=.01;l.connect(lg);layer(o,.05,null);l.start();});
 const n=noise(amb==='wind'?'pink':'white'),f=AC.createBiquadFilter();f.type=amb==='water'?'bandpass':'lowpass';f.frequency.value=amb==='water'?1400:amb==='rain'?3500:500;const lf=AC.createOscillator(),lg=AC.createGain();lf.frequency.value=.12;lg.gain.value=amb==='water'?500:200;lf.connect(lg).connect(f.frequency);lf.start();layer(n,amb==='rain'?.05:.1,f);
 if(amb==='crick'){const c=AC.createOscillator(),m=AC.createOscillator(),mg=AC.createGain(),cg=AC.createGain();c.frequency.value=4300;m.type='square';m.frequency.value=9;mg.gain.value=.5;cg.gain.value=.5;m.connect(mg).connect(cg.gain);c.connect(cg);layer(c,.012,cg);m.start()}
 timer=setInterval(()=>{if(paused)return;const t=AC.currentTime,o=AC.createOscillator(),g=AC.createGain(),p=AC.createStereoPanner();o.type=wave;o.frequency.value=root*Math.pow(2,sc[Math.floor(Math.random()*sc.length)]/12)*(Math.random()<.5?2:1);p.pan.value=Math.random()*2-1;
  g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.12,t+.05);g.gain.exponentialRampToValueAtTime(.0005,t+4);o.connect(g).connect(p);p.connect(MG);p.connect(RV);o.start(t);o.stop(t+4.2);sparkle()},1800);
 $('#now').textContent='♪ Now playing: '+nm;$$('.trk').forEach((b,k)=>b.classList.toggle('on',k===i));$('#soundBtn').textContent='🔊 '+nm}
function sparkle(){const d=document.createElement('i');d.className='spk';d.style.left=Math.random()*100+'vw';d.style.top=Math.random()*80+'vh';document.body.append(d);setTimeout(()=>d.remove(),3000)}
$('#tracks').innerHTML=TR.map((t,i)=>`<button class="trk card" data-i="${i}">🎵 ${i+1}<br>${t[0]}</button>`).join('');
$$('.trk').forEach(b=>b.onclick=()=>playT(+b.dataset.i));
$('#soundBtn').onclick=()=>playT(cur_t<0?0:(cur_t+1)%TR.length);
$('#pp').onclick=()=>{if(!AC)return playT(0);paused=!paused;paused?AC.suspend():AC.resume();$('#pp').textContent=paused?'▶ Play':'⏸ Pause'};
$('#vol').oninput=e=>{if(MG)MG.gain.value=+e.target.value};

/* ===== VISUAL MAGIC ===== */
$('#pines').innerHTML=Array.from({length:22},(_, i)=>`<b style="left:${i*4.8-2}%;height:${140+Math.random()*190}px;animation-delay:${-Math.random()*6}s;opacity:${.55+Math.random()*.45}"></b>`).join('');
setInterval(()=>{const l=document.createElement('i');l.className='leaf';l.textContent=['🍃','🌿','✨','🍂'][Math.floor(Math.random()*4)];l.style.left=Math.random()*100+'vw';l.style.animationDuration=8+Math.random()*8+'s';document.body.append(l);setTimeout(()=>l.remove(),16000)},900);
setInterval(()=>{const s=document.createElement('i');s.className='star';s.style.left=Math.random()*70+'vw';s.style.top=Math.random()*30+'vh';document.body.append(s);setTimeout(()=>s.remove(),1800)},5000);
onmousemove=e=>{const d=document.createElement('i');d.className='trail';d.style.left=e.clientX+'px';d.style.top=e.clientY+'px';document.body.append(d);setTimeout(()=>d.remove(),700);
 document.documentElement.style.setProperty('--px',(e.clientX/innerWidth-.5)*30+'px');
 const c=e.target.closest?.('.card');if(c&&!c.matches('.wide,.parchment')){const r=c.getBoundingClientRect();c.style.transform=`perspective(600px) rotateY(${((e.clientX-r.left)/r.width-.5)*16}deg) rotateX(${-((e.clientY-r.top)/r.height-.5)*16}deg)`}};
$$('.card').forEach(c=>c.onmouseleave=()=>c.style.transform='');
(function type(t,i=0){const el=$('#tag');if(i===0)el.textContent='';if(i<t.length){el.textContent+=t[i];setTimeout(()=>type(t,i+1),35)}})($('#tag').textContent);

/* ===== EXTRA FANTASY ===== */
let fx=0,fy=0,mx=0,my=0;onmousemove=(o=>e=>{o(e);mx=e.clientX;my=e.clientY})(onmousemove);
(function fl(){fx+=(mx-fx)*.06;fy+=(my-fy)*.06;$('#fairy').style.transform=`translate(${fx+24}px,${fy-24+Math.sin(Date.now()/250)*8}px)`;requestAnimationFrame(fl)})();

setInterval(()=>{const b=$('#treeBox');if(!b||!b.offsetParent)return;const d=document.createElement('i');d.className='spk';d.style.cssText=`left:${10+Math.random()*80}%;top:${5+Math.random()*85}%;background:radial-gradient(#fff,hsl(${Math.random()*360},100%,70%),transparent)`;b.append(d);setTimeout(()=>d.remove(),3000)},180);

/* magic bloom on the Music Glade */
function bloom(el,big){const r=el.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,n=big?18:6;
 const rp=document.createElement('i');rp.className='rip';rp.style.cssText=`left:${cx}px;top:${cy}px`;document.body.append(rp);setTimeout(()=>rp.remove(),1400);
 for(let i=0;i<n;i++){const a=i/n*6.283+Math.random()*.4,d=(big?90:45)+Math.random()*(big?90:40),p=document.createElement('i');p.className='bl';
  p.textContent=['🌸','🌼','💮','✨','🌺','🪷'][i%6];p.style.cssText=`left:${cx}px;top:${cy}px;--dx:${Math.cos(a)*d}px;--dy:${Math.sin(a)*d-30}px;--r:${Math.random()*360}deg;animation-delay:${i*20}ms`;document.body.append(p);setTimeout(()=>p.remove(),1800)}}
$$('.trk').forEach(b=>{b.addEventListener('click',()=>bloom(b,true));b.addEventListener('mouseenter',()=>bloom(b,false))});
