// in-page helpers, injected as string
export const HELPERS = `
window.__p = (s) => { const m = s.match(/[\\d.]+/g).map(Number); return { r:m[0], g:m[1], b:m[2], a: m.length>3?m[3]:1 }; };
window.__lin = (c) => { c/=255; return c<=0.03928? c/12.92 : Math.pow((c+0.055)/1.055,2.4); };
window.__L = (c) => 0.2126*__lin(c.r)+0.7152*__lin(c.g)+0.0722*__lin(c.b);
window.__over = (top, bot) => { const a = top.a; return { r: top.r*a+bot.r*(1-a), g: top.g*a+bot.g*(1-a), b: top.b*a+bot.b*(1-a), a:1 }; };
window.__bg = (el) => { const chain=[]; let e=el; while(e){ chain.push(e); e=e.parentElement; } let base={r:255,g:255,b:255,a:1};
  // find from root downward
  for (let i=chain.length-1;i>=0;i--) { const c = getComputedStyle(chain[i]); const bgc = __p(c.backgroundColor==='transparent'?'rgba(0,0,0,0)':c.backgroundColor); if (bgc.a>0) base = __over(bgc, base); }
  return base; };
window.__ratio = (fg, bg) => { const a=__L(fg), b=__L(bg); const hi=Math.max(a,b), lo=Math.min(a,b); return (hi+0.05)/(lo+0.05); };
window.__rgb = (c)=> 'rgb('+[c.r,c.g,c.b].map(x=>Math.round(x)).join(',')+')';
// text contrast of element against its own composited background
window.__text = (el, colorOverride) => { const cs=getComputedStyle(el); let fg=__p(colorOverride||cs.color); const bg=__bg(el); fg = __over(fg, bg); return { fg:__rgb(fg), bg:__rgb(bg), ratio: +__ratio(fg,bg).toFixed(2) }; };
// non-text: colour vs a given background element's composite
window.__nt = (col, bgel) => { const bg=__bg(bgel); let fg=__p(col); fg=__over(fg,bg); return { fg:__rgb(fg), bg:__rgb(bg), ratio:+__ratio(fg,bg).toFixed(2)}; };
`;
