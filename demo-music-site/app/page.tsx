'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AudioLines, Check, ChevronDown, CircleHelp, Download, Headphones, Link2, Menu, MoreHorizontal, Pause, Play, Plus, Search, Share2, Sparkles, Upload, X } from 'lucide-react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

type Track = { id: string; title: string; genre: string; bpm: string; key: string; duration: string; cover: string; audio?: string; description: string; };
const initialTracks: Track[] = [
 { id:'midnight-demo', title:'Midnight Demo', genre:'Hip Hop', bpm:'140', key:'Am', duration:'0:58', cover:'sunset', description:'A short idea turned into something.' },
 { id:'drill-edit-03', title:'Drill Edit 03', genre:'Drill', bpm:'146', key:'Fm', duration:'1:12', cover:'glitch', description:'Dark drums and a cold melody.' },
 { id:'indie-guitar', title:'Indie Guitar', genre:'Indie', bpm:'120', key:'C', duration:'1:05', cover:'road', description:'A guitar loop for late drives.' },
 { id:'late-night', title:'Late Night', genre:'Lo-fi', bpm:'90', key:'Em', duration:'0:47', cover:'city', description:'Rain on the window, tape in the deck.' },
 { id:'fragments', title:'Fragments', genre:'R&B', bpm:'95', key:'Dm', duration:'1:20', cover:'mono', description:'Little pieces of a bigger feeling.' },
];
const genres = ['All','Hip Hop','Drill','Lo-fi','Indie','R&B','Electronic','Other'];
const coverClass: Record<string,string> = { sunset:'cover-sunset', glitch:'cover-glitch', road:'cover-road', city:'cover-city', mono:'cover-mono' };
function formatTime(s:number) { if (!Number.isFinite(s)) return '0:00'; return `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`; }

export default function Home() {
 const [tracks,setTracks] = useState<Track[]>(initialTracks);
 const [active,setActive] = useState<Track>(initialTracks[0]);
 const [genre,setGenre] = useState('All'); const [search,setSearch] = useState('');
 const [playing,setPlaying] = useState(false); const [currentTime,setCurrentTime] = useState(0); const [duration,setDuration] = useState(58);
 const [shareOpen,setShareOpen] = useState(true); const [uploadOpen,setUploadOpen] = useState(false); const [notice,setNotice] = useState('');
 const [title,setTitle] = useState(''); const [artist,setArtist] = useState('Vaibhav'); const [description,setDescription] = useState(''); const [bpm,setBpm] = useState('140'); const [key,setKey] = useState('Am'); const [newGenre,setNewGenre] = useState('Hip Hop');
 const [audioUrl,setAudioUrl] = useState(''); const [coverUrl,setCoverUrl] = useState(''); const [videoBusy,setVideoBusy] = useState(false); const [videoProgress,setVideoProgress] = useState('');
 const ffmpegRef = useRef<FFmpeg | null>(null);
 const audioRef = useRef<HTMLAudioElement>(null); const coverFileRef = useRef<HTMLInputElement>(null); const audioFileRef = useRef<HTMLInputElement>(null); const videoCanvasRef = useRef<HTMLCanvasElement>(null);
 const filtered = useMemo(()=>tracks.filter(t=>(genre==='All'||t.genre===genre) && `${t.title} ${t.genre} ${t.key}`.toLowerCase().includes(search.toLowerCase())),[tracks,genre,search]);
 useEffect(()=>{ const a=audioRef.current; if(!a)return; const tick=()=>setCurrentTime(a.currentTime||0); const meta=()=>setDuration(a.duration||58); const ended=()=>setPlaying(false); a.addEventListener('timeupdate',tick); a.addEventListener('loadedmetadata',meta); a.addEventListener('ended',ended); return ()=>{a.removeEventListener('timeupdate',tick);a.removeEventListener('loadedmetadata',meta);a.removeEventListener('ended',ended)}; },[active]);
 useEffect(()=>{ if(notice){const t=setTimeout(()=>setNotice(''),3000);return ()=>clearTimeout(t)} },[notice]);
 function chooseTrack(t:Track){setActive(t);setCurrentTime(0);setPlaying(false); if(audioRef.current){audioRef.current.pause();audioRef.current.currentTime=0;} }
 async function togglePlay(){ const a=audioRef.current; if(!a){setNotice('Upload an audio file to preview your own snippet.');return;} if(playing){a.pause();setPlaying(false)}else{try{await a.play();setPlaying(true)}catch{setNotice('Choose an audio file first to play this snippet.')}} }
 function onAudioUpload(file?:File){if(!file)return; const url=URL.createObjectURL(file);setAudioUrl(url);setActive({...active,audio:url,duration:'—'});setTracks(prev=>prev.map(t=>t.id===active.id?{...t,audio:url,duration:'—'}:t));setNotice(`Loaded ${file.name}`)}
 function onCoverUpload(file?:File){if(!file)return;setCoverUrl(URL.createObjectURL(file));setNotice('Cover art added to the video preview.')}
 function addTrack(){if(!title.trim()){setNotice('Add a title for your snippet first.');return;} const t:Track={id:`${title.toLowerCase().replace(/[^a-z0-9]+/g,'-')}-${Date.now()}`,title:title.trim(),genre:newGenre,bpm,key,duration:'0:30',cover:coverUrl?'uploaded':'sunset',audio:audioUrl,description:description||'A new snippet.'}; setTracks(prev=>[t,...prev]);setActive(t);setUploadOpen(false);setTitle('');setDescription('');setGenre('All');setCurrentTime(0);setNotice('Snippet added to your library.'); }
 function copyLink(){const url=`${window.location.origin}/?snippet=${encodeURIComponent(active.id)}`;navigator.clipboard?.writeText(url).then(()=>setNotice('Snippet link copied.')).catch(()=>setNotice(url));}
 function drawVideoFrame(ctx:CanvasRenderingContext2D, w:number,h:number, t:Track, time:number, total:number, art:string|null){
   const grad=ctx.createLinearGradient(0,0,w,h);grad.addColorStop(0,'#17162d');grad.addColorStop(.5,'#090c14');grad.addColorStop(1,'#24182c');ctx.fillStyle=grad;ctx.fillRect(0,0,w,h);
   ctx.fillStyle='rgba(125,98,220,.12)';ctx.beginPath();ctx.arc(w*.78,h*.23,w*.5,0,Math.PI*2);ctx.fill();
   if(art){try{const img=new Image();img.src=art;}catch{}}
   // Graphic artwork block: a premium abstract cover that always renders consistently.
   const size=690, x=(w-size)/2, y=390;ctx.save();ctx.shadowColor='rgba(0,0,0,.5)';ctx.shadowBlur=50;ctx.fillStyle='#28234d';ctx.fillRect(x,y,size,size);ctx.shadowBlur=0;
   const artGrad=ctx.createLinearGradient(x,y,x+size,y+size);artGrad.addColorStop(0,'#5653a8');artGrad.addColorStop(.5,'#292b62');artGrad.addColorStop(1,'#df8a9d');ctx.fillStyle=artGrad;ctx.fillRect(x,y,size,size);
   for(let i=0;i<70;i++){const xx=x+((i*97)%size), yy=y+((i*151)%size);ctx.fillStyle=`rgba(255,255,255,${((i%7)+1)/100})`;ctx.fillRect(xx,yy,2+(i%5),2+(i%4));}
   ctx.strokeStyle='rgba(255,255,255,.3)';ctx.lineWidth=2;ctx.beginPath();ctx.arc(x+size*.5,y+size*.5,100+Math.sin(time*2)*10,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.arc(x+size*.5,y+size*.5,150,0,Math.PI*2);ctx.stroke();ctx.restore();
   ctx.fillStyle='#fff';ctx.font='600 32px Arial';ctx.fillText('demo',80,100);ctx.textAlign='right';ctx.fillStyle='rgba(255,255,255,.72)';ctx.font='24px Arial';ctx.fillText('SNIPPET / 001',w-80,100);ctx.textAlign='left';
   ctx.fillStyle='rgba(255,255,255,.7)';ctx.font='26px Arial';ctx.fillText(`${t.genre.toUpperCase()}  ·  ${t.bpm} BPM  ·  ${t.key}`,80,1220);
   ctx.fillStyle='#fff';ctx.font='bold 58px Arial';const titleText=t.title.length>23?t.title.slice(0,22)+'…':t.title;ctx.fillText(titleText,80,1300);
   ctx.fillStyle='rgba(255,255,255,.68)';ctx.font='30px Arial';ctx.fillText('by Vaibhav',80,1350);
   const baseY=1470, bars=58, barW=7, gap=7;for(let i=0;i<bars;i++){const amp=10+Math.abs(Math.sin(i*2.31)*Math.cos(i*.41))*62;ctx.fillStyle=i/bars<=time/Math.max(total,1)?'#fff':'rgba(255,255,255,.28)';ctx.fillRect(80+i*(barW+gap),baseY-amp/2,barW,amp);}
   ctx.fillStyle='rgba(255,255,255,.5)';ctx.font='22px Arial';ctx.fillText('SMALL SNIPPETS. BIG IDEAS.',80,1580);ctx.textAlign='right';ctx.fillText(`${formatTime(time)} / ${formatTime(total)}`,w-80,1525);ctx.textAlign='left';
 }
 async function generateVideo(){
   const a=audioRef.current, canvas=videoCanvasRef.current;if(!canvas){setNotice('Video canvas is not ready.');return;}
   if(!a||!active.audio){setNotice('Upload an audio file first.');return;}
   if(!('MediaRecorder' in window)){setNotice('Video export needs a modern desktop browser such as Chrome or Edge.');return;}
   setVideoBusy(true);setVideoProgress('Preparing 1080 × 1920 video…');
   try{
     const w=1080,h=1920;canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Canvas unavailable');
     const total=Math.min(Number.isFinite(a.duration)?a.duration:30,60);const previousTime=a.currentTime;const wasPlaying=!a.paused;
     const stream=canvas.captureStream(30);
     const capture=(a as HTMLAudioElement & {captureStream?:()=>MediaStream; mozCaptureStream?:()=>MediaStream}).captureStream || (a as HTMLAudioElement & {mozCaptureStream?:()=>MediaStream}).mozCaptureStream;
     if(capture){try{const audioStream=capture.call(a);audioStream.getAudioTracks().forEach(track=>stream.addTrack(track));}catch{}}
     const mime=['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm'].find(m=>MediaRecorder.isTypeSupported(m));if(!mime)throw new Error('This browser cannot create the temporary video needed for MP4 export.');
     const recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:6000000});const chunks:BlobPart[]=[];recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};
     const art=coverUrl||null;let start=performance.now();let raf=0;
     const render=()=>{const elapsed=(performance.now()-start)/1000;drawVideoFrame(ctx,w,h,active,Math.min(elapsed,total),total,art);setVideoProgress(`Rendering vertical video… ${Math.min(100,Math.round(elapsed/total*100))}%`);if(elapsed<total&&recorder.state==='recording')raf=requestAnimationFrame(render);};
     await new Promise<void>((resolve,reject)=>{recorder.onstop=()=>resolve();recorder.onerror=()=>reject(new Error('Video recording failed.'));recorder.start(250);start=performance.now();render();a.currentTime=0;a.play().catch(()=>{});setTimeout(()=>{if(recorder.state==='recording')recorder.stop();cancelAnimationFrame(raf);},total*1000);});
     a.pause();a.currentTime=previousTime;if(wasPlaying)a.play().catch(()=>{});
     const webmBlob=new Blob(chunks,{type:mime});

     setVideoProgress('Converting to MP4…');
     let ffmpeg=ffmpegRef.current;
     if(!ffmpeg){
       ffmpeg=new FFmpeg();
       ffmpeg.on('progress',({progress})=>setVideoProgress(`Converting to MP4… ${Math.max(0,Math.min(100,Math.round(progress*100)))}%`));
       const baseURL='https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/umd';
       await ffmpeg.load({
         coreURL:await toBlobURL(`${baseURL}/ffmpeg-core.js`,'text/javascript'),
         wasmURL:await toBlobURL(`${baseURL}/ffmpeg-core.wasm`,'application/wasm'),
       });
       ffmpegRef.current=ffmpeg;
     }
     await ffmpeg.writeFile('input.webm',await fetchFile(webmBlob));
     await ffmpeg.exec([
       '-i','input.webm',
       '-vf','scale=1080:1920:force_original_aspect_ratio=disable',
       '-r','30',
       '-c:v','libx264',
       '-preset','veryfast',
       '-crf','23',
       '-pix_fmt','yuv420p',
       '-c:a','aac',
       '-b:a','192k',
       '-movflags','+faststart',
       'output.mp4'
     ]);
     const data=await ffmpeg.readFile('output.mp4');
     if(typeof data==='string') throw new Error('FFmpeg returned invalid MP4 data.');
     const mp4Bytes=new Uint8Array(data);
     const mp4Blob=new Blob([mp4Bytes],{type:'video/mp4'});
     const url=URL.createObjectURL(mp4Blob);const link=document.createElement('a');link.href=url;link.download=`demo-${active.id}-1080x1920.mp4`;link.click();setTimeout(()=>URL.revokeObjectURL(url),60000);
     try{await ffmpeg.deleteFile('input.webm');await ffmpeg.deleteFile('output.mp4');}catch{}
     setVideoProgress('MP4 exported · 1080 × 1920');setNotice('Your 1080 × 1920 MP4 is ready.');
   }catch(e){setVideoProgress('');setNotice(e instanceof Error?e.message:'Could not export MP4. Try Chrome or Edge.');}finally{setVideoBusy(false);}
 }
 const activeCover = active.cover==='uploaded'&&coverUrl ? undefined : coverClass[active.cover]||'cover-sunset';
 return <main className="app-shell">
  <header className="topbar"><a className="wordmark" href="#top">demo<span>.</span></a><nav><a className="nav-active" href="#top">Home</a><a href="#library">My edits</a><a href="#about">About</a></nav><div className="top-actions"><button className="icon-button" aria-label="Search" onClick={()=>document.getElementById('search')?.focus()}><Search size={18}/></button><button className="profile-pill" onClick={()=>setUploadOpen(true)}>VAIBHAV <ChevronDown size={14}/></button></div></header>
  <section className="hero" id="top"><div className="hero-copy"><p className="eyebrow">YOUR SOUND, YOUR SPACE</p><p className="muted">Hi, I’m Vaibhav.</p><h1>This is demo.<br/>My edits. My sound.</h1><p className="hero-desc">A space to share music snippets, ideas and experiments.<br/>Listen, explore, and feel free to share.</p><div className="searchbox"><Search size={17}/><input id="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by title, genre, tag…" /></div><div className="genre-list">{genres.map(g=><button key={g} className={genre===g?'genre active':'genre'} onClick={()=>setGenre(g)}>{g}</button>)}</div></div><div className="hero-art"><div className="hero-window"><div className="window-glow"/><div className="monitor"/><div className="desk"/><div className="tiny-laptop"/></div><div className="hero-art-caption"><AudioLines size={16}/> INDEPENDENTLY MADE · ALWAYS IN PROGRESS</div></div></section>
  <section className="latest section-wrap" id="library"><div className="section-heading"><div><p className="eyebrow">THE WORK IN PROGRESS</p><h2>Latest snippets</h2></div><button className="text-button" onClick={()=>setUploadOpen(true)}><Plus size={16}/> Add snippet <span>↗</span></button></div><div className="track-grid">{filtered.map(t=><article className={`track-card ${active.id===t.id?'selected':''}`} key={t.id}><button className={`cover ${t.cover==='uploaded'&&coverUrl?'cover-uploaded':coverClass[t.cover]||'cover-sunset'}`} onClick={()=>chooseTrack(t)} aria-label={`Select ${t.title}`} style={t.cover==='uploaded'&&coverUrl?{backgroundImage:`url(${coverUrl})`}:undefined}><span className="cover-index">DEMO / {String(tracks.indexOf(t)+1).padStart(2,'0')}</span><span className="cover-symbol">{t.cover==='glitch'?'///':t.cover==='mono'?'✳':t.cover==='road'?'↗':'◌'}</span></button><button className="track-title" onClick={()=>chooseTrack(t)}>{t.title}</button><p className="track-meta">{t.genre} <span>·</span> {t.bpm} BPM <span>·</span> {t.key}</p><div className="track-bottom"><span>{t.duration}</span><div><button className="round-play" onClick={()=>{chooseTrack(t);setTimeout(()=>togglePlay(),0)}} aria-label="Play snippet"><Play size={13} fill="currentColor"/></button><button className="small-icon" onClick={()=>{chooseTrack(t);setShareOpen(true)}} aria-label="Share snippet"><MoreHorizontal size={18}/></button></div></div></article>)}</div>{filtered.length===0&&<div className="empty-state">No snippets match that search. Try another title or genre.</div>}</section>
  <section className="detail-layout section-wrap"><div className="detail-main"><div className="detail-card"><div className={`detail-cover ${activeCover}`} style={active.cover==='uploaded'&&coverUrl?{backgroundImage:`url(${coverUrl})`}:undefined}><span className="detail-cover-mark">d.</span><span className="detail-cover-label">AUDIO STUDY / {active.bpm} BPM</span></div><div className="detail-info"><div className="detail-meta">{active.genre} <span>·</span> {active.bpm} BPM <span>·</span> {active.key}</div><h2>{active.title}</h2><p>{active.description}</p><div className="tags"><span>#{active.genre.toLowerCase().replace(' ','')}</span><span>#{active.key.toLowerCase()}</span><span>#{active.bpm}bpm</span></div><p className="creator"><span className="avatar">V</span> Created by Vaibhav</p><div className="detail-actions"><button className="primary-button" onClick={togglePlay}>{playing?<Pause size={16} fill="currentColor"/>:<Play size={16} fill="currentColor"/>}{playing?'Pause':'Play'}</button><button className="outline-button" onClick={()=>{if(active.audio){const link=document.createElement('a');link.href=active.audio;link.download=`${active.id}.mp3`;link.click()}else setNotice('Load an audio file before downloading.')}}><Download size={16}/> Download</button><button className="circle-button" onClick={()=>setShareOpen(v=>!v)}><MoreHorizontal size={19}/></button></div></div><button className="share-button" onClick={()=>setShareOpen(v=>!v)}><Share2 size={15}/> Share</button></div>
   <div className="wave-player"><button className="wave-play" onClick={togglePlay}>{playing?<Pause size={15} fill="currentColor"/>:<Play size={15} fill="currentColor"/>}</button><div className="waveform" onClick={e=>{const r=e.currentTarget.getBoundingClientRect();const ratio=(e.clientX-r.left)/r.width;if(audioRef.current&&Number.isFinite(audioRef.current.duration))audioRef.current.currentTime=ratio*audioRef.current.duration}}>{Array.from({length:88},(_,i)=><i key={i} style={{height:`${9+Math.abs(Math.sin(i*1.73)*Math.cos(i*.37))*31}px`,opacity:i/88<(currentTime/Math.max(duration,1))?1:.42}}/>)}</div><span className="timecode">{formatTime(currentTime)} / {formatTime(duration)}</span></div>
   <div className="notes"><div className="notes-heading"><h3>Comments / Notes</h3><span>01 NOTE</span></div><form className="note-input" onSubmit={e=>{e.preventDefault();setNotice('Note added locally for this session.');}}><input placeholder="Leave a note…"/><button aria-label="Submit note"><span>↗</span></button></form><div className="comment"><div className="avatar">V</div><div><p className="comment-name">Vaibhav <span>· creator</span></p><p>This one’s a vibe. Might build on this later.</p><small>2d ago</small></div><button className="small-icon"><MoreHorizontal size={18}/></button></div></div>
  </div>
  <aside className="share-panel"><div className="share-panel-heading"><div><p className="eyebrow">TAKE IT WITH YOU</p><h3>Share as video</h3></div><span className="live-dot"/></div><p className="panel-copy">Turn your snippet into a vertical visual, ready for Reels, TikTok or Shorts.</p><div className="video-preview-wrap"><div className="video-preview"><div className="preview-top"><span>demo.</span><span>{active.duration}</span></div><div className={`preview-art ${activeCover}`} style={active.cover==='uploaded'&&coverUrl?{backgroundImage:`url(${coverUrl})`}:undefined}><span className="preview-orbit"/></div><div className="preview-track"><strong>{active.title}</strong><span>VAIBHAV · {active.bpm} BPM · {active.key}</span></div><div className="preview-wave">{Array.from({length:35},(_,i)=><i key={i} style={{height:`${7+Math.abs(Math.sin(i*1.8))*18}px`}}/>)}</div><div className="preview-footer"><span>SMALL SNIPPETS.</span><span>BIG IDEAS.</span></div></div></div><div className="resolution-row"><label>Video resolution</label><span className="resolution-badge"><span className="resolution-dot"/> 1080 × 1920 <span className="vertical-label">9:16 VERTICAL</span></span></div><div className="export-note"><Sparkles size={15}/><span>1080 × 1920 px · 9:16 · MP4 (H.264 + AAC)</span></div><button className="generate-button" onClick={generateVideo} disabled={videoBusy}><Sparkles size={16}/>{videoBusy?'Rendering MP4…':'Generate MP4'}</button>{videoProgress&&<p className="video-progress">{videoBusy&&<span className="spinner"/>}{videoProgress}</p>}<p className="fine-print">MP4 export uses FFmpeg in your browser and records up to 60 seconds. The first export downloads the FFmpeg engine (~31 MB); later exports reuse it.</p><div className="panel-links"><button onClick={copyLink}><Link2 size={14}/> Copy snippet link</button><button onClick={()=>setUploadOpen(true)}><Upload size={14}/> Replace audio / cover</button></div></aside>
  </section>
  <footer id="about"><div className="footer-brand"><a className="wordmark" href="#top">demo<span>.</span></a><p>Small snippets. Big ideas.</p><div className="socials"><span>◎</span><span>𝕏</span><span>▶</span><span>↗</span></div></div><div className="footer-nav"><a href="#top">Home</a><a href="#library">My edits</a><a href="#about">About</a></div><div className="footer-credit">Made with <span>♥</span> by Vaibhav<br/><small>INDEPENDENT MUSIC SHARING</small></div></footer>
  <audio ref={audioRef} src={active.audio||undefined} onPlay={()=>setPlaying(true)} onPause={()=>setPlaying(false)} />
  <canvas ref={videoCanvasRef} className="hidden-canvas" width={1080} height={1920}/>
  {uploadOpen&&<div className="modal-backdrop" onClick={()=>setUploadOpen(false)}><div className="upload-modal" onClick={e=>e.stopPropagation()}><div className="modal-head"><div><p className="eyebrow">YOUR NEXT IDEA</p><h2>Add a snippet</h2></div><button className="icon-button" onClick={()=>setUploadOpen(false)}><X size={19}/></button></div><label className="field-label">Track title</label><input className="field" value={title} onChange={e=>setTitle(e.target.value)} placeholder="e.g. Midnight in Delhi"/><label className="field-label">Description</label><input className="field" value={description} onChange={e=>setDescription(e.target.value)} placeholder="A little context about this edit…"/><div className="field-row"><div><label className="field-label">Genre</label><select className="field" value={newGenre} onChange={e=>setNewGenre(e.target.value)}>{genres.filter(g=>g!=='All').map(g=><option key={g}>{g}</option>)}</select></div><div><label className="field-label">BPM</label><input className="field" value={bpm} onChange={e=>setBpm(e.target.value)} placeholder="140"/></div><div><label className="field-label">Key</label><input className="field" value={key} onChange={e=>setKey(e.target.value)} placeholder="Am"/></div></div><div className="upload-drop-row"><button className="upload-drop" onClick={()=>audioFileRef.current?.click()}><Upload size={19}/><strong>{audioUrl?'Audio loaded':'Choose audio'}</strong><span>MP3, WAV, M4A</span></button><button className="upload-drop" onClick={()=>coverFileRef.current?.click()}><Plus size={19}/><strong>{coverUrl?'Cover added':'Add cover art'}</strong><span>JPG, PNG, WebP</span></button></div><input ref={audioFileRef} type="file" accept="audio/*" hidden onChange={e=>onAudioUpload(e.target.files?.[0])}/><input ref={coverFileRef} type="file" accept="image/*" hidden onChange={e=>onCoverUpload(e.target.files?.[0])}/><p className="modal-hint"><CircleHelp size={14}/> Files are loaded locally in this browser session. To publish permanently, add assets to your project’s public folder and deploy.</p><button className="generate-button" onClick={addTrack}><Plus size={16}/> Add to library</button></div></div>}
  {notice&&<div className="toast"><Check size={16}/>{notice}<button onClick={()=>setNotice('')}><X size={14}/></button></div>}
 </main>
}
