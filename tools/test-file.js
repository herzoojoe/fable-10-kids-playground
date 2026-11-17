// 더블클릭(file://) 동작 점검: node tools/test-file.js
const path = require('path');
const { chromium } = require('playwright');
let fails = 0; const ok = (c, m) => { console.log((c ? '[통과] ' : '[실패] ') + m); if (!c) fails++; };
const ROOT = path.resolve(__dirname, '..');
const url = p => 'file://' + path.join(ROOT, p);
const GAMES = ['word', 'math', 'clock', 'match'];

function watch(page, bag) {
  page.on('pageerror', e => bag.errors.push(page.url().split('/').pop() + ': ' + e));
  page.on('console', m => { if (m.type() === 'error') bag.errors.push(page.url().split('/').pop() + ': ' + m.text()); });
  page.on('request', r => { if (!r.url().startsWith('file://') && !r.url().startsWith('data:')) bag.net.push(r.url()); });
  page.on('requestfailed', r => bag.errors.push('불러오기 실패 ' + r.url()));
}

// 한 문제 맞히기 (게임마다)
async function solveOne(page, g) {
  if (g === 'match') {
    const an = await page.evaluate(() => [...document.querySelectorAll('.card')].map(c => c.classList.contains('is-found') ? null : c.dataset.animal));
    const i = an.findIndex(a => a), j = an.indexOf(an[i], i + 1);
    await page.locator('.card').nth(i).click(); await page.locator('.card').nth(j).click();
    return;
  }
  const ans = await page.evaluate((g) => {
    if (g === 'word') { const e = document.querySelector('.picture').textContent; return WordGame.WORDS.find(w => w[0] === e)[1]; }
    if (g === 'math') { const m = document.querySelector('.question').textContent.match(/^(\d+) ([+−]) (\d+)/); return String(m[2] === '+' ? +m[1] + +m[3] : +m[1] - +m[3]); }
    const svg = document.querySelector('.clock svg'); const ang = c => +svg.querySelector(c).getAttribute('transform').match(/rotate\(([\d.]+)/)[1];
    const mm = ang('.minute-hand') === 180 ? 30 : 0; let h = Math.round((ang('.hour-hand') - mm * 0.5) / 30) % 12; if (h === 0) h = 12;
    return mm ? h + '시 30분' : h + '시';
  }, g);
  await page.click(`.choice:text-is("${ans}")`);
  await page.click('#stars-overlay button');
}

(async () => {
  const browser = await chromium.launch();
  // 1) 다섯 화면 콘솔 오류
  {
    const bag = { errors: [], net: [] };
    const page = await browser.newPage({ viewport: { width: 1024, height: 768 } }); watch(page, bag);
    for (const p of ['index.html', ...GAMES.map(g => `games/${g}.html`)]) {
      await page.goto(url(p)); await page.waitForTimeout(200);
      const title = await page.title();
      ok(true, `${p} 열림 (제목: ${title})`);
    }
    ok(bag.errors.length === 0, '다섯 화면 콘솔 오류 0개 ' + bag.errors.join(' | '));
    ok(bag.net.length === 0, '인터넷 요청 0개 ' + bag.net.join(' | '));
    await page.close();
  }
  // 2) 첫 화면 → 각 게임 → 「처음으로」
  {
    const bag = { errors: [], net: [] };
    const page = await browser.newPage({ viewport: { width: 1024, height: 768 } }); watch(page, bag);
    for (const g of GAMES) {
      await page.goto(url('index.html'));
      await page.click(`.menu a[href="games/${g}.html"]`);
      await page.waitForLoadState();
      const at = page.url().endsWith(`games/${g}.html`) && await page.evaluate(() => !!document.querySelector('#stage').children.length);
      await page.click('.home-btn'); await page.waitForLoadState();
      const back = page.url().endsWith('/index.html') && await page.evaluate(() => !!document.querySelector('.menu'));
      ok(at && back, `첫 화면 → ${g}.html (게임 화면 그려짐) → 「🏠 처음으로」 → 첫 화면`);
    }
    // 끝 화면의 「🏠 처음으로」
    await page.goto(url('games/match.html'));
    const an = await page.evaluate(() => [...document.querySelectorAll('.card')].map(c => c.dataset.animal));
    for (const a of [...new Set(an)]) { const i = an.indexOf(a), j = an.indexOf(a, i + 1); await page.locator('.card').nth(i).click(); await page.locator('.card').nth(j).click(); }
    await page.click('#stars-overlay a'); await page.waitForLoadState();
    ok(page.url().endsWith('/index.html'), '끝 화면 「🏠 처음으로」 → 첫 화면');
    ok(bag.errors.length === 0, '이동하는 동안 콘솔 오류 0개 ' + bag.errors.join(' | '));
    await page.close();
  }
  // 3) localStorage 가 막힌 상태
  {
    const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 } });
    await ctx.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new DOMException('저장소가 막혀 있음', 'SecurityError'); } });
    });
    const bag = { errors: [], net: [] };
    const page = await ctx.newPage(); watch(page, bag);
    await page.goto(url('index.html'));
    const blocked = await page.evaluate(() => { try { window.localStorage; return false; } catch (e) { return true; } });
    ok(blocked, 'localStorage 가 정말 막혔음 (읽으면 오류)');
    ok(await page.evaluate(() => document.querySelector('[data-star-count]').textContent) === '0', '첫 화면: 모은 별 0');
    for (const g of GAMES) {
      await page.goto(url(`games/${g}.html`));
      const shown = () => page.evaluate(() => +document.querySelector('#my-stars [data-star-count]').textContent);
      const before = await shown();
      await solveOne(page, g);
      const mid = await shown();
      await solveOne(page, g);
      const after = await shown();
      ok(before === 0 && mid === 1 && after === 2, `${g}: 저장이 막혀도 화면 안에서 별 0 → 1 → 2 (${before} → ${mid} → ${after})`);
    }
    ok(bag.errors.length === 0, '저장이 막힌 상태 콘솔 오류 0개 ' + bag.errors.join(' | '));
    await ctx.close();
  }
  await browser.close();
  console.log(fails ? `실패 ${fails}개` : '모두 통과'); process.exit(fails ? 1 : 0);
})();
