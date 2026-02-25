#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const SKINS_DIR = path.join(__dirname, 'skins');
const PX = 8;
const BODY = [[3,0],[4,0],[8,0],[9,0],[2,1],[3,1],[4,1],[5,1],[6,1],[7,1],[8,1],[9,1],[10,1],[1,2],[2,2],[3,2],[4,2],[5,2],[6,2],[7,2],[8,2],[9,2],[10,2],[11,2],[1,3],[2,3],[5,3],[6,3],[7,3],[10,3],[11,3],[1,4],[2,4],[3,4],[4,4],[5,4],[6,4],[7,4],[8,4],[9,4],[10,4],[11,4],[1,5],[2,5],[3,5],[4,5],[5,5],[6,5],[7,5],[8,5],[9,5],[10,5],[11,5],[2,6],[3,6],[4,6],[5,6],[6,6],[7,6],[8,6],[9,6],[10,6],[3,7],[4,7],[8,7],[9,7],[3,8],[4,8],[8,8],[9,8]];
const EYES = [[3,3],[4,3],[8,3],[9,3]];
function px(OX,OY,x,y,fill,extra){return '<rect x="'+(OX+x*PX)+'" y="'+(OY+y*PX)+'" width="'+PX+'" height="'+PX+'" fill="'+fill+'"'+(extra||'')+'/>';}

/* ── Animation Registry ── */
var ANIM = {};

ANIM.fire = function(){return {
  style:
    '@keyframes ff{0%{opacity:.5;transform:translateY(0)}100%{opacity:1;transform:translateY(-1.5px)}}' +
    '.f0{animation:ff .15s infinite alternate}' +
    '.f1{animation:ff .15s .03s infinite alternate}' +
    '.f2{animation:ff .15s .07s infinite alternate}' +
    '.f3{animation:ff .15s .1s infinite alternate}' +
    '.f4{animation:ff .15s .13s infinite alternate}' +
    '.f5{animation:ff .15s .05s infinite alternate}',
  extraDefs:
    '<filter id="fgw"><feGaussianBlur in="SourceGraphic" stdDeviation="1" result="b">' +
    '<animate attributeName="stdDeviation" values="0.5;2;0.5" dur="0.3s" repeatCount="indefinite"/>' +
    '</feGaussianBlur><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>',
  extraClass: function(i){return ' class="f'+i+'" filter="url(#fgw)"';}
};};

ANIM.holographic = function(){
  var C = ['#ff4081','#e040fb','#7c4dff','#00e5ff','#69f0ae','#ffeb3b'];
  var anims = [];
  for(var i=0;i<5;i++){
    var vals = [];
    for(var j=0;j<C.length;j++) vals.push(C[(i+j)%C.length]);
    vals.push(vals[0]);
    anims.push('<animate attributeName="stop-color" values="'+vals.join(';')+'" dur="4s" repeatCount="indefinite"/>');
  }
  return {stopAnims: anims};
};

ANIM.shadow = function(){return {
  style:
    '@keyframes ep{0%,100%{opacity:.6}50%{opacity:1}}' +
    '@keyframes blink{0%,92%,96%,100%{transform:scaleY(1)}94%{transform:scaleY(0)}}' +
    '#eyes{animation:ep 3s ease infinite,blink 5s ease infinite;transform-origin:64px 48px}',
  extraDefs:
    '<filter id="sgf"><feGaussianBlur in="SourceGraphic" stdDeviation="2" result="b">' +
    '<animate attributeName="stdDeviation" values="1;4;1" dur="3s" repeatCount="indefinite"/>' +
    '</feGaussianBlur><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>',
  eyeFilter: 'sgf'
};};

ANIM.diamond = function(){return {
  style:
    '@keyframes si{0%,100%{opacity:.2}50%{opacity:1}}' +
    '.s0{animation:si 2s ease infinite}' +
    '.s1{animation:si 2s .5s ease infinite}' +
    '.s2{animation:si 2s 1s ease infinite}' +
    '.s3{animation:si 2s 1.5s ease infinite}',
  extraDefs:
    '<filter id="dgf"><feGaussianBlur in="SourceGraphic" stdDeviation="1" result="b">' +
    '<animate attributeName="stdDeviation" values="0.5;3;0.5" dur="2s" repeatCount="indefinite"/>' +
    '</feGaussianBlur><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>',
  extraClass: function(i){return ' class="s'+i+'" filter="url(#dgf)"';}
};};

ANIM.voidWalker = function(){return {
  style:
    '@keyframes vp{0%,100%{opacity:.2}50%{opacity:.9}}' +
    '.v0{animation:vp 2s ease infinite}' +
    '.v1{animation:vp 2s .4s ease infinite}' +
    '.v2{animation:vp 2s .8s ease infinite}' +
    '.v3{animation:vp 2s 1.2s ease infinite}' +
    '.v4{animation:vp 2s 1.6s ease infinite}',
  extraDefs:
    '<filter id="vgf"><feGaussianBlur in="SourceGraphic" stdDeviation="2" result="b">' +
    '<animate attributeName="stdDeviation" values="1.5;5;1.5" dur="2s" repeatCount="indefinite"/>' +
    '</feGaussianBlur><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>',
  extraClass: function(i){return ' class="v'+i+'" filter="url(#vgf)"';}
};};

ANIM.aurora = function(){return {
  stopAnims: [
    '<animate attributeName="stop-color" values="#00e676;#00bcd4;#7c4dff;#00e676" dur="3s" repeatCount="indefinite"/>',
    '<animate attributeName="stop-color" values="#00bcd4;#7c4dff;#e040fb;#00bcd4" dur="3s" repeatCount="indefinite"/>',
    '<animate attributeName="stop-color" values="#7c4dff;#e040fb;#00e676;#7c4dff" dur="3s" repeatCount="indefinite"/>',
    '<animate attributeName="stop-color" values="#e040fb;#00e676;#00bcd4;#e040fb" dur="3s" repeatCount="indefinite"/>'
  ],
  extraDefs:
    '<filter id="agf"><feGaussianBlur in="SourceGraphic" stdDeviation="1.5" result="b">' +
    '<animate attributeName="stdDeviation" values="1;3;1" dur="3s" repeatCount="indefinite"/>' +
    '</feGaussianBlur><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>'
};};

ANIM.demon = function(){return {
  style:
    '@keyframes dp{0%,100%{opacity:.65}50%{opacity:1}}' +
    '#eyes{animation:dp 2s ease infinite}',
  extraDefs:
    '<filter id="dmf"><feGaussianBlur in="SourceGraphic" stdDeviation="1.5" result="b">' +
    '<animate attributeName="stdDeviation" values="1;3;1" dur="2s" repeatCount="indefinite"/>' +
    '</feGaussianBlur><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>',
  eyeFilter: 'dmf'
};};

ANIM.bitcoinOg = function(){return {
  style:
    '@keyframes lp{0%,100%{opacity:.3}50%{opacity:1}}' +
    '.laser rect,.laser circle{animation:lp 1s ease infinite}'
};};

ANIM.legendary = function(){return {
  style:
    '@keyframes lgp{0%,100%{opacity:.85}50%{opacity:1}}' +
    '#body{animation:lgp 2.5s ease infinite}',
  extraDefs:
    '<filter id="lgf"><feGaussianBlur in="SourceGraphic" stdDeviation="1.5" result="b">' +
    '<animate attributeName="stdDeviation" values="1;3.5;1" dur="2.5s" repeatCount="indefinite"/>' +
    '</feGaussianBlur><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>'
};};

ANIM.subtleGlow = function(sd){return {
  extraDefs:
    '<filter id="sglow"><feGaussianBlur in="SourceGraphic" stdDeviation="'+(sd||1.5)+'" result="b">' +
    '<animate attributeName="stdDeviation" values="'+(sd||1.5)+';'+((sd||1.5)+1.5)+';'+(sd||1.5)+'" dur="3s" repeatCount="indefinite"/>' +
    '</feGaussianBlur><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>'
};};

/* ── SVG Generator ── */
function genSVG(o){
  var bodyColor=o.bodyColor||'#e8834a',eyeColor=o.eyeColor||'#1a1a1a',bgColor=o.bgColor||'none';
  var W=13*PX+PX*4,H=10*PX+PX*6,OX=PX*2,OY=PX*3;
  var defs='',fill=bodyColor;
  var filt=o.bodyFilter?' filter="url(#'+o.bodyFilter+')"':'';
  var strk=o.outline?' stroke="'+o.outline+'" stroke-width="0.5"':'';

  // Get animation config
  var anim=null;
  if(o.animationId && ANIM[o.animationId]){
    anim=ANIM[o.animationId](o.glowBase);
  }

  // Gradient with optional stop-color SMIL animations
  if(o.gradient){
    var g=o.gradient;
    var st=g.stops.map(function(s,i){
      var inner='';
      if(anim && anim.stopAnims && anim.stopAnims[i]) inner=anim.stopAnims[i];
      if(inner) return '<stop offset="'+s.offset+'" stop-color="'+s.color+'">'+inner+'</stop>';
      return '<stop offset="'+s.offset+'" stop-color="'+s.color+'"/>';
    }).join('');
    defs+='<linearGradient id="'+g.id+'" x1="'+(g.x1||0)+'" y1="'+(g.y1||0)+'" x2="'+(g.x2||0)+'" y2="'+(g.y2||1)+'">'+st+'</linearGradient>';
    fill='url(#'+g.id+')';
  }

  // Existing static defs
  if(o.extraDefs) defs+=o.extraDefs;
  // Animated defs from ANIM
  if(anim && anim.extraDefs) defs+=anim.extraDefs;

  // Override body filter if animation provides animated one
  if(anim && anim.bodyFilter) filt=' filter="url(#'+anim.bodyFilter+')"';

  // Eye filter
  var eyeFilt='';
  if(anim && anim.eyeFilter) eyeFilt=' filter="url(#'+anim.eyeFilter+')"';

  // Build body group
  var body=BODY.map(function(p){return px(OX,OY,p[0],p[1],fill,strk+filt);}).join('\n    ');

  // Build eyes group
  var ec=o.eyeGlow||eyeColor;
  var eyes=EYES.map(function(p){return px(OX,OY,p[0],p[1],ec,eyeFilt);}).join('\n    ');

  // Build extras group
  var extra='';
  if(o.extraPixels){
    extra=o.extraPixels.map(function(p,i){
      var attrs='';
      // Use animated class/filter from ANIM if available, else use static filter
      if(anim && anim.extraClass){
        attrs=anim.extraClass(i);
      } else if(p.filter){
        attrs=' filter="url(#'+p.filter+')"';
      }
      return px(OX,OY,p.x,p.y,p.color,attrs);
    }).join('\n    ');
  }

  // Build accessories group
  var acc='';
  if(o.accessoriesFn) acc=o.accessoriesFn(OX,OY,PX);

  // Style block: breathing (all skins) + per-skin animation
  var breathe='@keyframes breathe{0%,100%{transform:scale(1)}50%{transform:scale(1.02)}}' +
    '#mascot{animation:breathe 3s ease-in-out infinite;transform-origin:'+Math.round(W/2)+'px '+(OY+4*PX)+'px;}';
  var animStyle=(anim && anim.style)?anim.style:'';
  var styleBlock='<style>'+breathe+animStyle+'</style>';

  // Assemble SVG
  var svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+W+' '+H+'" width="'+W+'" height="'+H+'">\n';
  if(defs) svg+='  <defs>'+defs+'</defs>\n';
  svg+='  '+styleBlock+'\n';
  if(bgColor!=='none') svg+='  <rect width="'+W+'" height="'+H+'" fill="'+bgColor+'" rx="4"/>\n';
  svg+='  <g id="mascot">\n';
  svg+='    <g id="body">\n    '+body+'\n    </g>\n';
  svg+='    <g id="eyes">\n    '+eyes+'\n    </g>\n';
  if(extra) svg+='    <g id="extras">\n    '+extra+'\n    </g>\n';
  if(acc) svg+='    <g id="acc" class="laser">\n    '+acc+'\n    </g>\n';
  svg+='  </g>\n</svg>';
  return svg;
}

function genIcon(o){
  // Icons are static — strip animationId
  var staticO={};
  for(var k in o) staticO[k]=o[k];
  delete staticO.animationId;
  var svg=genSVG(staticO);
  return svg.replace(/viewBox="([^"]+)" width="\d+" height="\d+"/,'viewBox="$1" width="32" height="32"');
}

function glow(id,s){return '<filter id="'+id+'"><feGaussianBlur in="SourceGraphic" stdDeviation="'+(s||1.5)+'" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>';}
function acc_crown(X,Y,P){return [2,3,5,7,9,10].map(function(i){return '<rect x="'+(X+i*P)+'" y="'+(Y-P)+'" width="'+P+'" height="'+P+'" fill="#ffd700"/>';}).join('')+['#f44336','#4fc3f7','#66bb6a'].map(function(c,j){return '<rect x="'+(X+(4+j*2)*P)+'" y="'+(Y-2*P)+'" width="'+P+'" height="'+P+'" fill="'+c+'"/>';}).join('');}
function acc_tophat(X,Y,P){return '<rect x="'+(X+3*P)+'" y="'+(Y-P)+'" width="'+(7*P)+'" height="'+P+'" fill="#1a1a1a"/><rect x="'+(X+4*P)+'" y="'+(Y-2*P)+'" width="'+(5*P)+'" height="'+P+'" fill="#1a1a1a"/><rect x="'+(X+4*P)+'" y="'+(Y-3*P)+'" width="'+(5*P)+'" height="'+P+'" fill="#222"/><rect x="'+(X+5*P)+'" y="'+(Y-2*P)+'" width="'+(3*P)+'" height="'+P+'" fill="#333"/>';}
function acc_halo(X,Y,P){return '<rect x="'+(X+3*P)+'" y="'+(Y-2*P)+'" width="'+(7*P)+'" height="'+P+'" fill="#ffd700" opacity="0.8"/><rect x="'+(X+4*P)+'" y="'+(Y-3*P)+'" width="'+(5*P)+'" height="'+P+'" fill="#ffd700" opacity="0.5"/>';}
function acc_horns(X,Y,P){return '<rect x="'+(X+P)+'" y="'+(Y-P)+'" width="'+P+'" height="'+P+'" fill="#cc0000"/><rect x="'+(X+2*P)+'" y="'+(Y-2*P)+'" width="'+P+'" height="'+P+'" fill="#ff1a1a"/><rect x="'+(X+11*P)+'" y="'+(Y-P)+'" width="'+P+'" height="'+P+'" fill="#cc0000"/><rect x="'+(X+10*P)+'" y="'+(Y-2*P)+'" width="'+P+'" height="'+P+'" fill="#ff1a1a"/>';}
function acc_antenna(X,Y,P){return '<rect x="'+(X+6*P)+'" y="'+(Y-P)+'" width="'+P+'" height="'+P+'" fill="#888"/><rect x="'+(X+6*P)+'" y="'+(Y-2*P)+'" width="'+P+'" height="'+P+'" fill="#aaa"/><rect x="'+(X+6*P)+'" y="'+(Y-3*P)+'" width="'+P+'" height="'+P+'" fill="#ff0044"/>';}
function acc_shades(X,Y,P){return '<rect x="'+(X+2*P)+'" y="'+(Y+3*P)+'" width="'+(3*P)+'" height="'+P+'" fill="#111" rx="1"/><rect x="'+(X+7*P)+'" y="'+(Y+3*P)+'" width="'+(3*P)+'" height="'+P+'" fill="#111" rx="1"/><rect x="'+(X+5*P)+'" y="'+(Y+3*P)+'" width="'+(2*P)+'" height="'+Math.round(P*0.4)+'" fill="#333"/>';}
function acc_laser(X,Y,P){return '<rect x="'+(X+3*P)+'" y="'+(Y+3*P)+'" width="'+(P*2)+'" height="'+P+'" fill="#ff0000" opacity="0.9"/><rect x="'+(X+8*P)+'" y="'+(Y+3*P)+'" width="'+(P*2)+'" height="'+P+'" fill="#ff0000" opacity="0.9"/><rect x="'+(X+P)+'" y="'+(Y+4*P)+'" width="'+(P*3)+'" height="'+Math.round(P*0.5)+'" fill="#ff0000" opacity="0.35"/><rect x="'+(X+9*P)+'" y="'+(Y+4*P)+'" width="'+(P*3)+'" height="'+Math.round(P*0.5)+'" fill="#ff0000" opacity="0.35"/>';}
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
  {id:'gold-edition',name:'Gold Edition',rarity:'Uncommon',edition:'permanent',description:'Ship to prod with confidence.',colors:{primary:'#ffd700',accent:'#b8860b'},mascot:{bodyColor:'#ffd700',eyeColor:'#3e2723',outline:'#ffecb3',extraDefs:glow('gs',1),bodyFilter:'gs',animationId:'subtleGlow',glowBase:1},ascii:{line1:'\u2605\u2590\u259B\u2588\u2588\u2588\u259C\u258C\u2605',line2:' \u259C\u2588\u2588\u2588\u2588\u2588\u259B\u2598',line3:'  \u2598\u2598 \u259D\u259D'}},
  {id:'neon-pink',name:'Neon Pink',rarity:'Uncommon',edition:'permanent',description:'Hot pink. Impossible to ignore.',colors:{primary:'#ff4081',accent:'#c51162'},mascot:{bodyColor:'#ff4081',eyeColor:'#1a0a12',extraDefs:glow('pg',2),bodyFilter:'pg',animationId:'subtleGlow',glowBase:2},ascii:{line1:' \u2590\u259B\u2588\u2588\u2588\u259C\u258C',line2:' \u259C\u2588\u2588\u2588\u2588\u2588\u259B\u2598',line3:'  \u2598\u2598 \u259D\u259D'}},
  {id:'electric-cyan',name:'Electric Cyan',rarity:'Uncommon',edition:'permanent',description:'Pure voltage.',colors:{primary:'#00e5ff',accent:'#0097a7'},mascot:{bodyColor:'#00e5ff',eyeColor:'#001a1f',extraDefs:glow('cg',2),bodyFilter:'cg',animationId:'subtleGlow',glowBase:2},ascii:{line1:'\u26A1\u2590\u259B\u2588\u2588\u2588\u259C\u258C',line2:' \u259C\u2588\u2588\u2588\u2588\u2588\u259B\u2598',line3:'  \u2598\u2598 \u259D\u259D'}},
  {id:'sunset',name:'Sunset',rarity:'Uncommon',edition:'permanent',description:'Golden hour. Ship before dark.',colors:{primary:'#ff8a65',accent:'#ff5722'},mascot:{gradient:{id:'sun',x2:0,y2:1,stops:[{offset:'0%',color:'#ffcc02'},{offset:'50%',color:'#ff6f00'},{offset:'100%',color:'#e91e63'}]},eyeColor:'#1a0a05'},ascii:{line1:'\uD83C\uDF05\u2590\u259B\u2588\u2588\u2588\u259C\u258C',line2:' \u259C\u2588\u2588\u2588\u2588\u2588\u259B\u2598',line3:'  \u2598\u2598 \u259D\u259D'}},
  {id:'diamond',name:'Diamond',rarity:'Rare',edition:'permanent',description:'Flawless. The flex skin.',colors:{primary:'#b3e5fc',accent:'#4fc3f7'},mascot:{bodyColor:'#e0f7fa',eyeColor:'#006064',outline:'#80deea',extraDefs:glow('sp',1.5),bodyFilter:'sp',extraPixels:[{x:0,y:1,color:'#fff',filter:'sp'},{x:12,y:2,color:'#fff',filter:'sp'},{x:1,y:7,color:'#fff',filter:'sp'},{x:11,y:8,color:'#fff',filter:'sp'}],animationId:'diamond'},ascii:{line1:'\u25C7\u2590\u259B\u2588\u2588\u2588\u259C\u258C\u25C7',line2:' \u259C\u2588\u2588\u2588\u2588\u2588\u259B\u2598',line3:'\u25C7 \u2598\u2598 \u259D\u259D\u25C7'}},
  {id:'fire',name:'Fire',rarity:'Rare',edition:'permanent',description:'Straight heat.',colors:{primary:'#ff5722',accent:'#bf360c'},mascot:{gradient:{id:'fg',x2:0,y2:1,stops:[{offset:'0%',color:'#ffeb3b'},{offset:'40%',color:'#ff9800'},{offset:'100%',color:'#f44336'}]},eyeColor:'#1a0500',extraPixels:[{x:5,y:-1,color:'#ff9800'},{x:6,y:-1,color:'#ffeb3b'},{x:7,y:-1,color:'#ff9800'},{x:6,y:-2,color:'#ffeb3b'},{x:4,y:-1,color:'#ff5722'},{x:8,y:-1,color:'#ff5722'}],animationId:'fire'},ascii:{line1:'\uD83D\uDD25\u2590\u259B\u2588\u2588\u2588\u259C\u258C',line2:' \u259C\u2588\u2588\u2588\u2588\u2588\u259B\u2598',line3:'  \u2598\u2598 \u259D\u259D'}},
  {id:'shadow',name:'Shadow',rarity:'Rare',edition:'permanent',description:'Sees your bugs.',colors:{primary:'#263238',accent:'#000'},mascot:{bodyColor:'#1a1a2e',eyeGlow:'#ff0044',outline:'#2d2d44',extraDefs:glow('eg',3),animationId:'shadow'},ascii:{line1:' \u2590\u259B\u2588\u2588\u2588\u259C\u258C',line2:' \u259C\u2588\u2588\u2588\u2588\u2588\u259B\u2598',line3:'  \u25C9\u25C9 \u25C9\u25C9'}},
  {id:'demon',name:'Demon',rarity:'Rare',edition:'permanent',description:'Summoned from the stack trace.',colors:{primary:'#d32f2f',accent:'#880e0e'},mascot:{bodyColor:'#8b0000',eyeGlow:'#ff4444',outline:'#b71c1c',extraDefs:glow('dg',2),bodyFilter:'dg',accessoriesFn:acc_horns,animationId:'demon'},ascii:{line1:'\uD83D\uDE08\u2590\u259B\u2588\u2588\u2588\u259C\u258C',line2:' \u259C\u2588\u2588\u2588\u2588\u2588\u259B\u2598',line3:'  \u2598\u2598 \u259D\u259D'}},
  {id:'gentleman',name:'Gentleman',rarity:'Rare',edition:'permanent',description:'Sir codes-a-lot.',colors:{primary:'#5c6bc0',accent:'#283593'},mascot:{bodyColor:'#5c6bc0',eyeColor:'#0d0d2b',accessoriesFn:combine(acc_tophat,acc_shades)},ascii:{line1:'\uD83C\uDFA9\u2590\u259B\u2588\u2588\u2588\u259C\u258C',line2:' \u259C\u2588\u2588\u2588\u2588\u2588\u259B\u2598',line3:'  \u2598\u2598 \u259D\u259D'}},
  {id:'angel',name:'Angel',rarity:'Rare',edition:'permanent',description:'Zero bugs. Divinely clean.',colors:{primary:'#fff8e1',accent:'#ffd54f'},mascot:{bodyColor:'#fff3e0',eyeColor:'#4e342e',outline:'#ffe0b2',accessoriesFn:acc_halo},ascii:{line1:'\uD83D\uDE07\u2590\u259B\u2588\u2588\u2588\u259C\u258C',line2:' \u259C\u2588\u2588\u2588\u2588\u2588\u259B\u2598',line3:'  \u2598\u2598 \u259D\u259D'}},
  {id:'solana-degen',name:'Solana Degen',rarity:'Rare',edition:'permanent',description:'Wen moon? SOL chain on.',colors:{primary:'#14f195',accent:'#9945ff'},mascot:{gradient:{id:'sol',x1:0,y1:0,x2:1,y2:1,stops:[{offset:'0%',color:'#14f195'},{offset:'100%',color:'#9945ff'}]},eyeColor:'#0a0520',extraDefs:glow('sg',1.5),bodyFilter:'sg',accessoriesFn:acc_sol,animationId:'subtleGlow',glowBase:1.5},ascii:{line1:'\u25CE\u2590\u259B\u2588\u2588\u2588\u259C\u258C',line2:' \u259C\u2588\u2588\u2588\u2588\u2588\u259B\u2598',line3:' \u25CE\u2598\u2598 \u259D\u259D'}},
  {id:'bitcoin-og',name:'Bitcoin OG',rarity:'Rare',edition:'permanent',description:'HODL. Laser eyes. Block 0.',colors:{primary:'#f7931a',accent:'#4d2800'},mascot:{bodyColor:'#f7931a',eyeGlow:'#ff0000',outline:'#ffc107',extraDefs:glow('btg',1.5),accessoriesFn:combine(acc_laser,acc_btc),animationId:'bitcoinOg'},ascii:{line1:'\u20BF\u2590\u259B\u2588\u2588\u2588\u259C\u258C',line2:' \u259C\u2588\u2588\u2588\u2588\u2588\u259B\u2598',line3:'  \u25C9\u25C9 \u25C9\u25C9'}},
  {id:'holographic',name:'Holographic',rarity:'Epic',edition:'permanent',description:'Full spectrum shift.',colors:{primary:'#e040fb',accent:'#00e5ff'},mascot:{gradient:{id:'hl',x2:1,y2:1,stops:[{offset:'0%',color:'#ff4081'},{offset:'25%',color:'#e040fb'},{offset:'50%',color:'#7c4dff'},{offset:'75%',color:'#00e5ff'},{offset:'100%',color:'#69f0ae'}]},eyeColor:'#0a0020',outline:'rgba(255,255,255,0.3)',extraDefs:glow('hlg',1.5),bodyFilter:'hlg',animationId:'holographic'},ascii:{line1:'\u2726\u2590\u259B\u2588\u2588\u2588\u259C\u258C\u2726',line2:'\u2726\u259C\u2588\u2588\u2588\u2588\u2588\u259B\u2598',line3:'  \u2598\u2598 \u259D\u259D \u2726'}},
  {id:'crown-royal',name:'Crown Royal',rarity:'Epic',edition:'permanent',description:'King of the codebase. \uD83D\uDC51',colors:{primary:'#ffd700',accent:'#7b1fa2'},mascot:{bodyColor:'#7b1fa2',eyeColor:'#ffd700',outline:'#ce93d8',extraDefs:glow('rg',1),accessoriesFn:acc_crown,animationId:'subtleGlow',glowBase:1},ascii:{line1:'\uD83D\uDC51\u2590\u259B\u2588\u2588\u2588\u259C\u258C',line2:' \u259C\u2588\u2588\u2588\u2588\u2588\u259B\u2598',line3:'  \u2598\u2598 \u259D\u259D'}},
  {id:'void-walker',name:'Void Walker',rarity:'Epic',edition:'permanent',description:'Crossed /dev/null. Came back wrong.',colors:{primary:'#000',accent:'#7c4dff'},mascot:{bodyColor:'#0a0014',eyeGlow:'#b388ff',outline:'#4a148c',extraDefs:glow('vg',3),extraPixels:[{x:0,y:0,color:'#7c4dff',filter:'vg'},{x:12,y:0,color:'#7c4dff',filter:'vg'},{x:0,y:8,color:'#7c4dff',filter:'vg'},{x:12,y:8,color:'#7c4dff',filter:'vg'},{x:6,y:-2,color:'#b388ff',filter:'vg'}],animationId:'voidWalker'},ascii:{line1:'\u25C8\u2590\u259B\u2588\u2588\u2588\u259C\u258C\u25C8',line2:' \u259C\u2588\u2588\u2588\u2588\u2588\u259B\u2598',line3:'\u25C8 \u2598\u2598 \u259D\u259D\u25C8'}},
  {id:'aurora',name:'Aurora',rarity:'Epic',edition:'permanent',description:'Northern lights dancing.',colors:{primary:'#00e676',accent:'#6200ea'},mascot:{gradient:{id:'ar',x2:1,y2:0.5,stops:[{offset:'0%',color:'#00e676'},{offset:'30%',color:'#00bcd4'},{offset:'60%',color:'#7c4dff'},{offset:'100%',color:'#e040fb'}]},eyeColor:'#001a0f',outline:'rgba(255,255,255,0.15)',extraDefs:glow('ag',2),bodyFilter:'ag',animationId:'aurora'},ascii:{line1:'~\u2590\u259B\u2588\u2588\u2588\u259C\u258C~',line2:'~\u259C\u2588\u2588\u2588\u2588\u2588\u259B\u2598',line3:'  \u2598\u2598 \u259D\u259D ~'}},
  {id:'winter-frost',name:'Winter Frost',rarity:'Seasonal',edition:'seasonal',season:'Winter 2026',available_from:'2026-12-01',available_until:'2027-01-15',description:'Dec-Jan only.',colors:{primary:'#e3f2fd',accent:'#90caf9'},mascot:{bodyColor:'#bbdefb',eyeColor:'#0d47a1',outline:'#e3f2fd',extraDefs:glow('fg2',1.5),bodyFilter:'fg2',accessoriesFn:combine(acc_santa,acc_snow),animationId:'subtleGlow',glowBase:1.5},ascii:{line1:'\uD83C\uDF85\u2590\u259B\u2588\u2588\u2588\u259C\u258C',line2:' \u259C\u2588\u2588\u2588\u2588\u2588\u259B\u2598',line3:'\u2744 \u2598\u2598 \u259D\u259D\u2744'}},
  {id:'sakura-bloom',name:'Sakura Bloom',rarity:'Seasonal',edition:'seasonal',season:'Spring 2026',available_from:'2026-03-01',available_until:'2026-04-15',description:'Cherry blossom. Mar-Apr only.',colors:{primary:'#f8bbd0',accent:'#f06292'},mascot:{bodyColor:'#f48fb1',eyeColor:'#33001a',outline:'#f8bbd0',accessoriesFn:acc_sakura},ascii:{line1:'\uD83C\uDF38\u2590\u259B\u2588\u2588\u2588\u259C\u258C',line2:' \u259C\u2588\u2588\u2588\u2588\u2588\u259B\u2598',line3:'  \u2598\u2598 \u259D\u259D\uD83C\uDF38'}},
  {id:'halloween-haunt',name:'Halloween Haunt',rarity:'Seasonal',edition:'seasonal',season:'Halloween 2026',available_from:'2026-10-15',available_until:'2026-11-05',description:'Trick or debug.',colors:{primary:'#ff6f00',accent:'#1a0a00'},mascot:{bodyColor:'#ff6f00',eyeGlow:'#76ff03',outline:'#e65100',accessoriesFn:acc_horns,animationId:'demon'},ascii:{line1:'\uD83C\uDF83\u2590\u259B\u2588\u2588\u2588\u259C\u258C',line2:' \u259C\u2588\u2588\u2588\u2588\u2588\u259B\u2598',line3:'  \u2598\u2598 \u259D\u259D\uD83E\uDD87'}},
  {id:'genesis',name:'Genesis',rarity:'Legendary',edition:'numbered',max_supply:500,description:'First 500. Never again.',colors:{primary:'#ffd700',accent:'#ff6f00'},mascot:{gradient:{id:'gn',x2:0,y2:1,stops:[{offset:'0%',color:'#ffd700'},{offset:'50%',color:'#ff8f00'},{offset:'100%',color:'#ff6f00'}]},eyeColor:'#1a0a00',outline:'#fff9c4',extraDefs:glow('gg',2),bodyFilter:'gg',accessoriesFn:combine(acc_crown,acc_halo),animationId:'legendary'},ascii:{line1:'\uD83D\uDC51\u2590\u259B\u2588\u2588\u2588\u259C\u258C\uD83D\uDC51',line2:'\u2726\u259C\u2588\u2588\u2588\u2588\u2588\u259B\u2598\u2726',line3:'  \u2598\u2598 \u259D\u259D'}},
  {id:'obsidian',name:'Obsidian',rarity:'Legendary',edition:'numbered',max_supply:200,description:'Only 200. Volcanic glass.',colors:{primary:'#1a1a1a',accent:'#4a148c'},mascot:{bodyColor:'#1a1a1a',eyeGlow:'#e040fb',outline:'#4a148c',extraDefs:glow('og',2),extraPixels:[{x:2,y:1,color:'#7c4dff',filter:'og'},{x:10,y:1,color:'#7c4dff',filter:'og'},{x:3,y:6,color:'#e040fb',filter:'og'},{x:9,y:6,color:'#e040fb',filter:'og'}],accessoriesFn:acc_antenna,animationId:'legendary'},ascii:{line1:'\u25C6\u2590\u259B\u2588\u2588\u2588\u259C\u258C\u25C6',line2:' \u259C\u2588\u2588\u2588\u2588\u2588\u259B\u2598',line3:'\u25C6 \u2598\u2598 \u259D\u259D\u25C6'}},
];

/* ── Generate ── */
console.log('\n\uD83C\uDFA8 Generating skins...\n');
var counts={};
SKINS.forEach(function(skin){
  var dir=path.join(SKINS_DIR,skin.id);
  fs.mkdirSync(dir,{recursive:true});
  fs.writeFileSync(path.join(dir,'mascot.svg'),genSVG(skin.mascot));
  fs.writeFileSync(path.join(dir,'icon.svg'),genIcon(skin.mascot));
  fs.writeFileSync(path.join(dir,'ascii-art.txt'),[skin.ascii.line1,skin.ascii.line2,skin.ascii.line3].join('\n'));
  var manifest={name:skin.name,author:'claude-skins',version:'1.0.0',rarity:skin.rarity,edition:skin.edition,description:skin.description,targets:{vscode_mascot:'mascot.svg',vscode_icon:'icon.svg',terminal_ascii:'ascii-art.txt'},colors:Object.assign({},skin.colors)};
  // Include eyes/outline in manifest for patcher compatibility
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
