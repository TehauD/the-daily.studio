const fs=require('fs'),path=require('path');const S=require('./stem_synth.cjs');
eval(fs.readFileSync(path.join(__dirname,'../src/parts/16a-stem-dsp.js'),'utf8')+';globalThis.stemDSPFactory=stemDSPFactory');
const D=stemDSPFactory();const t0=Date.now();
D.run(S.L,S.R,S.sr,JSON.parse(process.env.OPT||'{}'),p=>process.stdout.write('\r'+Math.round(p*100)+'%')).then(({stems,feat})=>{
 console.log('\ntime',(Date.now()-t0)/1000,'s for',S.n/S.sr,'s audio');
 const f=a=>Float32Array.from(a,x=>x/32768);
 const est={drums:f(stems.drumsL).map((x,i)=>(x+stems.drumsR[i]/32768)/2),bass:f(stems.bass),vox:f(stems.vox)};
 est.other=S.L.map((x,i)=>((x+S.R[i])/2)-est.drums[i]-est.bass[i]-est.vox[i]);
 const tru={drums:S.T.dl.map((x,i)=>(x+S.T.dr[i])/2),bass:S.T.b,vox:S.T.v,other:S.T.gl.map((x,i)=>(x+S.T.gr[i])/2)};
 // SI-SDR (dB) after skipping edges
 const sisdr=(e,t)=>{let et=0,tt=0;for(let i=4096;i<e.length-4096;i++){et+=e[i]*t[i];tt+=t[i]*t[i]}const a=et/(tt+1e-12);let num=0,den=0;for(let i=4096;i<e.length-4096;i++){const s=a*t[i],r=e[i]-s;num+=s*s;den+=r*r}return 10*Math.log10(num/(den+1e-12))};
 const sdr0=(m,t)=>sisdr(m,t);const mix=S.L.map((x,i)=>(x+S.R[i])/2);
 for(const k of ['drums','bass','vox','other'])console.log(k.padEnd(6),'SI-SDR est',sisdr(est[k],tru[k]).toFixed(1),'dB   (mix as estimate:',sdr0(mix,tru[k]).toFixed(1),'dB)');
 {const MIN={drums:0,bass:3,vox:10};let bad=0;for(const k in MIN){const v=sisdr(est[k],tru[k]);if(!(v>=MIN[k])){console.error('FAIL',k,v.toFixed(1),'dB <',MIN[k]);bad++}}if(bad)process.exitCode=1;else console.log('PASS: stem SI-SDR above minimums',JSON.stringify(MIN));}
 const names=['drums','bass','vox','other'];console.log('leak matrix (rows=estimate, cols=true source; dB rel. est energy)');
 names.forEach(k=>{const e=est[k];let tot=0;for(let i=0;i<e.length;i++)tot+=e[i]*e[i];console.log(k.padEnd(6),names.map(j=>{const t=tru[j];let c=0,tt=0;for(let i=0;i<e.length;i++){c+=e[i]*t[i];tt+=t[i]*t[i]}const share=c*c/(tt+1e-12)/(tot+1e-12);return j+' '+(share*100).toFixed(0).padStart(3)+'%'}).join('  '))});
 {const res=est.other.map((x,i)=>x-tru.other[i]);let tot=0;for(const x of res)tot+=x*x;console.log('other residual share by cause (drums|bass|vox):',['drums','bass','vox'].map(j=>{const t=tru[j];let c=0,tt=0;for(let i=0;i<res.length;i++){c+=res[i]*t[i];tt+=t[i]*t[i]}return (c*c/(tt+1e-12)/tot*100).toFixed(0)+'%'}).join(' '),'; other level dB',(10*Math.log10(tru.other.reduce((a,x)=>a+x*x,0)/tru.other.length)).toFixed(1),'drums level',(10*Math.log10(tru.drums.reduce((a,x)=>a+x*x,0)/tru.drums.length)).toFixed(1))}
 // reconstruction check
 let err=0,en=0;for(let i=0;i<S.n;i++){const rec=est.drums[i]+est.bass[i]+est.vox[i]+est.other[i];err+=Math.pow(rec-mix[i],2);en+=mix[i]*mix[i]}console.log('sum-to-mix error',(10*Math.log10(err/en+1e-20)).toFixed(1),'dB');
 // vocal presence: energy of vox stem first 4 bars vs after
 const bl=Math.floor(4*4*60/S.BPM*S.sr);let a=0,b=0;for(let i=0;i<bl;i++)a+=est.vox[i]**2;for(let i=bl;i<2*bl;i++)b+=est.vox[i]**2;console.log('vox energy bars1-4 vs 5-8:',(10*Math.log10(a/bl+1e-12)).toFixed(1),(10*Math.log10(b/bl+1e-12)).toFixed(1),'dB');
});
