// 더하기 빼기 점검: node tools/test-math.js
const { chromium } = require('playwright');
const loadGame = require('./load-game');
const playFlow = require('./game-flow');
let fails = 0; const ok = (c, m) => { console.log((c ? '[통과] ' : '[실패] ') + m); if (!c) fails++; };
(async () => {
  const G = loadGame('math.js', 'MathGame');
  const probs = [];
  let shuffledRounds = 0;
  for (let r = 0; r < 100; r++) {
    const qs = G.makeRound();
    const adds = qs.filter(q => q.op === '+'), subs = qs.filter(q => q.op === '-');
    if (qs.length !== 10 || adds.length !== 5 || subs.length !== 5) probs.push('개수 ' + r);
    if (qs.map(q => q.op).join('') !== '+++++-----') shuffledRounds++;
    adds.forEach(q => { if (q.a < 0 || q.b < 0 || q.a > 10 || q.b > 10 || q.a + q.b > 10 || q.answer !== q.a + q.b) probs.push('더하기 ' + JSON.stringify(q)); });
    subs.forEach(q => { if (q.a < 0 || q.a > 10 || q.b > q.a || q.b < 0 || q.answer !== q.a - q.b || q.answer < 0) probs.push('빼기 ' + JSON.stringify(q)); });
    qs.forEach(q => {
      const o = q.options;
      if (o.length !== 3 || new Set(o).size !== 3 || !o.includes(q.answer) || o.some(n => n < 0 || n > 10 || !Number.isInteger(n))) probs.push('보기 ' + JSON.stringify(q));
      if (!o.filter(n => n !== q.answer).every(n => [1, 2].includes(Math.abs(n - q.answer)))) probs.push('보기 차이 ' + JSON.stringify(q));
      if (!G.EMOJIS.includes(q.emoji)) probs.push('이모지 ' + q.emoji);
    });
    const zeros = qs.filter(q => q.a === 0 || q.b === 0 || q.answer === 0).length;
    if (zeros > 1) probs.push('0 문제 ' + zeros);
  }
  ok(probs.length === 0, '100판: 5+5=10문제, 합 ≤ 10, 답 ≥ 0, 보기 0~10 서로 다름·정답 포함·차이 1~2, 0 문제 1개 이하, 이모지 5개 중 하나 ' + probs.slice(0, 5).join(' / '));
  ok(shuffledRounds >= 95, `순서가 섞여 있음 (100판 중 ${shuffledRounds}판이 더하기·빼기 섞임)`);
  // 정답 0, 10 일 때 보기
  const o0 = new Set(), o10 = new Set();
  for (let i = 0; i < 50; i++) { G.makeOptions(0).forEach(n => o0.add(n)); G.makeOptions(10).forEach(n => o10.add(n)); }
  ok([...o0].sort().join() === '0,1,2' && [...o10].sort().join() === '10,8,9', '정답 0 → 1·2, 정답 10 → 8·9');

  const browser = await chromium.launch();
  // 그림 도움: 문제마다 이모지 수와 흐림 확인 (여러 판)
  const p = await browser.newPage({ viewport: { width: 1024, height: 768 } });
  await p.goto('file://' + require('path').resolve(__dirname, '..', 'games', 'math.html'));
  let visBad = [];
  for (let k = 0; k < 30; k++) {
    const v = await p.evaluate(() => {
      const eq = document.querySelector('.question').textContent;
      const m = eq.match(/^(\d+) ([+−]) (\d+) = \?$/);
      const groups = [...document.querySelectorAll('.count-group')];
      const spans = [...document.querySelectorAll('.count-group span')];
      const faded = spans.filter(s => getComputedStyle(s).opacity === '0.3').length;
      const emojis = new Set(spans.map(s => s.textContent));
      return { eq, m: m && [m[1], m[2], m[3]], groups: groups.map(g => g.children.length), faded, emojis: [...emojis], qfs: parseFloat(getComputedStyle(document.querySelector('.question')).fontSize) };
    });
    const a = +v.m[0], b = +v.m[2];
    const good = v.m[1] === '+' ? (v.groups.join() === [a, b].join() && v.faded === 0) : (v.groups.join() === String(a) && v.faded === b);
    if (!good || v.emojis.length > 1 || (v.emojis[0] && !['🍎', '🐟', '🌷', '🚗', '⚽'].includes(v.emojis[0])) || v.qfs < 48) visBad.push(JSON.stringify(v));
    await p.evaluate(() => { document.querySelector('.choice').click(); const o = document.querySelector('#stars-overlay button'); if (o) o.click(); const o2 = document.querySelector('#stars-overlay button'); if (o2 && /다음|다시/.test(o2.textContent)) o2.click(); });
    await p.evaluate(() => { const o = document.querySelector('#stars-overlay button'); if (o && /다음/.test(o.textContent)) o.click(); if (o && /다시/.test(o.textContent)) { o.click(); [...document.querySelectorAll('.choice')].find(b => !b.disabled).click(); const n = document.querySelector('#stars-overlay button'); if (n) n.click(); } });
    if (await p.evaluate(() => /한 번 더/.test(document.body.innerText))) await p.click('#stars-overlay button:has-text("한 번 더 하기")');
  }
  ok(visBad.length === 0, '30문제 화면: 숫자만큼 이모지, 빼기는 b개 투명도 0.3, 문제마다 이모지 1종류, 식 글자 48px 이상 ' + visBad.slice(0, 3).join(' / '));

  const answerOf = (page) => page.evaluate(() => {
    const m = document.querySelector('.question').textContent.match(/^(\d+) ([+−]) (\d+)/);
    return String(m[2] === '+' ? +m[1] + +m[3] : +m[1] - +m[3]);
  });
  await playFlow({ browser, file: 'math.html', total: 10, guideText: '몇 개일까요?', answerOf, answerSay: a => a + '개예요', ok, shotName: 'math' });
  await browser.close();
  console.log(fails ? `실패 ${fails}개` : '모두 통과'); process.exit(fails ? 1 : 0);
})();
