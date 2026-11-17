// 같은 그림 찾기 점검: node tools/test-match.js
const path = require('path');
const { chromium } = require('playwright');
const loadGame = require('./load-game');
const { inspect, report } = require('./layout');
let fails = 0; const ok = (c, m) => { console.log((c ? '[통과] ' : '[실패] ') + m); if (!c) fails++; };
(async () => {
  const G = loadGame('match.js', 'MatchGame');
  const ALLOWED = ['🐶', '🐱', '🐰', '🐻', '🐼', '🐵', '🦊', '🐯', '🐷', '🐮'];
  let bad = 0;
  for (let r = 0; r < 100; r++) {
    const d = G.makeDeck();
    const cnt = {}; d.forEach(a => cnt[a] = (cnt[a] || 0) + 1);
    if (d.length !== 12 || Object.keys(cnt).length !== 6 || !Object.values(cnt).every(c => c === 2) || !d.every(a => ALLOWED.includes(a))) bad++;
  }
  ok(bad === 0, '100판: 카드 12장 = 그림 6쌍, 모두 정해진 10가지 동물 중에서');

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });
  const errors = []; page.on('pageerror', e => errors.push(String(e))); page.on('console', m => m.type() === 'error' && errors.push(m.text()));
  await page.goto('file://' + path.resolve(__dirname, '..', 'games', 'match.html'));
  await page.evaluate(() => localStorage.clear()); await page.reload();
  const lay = await page.evaluate(() => {
    const cs = [...document.querySelectorAll('.card')];
    const rs = cs.map(c => c.getBoundingClientRect());
    return { n: cs.length, xs: [...new Set(rs.map(r => Math.round(r.x)))].length, ys: [...new Set(rs.map(r => Math.round(r.y)))].length,
      minW: Math.min(...rs.map(r => r.width)), minH: Math.min(...rs.map(r => r.height)),
      backs: cs.map(c => c.textContent).join(''), bg: [...new Set(cs.map(c => getComputedStyle(c).backgroundImage + '|' + getComputedStyle(c).backgroundColor))],
      progress: document.getElementById('progress').innerText,
      home: [document.querySelector('.home-btn').innerText, document.querySelector('.home-btn').getAttribute('href'), document.querySelector('.home-btn').getBoundingClientRect().x] };
  });
  ok(lay.n === 12 && lay.xs === 4 && lay.ys === 3, `카드 ${lay.n}장, 가로 ${lay.xs} × 세로 ${lay.ys}`);
  ok(lay.minW >= 120 && lay.minH >= 120, `카드 크기 ${Math.round(lay.minW)}×${Math.round(lay.minH)}px ≥ 120`);
  ok(lay.backs === '❓'.repeat(12) && lay.bg.length === 1 && lay.bg[0].startsWith('none|'), '뒷면: 단색 바탕(' + lay.bg[0] + ')에 ❓ 하나');
  ok(lay.progress === '찾은 짝 0 / 6', '진행 표시: ' + lay.progress);
  ok(lay.home[0] === '🏠 처음으로' && lay.home[1] === '../index.html' && lay.home[2] < 50, '왼쪽 위 「🏠 처음으로」');
  report('match.html 1024x768', await inspect(page), ok);

  const animals = await page.evaluate(() => [...document.querySelectorAll('.card')].map(c => c.dataset.animal));
  const idxOf = a => animals.map((x, i) => x === a ? i : -1).filter(i => i >= 0);
  const card = i => page.locator('.card').nth(i);
  const state = () => page.evaluate(() => ({ open: [...document.querySelectorAll('.card')].map(c => c.classList.contains('is-open')), msg: getComputedStyle(document.querySelector('.match-message')).visibility, msgText: document.querySelector('.match-message').innerText, stars: Stars.count(), overlay: !!document.getElementById('stars-overlay'), progress: document.getElementById('progress').innerText }));

  // 짝이 아닌 두 장
  const kinds = [...new Set(animals)];
  const [x] = idxOf(kinds[0]), [y] = idxOf(kinds[1]);
  await card(x).click(); await card(y).click();
  let s = await state();
  ok(s.open[x] && s.open[y] && s.msg === 'visible' && s.msgText === '괜찮아요! 어디 있었는지 기억해 봐요', '짝이 아니면 두 장이 보이고 「괜찮아요! 어디 있었는지 기억해 봐요」 표시');
  await page.screenshot({ path: path.resolve(__dirname, 'screenshots', 'check-match-miss.png') });
  // 1초 안에 다른 카드를 눌러도 반응 없음
  const [z] = idxOf(kinds[2]);
  await card(z).click(); await page.waitForTimeout(300);
  s = await state();
  ok(!s.open[z], '뒤집히는 1초 동안 다른 카드를 눌러도 반응 없음');
  ok(s.open[x] && s.open[y], '0.3초 뒤에도 두 장은 아직 보임');
  await page.waitForTimeout(900);
  s = await state();
  ok(!s.open[x] && !s.open[y] && s.stars === 0, '약 1초 뒤 다시 뒤집힘, 별 없음');

  // 짝 찾기
  const [p1, p2] = idxOf(kinds[0]);
  await card(p1).click(); await card(p2).click();
  s = await state();
  const f = await page.evaluate(([a, b]) => { const c = document.querySelectorAll('.card'); return [c[a].classList.contains('is-found'), c[b].classList.contains('is-found'), document.querySelectorAll('.card .card-star').length, getComputedStyle(c[a]).animationName]; }, [p1, p2]);
  ok(s.open[p1] && s.open[p2] && f[0] && f[1], '짝을 찾으면 두 카드가 열린 채 남음');
  ok(f[3] === 'sparkle' && f[2] === 1, `반짝임(${f[3]}), 카드 위 작은 ⭐ ${f[2]}개`);
  ok(s.stars === 1 && !s.overlay, '별 1개 늚, 공통 「맞혔을 때」 상자는 뜨지 않음');
  ok(s.progress === '찾은 짝 1 / 6', '진행 표시: ' + s.progress);
  await page.screenshot({ path: path.resolve(__dirname, 'screenshots', 'check-match-found.png') });
  // 이미 열린 카드 다시 누르기
  await card(p1).click(); await page.waitForTimeout(100);
  const s2 = await state();
  ok(JSON.stringify(s2) === JSON.stringify(s), '이미 열린 카드를 눌러도 아무 일 없음');
  // 한 장만 열고 같은 카드를 다시 눌러도 그대로
  const [q1] = idxOf(kinds[1]);
  await card(q1).click(); await card(q1).click(); await page.waitForTimeout(100);
  s = await state();
  ok(s.open[q1] && s.msg === 'hidden', '한 장 연 상태에서 같은 카드를 또 눌러도 아무 일 없음');
  // 나머지 모두 찾기
  const q2 = idxOf(kinds[1]).find(i => i !== q1); await card(q2).click();
  for (let k = 2; k < 6; k++) { const [a, b] = idxOf(kinds[k]); await card(a).click(); await card(b).click(); }
  const end = await page.evaluate(() => { const o = document.getElementById('stars-overlay'); return o ? o.innerText.replace(/\s+/g, ' ').trim() : ''; });
  ok(end.includes('다 했어요!') && end.includes('이번 놀이에서 별 ⭐ 6개를 모았어요'), '6쌍 다 찾으면 끝 화면: ' + end);
  await page.screenshot({ path: path.resolve(__dirname, 'screenshots', 'check-match-end.png') });
  await page.click('#stars-overlay button:has-text("한 번 더 하기")');
  ok(await page.evaluate(() => document.getElementById('progress').innerText === '찾은 짝 0 / 6' && document.querySelectorAll('.card.is-open').length === 0), '「한 번 더 하기」 → 새 판');
  ok(errors.length === 0, '콘솔 오류 0개 ' + errors.join(' | '));
  await browser.close();
  console.log(fails ? `실패 ${fails}개` : '모두 통과'); process.exit(fails ? 1 : 0);
})();
