#!/usr/bin/env node
var fs=require('fs'),path=require('path'),zlib=require('zlib');
var SKINS_DIR=path.join(__dirname,'skins');
var PX=8;
var BODY=[[3,0],[4,0],[8,0],[9,0],[2,1],[3,1],[4,1],[5,1],[6,1],[7,1],[8,1],[9,1],[10,1],[1,2],[2,2],[3,2],[4,2],[5,2],[6,2],[7,2],[8,2],[9,2],[10,2],[11,2],[1,3],[2,3],[5,3],[6,3],[7,3],[10,3],[11,3],[1,4],[2,4],[3,4],[4,4],[5,4],[6,4],[7,4],[8,4],[9,4],[10,4],[11,4],[1,5],[2,5],[3,5],[4,5],[5,5],[6,5],[7,5],[8,5],[9,5],[10,5],[11,5],[2,6],[3,6],[4,6],[5,6],[6,6],[7,6],[8,6],[9,6],[10,6],[3,7],[4,7],[8,7],[9,7],[3,8],[4,8],[8,8],[9,8]];
var EYES=[[3,3],[4,3],[8,3],[9,3]];

function px(OX,OY,x,y,fill,attrs,inner){
  var s='<rect x="'+(OX+x*PX)+'" y="'+(OY+y*PX)+'" width="'+PX+'" height="'+PX+'" fill="'+fill+'"'+(attrs||'');
  return inner?s+'>'+inner+'</rect>':s+'/>';
}
function gf(id,sd){return '<filter id="'+id+'"><feGaussianBlur in="SourceGraphic" stdDeviation="'+(sd||1.5)+'" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>';}
function mkEyeGlow(OX,OY,color,r){
  r=r||8;var lx=OX+4*PX,ly=OY+3*PX+PX/2,rx=OX+9*PX;
  var a='<animate attributeName="opacity" values="0.15;0.4;0.15" dur="3s" repeatCount="indefinite"/>';
  return '<circle cx="'+lx+'" cy="'+ly+'" r="'+r+'" fill="'+color+'" opacity="0.3">'+a+'</circle><circle cx="'+rx+'" cy="'+ly+'" r="'+r+'" fill="'+color+'" opacity="0.3">'+a+'</circle>';
}

/* ── ANIM Registry ── */
var ANIM={};
ANIM.fire=function(){return{
  extraDefs:gf('fgl',2),extraFilter:'fgl',
  extraInner:function(i){var d=['0','0.07','0.14','0.04','0.18','0.11'];return '<animate attributeName="opacity" values="1;0.1;0.7;0.15;1" dur="0.3s" begin="'+(d[i]||'0')+'s" repeatCount="indefinite"/>';}
};};
ANIM.holographic=function(){
  var C=['#ff4081','#e040fb','#7c4dff','#00e5ff','#69f0ae','#ffeb3b'];
  return{
    bodyFill:function(c,r){return C[(c+r)%C.length];},
    bodyInner:function(c,r){var o=(c+r)%C.length,v=[];for(var j=0;j<C.length;j++)v.push(C[(j+o)%C.length]);v.push(v[0]);return '<animate attributeName="fill" values="'+v.join(';')+'" dur="4s" begin="'+((c+r)*0.06).toFixed(2)+'s" repeatCount="indefinite"/>';}
  };
};
ANIM.shadow=function(){return{
  eyeInner:'<animate attributeName="fill" values="#ff0044;#cc0033;#ff0044" dur="3s" repeatCount="indefinite"/>'
};};
ANIM.diamond=function(){return{
  extraDefs:gf('sgl',1.5),extraFilter:'sgl',
  extraInner:function(i){var d=['0','0.5','1.0','1.5'];return '<animate attributeName="opacity" values="0;1;0" dur="2s" begin="'+(d[i]||'0')+'s" repeatCount="indefinite"/>';}
};};
ANIM.demon=function(){return{
  eyeInner:'<animate attributeName="opacity" values="0.6;1;0.6" dur="2s" repeatCount="indefinite"/>'
};};
ANIM.voidWalker=function(){return{
  extraDefs:gf('vgl',3),extraFilter:'vgl',
  extraInner:function(i){var d=['0','0.4','0.8','1.2','1.6'];return '<animate attributeName="opacity" values="0.2;0.9;0.2" dur="2s" begin="'+(d[i]||'0')+'s" repeatCount="indefinite"/>';}
};};
ANIM.aurora=function(){
  var C=['#00e676','#00bcd4','#7c4dff','#e040fb','#00e676','#00bcd4'];
  return{
    bodyFill:function(c,r){return C[(c+r)%C.length];},
    bodyInner:function(c,r){var o=(c+r)%C.length,v=[];for(var j=0;j<C.length;j++)v.push(C[(j+o)%C.length]);v.push(v[0]);return '<animate attributeName="fill" values="'+v.join(';')+'" dur="3s" begin="'+((c+r)*0.05).toFixed(2)+'s" repeatCount="indefinite"/>';}
  };
};
ANIM.accentPulse=function(){return{
  extraDefs:gf('apl',2),extraFilter:'apl',
  extraInner:function(i){var d=['0','0.4','0.8','1.2'];return '<animate attributeName="opacity" values="0.4;1;0.4" dur="2s" begin="'+(d[i]||'0')+'s" repeatCount="indefinite"/>';}
};};

/* ── SVG Generator ── */
function genSVG(o){
  var bodyColor=o.bodyColor||'#e8834a',eyeColor=o.eyeColor||'#1a1a1a';
  var W=136,H=128,OX=16,OY=24,CX=68,CY=56;
  var defs='',fill=bodyColor,isStatic=o._static;
  var anim=null;
  if(!isStatic&&o.animationId&&ANIM[o.animationId]) anim=ANIM[o.animationId]();
  var gs=isStatic?'':' stroke="#000" stroke-opacity="0.2" stroke-width="0.5"';
  if(o.gradient){
    var g=o.gradient,st=g.stops.map(function(s,i){
      var inner='';if(anim&&anim.stopAnims&&anim.stopAnims[i])inner=anim.stopAnims[i];
      return inner?'<stop offset="'+s.offset+'" stop-color="'+s.color+'">'+inner+'</stop>':'<stop offset="'+s.offset+'" stop-color="'+s.color+'"/>';
    }).join('');
    defs+='<linearGradient id="'+g.id+'" x1="'+(g.x1||0)+'" y1="'+(g.y1||0)+'" x2="'+(g.x2||0)+'" y2="'+(g.y2||1)+'">'+st+'</linearGradient>';
    fill='url(#'+g.id+')';
  }
  if(o.extraDefs)defs+=o.extraDefs;
  if(anim&&anim.extraDefs)defs+=anim.extraDefs;
  var body=BODY.map(function(p){
    var f=fill,inner='';
    if(anim&&anim.bodyFill)f=anim.bodyFill(p[0],p[1]);
    if(anim&&anim.bodyInner)inner=anim.bodyInner(p[0],p[1]);
    return px(OX,OY,p[0],p[1],f,gs,inner);
  }).join('\n    ');
  var egSvg='';
  if(!isStatic&&o.eyeGlow)egSvg=mkEyeGlow(OX,OY,o.eyeGlow);
  var ec=o.eyeGlow||eyeColor;
  var ei=(!isStatic&&anim&&anim.eyeInner)?anim.eyeInner:'';
  var eyes=EYES.map(function(p){return px(OX,OY,p[0],p[1],ec,'',ei);}).join('\n    ');
  var extras='';
  if(o.extraPixels){
    var ef=(anim&&anim.extraFilter)?' filter="url(#'+anim.extraFilter+')"':'';
    extras=o.extraPixels.map(function(p,i){
      var inner=(!isStatic&&anim&&anim.extraInner)?anim.extraInner(i):'';
      var filt=ef||(p.filter?' filter="url(#'+p.filter+')"':'');
      return px(OX,OY,p.x,p.y,p.color,filt,inner);
    }).join('\n    ');
  }
  var acc='';if(o.accessoriesFn)acc=o.accessoriesFn(OX,OY,PX);
  var svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+W+' '+H+'" width="'+W+'" height="'+H+'">\n';
  if(defs)svg+='  <defs>'+defs+'</defs>\n';
  if(!isStatic){
    svg+='  <g transform="translate('+CX+','+CY+')">\n  <g id="mascot">\n';
    svg+='    <animateTransform attributeName="transform" type="scale" values="1;1.015;1" dur="3s" repeatCount="indefinite"/>\n';
    svg+='    <g transform="translate(-'+CX+',-'+CY+')">\n';
  }else{svg+='  <g id="mascot">\n';}
  svg+='    <g id="body">\n    '+body+'\n    </g>\n';
  if(egSvg)svg+='    <g id="eyeglow">\n    '+egSvg+'\n    </g>\n';
  svg+='    <g id="eyes">\n    '+eyes+'\n    </g>\n';
  if(extras)svg+='    <g id="extras">\n    '+extras+'\n    </g>\n';
  if(acc)svg+='    <g id="acc" class="laser">\n    '+acc+'\n    </g>\n';
  if(!isStatic){svg+='    </g>\n  </g>\n  </g>\n';}else{svg+='  </g>\n';}
  svg+='</svg>';return svg;
}
function genIcon(o){
  var s={};for(var k in o)s[k]=o[k];delete s.animationId;s._static=true;
  return genSVG(s).replace(/viewBox="([^"]+)" width="\d+" height="\d+"/,'viewBox="$1" width="32" height="32"');
}
/* ── Claude Logo (asterisk) recolored ── */
var CLAUDE_LOGO_PATH='M4.709 15.955l4.72-2.647.08-.23-.08-.128H9.2l-.79-.048-2.698-.073-2.339-.097-2.266-.122-.571-.121L0 11.784l.055-.352.48-.321.686.06 1.52.103 2.278.158 1.652.097 2.449.255h.389l.055-.157-.134-.098-.103-.097-2.358-1.596-2.552-1.688-1.336-.972-.724-.491-.364-.462-.158-1.008.656-.722.881.06.225.061.893.686 1.908 1.476 2.491 1.833.365.304.145-.103.019-.073-.164-.274-1.355-2.446-1.446-2.49-.644-1.032-.17-.619a2.97 2.97 0 01-.104-.729L6.283.134 6.696 0l.996.134.42.364.62 1.414 1.002 2.229 1.555 3.03.456.898.243.832.091.255h.158V9.01l.128-1.706.237-2.095.23-2.695.08-.76.376-.91.747-.492.584.28.48.685-.067.444-.286 1.851-.559 2.903-.364 1.942h.212l.243-.242.985-1.306 1.652-2.064.73-.82.85-.904.547-.431h1.033l.76 1.129-.34 1.166-1.064 1.347-.881 1.142-1.264 1.7-.79 1.36.073.11.188-.02 2.856-.606 1.543-.28 1.841-.315.833.388.091.395-.328.807-1.969.486-2.309.462-3.439.813-.042.03.049.061 1.549.146.662.036h1.622l3.02.225.79.522.474.638-.079.485-1.215.62-1.64-.389-3.829-.91-1.312-.329h-.182v.11l1.093 1.068 2.006 1.81 2.509 2.33.127.578-.322.455-.34-.049-2.205-1.657-.851-.747-1.926-1.62h-.128v.17l.444.649 2.345 3.521.122 1.08-.17.353-.608.213-.668-.122-1.374-1.925-1.415-2.167-1.143-1.943-.14.08-.674 7.254-.316.37-.729.28-.607-.461-.322-.747.322-1.476.389-1.924.315-1.53.286-1.9.17-.632-.012-.042-.14.018-1.434 1.967-2.18 2.945-1.726 1.845-.414.164-.717-.37.067-.662.401-.589 2.388-3.036 1.44-1.882.93-1.086-.006-.158h-.055L4.132 18.56l-1.13.146-.487-.456.061-.746.231-.243 1.908-1.312-.006.006z';
function genLogo(color){
  return '<svg height="256" width="256" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="'+CLAUDE_LOGO_PATH+'" fill="'+color+'" fill-rule="nonzero"/></svg>';
}

/* ── PNG Icon Generator (pure Node, no deps) ── */
var crcTable=(function(){var t=new Uint32Array(256);for(var n=0;n<256;n++){var c=n;for(var k=0;k<8;k++)c=(c&1)?(0xedb88320^(c>>>1)):(c>>>1);t[n]=c;}return t;})();
function crc32(buf){var c=0xffffffff;for(var i=0;i<buf.length;i++)c=crcTable[(c^buf[i])&0xff]^(c>>>8);return(c^0xffffffff)>>>0;}
function pngChunk(type,data){var len=Buffer.alloc(4);len.writeUInt32BE(data.length,0);var td=Buffer.concat([Buffer.from(type),data]);var crc=Buffer.alloc(4);crc.writeUInt32BE(crc32(td),0);return Buffer.concat([len,td,crc]);}
function parseHex(hex){hex=hex.replace('#','');if(hex.length===3)hex=hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];return[parseInt(hex.substring(0,2),16),parseInt(hex.substring(2,4),16),parseInt(hex.substring(4,6),16)];}
function genPNG(o){
  var S=2; // scale factor: 2x gives 272x256
  var W=136*S,H=128*S,OX=16*S,OY=24*S,PP=PX*S;
  var rgba=Buffer.alloc(W*H*4);
  function fillRect(x,y,w,h,color,alpha){
    var c=parseHex(color),a=alpha!==undefined?Math.round(alpha*255):255;
    for(var dy=0;dy<h;dy++)for(var dx=0;dx<w;dx++){
      var px=x+dx,py=y+dy;
      if(px>=0&&px<W&&py>=0&&py<H){var idx=(py*W+px)*4;rgba[idx]=c[0];rgba[idx+1]=c[1];rgba[idx+2]=c[2];rgba[idx+3]=a;}
    }
  }
  var bodyColor=o.bodyColor||'#e8834a',eyeColor=o.eyeGlow||o.eyeColor||'#1a1a1a';
  if(o.gradient&&o.gradient.stops){var stops=o.gradient.stops;bodyColor=stops[Math.floor(stops.length/2)].color;}
  BODY.forEach(function(p){fillRect(OX+p[0]*PP,OY+p[1]*PP,PP,PP,bodyColor);});
  EYES.forEach(function(p){fillRect(OX+p[0]*PP,OY+p[1]*PP,PP,PP,eyeColor);});
  if(o.extraPixels)o.extraPixels.forEach(function(p){fillRect(OX+p.x*PP,OY+p.y*PP,PP,PP,p.color);});
  if(o.accessoriesFn){
    var accSvg=o.accessoriesFn(OX,OY,PP);
    var m,re=/<rect x="([^"]+)" y="([^"]+)" width="([^"]+)" height="([^"]+)" fill="([^"]+)"(?:\s+opacity="([^"]+)")?/g;
    while((m=re.exec(accSvg))!==null){
      var rx=Math.round(parseFloat(m[1])),ry=Math.round(parseFloat(m[2]));
      var rw=Math.round(parseFloat(m[3])),rh=Math.round(parseFloat(m[4]));
      fillRect(rx,ry,rw,rh,m[5],m[6]?parseFloat(m[6]):1.0);
    }
  }
  var scanlines=Buffer.alloc(H*(1+W*4));
  for(var y=0;y<H;y++){scanlines[y*(1+W*4)]=0;rgba.copy(scanlines,y*(1+W*4)+1,y*W*4,(y+1)*W*4);}
  var compressed=zlib.deflateSync(scanlines);
  var ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(W,0);ihdr.writeUInt32BE(H,4);ihdr[8]=8;ihdr[9]=6;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),pngChunk('IHDR',ihdr),pngChunk('IDAT',compressed),pngChunk('IEND',Buffer.alloc(0))]);
}

/* ── Accessories ── */
function acc_crown(X,Y,P){return [2,3,5,7,9,10].map(function(i){return '<rect x="'+(X+i*P)+'" y="'+(Y-P)+'" width="'+P+'" height="'+P+'" fill="#ffd700"/>';}).join('')+['#f44336','#4fc3f7','#66bb6a'].map(function(c,j){return '<rect x="'+(X+(4+j*2)*P)+'" y="'+(Y-2*P)+'" width="'+P+'" height="'+P+'" fill="'+c+'"/>';}).join('');}
function acc_tophat(X,Y,P){return '<rect x="'+(X+3*P)+'" y="'+(Y-P)+'" width="'+(7*P)+'" height="'+P+'" fill="#1a1a1a"/><rect x="'+(X+4*P)+'" y="'+(Y-2*P)+'" width="'+(5*P)+'" height="'+P+'" fill="#1a1a1a"/><rect x="'+(X+4*P)+'" y="'+(Y-3*P)+'" width="'+(5*P)+'" height="'+P+'" fill="#222"/><rect x="'+(X+5*P)+'" y="'+(Y-2*P)+'" width="'+(3*P)+'" height="'+P+'" fill="#333"/>';}
function acc_halo(X,Y,P){return '<rect x="'+(X+3*P)+'" y="'+(Y-2*P)+'" width="'+(7*P)+'" height="'+P+'" fill="#ffd700" opacity="0.8"/><rect x="'+(X+4*P)+'" y="'+(Y-3*P)+'" width="'+(5*P)+'" height="'+P+'" fill="#ffd700" opacity="0.5"/>';}
function acc_horns(X,Y,P){return '<rect x="'+(X+P)+'" y="'+(Y-P)+'" width="'+P+'" height="'+P+'" fill="#cc0000"/><rect x="'+(X+2*P)+'" y="'+(Y-2*P)+'" width="'+P+'" height="'+P+'" fill="#ff1a1a"/><rect x="'+(X+11*P)+'" y="'+(Y-P)+'" width="'+P+'" height="'+P+'" fill="#cc0000"/><rect x="'+(X+10*P)+'" y="'+(Y-2*P)+'" width="'+P+'" height="'+P+'" fill="#ff1a1a"/>';}
function acc_antenna(X,Y,P){return '<rect x="'+(X+6*P)+'" y="'+(Y-P)+'" width="'+P+'" height="'+P+'" fill="#888"/><rect x="'+(X+6*P)+'" y="'+(Y-2*P)+'" width="'+P+'" height="'+P+'" fill="#aaa"/><rect x="'+(X+6*P)+'" y="'+(Y-3*P)+'" width="'+P+'" height="'+P+'" fill="#ff0044"/>';}
function acc_shades(X,Y,P){return '<rect x="'+(X+2*P)+'" y="'+(Y+3*P)+'" width="'+(3*P)+'" height="'+P+'" fill="#111" rx="1"/><rect x="'+(X+7*P)+'" y="'+(Y+3*P)+'" width="'+(3*P)+'" height="'+P+'" fill="#111" rx="1"/><rect x="'+(X+5*P)+'" y="'+(Y+3*P)+'" width="'+(2*P)+'" height="'+Math.round(P*0.4)+'" fill="#333"/>';}
function acc_laser(X,Y,P){
  var f='<animate attributeName="opacity" values="0.9;0.1;0.7;0.15;0.9" dur="0.4s" repeatCount="indefinite"/>';
  var f2='<animate attributeName="opacity" values="0.35;0.05;0.2;0.05;0.35" dur="0.4s" begin="0.1s" repeatCount="indefinite"/>';
  return '<rect x="'+(X+3*P)+'" y="'+(Y+3*P)+'" width="'+(P*2)+'" height="'+P+'" fill="#ff0000" opacity="0.9">'+f+'</rect><rect x="'+(X+8*P)+'" y="'+(Y+3*P)+'" width="'+(P*2)+'" height="'+P+'" fill="#ff0000" opacity="0.9">'+f+'</rect><rect x="'+(X+P)+'" y="'+(Y+4*P)+'" width="'+(P*3)+'" height="'+Math.round(P*0.5)+'" fill="#ff0000" opacity="0.35">'+f2+'</rect><rect x="'+(X+9*P)+'" y="'+(Y+4*P)+'" width="'+(P*3)+'" height="'+Math.round(P*0.5)+'" fill="#ff0000" opacity="0.35">'+f2+'</rect>';
}
function acc_sol(X,Y,P){return '<circle cx="'+(X+6*P+P/2)+'" cy="'+(Y+5*P+P/2)+'" r="'+(P*0.7)+'" fill="none" stroke="#14f195" stroke-width="1.5"/><circle cx="'+(X+6*P+P/2)+'" cy="'+(Y+5*P+P/2)+'" r="'+(P*0.3)+'" fill="#14f195"/>';}
function acc_btc(X,Y,P){return '<circle cx="'+(X+6*P+P/2)+'" cy="'+(Y+5*P+P/2)+'" r="'+(P*0.8)+'" fill="#f7931a"/>';}
function acc_santa(X,Y,P){return '<rect x="'+(X+2*P)+'" y="'+(Y-P)+'" width="'+(9*P)+'" height="'+P+'" fill="#cc0000"/><rect x="'+(X+3*P)+'" y="'+(Y-2*P)+'" width="'+(7*P)+'" height="'+P+'" fill="#cc0000"/><rect x="'+(X+4*P)+'" y="'+(Y-3*P)+'" width="'+(5*P)+'" height="'+P+'" fill="#cc0000"/><rect x="'+(X+6*P)+'" y="'+(Y-4*P)+'" width="'+(3*P)+'" height="'+P+'" fill="#cc0000"/><rect x="'+(X+2*P)+'" y="'+(Y-P)+'" width="'+(9*P)+'" height="'+Math.round(P*0.4)+'" fill="#fff"/>';}
function acc_snow(X,Y,P){return '<text x="'+X+'" y="'+Y+'" font-size="'+P+'" fill="#b3e5fc" opacity="0.6">\u2744</text><text x="'+(X+11*P)+'" y="'+(Y+2*P)+'" font-size="'+(P*0.7)+'" fill="#b3e5fc" opacity="0.4">\u2744</text>';}
function acc_sakura(X,Y,P){return '<text x="'+(X+P)+'" y="'+(Y-P)+'" font-size="'+P+'" fill="#ffb7c5">\uD83C\uDF38</text><text x="'+(X+9*P)+'" y="'+Y+'" font-size="'+(P*0.7)+'" fill="#ffb7c5" opacity="0.7">\uD83C\uDF38</text>';}
function combine(){var fns=Array.from(arguments);return function(X,Y,P){return fns.map(function(f){return f(X,Y,P);}).join('\n');};}

/* ── Skin Definitions ── */
var SKINS=[
  {id:'ice-blue',name:'Ice Blue',rarity:'Common',edition:'permanent',description:'Frozen solid. Cool under pressure.',colors:{primary:'#4fc3f7',accent:'#0288d1'},mascot:{bodyColor:'#4fc3f7',eyeColor:'#0d1b2a',outline:'#81d4fa'},ascii:{line1:' \u2590\u259B\u2588\u2588\u2588\u259C\u258C',line2:' \u259C\u2588\u2588\u2588\u2588\u2588\u259B\u2598',line3:'  \u2598\u2598 \u259D\u259D'}},
  {id:'forest-green',name:'Forest Green',rarity:'Common',edition:'permanent',description:'Camouflaged in the codebase.',colors:{primary:'#66bb6a',accent:'#2e7d32'},mascot:{bodyColor:'#66bb6a',eyeColor:'#1b2e1b'},ascii:{line1:' \u2590\u259B\u2588\u2588\u2588\u259C\u258C',line2:' \u259C\u2588\u2588\u2588\u2588\u2588\u259B\u2598',line3:'  \u2598\u2598 \u259D\u259D'}},
  {id:'midnight-purple',name:'Midnight Purple',rarity:'Common',edition:'permanent',description:'Late night coding only.',colors:{primary:'#ab47bc',accent:'#6a1b9a'},mascot:{bodyColor:'#ab47bc',eyeColor:'#1a0a2e'},ascii:{line1:' \u2590\u259B\u2588\u2588\u2588\u259C\u258C',line2:' \u259C\u2588\u2588\u2588\u2588\u2588\u259B\u2598',line3:'  \u2598\u2598 \u259D\u259D'}},
  {id:'blood-red',name:'Blood Red',rarity:'Common',edition:'permanent',description:'Debugging at 3am.',colors:{primary:'#ef5350',accent:'#b71c1c'},mascot:{bodyColor:'#ef5350',eyeColor:'#1a0505'},ascii:{line1:' \u2590\u259B\u2588\u2588\u2588\u259C\u258C',line2:' \u259C\u2588\u2588\u2588\u2588\u2588\u259B\u2598',line3:'  \u2598\u2598 \u259D\u259D'}},
  {id:'slate',name:'Slate',rarity:'Common',edition:'permanent',description:'Clean. Minimal.',colors:{primary:'#78909c',accent:'#455a64'},mascot:{bodyColor:'#78909c',eyeColor:'#1a1a1a',outline:'#90a4ae'},ascii:{line1:' \u2590\u259B\u2588\u2588\u2588\u259C\u258C',line2:' \u259C\u2588\u2588\u2588\u2588\u2588\u259B\u2598',line3:'  \u2598\u2598 \u259D\u259D'}},
  {id:'gold-edition',name:'Gold Edition',rarity:'Uncommon',edition:'permanent',description:'Ship to prod with confidence.',colors:{primary:'#ffd700',accent:'#b8860b'},mascot:{bodyColor:'#ffd700',eyeColor:'#3e2723',outline:'#ffecb3'},ascii:{line1:'\u2605\u2590\u259B\u2588\u2588\u2588\u259C\u258C\u2605',line2:' \u259C\u2588\u2588\u2588\u2588\u2588\u259B\u2598',line3:'  \u2598\u2598 \u259D\u259D'}},
  {id:'neon-pink',name:'Neon Pink',rarity:'Uncommon',edition:'permanent',description:'Hot pink. Impossible to ignore.',colors:{primary:'#ff4081',accent:'#c51162'},mascot:{bodyColor:'#ff4081',eyeColor:'#1a0a12'},ascii:{line1:' \u2590\u259B\u2588\u2588\u2588\u259C\u258C',line2:' \u259C\u2588\u2588\u2588\u2588\u2588\u259B\u2598',line3:'  \u2598\u2598 \u259D\u259D'}},
  {id:'electric-cyan',name:'Electric Cyan',rarity:'Uncommon',edition:'permanent',description:'Pure voltage.',colors:{primary:'#00e5ff',accent:'#0097a7'},mascot:{bodyColor:'#00e5ff',eyeColor:'#001a1f'},ascii:{line1:'\u26A1\u2590\u259B\u2588\u2588\u2588\u259C\u258C',line2:' \u259C\u2588\u2588\u2588\u2588\u2588\u259B\u2598',line3:'  \u2598\u2598 \u259D\u259D'}},
  {id:'sunset',name:'Sunset',rarity:'Uncommon',edition:'permanent',description:'Golden hour. Ship before dark.',colors:{primary:'#ff8a65',accent:'#ff5722'},mascot:{gradient:{id:'sun',x2:0,y2:1,stops:[{offset:'0%',color:'#ffcc02'},{offset:'50%',color:'#ff6f00'},{offset:'100%',color:'#e91e63'}]},eyeColor:'#1a0a05'},ascii:{line1:'\uD83C\uDF05\u2590\u259B\u2588\u2588\u2588\u259C\u258C',line2:' \u259C\u2588\u2588\u2588\u2588\u2588\u259B\u2598',line3:'  \u2598\u2598 \u259D\u259D'}},
  {id:'diamond',name:'Diamond',rarity:'Rare',edition:'permanent',description:'Flawless. The flex skin.',colors:{primary:'#b3e5fc',accent:'#4fc3f7'},mascot:{bodyColor:'#e0f7fa',eyeColor:'#006064',outline:'#80deea',extraPixels:[{x:0,y:1,color:'#fff'},{x:12,y:2,color:'#fff'},{x:1,y:7,color:'#fff'},{x:11,y:8,color:'#fff'}],animationId:'diamond'},ascii:{line1:'\u25C7\u2590\u259B\u2588\u2588\u2588\u259C\u258C\u25C7',line2:' \u259C\u2588\u2588\u2588\u2588\u2588\u259B\u2598',line3:'\u25C7 \u2598\u2598 \u259D\u259D\u25C7'}},
  {id:'fire',name:'Fire',rarity:'Rare',edition:'permanent',description:'Straight heat.',colors:{primary:'#ff5722',accent:'#bf360c'},mascot:{gradient:{id:'fg',x2:0,y2:1,stops:[{offset:'0%',color:'#ffeb3b'},{offset:'40%',color:'#ff9800'},{offset:'100%',color:'#f44336'}]},eyeColor:'#1a0500',extraPixels:[{x:5,y:-1,color:'#ff9800'},{x:6,y:-1,color:'#ffeb3b'},{x:7,y:-1,color:'#ff9800'},{x:6,y:-2,color:'#ffeb3b'},{x:4,y:-1,color:'#ff5722'},{x:8,y:-1,color:'#ff5722'}],animationId:'fire'},ascii:{line1:'\uD83D\uDD25\u2590\u259B\u2588\u2588\u2588\u259C\u258C',line2:' \u259C\u2588\u2588\u2588\u2588\u2588\u259B\u2598',line3:'  \u2598\u2598 \u259D\u259D'}},
  {id:'shadow',name:'Shadow',rarity:'Rare',edition:'permanent',description:'Sees your bugs.',colors:{primary:'#263238',accent:'#000'},mascot:{bodyColor:'#1a1a2e',eyeGlow:'#ff0044',outline:'#2d2d44',animationId:'shadow'},ascii:{line1:' \u2590\u259B\u2588\u2588\u2588\u259C\u258C',line2:' \u259C\u2588\u2588\u2588\u2588\u2588\u259B\u2598',line3:'  \u25C9\u25C9 \u25C9\u25C9'}},
  {id:'demon',name:'Demon',rarity:'Rare',edition:'permanent',description:'Summoned from the stack trace.',colors:{primary:'#d32f2f',accent:'#880e0e'},mascot:{bodyColor:'#8b0000',eyeGlow:'#ff4444',outline:'#b71c1c',accessoriesFn:acc_horns,animationId:'demon'},ascii:{line1:'\uD83D\uDE08\u2590\u259B\u2588\u2588\u2588\u259C\u258C',line2:' \u259C\u2588\u2588\u2588\u2588\u2588\u259B\u2598',line3:'  \u2598\u2598 \u259D\u259D'}},
  {id:'gentleman',name:'Gentleman',rarity:'Rare',edition:'permanent',description:'Sir codes-a-lot.',colors:{primary:'#5c6bc0',accent:'#283593'},mascot:{bodyColor:'#5c6bc0',eyeColor:'#0d0d2b',accessoriesFn:combine(acc_tophat,acc_shades)},ascii:{line1:'\uD83C\uDFA9\u2590\u259B\u2588\u2588\u2588\u259C\u258C',line2:' \u259C\u2588\u2588\u2588\u2588\u2588\u259B\u2598',line3:'  \u2598\u2598 \u259D\u259D'}},
  {id:'angel',name:'Angel',rarity:'Rare',edition:'permanent',description:'Zero bugs. Divinely clean.',colors:{primary:'#fff8e1',accent:'#ffd54f'},mascot:{bodyColor:'#fff3e0',eyeColor:'#4e342e',outline:'#ffe0b2',accessoriesFn:acc_halo},ascii:{line1:'\uD83D\uDE07\u2590\u259B\u2588\u2588\u2588\u259C\u258C',line2:' \u259C\u2588\u2588\u2588\u2588\u2588\u259B\u2598',line3:'  \u2598\u2598 \u259D\u259D'}},
  {id:'solana-degen',name:'Solana Degen',rarity:'Rare',edition:'permanent',description:'Wen moon? SOL chain on.',colors:{primary:'#14f195',accent:'#9945ff'},mascot:{gradient:{id:'sol',x1:0,y1:0,x2:1,y2:1,stops:[{offset:'0%',color:'#14f195'},{offset:'100%',color:'#9945ff'}]},eyeColor:'#0a0520',accessoriesFn:acc_sol},ascii:{line1:'\u25CE\u2590\u259B\u2588\u2588\u2588\u259C\u258C',line2:' \u259C\u2588\u2588\u2588\u2588\u2588\u259B\u2598',line3:' \u25CE\u2598\u2598 \u259D\u259D'}},
  {id:'bitcoin-og',name:'Bitcoin OG',rarity:'Rare',edition:'permanent',description:'HODL. Laser eyes. Block 0.',colors:{primary:'#f7931a',accent:'#4d2800'},mascot:{bodyColor:'#f7931a',eyeGlow:'#ff0000',outline:'#ffc107',accessoriesFn:combine(acc_laser,acc_btc)},ascii:{line1:'\u20BF\u2590\u259B\u2588\u2588\u2588\u259C\u258C',line2:' \u259C\u2588\u2588\u2588\u2588\u2588\u259B\u2598',line3:'  \u25C9\u25C9 \u25C9\u25C9'}},
  {id:'holographic',name:'Holographic',rarity:'Epic',edition:'permanent',description:'Full spectrum shift.',colors:{primary:'#e040fb',accent:'#00e5ff'},mascot:{gradient:{id:'hl',x2:1,y2:1,stops:[{offset:'0%',color:'#ff4081'},{offset:'25%',color:'#e040fb'},{offset:'50%',color:'#7c4dff'},{offset:'75%',color:'#00e5ff'},{offset:'100%',color:'#69f0ae'}]},eyeColor:'#0a0020',outline:'rgba(255,255,255,0.3)',animationId:'holographic'},ascii:{line1:'\u2726\u2590\u259B\u2588\u2588\u2588\u259C\u258C\u2726',line2:'\u2726\u259C\u2588\u2588\u2588\u2588\u2588\u259B\u2598',line3:'  \u2598\u2598 \u259D\u259D \u2726'}},
  {id:'crown-royal',name:'Crown Royal',rarity:'Epic',edition:'permanent',description:'King of the codebase. \uD83D\uDC51',colors:{primary:'#ffd700',accent:'#7b1fa2'},mascot:{bodyColor:'#7b1fa2',eyeColor:'#ffd700',outline:'#ce93d8',accessoriesFn:acc_crown},ascii:{line1:'\uD83D\uDC51\u2590\u259B\u2588\u2588\u2588\u259C\u258C',line2:' \u259C\u2588\u2588\u2588\u2588\u2588\u259B\u2598',line3:'  \u2598\u2598 \u259D\u259D'}},
  {id:'void-walker',name:'Void Walker',rarity:'Epic',edition:'permanent',description:'Crossed /dev/null. Came back wrong.',colors:{primary:'#000',accent:'#7c4dff'},mascot:{bodyColor:'#0a0014',eyeGlow:'#b388ff',outline:'#4a148c',extraPixels:[{x:0,y:0,color:'#7c4dff'},{x:12,y:0,color:'#7c4dff'},{x:0,y:8,color:'#7c4dff'},{x:12,y:8,color:'#7c4dff'},{x:6,y:-2,color:'#b388ff'}],animationId:'voidWalker'},ascii:{line1:'\u25C8\u2590\u259B\u2588\u2588\u2588\u259C\u258C\u25C8',line2:' \u259C\u2588\u2588\u2588\u2588\u2588\u259B\u2598',line3:'\u25C8 \u2598\u2598 \u259D\u259D\u25C8'}},
  {id:'aurora',name:'Aurora',rarity:'Epic',edition:'permanent',description:'Northern lights dancing.',colors:{primary:'#00e676',accent:'#6200ea'},mascot:{gradient:{id:'ar',x2:1,y2:0.5,stops:[{offset:'0%',color:'#00e676'},{offset:'30%',color:'#00bcd4'},{offset:'60%',color:'#7c4dff'},{offset:'100%',color:'#e040fb'}]},eyeColor:'#001a0f',outline:'rgba(255,255,255,0.15)',animationId:'aurora'},ascii:{line1:'~\u2590\u259B\u2588\u2588\u2588\u259C\u258C~',line2:'~\u259C\u2588\u2588\u2588\u2588\u2588\u259B\u2598',line3:'  \u2598\u2598 \u259D\u259D ~'}},
  {id:'winter-frost',name:'Winter Frost',rarity:'Seasonal',edition:'seasonal',season:'Winter 2026',available_from:'2026-12-01',available_until:'2027-01-15',description:'Dec-Jan only.',colors:{primary:'#e3f2fd',accent:'#90caf9'},mascot:{bodyColor:'#bbdefb',eyeColor:'#0d47a1',outline:'#e3f2fd',accessoriesFn:combine(acc_santa,acc_snow)},ascii:{line1:'\uD83C\uDF85\u2590\u259B\u2588\u2588\u2588\u259C\u258C',line2:' \u259C\u2588\u2588\u2588\u2588\u2588\u259B\u2598',line3:'\u2744 \u2598\u2598 \u259D\u259D\u2744'}},
  {id:'sakura-bloom',name:'Sakura Bloom',rarity:'Seasonal',edition:'seasonal',season:'Spring 2026',available_from:'2026-03-01',available_until:'2026-04-15',description:'Cherry blossom. Mar-Apr only.',colors:{primary:'#f8bbd0',accent:'#f06292'},mascot:{bodyColor:'#f48fb1',eyeColor:'#33001a',outline:'#f8bbd0',accessoriesFn:acc_sakura},ascii:{line1:'\uD83C\uDF38\u2590\u259B\u2588\u2588\u2588\u259C\u258C',line2:' \u259C\u2588\u2588\u2588\u2588\u2588\u259B\u2598',line3:'  \u2598\u2598 \u259D\u259D\uD83C\uDF38'}},
  {id:'halloween-haunt',name:'Halloween Haunt',rarity:'Seasonal',edition:'seasonal',season:'Halloween 2026',available_from:'2026-10-15',available_until:'2026-11-05',description:'Trick or debug.',colors:{primary:'#ff6f00',accent:'#1a0a00'},mascot:{bodyColor:'#ff6f00',eyeGlow:'#76ff03',outline:'#e65100',accessoriesFn:acc_horns,animationId:'demon'},ascii:{line1:'\uD83C\uDF83\u2590\u259B\u2588\u2588\u2588\u259C\u258C',line2:' \u259C\u2588\u2588\u2588\u2588\u2588\u259B\u2598',line3:'  \u2598\u2598 \u259D\u259D\uD83E\uDD87'}},
  {id:'genesis',name:'Genesis',rarity:'Legendary',edition:'numbered',max_supply:500,description:'First 500. Never again.',colors:{primary:'#ffd700',accent:'#ff6f00'},mascot:{gradient:{id:'gn',x2:0,y2:1,stops:[{offset:'0%',color:'#ffd700'},{offset:'50%',color:'#ff8f00'},{offset:'100%',color:'#ff6f00'}]},eyeColor:'#1a0a00',outline:'#fff9c4',accessoriesFn:combine(acc_crown,acc_halo)},ascii:{line1:'\uD83D\uDC51\u2590\u259B\u2588\u2588\u2588\u259C\u258C\uD83D\uDC51',line2:'\u2726\u259C\u2588\u2588\u2588\u2588\u2588\u259B\u2598\u2726',line3:'  \u2598\u2598 \u259D\u259D'}},
  {id:'obsidian',name:'Obsidian',rarity:'Legendary',edition:'numbered',max_supply:200,description:'Only 200. Volcanic glass.',colors:{primary:'#1a1a1a',accent:'#4a148c'},mascot:{bodyColor:'#1a1a1a',eyeGlow:'#e040fb',outline:'#4a148c',extraPixels:[{x:2,y:1,color:'#7c4dff'},{x:10,y:1,color:'#7c4dff'},{x:3,y:6,color:'#e040fb'},{x:9,y:6,color:'#e040fb'}],accessoriesFn:acc_antenna,animationId:'accentPulse'},ascii:{line1:'\u25C6\u2590\u259B\u2588\u2588\u2588\u259C\u258C\u25C6',line2:' \u259C\u2588\u2588\u2588\u2588\u2588\u259B\u2598',line3:'\u25C6 \u2598\u2598 \u259D\u259D\u25C6'}},
];

/* ── Generate ── */
console.log('\n\uD83C\uDFA8 Generating skins...\n');
var counts={};
SKINS.forEach(function(skin){
  var dir=path.join(SKINS_DIR,skin.id);
  fs.mkdirSync(dir,{recursive:true});
  fs.writeFileSync(path.join(dir,'mascot.svg'),genSVG(skin.mascot));
  fs.writeFileSync(path.join(dir,'icon.svg'),genIcon(skin.mascot));
  fs.writeFileSync(path.join(dir,'icon.png'),genPNG(skin.mascot));
  fs.writeFileSync(path.join(dir,'logo.svg'),genLogo(skin.colors.primary));
  fs.writeFileSync(path.join(dir,'ascii-art.txt'),[skin.ascii.line1,skin.ascii.line2,skin.ascii.line3].join('\n'));
  var manifest={name:skin.name,author:'claude-skins',version:'1.0.0',rarity:skin.rarity,edition:skin.edition,description:skin.description,targets:{vscode_mascot:'mascot.svg',vscode_icon:'icon.svg',vscode_icon_png:'icon.png',vscode_logo:'logo.svg',terminal_ascii:'ascii-art.txt'},colors:Object.assign({},skin.colors)};
  if(skin.mascot.eyeGlow) manifest.colors.eyes=skin.mascot.eyeGlow;
  if(skin.mascot.outline) manifest.colors.outline=skin.mascot.outline;
  if(skin.edition==='seasonal'){manifest.season=skin.season;manifest.available_from=skin.available_from;manifest.available_until=skin.available_until;}
  if(skin.edition==='numbered'){manifest.max_supply=skin.max_supply;manifest.serial_number=null;}
  fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify(manifest,null,2));
  counts[skin.rarity]=(counts[skin.rarity]||0)+1;
  var badge={Common:'\u26AA',Uncommon:'\uD83D\uDFE2',Rare:'\uD83D\uDD35',Epic:'\uD83D\uDFE3',Legendary:'\uD83D\uDFE1',Seasonal:'\uD83D\uDFE0'}[skin.rarity]||'\u26AA';
  var ed=skin.edition!=='permanent'?' ['+skin.edition.toUpperCase()+(skin.max_supply?' #'+skin.max_supply:'')+']':'';
  console.log('  '+badge+' '+skin.rarity.padEnd(10)+' '+skin.name.padEnd(20)+ed);
});
console.log('\n\u2705 Generated '+SKINS.length+' skins!');
Object.entries(counts).forEach(function(e){console.log('   '+e[0]+': '+e[1]);});
console.log('\n   Run: node bin/claude-skins.js list\n');
