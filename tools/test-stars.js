// js/stars.js 점검: node tools/test-stars.js
const { chromium } = require('playwright');
const path = require('path');
const url = 'file://' + path.resolve(__dirname, 'blank.html');
let fails = 0;
function ok(cond, msg) { console.log((cond ? '[통과] ' : '[실패] ') + msg); if (!cond) fails++; }

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

  // 전역 객체가 Stars 하나만 늘었는지: stars.js 없는 화면과 비교
  const p0 = await browser.newPage();
  await p0.goto('file://' + path.resolve(__dirname, 'empty.html'));
  const base = await p0.evaluate(() => Object.keys(window));
  await page.goto(url);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  const keys = await page.evaluate(() => Object.keys(window));
  const added = keys.filter(k => !base.includes(k));
  ok(added.length === 1 && added[0] === 'Stars', '전역 객체는 Stars 하나: ' + JSON.stringify(added));
  const api = await page.evaluate(() => ['add','count','showCorrect','showRetry','showAnswer','showEnd'].every(k => typeof Stars[k] === 'function'));
  ok(api, 'add, count, showCorrect, showRetry, showAnswer, showEnd 있음');

  // 저장
  const s = await page.evaluate(() => { const a = Stars.count(); Stars.add(); return [a, Stars.count(), localStorage.getItem('kkoma-stars')]; });
  ok(s[0] === 0 && s[1] === 1 && s[2] === '1', 'add 후 count 1, kkoma-stars = "1" ' + JSON.stringify(s));
  await page.reload();
  ok(await page.evaluate(() => Stars.count()) === 1, '새로 열어도 별 1개 유지');

  const text = () => page.evaluate(() => { const o = document.getElementById('stars-overlay'); return o ? o.innerText.replace(/\s+/g, ' ').trim() : null; });

  // 맞혔을 때
  await page.evaluate(() => { window.__n = 0; Stars.showCorrect(() => window.__n++); });
  let t = await text();
  ok(t.includes('⭐') && t.includes('잘했어요!') && t.includes('별 스티커를 받았어요!') && t.includes('다음 ▶'), '맞혔을 때 상자: ' + t);
  ok(await page.evaluate(() => !!document.querySelector('#stars-overlay .star-pop')), '맞혔을 때 별에 움직임 클래스');
  await page.click('#stars-overlay button');
  ok(await page.evaluate(() => window.__n === 1 && !document.getElementById('stars-overlay')), '「다음 ▶」 누르면 onNext 실행, 상자 닫힘');

  // 다시 해 보기 / 정답 알려 주기 흐름 (choose)
  const setup = () => page.evaluate(() => {
    const row = document.getElementById('row'); row.innerHTML = '';
    ['나비','사자','기차'].forEach(w => { const b = document.createElement('button'); b.className = 'btn choice'; b.textContent = w; row.appendChild(b); });
    window.__state = {}; window.__next = [];
  });
  const press = (i) => page.evaluate((i) => {
    const bs = document.querySelectorAll('#row button');
    Stars.choose({ button: bs[i], isCorrect: i === 0, correctButton: bs[0], answerText: '나비', state: window.__state, onNext: g => window.__next.push(g) });
  }, i);

  // 1) 첫 번째에 맞힘
  await setup(); let before = await page.evaluate(() => Stars.count());
  await press(0);
  ok(await page.evaluate(() => document.querySelector('#row button').classList.contains('is-correct')), '맞힌 보기에 초록 테두리 클래스');
  await page.click('#stars-overlay button');
  ok(await page.evaluate(() => Stars.count()) === before + 1, '첫 번째에 맞히면 별 +1');
  await press(0);  // 같은 문제에서 또 눌러도
  ok(await page.evaluate(() => Stars.count()) === before + 1, '같은 문제에서 별이 2개 이상 늘지 않음');

  // 2) 한 번 틀린 뒤 맞힘
  await setup(); before = await page.evaluate(() => Stars.count());
  await press(1);
  t = await text();
  ok(t.includes('🤗') && t.includes('괜찮아요! 한 번 더 해 볼까요?') && t.includes('다시 해 볼게요'), '처음 다시 해 보기 상자: ' + t);
  await page.click('#stars-overlay button');
  const dim = await page.evaluate(() => { const b = document.querySelectorAll('#row button')[1]; return [b.classList.contains('is-dim'), b.disabled, getComputedStyle(b).opacity]; });
  ok(dim[0] && dim[1] && parseFloat(dim[2]) < 0.5, '방금 누른 보기는 흐리고 누를 수 없음 ' + JSON.stringify(dim));
  ok(await page.evaluate(() => !document.getElementById('stars-overlay')), '「다시 해 볼게요」 → 같은 문제로 돌아감');
  await press(0); await page.click('#stars-overlay button');
  ok(await page.evaluate(() => Stars.count()) === before + 1, '한 번 틀린 뒤 두 번째에 맞혀도 별 +1');

  // 3) 두 번 모두 틀림
  await setup(); before = await page.evaluate(() => Stars.count());
  await press(1); await page.click('#stars-overlay button');
  await press(2);
  t = await text();
  ok(t.includes('🙂') && t.includes('같이 볼까요? 정답은 나비예요.') && t.includes('다음 ▶'), '두 번째 상자: ' + t);
  const yb = await page.evaluate(() => { const b = document.querySelectorAll('#row button')[0]; return [b.classList.contains('is-answer'), getComputedStyle(b).borderTopColor]; });
  ok(yb[0] && yb[1] === 'rgb(255, 194, 26)', '정답 보기에 노란 테두리 ' + JSON.stringify(yb));
  await page.click('#stars-overlay button');
  ok(await page.evaluate(() => Stars.count()) === before && (await page.evaluate(() => window.__next[0])) === false, '두 번 틀린 문제는 별 없음, onNext(false)');

  // 받침 맞춤
  const j = await page.evaluate(() => { const r = []; ['3시 30분', '3시', '5개', '오이'].forEach(a => { Stars.showAnswer(a, () => {}); r.push(document.querySelector('#stars-overlay .panel-title').textContent); }); return r; });
  ok(j[0].endsWith('30분이에요.') && j[1].endsWith('3시예요.') && j[2].endsWith('5개예요.'), '정답 문구 받침 맞춤: ' + j.join(' / '));

  // 끝 화면
  await page.evaluate(() => { window.__again = 0; Stars.showEnd(7, () => window.__again++); });
  t = await text();
  ok(t.includes('🎉') && t.includes('다 했어요!') && t.includes('이번 놀이에서 별 ⭐ 7개를 모았어요') && t.includes('한 번 더 하기') && t.includes('🏠 처음으로'), '끝 화면: ' + t);
  const href = await page.evaluate(() => document.querySelector('#stars-overlay a').getAttribute('href'));
  ok(href === '../index.html', '「🏠 처음으로」 → ../index.html');
  ok(!/지우|삭제|reset/i.test(t), '별을 지우는 버튼 없음');
  await page.click('#stars-overlay button');
  ok(await page.evaluate(() => window.__again === 1), '「한 번 더 하기」 → onAgain 실행');

  // 저절로 넘어가지 않음: 상자를 띄우고 3초 기다려도 그대로
  await page.evaluate(() => Stars.showCorrect(() => {}));
  await page.waitForTimeout(3000);
  ok(await page.evaluate(() => !!document.getElementById('stars-overlay')), '3초 기다려도 상자가 저절로 닫히지 않음');

  // localStorage 가 막혀도 오류 없이 화면 안에서 셈
  const p2 = await browser.newPage();
  const err2 = [];
  p2.on('pageerror', e => err2.push(String(e)));
  await p2.addInitScript(() => { Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('막힘', 'SecurityError'); } }); });
  await p2.goto(url);
  const m = await p2.evaluate(() => { const a = Stars.count(); Stars.add(); Stars.add(); return [a, Stars.count()]; });
  ok(m[0] === 0 && m[1] === 2 && err2.length === 0, '저장이 막혀도 오류 없이 화면 안에서 0 → 2 ' + JSON.stringify(m) + ' ' + err2.join());

  ok(errors.length === 0, '콘솔 오류 0개 ' + errors.join(' | '));
  await browser.close();
  console.log(fails ? `실패 ${fails}개` : '모두 통과');
  process.exit(fails ? 1 : 0);
})();
