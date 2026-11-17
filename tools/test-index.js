// 첫 화면 점검: node tools/test-index.js
const { chromium } = require('playwright');
const path = require('path');
const { inspect, report } = require('./layout');
let fails = 0; const ok = (c, m) => { console.log((c ? '[통과] ' : '[실패] ') + m); if (!c) fails++; };
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });
  const errors = []; page.on('pageerror', e => errors.push(String(e))); page.on('console', m => m.type() === 'error' && errors.push(m.text()));
  await page.goto('file://' + path.resolve(__dirname, '..', 'index.html'));
  await page.evaluate(() => localStorage.setItem('kkoma-stars', '12')); await page.reload();
  const info = await page.evaluate(() => ({
    title: document.querySelector('h1').innerText,
    stars: document.querySelector('.total-stars').innerText,
    links: [...document.querySelectorAll('.menu a')].map(a => [a.getAttribute('href'), a.innerText.replace(/\s+/g, ' ').trim(), a.getBoundingClientRect().x | 0, a.getBoundingClientRect().y | 0, parseFloat(getComputedStyle(a.querySelector('.menu-emoji')).fontSize)]),
  }));
  ok(info.title === 'Uno의 놀이터 🎈', '제목: ' + info.title);
  ok(info.stars === '모은 별 ⭐ × 12', '모은 별: ' + info.stars);
  const hrefs = info.links.map(l => l[0]).join(',');
  ok(hrefs === 'games/word.html,games/math.html,games/clock.html,games/match.html', '연결 주소: ' + hrefs);
  ok(info.links.map(l => l[1]).join('/') === '🔤 영어 단어 맞추기/🧮 계산하기/🕐 시계 읽기/🃏 같은 그림 찾기', '버튼 이모지+이름: ' + info.links.map(l => l[1]).join('/'));
  const xs = new Set(info.links.map(l => l[2])), ys = new Set(info.links.map(l => l[3]));
  ok(xs.size === 2 && ys.size === 2, '2x2 배치: ' + JSON.stringify(info.links.map(l => [l[2], l[3]])));
  ok(info.links.every(l => l[4] >= 64), '큰 이모지 (' + info.links[0][4] + 'px)');
  report('첫 화면 1024x768', await inspect(page), ok);
  ok(errors.length === 0, '콘솔 오류 0개 ' + errors.join(' | '));
  await page.screenshot({ path: path.resolve(__dirname, 'screenshots', 'check-index-1024x768.png') });
  await browser.close();
  console.log(fails ? `실패 ${fails}개` : '모두 통과'); process.exit(fails ? 1 : 0);
})();
