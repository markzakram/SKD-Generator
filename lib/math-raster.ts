import { escapeHtml, mathParts, mathSvg, sizedMathSvg } from './math';
import type { Raster } from './export';
type Rasterizer=(svg:string,scale?:number)=>Promise<Raster>;
export async function prepareMathImages(texts:string[],rasterize:Rasterizer){
  const values=[...new Set(texts.flatMap(s=>mathParts(s).flatMap(p=>p.kind==='math'?[p.value]:[])))];
  const images=new Map<string,Raster>();
  // Sequential conversion bounds canvas memory for large packages.
  for(const value of values)images.set(value,await rasterize(sizedMathSvg(value,16).replaceAll('#142b49','#000000')));
  return images;
}
export function mathImageHtml(text:string,images:Map<string,Raster>){
  return mathParts(text).map(p=>{
    if(p.kind==='text')return escapeHtml(p.value);
    const image=images.get(p.value);if(!image)return escapeHtml('\\('+p.value+'\\)');
    return `<img src="${image.url}" width="${image.width}" height="${image.height}" style="vertical-align:middle" alt="${escapeHtml(p.value)}">`;
  }).join('');
}
// Draw prose and typeset formulae on shared baselines. One image per line permits
// natural PDF page breaks and avoids SVG foreignObject/browser-font dependencies.
export async function mathLines(text:string,size:number,bold:boolean,maxWidth:number,rasterize:Rasterizer):Promise<Raster[]> {
  const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
  if(!ctx)throw new Error('Canvas tidak tersedia.');
  const font=`${bold?'bold ':''}${size}px Arial`;
  ctx.font=font;
  type Token={text?:string;image?:HTMLImageElement;width:number;ascent:number;descent:number;newline?:boolean};
  const tokens:Token[]=[];
  for(const p of mathParts(text)){
    if(p.kind==='math'){
      const m=mathSvg(p.value),r=await rasterize(sizedMathSvg(p.value,size).replaceAll('#142b49','#000000'));
      const image=new Image();await new Promise<void>((resolve,reject)=>{image.onload=()=>resolve();image.onerror=()=>reject(new Error('Rumus gagal disiapkan.'));image.src=r.url;});
      const scale=Math.min(1,maxWidth/r.width);
      if(p.display)tokens.push({width:0,ascent:0,descent:0,newline:true});
      tokens.push({image,width:r.width*scale,ascent:(m.height-m.depth)*size*scale,descent:m.depth*size*scale});
      if(p.display)tokens.push({width:0,ascent:0,descent:0,newline:true});
    }else for(const word of p.value.split(/(\n|[ \t]+)/).filter(Boolean)){
      ctx.font=font;
      if(word==='\n'){tokens.push({width:0,ascent:0,descent:0,newline:true});continue;}
      // Long URLs/words also wrap rather than overflowing the image.
      let rest=word;while(rest){let n=rest.length;while(n>1&&ctx.measureText(rest.slice(0,n)).width>maxWidth)n--;
        const t=rest.slice(0,n);tokens.push({text:t,width:ctx.measureText(t).width,ascent:size*.85,descent:size*.25});rest=rest.slice(n);}
    }
  }
  const lines:Token[][]=[];let line:Token[]=[],width=0;
  const flush=()=>{if(line.length)lines.push(line);line=[];width=0;};
  for(const token of tokens){if(token.newline){flush();continue;}if(width+token.width>maxWidth&&line.length)flush();if(!line.length&&token.text?.trim()==='')continue;line.push(token);width+=token.width;}flush();
  const results:Raster[]=[];
  for(const row of lines){
    const ascent=Math.max(size*.85,...row.map(t=>t.ascent)),descent=Math.max(size*.25,...row.map(t=>t.descent));
    const height=Math.ceil(ascent+descent+size*.25),scale=3;
    canvas.width=Math.ceil(maxWidth*scale);canvas.height=height*scale;ctx.scale(scale,scale);
    ctx.fillStyle='#fff';ctx.fillRect(0,0,maxWidth,height);ctx.fillStyle='#000';ctx.font=font;ctx.textBaseline='alphabetic';
    let x=0;const baseline=ascent+size*.1;
    for(const t of row){if(t.image)ctx.drawImage(t.image,x,baseline-t.ascent,t.width,t.ascent+t.descent);else ctx.fillText(t.text??'',x,baseline);x+=t.width;}
    const url=canvas.toDataURL('image/png');results.push({url,data:Uint8Array.from(atob(url.split(',')[1]),c=>c.charCodeAt(0)),width:maxWidth,height});
  }
  return results;
}
