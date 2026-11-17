// 계산하기 점검: node tools/test-math.js
const { chromium } = require('playwright');
const loadGame = require('./load-game');
const playFlow = require('./game-flow');
let fails = 0; const ok = (c, m) => { console.log((c ? '[통과] ' : '[실패] ') + m); if (!c) fails++; };
const two = n => Number.isInteger(n) && n >= 10 && n <= 99;
const one = n => Number.isInteger(n) && n >= 2 && n <= 9;
const calc = (a, op, b) => ({ '+': a + b, '-': a - b, '−': a - b, '×': a * b, '÷': a / b })[op];
// 「이에요/예요」: 숫자를 읽었을 때 끝소리 (0 영·십, 1 일, 3 삼, 6 육, 7 칠, 8 팔 → 받침 있음)
const say = n => n + ('013678'.includes(String(n).slice(-1)) ? '이에요' : '예요');
(async () => {
  const G = loadGame('math.js', 'MathGame');
  const probs = [];
  let shuffledRounds = 0;
  for (let r = 0; r < 100; r++) {
    const qs = G.makeRound();
    const count = op => qs.filter(q => q.op === op).length;
    if (qs.length !== 10 || count('+') !== 3 || count('-') !== 3 || count('×') !== 2 || count('÷') !== 2) probs.push('개수 ' + r);
    if (qs.map(q => q.op).join('') !== '+++---××÷÷') shuffledRounds++;
    if (new Set(qs.map(q => q.a + q.op + q.b)).size !== 10) probs.push('같은 식 ' + r);
    qs.forEach(q => {
      if (q.answer !== calc(q.a, q.op, q.b)) probs.push('답 ' + JSON.stringify(q));
      if ((q.op === '+' || q.op === '-') && !(two(q.a) && two(q.b) && two(q.answer))) probs.push('범위 ' + JSON.stringify(q));
      if (q.op === '×' && !(two(q.a) && one(q.b) && q.answer <= 99)) probs.push('곱하기 ' + JSON.stringify(q));
      if (q.op === '÷' && !(two(q.a) && one(q.b) && q.a % q.b === 0)) probs.push('나누기 ' + JSON.stringify(q));
      const o = q.options;
      if (o.length !== 3 || new Set(o).size !== 3 || !o.includes(q.answer) || o.some(n => n < 0 || n > 99 || !Number.isInteger(n))) probs.push('보기 ' + JSON.stringify(q));
      if (!o.filter(n => n !== q.answer).every(n => [1, 2].includes(Math.abs(n - q.answer)))) probs.push('보기 차이 ' + JSON.stringify(q));
    });
  }
  ok(probs.length === 0, '100판: 더하기 3·빼기 3·곱하기 2·나누기 2, 같은 식 없음, 더하기·빼기 두 수와 답 10~99, 곱하기 두 자리×2~9·답 ≤ 99, 나누기 두 자리÷2~9·나누어떨어짐, 보기 0~99 서로 다름·정답 포함·차이 1~2 ' + probs.slice(0, 5).join(' / '));
  ok(shuffledRounds >= 95, `순서가 섞여 있음 (100판 중 ${shuffledRounds}판)`);

  const browser = await chromium.launch();
  // 그림 도움: 더하기·빼기는 십 모형(막대 = 십의 자리, 네모 = 일의 자리), 곱하기·나누기는 그림 없음
  const p = await browser.newPage({ viewport: { width: 1024, height: 768 } });
  await p.goto('file://' + require('path').resolve(__dirname, '..', 'games', 'math.html'));
  const visBad = []; const seenOps = new Set();
  for (let k = 0; k < 30; k++) {
    const v = await p.evaluate(() => {
      const eq = document.querySelector('.question').textContent;
      const m = eq.match(/^(\d+) ([+−×÷]) (\d+) = \?$/);
      const groups = [...document.querySelectorAll('.tens-blocks')].map(g => [g.querySelectorAll('.ten-bar').length, g.querySelectorAll('.ones i').length]);
      return { eq, m: m && [m[1], m[2], m[3]], groups, qfs: parseFloat(getComputedStyle(document.querySelector('.question')).fontSize) };
    });
    if (!v.m) { visBad.push('식 모양 ' + v.eq); continue; }
    const a = +v.m[0], op = v.m[1], b = +v.m[2]; seenOps.add(op);
    const blocks = n => [Math.floor(n / 10), n % 10].join();
    const good = (op === '+' || op === '−') ? (v.groups.length === 2 && v.groups[0].join() === blocks(a) && v.groups[1].join() === blocks(b)) : v.groups.length === 0;
    if (!good || v.qfs < 48) visBad.push(JSON.stringify(v));
    // 정답을 눌러 다음 문제로
    await p.evaluate(() => {
      const m = document.querySelector('.question').textContent.match(/^(\d+) ([+−×÷]) (\d+)/);
      const x = +m[1], y = +m[3];
      const ans = String({ '+': x + y, '−': x - y, '×': x * y, '÷': x / y }[m[2]]);
      [...document.querySelectorAll('.choice')].find(b => b.textContent === ans).click();
      document.querySelector('#stars-overlay button').click();
    });
    if (await p.evaluate(() => /한 번 더/.test(document.body.innerText))) await p.click('#stars-overlay button:has-text("한 번 더 하기")');
  }
  ok(visBad.length === 0 && seenOps.size === 4, `30문제 화면: 더하기·빼기는 십 모형 두 묶음(막대·네모 수가 맞음), 곱하기·나누기는 그림 없음, 식 글자 48px 이상 (본 계산 ${[...seenOps].join(' ')}) ` + visBad.slice(0, 3).join(' / '));

  const answerOf = (page) => page.evaluate(() => {
    const m = document.querySelector('.question').textContent.match(/^(\d+) ([+−×÷]) (\d+)/);
    const a = +m[1], b = +m[3];
    return String({ '+': a + b, '−': a - b, '×': a * b, '÷': a / b }[m[2]]);
  });
  await playFlow({ browser, file: 'math.html', total: 10, guideText: '답은 얼마일까요?', answerOf, answerSay: a => say(+a), ok, shotName: 'math' });
  await browser.close();
  console.log(fails ? `실패 ${fails}개` : '모두 통과'); process.exit(fails ? 1 : 0);
})();
