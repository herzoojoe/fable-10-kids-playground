// 보기 3개짜리 게임(영어 단어·계산하기·시계)을 브라우저에서 끝까지 해 보는 공통 점검
const path = require('path');
const { inspect, report } = require('./layout');
module.exports = async function playFlow({ browser, file, total, guideText, answerOf, answerSay, ok, shotName }) {
  const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });
  const errors = []; page.on('pageerror', e => errors.push(String(e))); page.on('console', m => m.type() === 'error' && errors.push(m.text()));
  await page.goto('file://' + path.resolve(__dirname, '..', 'games', file));
  await page.evaluate(() => localStorage.clear()); await page.reload();
  const ui = await page.evaluate(() => {
    const h = document.querySelector('.home-btn').getBoundingClientRect();
    return { guide: document.querySelector('.guide').innerText, progress: document.getElementById('progress').innerText,
      home: [document.querySelector('.home-btn').innerText, document.querySelector('.home-btn').getAttribute('href'), h.x, h.y] };
  });
  ok(ui.guide === guideText, '안내 문구: ' + ui.guide);
  ok(ui.progress === '1 / ' + total, '진행 표시: ' + ui.progress);
  ok(ui.home[0] === '🏠 처음으로' && ui.home[1] === '../index.html' && ui.home[2] < 50 && ui.home[3] < 50, '왼쪽 위 「🏠 처음으로」 ' + JSON.stringify(ui.home));
  report(file + ' 1024x768', await inspect(page), ok);

  const click = (t) => page.click(`.choice:text-is("${t}")`);
  const wrong = (ans) => page.evaluate((ans) => [...document.querySelectorAll('.choice')].find(b => b.textContent !== ans && !b.disabled).textContent, ans);
  const ov = () => page.evaluate(() => { const o = document.getElementById('stars-overlay'); return o ? o.innerText.replace(/\s+/g, ' ').trim() : ''; });
  const stars = () => page.evaluate(() => Stars.count());
  const shot = (n) => page.screenshot({ path: path.resolve(__dirname, 'screenshots', `check-${shotName}-${n}.png`) });

  let a = await answerOf(page); await click(a);
  ok(await page.evaluate((a) => [...document.querySelectorAll('.choice')].find(b => b.textContent === a).classList.contains('is-correct'), a) && (await ov()).includes('잘했어요!'), '맞히면 초록 테두리 + 「잘했어요!」 상자');
  await shot('correct');
  ok(await stars() === 1, '별 1개 늚');
  await page.click('#stars-overlay button');
  ok(await page.evaluate(() => document.getElementById('progress').innerText) === '2 / ' + total, '「다음 ▶」 → 2 / ' + total);
  a = await answerOf(page); await click(await wrong(a));
  ok((await ov()).includes('괜찮아요! 한 번 더 해 볼까요?'), '첫 번째 → 다시 해 보기 상자');
  await shot('retry');
  await page.click('#stars-overlay button');
  ok(await page.evaluate(() => document.querySelectorAll('.choice.is-dim[disabled]').length) === 1, '누른 보기 흐려지고 못 누름');
  await click(a); await page.click('#stars-overlay button');
  ok(await stars() === 2, '두 번째에 맞혀도 별 +1');
  a = await answerOf(page); await click(await wrong(a)); await page.click('#stars-overlay button'); await click(await wrong(a));
  const t = await ov();
  ok(t.includes('같이 볼까요? 정답은 ' + answerSay(a) + '.') && await page.evaluate(() => document.querySelectorAll('.choice.is-answer').length) === 1, '두 번째 → 「' + t + '」, 노란 테두리');
  await shot('answer');
  await page.click('#stars-overlay button');
  ok(await stars() === 2, '두 번 다 고르지 못한 문제는 별 없음');
  for (let i = 0; i < total - 3; i++) { a = await answerOf(page); await click(a); await page.click('#stars-overlay button'); }
  const end = await ov();
  ok(end.includes('다 했어요!') && end.includes(`이번 놀이에서 별 ⭐ ${total - 1}개를 모았어요`), total + '문제 뒤 끝 화면: ' + end);
  await shot('end');
  await page.click('#stars-overlay button:has-text("한 번 더 하기")');
  ok(await page.evaluate(() => document.getElementById('progress').innerText) === '1 / ' + total, '「한 번 더 하기」 → 새 판');
  ok(errors.length === 0, '콘솔 오류 0개 ' + errors.join(' | '));
  return page;
};
