// synthetic backing track with known stems: drums (centre), bass (centre), vocals (centre, enters bar 5), guitars (panned)
const sr=44100,BPM=100,bars=+process.env.BARS||16,spb=60/BPM,n=Math.floor(bars*4*spb*sr);
const mk=()=>new Float32Array(n);const T={dl:mk(),dr:mk(),b:mk(),v:mk(),gl:mk(),gr:mk()};
let seed=12345;const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296*2-1};
const chords=[[57,60,64],[53,57,60],[48,52,55],[55,59,62]],roots=[33,29,36,31];
const mtof=m=>440*Math.pow(2,(m-69)/12);
for(let bar=0;bar<bars;bar++){const ci=bar%4,t0=bar*4*spb;
 for(let beat=0;beat<4;beat++){const t=t0+beat*spb,i0=Math.floor(t*sr);
  if(beat%2===0){for(let i=0;i<sr*.25;i++){const tt=i/sr,f=50+90*Math.exp(-tt*28);const ph=2*Math.PI*(50*tt+90/28*(1-Math.exp(-tt*28)));const v=Math.sin(ph)*Math.exp(-tt*11)*.9;if(i0+i<n){T.dl[i0+i]+=v;T.dr[i0+i]+=v}}}
  else{for(let i=0;i<sr*.22;i++){const tt=i/sr,v=(rnd()*.5+Math.sin(2*Math.PI*190*tt)*.6)*Math.exp(-tt*20)*.55;if(i0+i<n){T.dl[i0+i]+=v;T.dr[i0+i]+=v}}}
  for(let h=0;h<2;h++){const ih=i0+Math.floor(h*spb/2*sr);let lp=0;for(let i=0;i<sr*.05;i++){const x=rnd(),hp=x-lp;lp=x*.3+lp*.7;const v=hp*Math.exp(-i/sr*90)*.18;if(ih+i<n){T.dl[ih+i]+=v*.9;T.dr[ih+i]+=v*1.1}}}
  // bass 8ths
  for(let h=0;h<2;h++){const ib=i0+Math.floor(h*spb/2*sr),f=mtof(roots[ci]+(h&&beat%2?7:0)),len=Math.floor(spb/2*sr*.9);for(let i=0;i<len;i++){const tt=i/sr,ph=2*Math.PI*f*tt;const v=(Math.sin(ph)+.5*Math.sin(2*ph)+.25*Math.sin(3*ph))*Math.min(1,tt*200)*Math.exp(-tt*3)*.35;if(ib+i<n)T.b[ib+i]+=v}}
 }
 // guitars: strum on each beat, pan L / R
 for(let beat=0;beat<4;beat++){const i0=Math.floor((t0+beat*spb)*sr);chords[ci].forEach((m,k)=>{for(const oct of [0,12]){const f=mtof(m+oct-(oct?0:12)),len=Math.floor(spb*sr*.95),off=Math.floor(k*.012*sr);for(let i=0;i<len;i++){const tt=i/sr;let v=0;for(let h=1;h<=5;h++)v+=Math.sin(2*Math.PI*f*h*tt)/(h*1.4);v*=Math.exp(-tt*2.6)*Math.min(1,tt*400)*.07;const j=i0+off+i;if(j<n){T.gl[j]+=v*(oct?.3:.9);T.gr[j]+=v*(oct?.9:.3)}}}})}
 // vocals from bar 4 on: harmonic voice with vibrato, formants
 if(bar>=4){const mel=[69,72,71,67,69,64,65,67];for(let q=0;q<4;q++){const f=mtof(mel[(bar*4+q)%8]+(ci%2?0:-0)),i0=Math.floor((t0+q*spb)*sr),len=Math.floor(spb*sr*.95);let ph=0;for(let i=0;i<len;i++){const tt=i/sr,ff=f*(1+.012*Math.sin(2*Math.PI*5.5*tt));ph+=2*Math.PI*ff/sr;let v=0;for(let h=1;h<=14;h++){const fh=ff*h,fm=Math.exp(-Math.pow((fh-700)/350,2))+.7*Math.exp(-Math.pow((fh-1300)/400,2))+.35*Math.exp(-Math.pow((fh-2600)/600,2));v+=Math.sin(h*ph)*fm/h*1.4}v*=Math.min(1,tt*30)*Math.min(1,(len/sr-tt)*30)*.22;if(i0+i<n)T.v[i0+i]+=v}}}
}
const L=mk(),R=mk();for(let i=0;i<n;i++){L[i]=T.dl[i]+T.b[i]+T.v[i]+T.gl[i];R[i]=T.dr[i]+T.b[i]+T.v[i]+T.gr[i]}
let pk=0;for(let i=0;i<n;i++)pk=Math.max(pk,Math.abs(L[i]),Math.abs(R[i]));const g=.8/pk;for(const k in T)for(let i=0;i<n;i++)T[k][i]*=g;for(let i=0;i<n;i++){L[i]*=g;R[i]*=g}
function wav(path,L,R){const fs=require('fs'),b=Buffer.alloc(44+n*4);b.write('RIFF',0);b.writeUInt32LE(36+n*4,4);b.write('WAVEfmt ',8);b.writeUInt32LE(16,16);b.writeUInt16LE(1,20);b.writeUInt16LE(2,22);b.writeUInt32LE(sr,24);b.writeUInt32LE(sr*4,28);b.writeUInt16LE(4,32);b.writeUInt16LE(16,34);b.write('data',36);b.writeUInt32LE(n*4,40);for(let i=0;i<n;i++){b.writeInt16LE(Math.max(-32768,Math.min(32767,L[i]*32767)),44+i*4);b.writeInt16LE(Math.max(-32768,Math.min(32767,R[i]*32767)),46+i*4)}fs.writeFileSync(path,b)}
module.exports={sr,n,L,R,T,wav,BPM,bars};
if(require.main===module){wav(__dirname+'/backing.wav',L,R);console.log('wrote backing.wav',n/sr,'s')}
