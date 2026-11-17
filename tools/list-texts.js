// 화면에 나오는 모든 문구 뽑기: node tools/list-texts.js  → tools/화면문구.txt
// 1) 사이트 파일 안의 한글 문자열(HTML 글자, JS 문자열)  2) 실제로 게임을 해 보며 화면에 보인 글자
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.resolve(__dirname, '..');
const BANNED = ['틀렸', '땡', '아니야', '실패', '바보', '왜 몰라', '오답', '벌점', '다시는'];
const seen = new Set();
const add = t => t.split('\n').map(s => s.replace(/\s+/g, ' ').trim()).filter(s => /[가-힣]/.test(s)).forEach(s => seen.add(s));

function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map(l => {
    const i = l.indexOf('// ');
    return i >= 0 && !/'[^']*\/\/ /.test(l) ? l.slice(0, i) : l;
  }).join('\n');
}

(async () => {
  // 1) 파일에서 (주석은 화면에 나오지 않으므로 뺌)
  const fromFiles = new Set();
  const files = ['index.html', 'js/stars.js'];
  ['word', 'math', 'clock', 'match'].forEach(g => files.push(`games/${g}.html`, `games/${g}.js`));
  for (const f of files) {
    const src = stripComments(fs.readFileSync(path.join(ROOT, f), 'utf8'));
    const re = f.endsWith('.js') ? /'([^'\n]*[가-힣][^'\n]*)'/g : />([^<]*[가-힣][^<]*)</g;
    let m;
    while ((m = re.exec(src))) fromFiles.add(m[1].trim());
  }

  // 2) 화면에서 (게임을 처음부터 끝까지, 다시 해 보기·정답 알려 주기 포함)
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });
  const grab = async () => add(await page.evaluate(() => document.body.innerText));
  await page.goto('file://' + path.join(ROOT, 'index.html'));
  await grab();
  for (const g of ['word', 'math', 'clock']) {
    await page.goto('file://' + path.join(ROOT, 'games', g + '.html'));
    for (let q = 0; q < 20; q++) {
      await grab();
      if (await page.$('#stars-overlay')) break;          // 끝 화면
      // 문제마다: 남은 보기를 차례로 눌러 보며 나오는 상자를 모두 모음
      for (let k = 0; k < 3; k++) {
        const b = (await page.$$('.choice:not([disabled])'))[0];
        if (!b) break;
        await b.click();
        await grab();
        const o = await page.$('#stars-overlay button');
        if (!o) break;
        const label = await o.innerText();
        await o.click();
        if (label.includes('다음')) break;
      }
    }
    await grab();
  }
  await page.goto('file://' + path.join(ROOT, 'games', 'match.html'));
  await grab();
  const an = await page.evaluate(() => [...document.querySelectorAll('.card')].map(c => c.dataset.animal));
  const kinds = [...new Set(an)];
  await page.locator('.card').nth(an.indexOf(kinds[0])).click();
  await page.locator('.card').nth(an.indexOf(kinds[1])).click();
  await grab();
  await page.waitForTimeout(1100);
  for (const k of kinds) {
    const i = an.indexOf(k);
    await page.locator('.card').nth(i).click();
    await page.locator('.card').nth(an.indexOf(k, i + 1)).click();
  }
  await grab();
  await browser.close();

  const all = [...new Set([...fromFiles, ...seen])];
  const hits = all.filter(s => BANNED.some(w => s.includes(w)));
  const lines = ['# 화면 문구 목록 (tools/list-texts.js 로 만듦)', '',
    '## 사이트 파일에서 뽑은 한글 문자열', ...[...fromFiles].sort().map(s => '- ' + s), '',
    '## 게임을 해 보며 화면에서 본 문구', ...[...seen].sort().map(s => '- ' + s), '',
    '## 쓰지 않는 말 검사',
    ...(hits.length ? hits.map(s => '- 발견: ' + s) : ['- 없음 (' + BANNED.join(', ') + ')'])];
  fs.writeFileSync(path.join(__dirname, '화면문구.txt'), lines.join('\n') + '\n');
  console.log(lines.join('\n'));
  process.exit(hits.length ? 1 : 0);
})();
