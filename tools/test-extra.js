// 그 밖의 SPEC 항목 점검: node tools/test-extra.js
const path = require('path');
const { chromium } = require('playwright');
let fails = 0; const ok = (c, m) => { console.log((c ? '[통과] ' : '[실패] ') + m); if (!c) fails++; };
const url = p => 'file://' + path.resolve(__dirname, '..', p);
(async () => {
  const browser = await chromium.launch();
  // 움직임 줄이기
  for (const rm of ['no-preference', 'reduce']) {
    const page = await browser.newPage({ reducedMotion: rm });
    await page.goto(url('games/word.html'));
    await page.evaluate(() => Stars.showCorrect(() => {}));
    const a = await page.evaluate(() => { const s = getComputedStyle(document.querySelector('.star-pop')); return [s.animationName, s.animationDuration]; });
    if (rm === 'reduce') ok(a[0] === 'none', '움직임 줄이기 켬 → 별 애니메이션 없음 (' + a[0] + ')');
    else ok(a[0] === 'star-pop' && parseFloat(a[1]) <= 1, '움직임 줄이기 끔 → 별 애니메이션 ' + a[1] + ' (1초 이내)');
    await page.close();
  }
  // 카드 크기: 세 가지 화면
  for (const [w, h] of [[1024, 768], [1280, 800], [1024, 690]]) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    await page.goto(url('games/match.html'));
    const s = await page.evaluate(() => { const r = document.querySelector('.card').getBoundingClientRect(); return [r.width, r.height]; });
    ok(s[0] >= 120 && s[1] >= 120, `${w}x${h}: 카드 ${Math.round(s[0])}×${Math.round(s[1])}px ≥ 120`);
    await page.close();
  }
  // 글꼴
  const page = await browser.newPage();
  for (const p of ['index.html', 'games/word.html', 'games/math.html', 'games/clock.html', 'games/match.html']) {
    await page.goto(url(p));
    const f = await page.evaluate(() => [getComputedStyle(document.body).fontFamily, getComputedStyle(document.querySelector('.btn')).fontFamily]);
    ok(f.every(x => x === '"Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif'), p + ' 글꼴: ' + f[0]);
  }
  // 시간 제한 없음: 게임 화면을 5초 그대로 두어도 문제가 바뀌지 않음
  for (const g of ['word', 'math', 'clock', 'match']) {
    await page.goto(url(`games/${g}.html`));
    const before = await page.evaluate(() => document.getElementById('stage').innerHTML + document.getElementById('progress').innerText);
    await page.waitForTimeout(5000);
    const after = await page.evaluate(() => document.getElementById('stage').innerHTML + document.getElementById('progress').innerText);
    ok(before === after, `${g}: 5초 동안 아무것도 안 눌러도 화면이 그대로 (시간 제한 없음)`);
  }
  await browser.close();
  console.log(fails ? `실패 ${fails}개` : '모두 통과'); process.exit(fails ? 1 : 0);
})();
