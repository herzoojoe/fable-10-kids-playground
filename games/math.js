/* 더하기 빼기 — 10까지의 더하기와 빼기 (답은 0~10)
   한 판: 더하기 5개 + 빼기 5개, 순서는 섞음
   0이 들어간 문제(식의 숫자나 답 중 하나라도 0)는 한 판에 1개까지 */
var MathGame = (function () {
  var TOTAL = 10;
  var EMOJIS = ['🍎', '🐟', '🌷', '🚗', '⚽'];

  function rand(n) { return Math.floor(Math.random() * n); }

  function shuffle(list) {
    var a = list.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = rand(i + 1);
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function hasZero(q) { return q.a === 0 || q.b === 0 || q.answer === 0; }

  // 정답 −2, −1, +1, +2 중 0~10 안의 수에서 2개를 무작위로 고름
  function makeOptions(answer) {
    var near = [answer - 2, answer - 1, answer + 1, answer + 2].filter(function (n) {
      return n >= 0 && n <= 10;
    });
    return shuffle([answer].concat(shuffle(near).slice(0, 2)));
  }

  function makeProblem(op) {
    var a, b;
    if (op === '+') {
      a = rand(11);
      b = rand(11 - a);          // a + b ≤ 10
      return { op: '+', a: a, b: b, answer: a + b };
    }
    a = rand(11);
    b = rand(a + 1);             // b ≤ a, 답은 0 이상
    return { op: '-', a: a, b: b, answer: a - b };
  }

  // 한 판(10문제)을 만듦
  function makeRound() {
    var list = [];
    var zeroUsed = false;
    var seen = {};
    ['+', '+', '+', '+', '+', '-', '-', '-', '-', '-'].forEach(function (op) {
      var q;
      for (;;) {
        q = makeProblem(op);
        var key = q.a + q.op + q.b;
        if (seen[key]) continue;                 // 같은 식은 한 판에 한 번만
        if (hasZero(q) && zeroUsed) continue;    // 0이 들어간 문제는 1개까지
        seen[key] = true;
        if (hasZero(q)) zeroUsed = true;
        break;
      }
      q.options = makeOptions(q.answer);
      q.emoji = EMOJIS[rand(EMOJIS.length)];
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

    function group(emoji, total, faded) {
      var g = document.createElement('div');
      g.className = 'count-group' + (total === 0 ? ' is-empty' : '');
      g.setAttribute('aria-hidden', 'true');
      for (var i = 0; i < total; i++) {
        var s = document.createElement('span');
        s.textContent = emoji;
        if (i >= total - faded) s.className = 'faded';   // 빼는 만큼 흐리게
        g.appendChild(s);
      }
      return g;
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
      guide.textContent = '몇 개일까요?';
      stage.appendChild(guide);

      var eq = document.createElement('p');
      eq.className = 'question';
      eq.textContent = q.a + (q.op === '+' ? ' + ' : ' − ') + q.b + ' = ?';
      stage.appendChild(eq);

      var counters = document.createElement('div');
      counters.className = 'counters';
      if (q.op === '+') {
        counters.appendChild(group(q.emoji, q.a, 0));
        var sign = document.createElement('span');
        sign.className = 'count-sign';
        sign.textContent = '+';
        counters.appendChild(sign);
        counters.appendChild(group(q.emoji, q.b, 0));
      } else {
        counters.appendChild(group(q.emoji, q.a, q.b));
      }
      stage.appendChild(counters);

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
            answerText: q.answer + '개',
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

  return { TOTAL: TOTAL, EMOJIS: EMOJIS, makeRound: makeRound, makeOptions: makeOptions, start: start };
})();

if (typeof document !== 'undefined') MathGame.start();
