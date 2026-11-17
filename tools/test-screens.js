// 태블릿 가로 화면 점검 + 스크린샷: node tools/test-screens.js
// 스크린샷은 tools/screenshots/ 에 저장 (사이트 화면은 이 폴더를 불러오지 않음)
const path = require('path');
const { chromium } = require('playwright');
const { inspect, report } = require('./layout');
let fails = 0; const ok = (c, m) => { if (!c) { console.log('[실패] ' + m); fails++; } else if (process.env.VERBOSE) console.log('[통과] ' + m); };
let passCount = 0; const ok2 = (c, m) => { ok(c, m); if (c) passCount++; };
const ROOT = path.resolve(__dirname, '..');
const SHOTS = path.join(__dirname, 'screenshots');
const url = p => 'file://' + path.join(ROOT, p);

async function answer(page, g) {
  return page.evaluate((g) => {
    if (g === 'word') { const e = document.querySelector('.picture').textContent; return WordGame.WORDS.find(w => w[0] === e)[1]; }
    if (g === 'math') { const m = document.querySelector('.question').textContent.match(/^(\d+) ([+−]) (\d+)/); return String(m[2] === '+' ? +m[1] + +m[3] : +m[1] - +m[3]); }
    const svg = document.querySelector('.clock svg'); const ang = c => +svg.querySelector(c).getAttribute('transform').match(/rotate\(([\d.]+)/)[1];
    const mm = ang('.minute-hand') === 180 ? 30 : 0; let h = Math.round((ang('.hour-hand') - mm * 0.5) / 30) % 12; if (h === 0) h = 12;
    return mm ? h + '시 30분' : h + '시';
  }, g);
}
// 상자(panel)가 화면 안에 있고 글자끼리 겹치지 않는지
async function panelCheck(page) {
  return page.evaluate(() => {
    const p = document.querySelector('#stars-overlay .panel'); if (!p) return { ok: false, why: '상자 없음' };
    const r = p.getBoundingClientRect();
    // 상자 안의 그림·글·버튼이 서로 겹치지 않는지 (모든 짝 비교)
    const kids = [...p.querySelectorAll('.panel-emoji, .panel-title, .panel-text, .btn')].map(c => c.getBoundingClientRect());
    let overlap = false;
    for (let i = 0; i < kids.length; i++) for (let j = i + 1; j < kids.length; j++) {
      const a = kids[i], b = kids[j];
      if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) overlap = true;
    }
    const inside = r.top >= 0 && r.left >= 0 && r.bottom <= innerHeight && r.right <= innerWidth;
    return { ok: inside && !overlap, why: JSON.stringify({ top: r.top, bottom: r.bottom, vh: innerHeight, overlap }) };
  });
}

(async () => {
  const browser = await chromium.launch();
  for (const [w, h] of [[1024, 768], [1280, 800], [1024, 690]]) {
    const vp = `${w}x${h}`;
    const full = h !== 690;   // 1024x690 은 다섯 화면만
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    const errors = []; page.on('pageerror', e => errors.push(String(e)));
    await page.goto(url('index.html')); await page.evaluate(() => localStorage.setItem('kkoma-stars', '12')); await page.reload();
    report(`[${vp}] 첫 화면`, await inspect(page), ok2);
    await page.screenshot({ path: path.join(SHOTS, `${vp}-1-index.png`) });

    for (const [n, g] of [[2, 'word'], [3, 'math'], [4, 'clock']]) {
      await page.goto(url(`games/${g}.html`)); await page.waitForTimeout(50);
      report(`[${vp}] ${g} 화면`, await inspect(page), ok2);
      await page.screenshot({ path: path.join(SHOTS, `${vp}-${n}-${g}.png`) });
      // 한 판의 모든 문제 화면을 돌며 배치 확인 (긴 낱말, 이모지 10개 등)
      let allGood = true, why = '';
      const total = g === 'clock' ? 8 : 10;
      for (let q = 0; q < total; q++) {
        const r = await inspect(page);
        const bad = !r.scroll.none || r.cut.length || r.overlap.length || r.small.length || r.tiny.length;
        if (bad) { allGood = false; why = JSON.stringify(r).slice(0, 300); }
        const a = await answer(page, g);
        if (full && q === 0) {   // 공통 상자 3가지
          const wrong = await page.evaluate((a) => [...document.querySelectorAll('.choice')].find(b => b.textContent !== a).textContent, a);
          await page.click(`.choice:text-is("${wrong}")`); await page.waitForTimeout(700);
          const pr = await panelCheck(page); ok2(pr.ok, `[${vp}] ${g} 「다시 해 보기」 상자가 화면 안, 겹침 없음 ${pr.why}`);
          report(`[${vp}] ${g} 「다시 해 보기」 상자`, await inspect(page), ok2);
          await page.screenshot({ path: path.join(SHOTS, `${vp}-${n}-${g}-box2-retry.png`) });
          await page.click('#stars-overlay button');
          const wrong2 = await page.evaluate((a) => [...document.querySelectorAll('.choice')].find(b => b.textContent !== a && !b.disabled).textContent, a);
          await page.click(`.choice:text-is("${wrong2}")`); await page.waitForTimeout(700);
          const pa = await panelCheck(page); ok2(pa.ok, `[${vp}] ${g} 「정답 알려 주기」 상자 ${pa.why}`);
          // 노란 테두리 보기가 상자에 가리지 않는지
          const vis = await page.evaluate(() => { const b = document.querySelector('.choice.is-answer').getBoundingClientRect(); const p = document.querySelector('.panel').getBoundingClientRect(); return b.top >= p.bottom; });
          ok2(vis, `[${vp}] ${g} 노란 테두리 보기가 상자 아래에 보임`);
          const seen = await page.evaluate(() => { const q = document.querySelector('.picture, .counters, .clock').getBoundingClientRect(); const p = document.querySelector('.panel').getBoundingClientRect(); return [Math.round(q.top), Math.round(p.bottom)]; });
          ok2(seen[0] >= seen[1] - 1, `[${vp}] ${g} 정답을 알려 줄 때 문제 그림이 상자에 가리지 않음 (그림 위 ${seen[0]} ≥ 상자 아래 ${seen[1]})`);
          report(`[${vp}] ${g} 「정답 알려 주기」 상자`, await inspect(page), ok2);
          await page.screenshot({ path: path.join(SHOTS, `${vp}-${n}-${g}-box3-answer.png`) });
          await page.click('#stars-overlay button');
          continue;
        }
        await page.click(`.choice:text-is("${a}")`); await page.waitForTimeout(full && q === 1 ? 700 : 0);
        if (full && q === 1) {
          const pc = await panelCheck(page); ok2(pc.ok, `[${vp}] ${g} 「맞혔을 때」 상자 ${pc.why}`);
          const vis = await page.evaluate(() => { const b = document.querySelector('.choice.is-correct').getBoundingClientRect(); const p = document.querySelector('.panel').getBoundingClientRect(); return b.top >= p.bottom; });
          ok2(vis, `[${vp}] ${g} 초록 테두리 보기가 상자 아래에 보임`);
          report(`[${vp}] ${g} 「맞혔을 때」 상자`, await inspect(page), ok2);
          await page.screenshot({ path: path.join(SHOTS, `${vp}-${n}-${g}-box1-correct.png`) });
        }
        await page.click('#stars-overlay button');
      }
      ok2(allGood, `[${vp}] ${g} 한 판 ${total}문제 화면 모두 스크롤·잘림·겹침 없음 ${why}`);
      if (full) {
        await page.waitForTimeout(700);
        const pe = await panelCheck(page); ok2(pe.ok, `[${vp}] ${g} 끝 화면 ${pe.why}`);
        report(`[${vp}] ${g} 끝 화면`, await inspect(page), ok2);
        await page.screenshot({ path: path.join(SHOTS, `${vp}-${n}-${g}-end.png`) });
      }
    }
    // 같은 그림 찾기
    await page.goto(url('games/match.html'));
    report(`[${vp}] match 화면`, await inspect(page), ok2);
    await page.screenshot({ path: path.join(SHOTS, `${vp}-5-match.png`) });
    const an = await page.evaluate(() => [...document.querySelectorAll('.card')].map(c => c.dataset.animal));
    const kinds = [...new Set(an)];
    // 짝이 아닐 때 (안내 문구 보임)
    await page.locator('.card').nth(an.indexOf(kinds[0])).click(); await page.locator('.card').nth(an.indexOf(kinds[1])).click();
    await page.waitForTimeout(300);
    report(`[${vp}] match 짝이 아닐 때`, await inspect(page), ok2);
    if (full) await page.screenshot({ path: path.join(SHOTS, `${vp}-5-match-miss.png`) });
    await page.waitForTimeout(1000);
    for (const k of kinds) { const i = an.indexOf(k), j = an.indexOf(k, i + 1); await page.locator('.card').nth(i).click(); await page.locator('.card').nth(j).click(); if (k === kinds[2] && full) { await page.waitForTimeout(900); await page.screenshot({ path: path.join(SHOTS, `${vp}-5-match-found.png`) }); } }
    if (full) {
      await page.waitForTimeout(700);
      const pe = await panelCheck(page); ok2(pe.ok, `[${vp}] match 끝 화면 ${pe.why}`);
      report(`[${vp}] match 끝 화면`, await inspect(page), ok2);
      await page.screenshot({ path: path.join(SHOTS, `${vp}-5-match-end.png`) });
    }
    ok2(errors.length === 0, `[${vp}] 콘솔 오류 0개 ` + errors.join(' | '));
    await page.close();
  }
  await browser.close();
  console.log(`통과 ${passCount}개, 실패 ${fails}개`); process.exit(fails ? 1 : 0);
})();
