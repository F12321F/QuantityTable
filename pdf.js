'use strict';
// Render local CJK fonts at 192 DPI. The preview uses the exact JPEG pages
// embedded in the PDF, without a network service or a PDF browser plug-in.
window.createQuantityPDF=async function(data,{fmt,rowWeight,caption=''},options={}){
  const logo=document.getElementById('companyLogo');if(!logo)throw new Error('找不到公司 Logo');await logo.decode();
  const custom=data.columns||[],landscape=custom.length>0,pages=[],pageImages=[];
  const W=landscape?1123:794,H=landscape?794:1123,SCALE=2,margin=44;
  const pageWidth=landscape?841.89:595.28,pageHeight=landscape?595.28:841.89;
  const columns=[
    {name:'品項編號',ratio:1.05,value:r=>r.code},{name:'品項名稱',ratio:1.6,value:r=>r.name},{name:'規格',ratio:1.6,value:r=>r.spec||'—'},
    {name:'數量（件）',ratio:.7,number:true,value:r=>fmt(Number(r.quantity),0)},
    {name:'單重（kg）',ratio:1,number:true,value:r=>r.weight===''?'待填':fmt(Number(r.weight))},
    {name:'總重量（kg）',ratio:1.15,number:true,value:r=>r.weight===''?'待填':fmt(rowWeight(r))},
    ...custom.map(c=>({name:c.name,ratio:1.1,value:r=>r.extra?.[c.id]||'—'}))
  ];
  const totalRatio=columns.reduce((sum,c)=>sum+c.ratio,0);let left=margin;
  columns.forEach(c=>{c.x=left;c.width=(W-margin*2)*c.ratio/totalRatio;left+=c.width;});
  let canvas,ctx,y;
  function text(value,x,top,size=12,color='#263f38',align='left',bold=false){ctx.fillStyle=color;ctx.font=`${bold?'600':'400'} ${size}px "Noto Sans CJK TC", "Microsoft JhengHei", sans-serif`;ctx.textAlign=align;ctx.textBaseline='top';ctx.fillText(String(value),x,top);}
  function lines(value,width,size=12){
    ctx.font=`400 ${size}px "Noto Sans CJK TC", "Microsoft JhengHei", sans-serif`;const result=[];
    for(const paragraph of String(value).split('\n')){let line='';for(const character of paragraph){if(ctx.measureText(line+character).width>width&&line){result.push(line);line=character;}else line+=character;}result.push(line);}return result;
  }
  function wrapped(value,x,top,width,size=12,color='#263f38'){const content=lines(value,width,size);content.forEach((line,i)=>text(line,x,top+i*(size+6),size,color));return content.length*(size+6);}
  function startPage(){
    canvas=document.createElement('canvas');canvas.width=W*SCALE;canvas.height=H*SCALE;ctx=canvas.getContext('2d');if(!ctx)throw new Error('瀏覽器不支援繪圖匯出');ctx.scale(SCALE,SCALE);ctx.fillStyle='white';ctx.fillRect(0,0,W,H);
    ctx.drawImage(logo,margin,36,190,190*logo.naturalHeight/logo.naturalWidth);text('圓盤系統支撐架產品數量表',margin,82,24,'#164c43','left',true);y=128;
    const leftWidth=(W-margin*2)*.64,rightX=margin+leftWidth+24,rightWidth=W-margin-rightX;
    y+=Math.max(wrapped(`客戶名稱：${data.customer||'—'}`,margin,y,leftWidth),wrapped(`日期：${data.date||'—'}`,rightX,y,rightWidth))+8;
    y+=Math.max(wrapped(`工程名稱：${data.project||'—'}`,margin,y,leftWidth),wrapped(`製表人：${data.author||'—'}`,rightX,y,rightWidth))+22;
    const content=columns.map(c=>lines(c.name,c.width-16,10)),height=Math.max(34,...content.map(list=>list.length*17+16));ctx.fillStyle='#edf2e8';ctx.fillRect(margin,y,W-margin*2,height);
    columns.forEach((c,i)=>content[i].forEach((line,j)=>text(line,c.number?c.x+c.width-8:c.x+8,y+9+j*17,10,'#365544',c.number?'right':'left',true)));y+=height;
  }
  function finishPage(){text(`第 ${pages.length+1} 頁`,W-margin,H-41,10,'#7b8678','right');const dataURL=canvas.toDataURL('image/jpeg',.94);if(options.preview)pageImages.push(dataURL);const raw=atob(dataURL.split(',')[1]);pages.push(Uint8Array.from(raw,c=>c.charCodeAt(0)));}
  startPage();
  for(const row of data.rows){
    const size=custom.length?11:12,cells=columns.map(c=>lines(c.value(row),c.width-16,c.number?11:size));const height=Math.max(43,...cells.map((list,i)=>list.length*((columns[i].number?11:size)+6)+20));
    if(y+height>H-85){finishPage();startPage();}
    columns.forEach((c,i)=>cells[i].forEach((line,j)=>text(line,c.number?c.x+c.width-8:c.x+8,y+12+j*((c.number?11:size)+6),c.number?11:size,c.number&&i>=4&&row.weight===''?'#9e7a31':'#263f38',c.number?'right':'left')));
    ctx.strokeStyle='#e0e5dd';ctx.lineWidth=.6;ctx.beginPath();ctx.moveTo(margin,y+height);ctx.lineTo(W-margin,y+height);ctx.stroke();y+=height;
  }
  if(y+130>H-85){finishPage();startPage();}y+=22;text(`已知總重量：${fmt(data.sum.grams/1000)} kg`,margin,y,18,'#164c43','left',true);y+=31;
  if(data.sum.pending){text(`注意：${data.sum.pending} 項缺少單重，尚未計入總重量。`,margin,y,12,'#9e7a31');y+=26;}
  if(data.notes){y+=12;for(const line of lines('備註：'+data.notes,W-margin*2,12)){if(y+20>H-85){finishPage();startPage();y+=10;}text(line,margin,y);y+=18;}}
  y+=17;for(const line of lines(caption,W-margin*2,10)){if(y+16>H-65){finishPage();startPage();}text(line,margin,y,10,'#7b8678');y+=16;}finishPage();
  const encoder=new TextEncoder(),parts=[],offsets=[0];let length=0;
  const push=value=>{const bytes=typeof value==='string'?encoder.encode(value):value;parts.push(bytes);length+=bytes.length;};
  const object=(n,body)=>{offsets[n]=length;push(`${n} 0 obj\n`);push(body);push('\nendobj\n');};
  push('%PDF-1.4\n');object(1,'<< /Type /Catalog /Pages 2 0 R >>');object(2,`<< /Type /Pages /Count ${pages.length} /Kids [${pages.map((_,i)=>`${3+i*3} 0 R`).join(' ')}] >>`);
  pages.forEach((bytes,i)=>{
    const n=3+i*3;object(n,`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /XObject << /Im0 ${n+1} 0 R >> >> /Contents ${n+2} 0 R >>`);
    offsets[n+1]=length;push(`${n+1} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${W*SCALE} /Height ${H*SCALE} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${bytes.length} >>\nstream\n`);push(bytes);push('\nendstream\nendobj\n');
    const content=`q\n${pageWidth} 0 0 ${pageHeight} 0 0 cm\n/Im0 Do\nQ\n`;object(n+2,`<< /Length ${encoder.encode(content).length} >>\nstream\n${content}endstream`);
  });
  const xref=length;push(`xref\n0 ${offsets.length}\n0000000000 65535 f \n`);for(let i=1;i<offsets.length;i++)push(`${String(offsets[i]).padStart(10,'0')} 00000 n \n`);push(`trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  const blob=new Blob(parts,{type:'application/pdf'});return options.preview?{blob,pages:pageImages,width:W,height:H}:blob;
};
