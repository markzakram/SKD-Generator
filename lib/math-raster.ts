import { escapeHtml, mathParts, mathSvg, sizedMathSvg, type MathStyle } from './math';
import { COLOR_HEX, richRuns } from './richtext';
import { tableGrid, type TableCell } from './table';
import type { Raster } from './export';
type Rasterizer=(svg:string,scale?:number)=>Promise<Raster>;
export const mathImageKey = (latex:string,color?:string,style:MathStyle={}) => (style.bold?'bold:':'')+(style.strike?'strike:':'')+(color?color+':':'')+latex;
export async function prepareMathImages(texts:string[],rasterize:Rasterizer){
  const values=new Map(texts.flatMap(s=>richRuns(s).flatMap(run=>mathParts(run.text).flatMap(p=>p.kind==='math'?[[mathImageKey(p.value,run.color,run),{value:p.value,color:COLOR_HEX[run.color??'']??'000000',style:run}] as const]:[]))));
  const images=new Map<string,Raster>();
  // Sequential conversion bounds canvas memory for large packages.
  for(const [key,{value,color,style}] of values)images.set(key,await rasterize(sizedMathSvg(value,16,style).replaceAll('#142b49','#'+color)));
  return images;
}
export function mathImageHtml(text:string,images:Map<string,Raster>,color?:string,style:MathStyle={}){
  return mathParts(text).map(p=>{
    if(p.kind==='text')return escapeHtml(p.value);
    const image=images.get(mathImageKey(p.value,color,style));if(!image)return escapeHtml('\\('+p.value+'\\)');
    return `<img src="${image.url}" width="${image.width}" height="${image.height}" style="vertical-align:middle" alt="${escapeHtml(p.value)}">`;
  }).join('');
}
// Draw prose and typeset formulae on shared baselines. One image per line permits
// natural PDF page breaks and avoids SVG foreignObject/browser-font dependencies.
export async function mathLines(text:string,size:number,bold:boolean,maxWidth:number,rasterize:Rasterizer):Promise<Raster[]> {
  const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
  if(!ctx)throw new Error('Canvas tidak tersedia.');
  const fontOf=(heavy:boolean)=>`${heavy?'bold ':''}${size}px "Times New Roman",serif`;
  ctx.font=fontOf(bold);
  // `heavy`/`strike`: tebal dan coret dari penanda **teks** dan ~~teks~~ (lib/richtext.ts); coretan digambar dengan fillRect sehingga tidak bergantung pada API canvas lain.
  type Token={text?:string;image?:HTMLImageElement;width:number;ascent:number;descent:number;newline?:boolean;heavy?:boolean;strike?:boolean;color?:string};
  const tokens:Token[]=[];
  for(const run of richRuns(text))for(const p of mathParts(run.text)){
    const heavy=bold||!!run.bold,strike=!!run.strike,color='#'+(COLOR_HEX[run.color??'']??'000000');
    if(p.kind==='math'){
      const m=mathSvg(p.value,{bold:heavy}),r=await rasterize(sizedMathSvg(p.value,size,{bold:heavy}).replaceAll('#142b49',color));
      const image=new Image();await new Promise<void>((resolve,reject)=>{image.onload=()=>resolve();image.onerror=()=>reject(new Error('Rumus gagal disiapkan.'));image.src=r.url;});
      const scale=Math.min(1,maxWidth/r.width);
      if(p.display)tokens.push({width:0,ascent:0,descent:0,newline:true});
      tokens.push({image,width:r.width*scale,ascent:(m.height-m.depth)*size*scale,descent:m.depth*size*scale,strike,color});
      if(p.display)tokens.push({width:0,ascent:0,descent:0,newline:true});
    }else for(const word of p.value.split(/(\n|[ \t]+)/).filter(Boolean)){
      ctx.font=fontOf(heavy);
      if(word==='\n'){tokens.push({width:0,ascent:0,descent:0,newline:true});continue;}
      // Long URLs/words also wrap rather than overflowing the image.
      let rest=word;while(rest){let n=rest.length;while(n>1&&ctx.measureText(rest.slice(0,n)).width>maxWidth)n--;
        const t=rest.slice(0,n);tokens.push({text:t,width:ctx.measureText(t).width,ascent:size*.85,descent:size*.25,heavy,strike,color});rest=rest.slice(n);}
    }
  }
  const lines:Token[][]=[];let line:Token[]=[],width=0;
  const flush=()=>{if(line.length)lines.push(line);line=[];width=0;};
  for(const token of tokens){if(token.newline){flush();continue;}if(width+token.width>maxWidth&&line.length)flush();if(!line.length&&token.text?.trim()==='')continue;line.push(token);width+=token.width;}flush();
  const results:Raster[]=[];
  for(const row of lines){
    const ascent=Math.max(size*.85,...row.map(t=>t.ascent)),descent=Math.max(size*.25,...row.map(t=>t.descent));
    const height=Math.ceil(ascent+descent+size*.4),scale=3; // teks 12 pt dengan spasi 1,5 mengikuti panduan
    canvas.width=Math.ceil(maxWidth*scale);canvas.height=height*scale;ctx.scale(scale,scale);
    ctx.fillStyle='#fff';ctx.fillRect(0,0,maxWidth,height);ctx.fillStyle='#000';ctx.font=fontOf(bold);ctx.textBaseline='alphabetic';
    let x=0;const baseline=ascent+size*.1,rule=Math.max(1,size*.07);
    for(const t of row){
      ctx.fillStyle=t.color??'#000000';
      if(t.image)ctx.drawImage(t.image,x,baseline-t.ascent,t.width,t.ascent+t.descent);else{ctx.font=fontOf(!!t.heavy);ctx.fillText(t.text??'',x,baseline);}
      // Coretan menutup juga spasi antarkata di dalam bagian yang dicoret: satu garis per potongan kata dan spasinya.
      if(t.strike)ctx.fillRect(x,baseline-size*.3,t.width,rule);
      x+=t.width;
    }
    const url=canvas.toDataURL('image/png');results.push({url,data:Uint8Array.from(atob(url.split(',')[1]),c=>c.charCodeAt(0)),width:maxWidth,height,content:x});
  }
  return results;
}

// Tabel pembahasan sebagai satu gambar (PDF dan PNG): garis sel, kolom sama lebar, header tebal, sel kosong dan judul selebar tabel
// (lib/table.ts: tableGrid); sel header ditengahkan seperti di layar. Isi tiap sel memakai mathLines sehingga rumus dan teks sebaris seperti di bagian lain. Hanya memakai
// fillRect dan drawImage untuk menggambar. `size` dan `maxWidth` dalam piksel layar (96 dpi), seperti mathLines.
export async function tableRaster(table:{headers:string[];rows:string[][]},size:number,maxWidth:number,rasterize:Rasterizer,box=false):Promise<Raster> {
  const grid=tableGrid(table),pad=Math.round(size*.45),column=maxWidth/grid.columns,scale=3,minRow=size*1.5;
  type Laid={x:number;w:number;mark:boolean;center:boolean;lines:Raster[];height:number};
  const layout=async(cells:TableCell[],bold:boolean,center=false):Promise<Laid[]>=>{
    const out:Laid[]=[];let x=0;
    for(const cell of cells){
      const w=column*cell.span,lines=cell.text?await mathLines(cell.text,size,bold||cell.mark,w-2*pad,rasterize):[];
      out.push({x,w,mark:cell.mark,center:bold||center,lines,height:lines.reduce((sum,line)=>sum+line.height,0)});x+=w;
    }
    return out;
  };
  const rows:{cells:Laid[];height:number}[]=[];
  for(const [cells,bold] of [...(grid.header?[[grid.header,true] as const]:[]),...grid.rows.map(row=>[row,false] as const)])
    {const laid=await layout(cells,bold,grid.centered);rows.push({cells:laid,height:Math.max(minRow,...laid.map(cell=>cell.height+2*pad))});}
  const total=rows.reduce((sum,row)=>sum+row.height,0)+1;
  const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
  if(!ctx)throw new Error('Canvas tidak tersedia.');
  canvas.width=Math.ceil(maxWidth*scale);canvas.height=Math.ceil(total*scale);ctx.scale(scale,scale);
  ctx.fillStyle='#fff';ctx.fillRect(0,0,maxWidth,total);ctx.fillStyle='#000';
  const rule=(x:number,y:number,w:number,h:number)=>ctx.fillRect(x,y,w,h);
  let y=0;rule(0,0,maxWidth,1);
  for(const row of rows){
    for(const cell of row.cells){
      rule(cell.x,y,1,row.height);rule(cell.x+cell.w-1,y,1,row.height);if(!box||row===rows[rows.length-1])rule(cell.x,y+row.height,cell.w,1);
      if(cell.mark){rule(cell.x+2,y+2,cell.w-4,2);rule(cell.x+2,y+row.height-4,cell.w-4,2);}
      let top=y+(row.height-cell.height)/2;
      for(const line of cell.lines){
        const image=new Image();await new Promise<void>((resolve,reject)=>{image.onload=()=>resolve();image.onerror=()=>reject(new Error('Tabel gagal disiapkan.'));image.src=line.url;});
        const ink = Math.min(line.width, line.content ?? line.width);
        const left = cell.x + pad + (cell.center ? Math.max(0, (cell.w - 2 * pad - ink) / 2) : 0);
        // Potong ruang putih di kanan sebelum menengahkan; jangan sampai gambar
        // baris menimpa garis sel atau isi kolom di sebelahnya.
        if (ink > 0) ctx.drawImage(image, 0, 0, image.width * ink / line.width, image.height, left, top, ink, line.height);
        top += line.height;
      }
    }
    y+=row.height;
  }
  const url=canvas.toDataURL('image/png');
  return {url,data:Uint8Array.from(atob(url.split(',')[1]),c=>c.charCodeAt(0)),width:maxWidth,height:total};
}
