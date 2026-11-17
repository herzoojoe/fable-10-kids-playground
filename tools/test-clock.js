// 시계 읽기 점검: node tools/test-clock.js
const path = require('path');
const { chromium } = require('playwright');
const loadGame = require('./load-game');
const playFlow = require('./game-flow');
let fails = 0; const ok = (c, m) => { console.log((c ? '[통과] ' : '[실패] ') + m); if (!c) fails++; };
(async () => {
  const G = loadGame('clock.js', 'ClockGame');
  // 각도 공식
  const cases = [[3, 0, 90, 0], [3, 30, 105, 180], [12, 0, 0, 0], [12, 30, 15, 180], [6, 30, 195, 180], [11, 0, 330, 0]];
  cases.forEach(([h, m, ha, ma]) => ok(G.hourAngle(h, m) === ha && G.minuteAngle(m) === ma, `${h}시 ${m}분 → 시침 ${G.hourAngle(h, m)}° (기대 ${ha}°), 분침 ${G.minuteAngle(m)}° (기대 ${ma}°)`));
  // 100판
  const probs = [];
  for (let r = 0; r < 100; r++) {
    const qs = G.makeRound();
    if (qs.length !== 8) probs.push('개수');
    if (qs.filter(q => q.m === 0).length !== 4 || qs.filter(q => q.m === 30).length !== 4) probs.push('정각/30분 수');
    if (new Set(qs.map(q => q.answer)).size !== 8) probs.push('중복');
    qs.forEach(q => {
      if (q.h < 1 || q.h > 12 || ![0, 30].includes(q.m)) probs.push('범위');
      const o = q.options;
      if (o.length !== 3 || new Set(o).size !== 3 || !o.includes(q.answer)) probs.push('보기 ' + o);
      const swap = G.label(q.h, q.m === 0 ? 30 : 0);
      if (!o.includes(swap)) probs.push('정각↔30분 보기 없음 ' + o);
      const other = o.filter(x => x !== q.answer && x !== swap);
      const mm = other.length === 1 && other[0].match(/^(\d+)시( 30분)?$/);
      if (!mm || +mm[1] === q.h || (mm[2] ? 30 : 0) !== q.m) probs.push('다른 시 보기 ' + o + ' / 정답 ' + q.answer);
    });
  }
  ok(probs.length === 0, '100판: 8문제(정각 4 + 30분 4), 같은 시각 없음, 보기 3개 서로 다름·정답 포함, 정각↔30분 1개, 분 같고 시만 다른 것 1개 ' + probs.slice(0, 5).join(' / '));

  const browser = await chromium.launch();
  // 시계 그림 확인 (세 가지 화면 크기)
  for (const [w, h] of [[1024, 768], [1280, 800], [1024, 690]]) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    await page.goto('file://' + path.resolve(__dirname, '..', 'games', 'clock.html'));
    const v = await page.evaluate(() => {
      const svg = document.querySelector('.clock svg');
      const r = svg.getBoundingClientRect();
      const nums = [...svg.querySelectorAll('text')].map(t => t.textContent).join(',');
      const hh = svg.querySelector('.hour-hand'), mh = svg.querySelector('.minute-hand');
      const len = l => Math.abs(l.y1.baseVal.value - l.y2.baseVal.value);
      return { d: Math.min(r.width, r.height), vh: innerHeight, nums,
        hour: [len(hh), +hh.getAttribute('stroke-width'), hh.getAttribute('stroke')],
        minute: [len(mh), +mh.getAttribute('stroke-width'), mh.getAttribute('stroke')] };
    });
    ok(v.d >= v.vh / 2, `${w}x${h}: 시계 지름 ${Math.round(v.d)}px ≥ 화면 높이의 절반 ${v.vh / 2}px`);
    if (w === 1024 && h === 768) {
      ok(v.nums === '1,2,3,4,5,6,7,8,9,10,11,12', '숫자 1~12 표시');
      ok(v.hour[0] < v.minute[0] && v.hour[1] > v.minute[1] && v.hour[2] !== v.minute[2], `시침(길이 ${v.hour[0]}, 굵기 ${v.hour[1]}, ${v.hour[2]}) / 분침(길이 ${v.minute[0]}, 굵기 ${v.minute[1]}, ${v.minute[2]}) — 짧고 굵게 / 길고 가늘게, 색 다름`);
      // 화면에 그려진 바늘 각도가 공식과 같은지 (여러 문제)
      let angBad = [];
      for (let k = 0; k < 8; k++) {
        const a = await page.evaluate(() => {
          const svg = document.querySelector('.clock svg');
          const ang = cls => +svg.querySelector(cls).getAttribute('transform').match(/rotate\(([\d.]+)/)[1];
          return { hh: ang('.hour-hand'), mh: ang('.minute-hand') };
        });
        const ans = await page.evaluate(() => [...document.querySelectorAll('.choice')].map(b => b.textContent));
        // 시침·분침 각도로 거꾸로 시각을 구해 보기 중 하나와 맞는지
        const m = a.mh === 180 ? 30 : 0; let hr = Math.round((a.hh - m * 0.5) / 30) % 12; if (hr === 0) hr = 12;
        if (!ans.includes(G.label(hr, m)) || G.hourAngle(hr, m) !== a.hh) angBad.push(JSON.stringify([a, ans]));
        await page.evaluate((lbl) => { [...document.querySelectorAll('.choice')].find(b => b.textContent === lbl).click(); document.querySelector('#stars-overlay button').click(); }, G.label(hr, m));
      }
      ok(angBad.length === 0, '8문제 모두: 그려진 바늘 각도가 공식과 같고 그 시각이 보기에 있음 ' + angBad.join(' / '));
    }
    await page.close();
  }
  const answerOf = (page) => page.evaluate(() => {
    const svg = document.querySelector('.clock svg');
    const ang = cls => +svg.querySelector(cls).getAttribute('transform').match(/rotate\(([\d.]+)/)[1];
    const m = ang('.minute-hand') === 180 ? 30 : 0; let h = Math.round((ang('.hour-hand') - m * 0.5) / 30) % 12; if (h === 0) h = 12;
    return m ? h + '시 30분' : h + '시';
  });
  await playFlow({ browser, file: 'clock.html', total: 8, guideText: '몇 시일까요?', answerOf, answerSay: a => a.endsWith('분') ? a + '이에요' : a + '예요', ok, shotName: 'clock' });
  await browser.close();
  console.log(fails ? `실패 ${fails}개` : '모두 통과'); process.exit(fails ? 1 : 0);
})();
