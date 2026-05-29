// Extrait les 2 couleurs dominantes d'une image via Canvas.
// cb(c1, c2) avec des hex ; cb(null, null) si échec / image illisible.
export const extraireCouleurs = (src, cb) => {
  const img = new Image();
  img.onload = () => {
    try {
      const S = 80; // résolution réduite pour perf
      const canvas = document.createElement("canvas");
      canvas.width = S; canvas.height = S;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, S, S);
      const px = ctx.getImageData(0, 0, S, S).data;
      const freq = {};
      for(let i=0;i<px.length;i+=4){
        const [r,g,b,a] = [px[i],px[i+1],px[i+2],px[i+3]];
        if(a<100) continue;                        // transparent
        if(r>230&&g>230&&b>230) continue;          // blanc
        if(r<25&&g<25&&b<25) continue;             // noir
        // Quantiser (grouper les teintes proches)
        const k=`${Math.round(r/28)*28},${Math.round(g/28)*28},${Math.round(b/28)*28}`;
        freq[k]=(freq[k]||0)+1;
      }
      const tri = Object.entries(freq).sort((a,b)=>b[1]-a[1]);
      if(!tri.length){cb(null,null);return;}
      const hex=([r,g,b])=>"#"+[r,g,b].map(v=>Math.min(255,v).toString(16).padStart(2,"0")).join("");
      const c1rgb = tri[0][0].split(",").map(Number);
      const c1 = hex(c1rgb);
      let c2=null;
      for(const [k] of tri.slice(1)){
        const rgb=k.split(",").map(Number);
        const d=Math.sqrt(c1rgb.reduce((s,v,i)=>s+(v-rgb[i])**2,0));
        if(d>70){c2=hex(rgb);break;}
      }
      cb(c1, c2||"#00C48C");
    } catch{ cb(null,null); }
  };
  img.onerror=()=>cb(null,null);
  img.src=src;
};
