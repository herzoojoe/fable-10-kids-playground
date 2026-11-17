// 낱말 맞추기 점검: node tools/test-word.js
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const loadGame = require('./load-game');
const { inspect, report } = require('./layout');
let fails = 0; const ok = (c, m) => { console.log((c ? '[통과] ' : '[실패] ') + m); if (!c) fails++; };

(async () => {
  const G = loadGame('word.js', 'WordGame');
  // 1) SPEC 6-1 표와 같은지 (그림-낱말 짝까지)
  const spec = fs.readFileSync(path.resolve(__dirname, '..', 'SPEC.md'), 'utf8');
  const sec = spec.split('### 6-1.')[1].split('### 6-2.')[0];
  const specPairs = [];
  sec.split('\n').filter(l => l.startsWith('|') && !l.includes('---') && !l.includes('낱말 |')).forEach(l => {
    const c = l.split('|').slice(1, -1).map(s => s.trim());
    for (let i = 0; i + 1 < c.length; i += 2) if (c[i] && c[i + 1]) specPairs.push(c[i] + '=' + c[i + 1]);
  });
  const mine = G.WORDS.map(w => w[0] + '=' + w[1]);
  ok(specPairs.length === 29 && mine.length === 29, `낱말 수: SPEC ${specPairs.length}개, word.js ${mine.length}개`);
  ok(JSON.stringify([...specPairs].sort()) === JSON.stringify([...mine].sort()), '그림-낱말 짝이 SPEC 표와 같음');
  // 2) 받침 없음
  const bad = [];
  G.WORDS.forEach(w => [...w[1]].forEach(ch => { const c = ch.charCodeAt(0); if (c < 0xAC00 || c > 0xD7A3 || (c - 0xAC00) % 28 !== 0) bad.push(w[1] + ':' + ch); }));
  ok(bad.length === 0, '모든 낱말이 (코드 − 0xAC00) % 28 === 0 ' + bad.join(','));
  // 3) 100판
  let roundBad = 0;
  for (let r = 0; r < 100; r++) {
    const qs = G.makeRound();
    const emojis = qs.map(q => q.emoji);
    if (qs.length !== 10 || new Set(emojis).size !== 10) roundBad++;
    qs.forEach(q => {
      const pair = G.WORDS.find(w => w[0] === q.emoji);
      if (q.options.length !== 3 || new Set(q.options).size !== 3 || q.options.filter(o => o === q.answer).length !== 1 || pair[1] !== q.answer
        || !q.options.every(o => G.WORDS.some(w => w[1] === o))) roundBad++;
    });
  }
  ok(roundBad === 0, '100판: 판마다 10문제, 같은 그림 없음, 보기 3개 서로 다름, 정답 1개 (문제 ' + roundBad + '건)');

  // 4) 브라우저에서 실제로 해 보기
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });
  const errors = []; page.on('pageerror', e => errors.push(String(e))); page.on('console', m => m.type() === 'error' && errors.push(m.text()));
  await page.goto('file://' + path.resolve(__dirname, '..', 'games', 'word.html'));
  await page.evaluate(() => localStorage.clear()); await page.reload();
  const ui = await page.evaluate(() => ({
    guide: document.querySelector('.guide').innerText, progress: document.getElementById('progress').innerText,
    home: [document.querySelector('.home-btn').innerText, document.querySelector('.home-btn').getAttribute('href'), document.querySelector('.home-btn').getBoundingClientRect().x, document.querySelector('.home-btn').getBoundingClientRect().y],
    qfs: parseFloat(getComputedStyle(document.querySelector('.choice')).fontSize),
  }));
  ok(ui.guide === '그림에 맞는 낱말을 눌러 보세요', '안내 문구: ' + ui.guide);
  ok(ui.progress === '1 / 10', '진행 표시: ' + ui.progress);
  ok(ui.home[0] === '🏠 처음으로' && ui.home[1] === '../index.html' && ui.home[2] < 50 && ui.home[3] < 50, '왼쪽 위 「🏠 처음으로」 ' + JSON.stringify(ui.home));
  report('낱말 맞추기 1024x768', await inspect(page), ok);

  const answerOf = () => page.evaluate(() => {
    const emoji = document.querySelector('.picture').textContent;
    return WordGame.WORDS.find(w => w[0] === emoji)[1];
  });
  const clickWord = (w) => page.click(`.choice:text-is("${w}")`);
  const wrongWord = async (ans) => page.evaluate((ans) => [...document.querySelectorAll('.choice')].find(b => b.textContent !== ans && !b.disabled).textContent, ans);
  const ov = () => page.evaluate(() => { const o = document.getElementById('stars-overlay'); return o ? o.innerText.replace(/\s+/g, ' ').trim() : ''; });
  const stars = () => page.evaluate(() => Stars.count());

  // 문제 1: 바로 맞힘
  let a = await answerOf(); await clickWord(a);
  ok(await page.evaluate((a) => [...document.querySelectorAll('.choice')].find(b => b.textContent === a).classList.contains('is-correct'), a) && (await ov()).includes('잘했어요!'), '맞히면 초록 테두리 후 「잘했어요!」 상자');
  await page.screenshot({ path: path.resolve(__dirname, 'screenshots', 'check-word-correct.png') });
  ok(await stars() === 1, '별 1개 늚');
  await page.click('#stars-overlay button');
  ok(await page.evaluate(() => document.getElementById('progress').innerText) === '2 / 10', '「다음 ▶」 → 2 / 10');
  // 문제 2: 한 번 다시 해 보고 맞힘
  a = await answerOf(); await clickWord(await wrongWord(a));
  ok((await ov()).includes('괜찮아요! 한 번 더 해 볼까요?'), '첫 번째 → 다시 해 보기 상자');
  await page.screenshot({ path: path.resolve(__dirname, 'screenshots', 'check-word-retry.png') });
  await page.click('#stars-overlay button');
  ok(await page.evaluate(() => document.querySelectorAll('.choice.is-dim[disabled]').length) === 1, '누른 보기 흐려지고 못 누름');
  await clickWord(a); await page.click('#stars-overlay button');
  ok(await stars() === 2, '두 번째에 맞혀도 별 +1 (모두 2개)');
  // 문제 3: 두 번 다 다른 보기
  a = await answerOf(); await clickWord(await wrongWord(a)); await page.click('#stars-overlay button'); await clickWord(await wrongWord(a));
  const t = await ov();
  ok(t.includes('같이 볼까요? 정답은 ' + a + '예요.') && await page.evaluate(() => document.querySelectorAll('.choice.is-answer').length) === 1, '두 번째 → 「' + t + '」, 노란 테두리');
  await page.screenshot({ path: path.resolve(__dirname, 'screenshots', 'check-word-answer.png') });
  await page.click('#stars-overlay button');
  ok(await stars() === 2, '이 문제는 별 없음');
  // 나머지 7문제 맞힘 → 끝 화면
  for (let i = 0; i < 7; i++) { a = await answerOf(); await clickWord(a); await page.click('#stars-overlay button'); }
  const end = await ov();
  ok(end.includes('다 했어요!') && end.includes('이번 놀이에서 별 ⭐ 9개를 모았어요'), '10문제 뒤 끝 화면: ' + end);
  await page.screenshot({ path: path.resolve(__dirname, 'screenshots', 'check-word-end.png') });
  await page.click('#stars-overlay button:has-text("한 번 더 하기")');
  ok(await page.evaluate(() => document.getElementById('progress').innerText) === '1 / 10', '「한 번 더 하기」 → 새 판 1 / 10');
  ok(errors.length === 0, '콘솔 오류 0개 ' + errors.join(' | '));
  await browser.close();
  console.log(fails ? `실패 ${fails}개` : '모두 통과'); process.exit(fails ? 1 : 0);
})();
