// 화면 배치 점검 도우미: 스크롤 여부, 버튼이 화면 안에 있는지, 버튼끼리 겹치는지, 글자 크기
// 다른 점검 스크립트에서 require 해서 씀
async function inspect(page) {
  return page.evaluate(() => {
    const vw = innerWidth, vh = innerHeight;
    const de = document.documentElement;
    const scroll = { w: de.scrollWidth, h: de.scrollHeight, vw, vh,
      none: de.scrollWidth <= vw && de.scrollHeight <= vh };
    const vis = el => { const s = getComputedStyle(el); return s.display !== 'none' && s.visibility !== 'hidden' && el.getClientRects().length; };
    const btns = [...document.querySelectorAll('.btn')].filter(vis).map(b => {
      const r = b.getBoundingClientRect();
      return { t: b.innerText.replace(/\s+/g, ' ').trim(), x: r.left, y: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height,
        fs: parseFloat(getComputedStyle(b).fontSize), overlay: !!b.closest('#stars-overlay') };
    });
    const cut = btns.filter(b => b.x < 0 || b.y < 0 || b.r > vw + 0.5 || b.b > vh + 0.5);
    const small = btns.filter(b => b.w < 80 || b.h < 80 || b.fs < 32);
    const overlap = [];
    for (let i = 0; i < btns.length; i++) for (let j = i + 1; j < btns.length; j++) {
      const a = btns[i], c = btns[j];
      if (a.overlay !== c.overlay) continue;   // 덮는 상자와 그 아래 화면은 비교하지 않음
      const gapX = Math.max(c.x - a.r, a.x - c.r), gapY = Math.max(c.y - a.b, a.y - c.b);
      if (Math.max(gapX, gapY) < 16) overlap.push([a.t, c.t, Math.round(Math.max(gapX, gapY))]);
    }
    // 화면에 보이는 글자 중 28px 보다 작은 것
    const tiny = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n; while ((n = walker.nextNode())) {
      if (!n.textContent.trim() || !n.parentElement || !vis(n.parentElement)) continue;
      if (n.parentElement.closest('svg')) continue;
      const fs = parseFloat(getComputedStyle(n.parentElement).fontSize);
      if (fs < 28) tiny.push([n.textContent.trim(), fs]);
    }
    return { scroll, buttons: btns.length, cut, small, overlap, tiny };
  });
}
function report(name, r, ok) {
  ok(r.scroll.none, `${name}: 스크롤 없음 (${r.scroll.w}x${r.scroll.h} / ${r.scroll.vw}x${r.scroll.vh})`);
  ok(r.cut.length === 0, `${name}: 버튼 ${r.buttons}개가 잘리지 않음 ${r.cut.length ? JSON.stringify(r.cut.map(b => b.t)) : ''}`);
  ok(r.overlap.length === 0, `${name}: 버튼끼리 16px 이상 떨어짐 ${r.overlap.length ? JSON.stringify(r.overlap) : ''}`);
  ok(r.small.length === 0, `${name}: 버튼 80x80 이상, 글자 32px 이상 ${r.small.length ? JSON.stringify(r.small.map(b => [b.t, b.w, b.h, b.fs])) : ''}`);
  ok(r.tiny.length === 0, `${name}: 28px 보다 작은 글자 없음 ${r.tiny.length ? JSON.stringify(r.tiny.slice(0, 5)) : ''}`);
}
module.exports = { inspect, report };
