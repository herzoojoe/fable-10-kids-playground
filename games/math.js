/* 계산하기 — 두 자리 수의 더하기·빼기·곱하기·나누기
   한 판: 더하기 3개 + 빼기 3개 + 곱하기 2개 + 나누기 2개, 순서는 섞음
   더하기: 두 수와 답 모두 10~99
   빼기:   두 수와 답 모두 10~99
   곱하기: 두 자리 수(10~49) × 한 자리 수(2~9), 답 99 이하
   나누기: 두 자리 수 ÷ 한 자리 수(2~9), 항상 나누어떨어짐 (나뉠 수 = 나누는 수 × 몫)
   그림 도움: 더하기·빼기는 십 모형(10개짜리 막대 + 낱개 네모), 곱하기·나누기는 식만 */
var MathGame = (function () {
  var TOTAL = 10;

  function rand(n) { return Math.floor(Math.random() * n); }
  function between(lo, hi) { return lo + rand(hi - lo + 1); }

  function shuffle(list) {
    var a = list.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = rand(i + 1);
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  // 정답 −2, −1, +1, +2 중 0~99 안의 수에서 2개를 무작위로 고름
  function makeOptions(answer) {
    var near = [answer - 2, answer - 1, answer + 1, answer + 2].filter(function (n) {
      return n >= 0 && n <= 99;
    });
    return shuffle([answer].concat(shuffle(near).slice(0, 2)));
  }

  function makeProblem(op) {
    var a, b, q;
    if (op === '+') {
      a = between(10, 89);
      b = between(10, 99 - a);                 // 합 ≤ 99
      return { op: '+', a: a, b: b, answer: a + b };
    }
    if (op === '-') {
      a = between(20, 99);
      b = between(10, a - 10);                 // 답 ≥ 10
      return { op: '-', a: a, b: b, answer: a - b };
    }
    if (op === '×') {
      b = between(2, 9);
      a = between(10, Math.floor(99 / b));     // 곱 ≤ 99
      return { op: '×', a: a, b: b, answer: a * b };
    }
    b = between(2, 9);                         // 나누는 수
    q = between(Math.ceil(10 / b), Math.floor(99 / b));   // 나뉠 수가 10~99가 되게
    return { op: '÷', a: b * q, b: b, answer: q };       // 항상 나누어떨어짐
  }

  // 한 판(10문제)을 만듦
  function makeRound() {
    var list = [];
    var seen = {};
    ['+', '+', '+', '-', '-', '-', '×', '×', '÷', '÷'].forEach(function (op) {
      var q;
      do { q = makeProblem(op); } while (seen[q.a + q.op + q.b]);   // 같은 식은 한 번만
      seen[q.a + q.op + q.b] = true;
      q.options = makeOptions(q.answer);
      list.push(q);
    });
    return shuffle(list);
  }

  function start() {
    var stage = document.getElementById('stage');
    var progress = document.getElementById('progress');
    document.getElementById('my-stars').innerHTML = '⭐ <span data-star-count></span>';

    var questions, index, earned;

    function newGame() {
      questions = makeRound();
      index = 0;
      earned = 0;
      show();
    }

    // 십 모형: 10개짜리 막대와 낱개 네모로 수를 보여 줌 (34 = 막대 3개 + 네모 4개)
    function blocks(n) {
      var wrap = document.createElement('div');
      wrap.className = 'tens-blocks';
      wrap.setAttribute('aria-hidden', 'true');
      for (var t = 0; t < Math.floor(n / 10); t++) {
        var bar = document.createElement('span');
        bar.className = 'ten-bar';
        for (var c = 0; c < 10; c++) bar.appendChild(document.createElement('i'));
        wrap.appendChild(bar);
      }
      var units = document.createElement('span');
      units.className = 'ones';
      for (var u = 0; u < n % 10; u++) units.appendChild(document.createElement('i'));
      wrap.appendChild(units);
      return wrap;
    }

    function show() {
      var q = questions[index];
      var state = {};
      progress.textContent = (index + 1) + ' / ' + TOTAL;
      Array.prototype.forEach.call(document.querySelectorAll('[data-star-count]'), function (e) {
        e.textContent = String(Stars.count());
      });
      stage.innerHTML = '';

      var guide = document.createElement('p');
      guide.className = 'guide';
      guide.textContent = '답은 얼마일까요?';
      stage.appendChild(guide);

      var SIGN = { '+': ' + ', '-': ' − ', '×': ' × ', '÷': ' ÷ ' };
      var eq = document.createElement('p');
      eq.className = 'question';
      eq.textContent = q.a + SIGN[q.op] + q.b + ' = ?';
      stage.appendChild(eq);

      if (q.op === '+' || q.op === '-') {
        var counters = document.createElement('div');
        counters.className = 'counters';
        counters.appendChild(blocks(q.a));
        var sign = document.createElement('span');
        sign.className = 'count-sign';
        sign.textContent = q.op === '+' ? '+' : '−';
        counters.appendChild(sign);
        counters.appendChild(blocks(q.b));
        stage.appendChild(counters);
      }

      var row = document.createElement('div');
      row.className = 'btn-row choices';
      var buttons = q.options.map(function (n) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'btn choice';
        b.textContent = String(n);
        row.appendChild(b);
        return b;
      });
      var correctButton = buttons[q.options.indexOf(q.answer)];
      buttons.forEach(function (b, i) {
        b.addEventListener('click', function () {
          Stars.choose({
            button: b,
            isCorrect: q.options[i] === q.answer,
            correctButton: correctButton,
            answerText: String(q.answer),
            state: state,
            onNext: next
          });
        });
      });
      stage.appendChild(row);
    }

    function next(gotStar) {
      if (gotStar) earned++;
      index++;
      if (index < TOTAL) show();
      else Stars.showEnd(earned, newGame);
    }

    newGame();
  }

  return { TOTAL: TOTAL, makeRound: makeRound, makeOptions: makeOptions, start: start };
})();

if (typeof document !== 'undefined') MathGame.start();
