/* 시계 읽기 — 바늘 시계를 보고 몇 시인지 고르는 놀이
   한 판: 8문제 (정각 4개 + 30분 4개), 같은 시각은 한 번만
   시침 각도 = (시 % 12) × 30 + 분 × 0.5 도, 분침 각도 = 분 × 6 도 (12시 방향이 0도) */
var ClockGame = (function () {
  var TOTAL = 8;
  var HOURS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

  function rand(n) { return Math.floor(Math.random() * n); }

  function shuffle(list) {
    var a = list.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = rand(i + 1);
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function hourAngle(h, m) { return (h % 12) * 30 + m * 0.5; }
  function minuteAngle(m) { return m * 6; }
  function label(h, m) { return m === 0 ? h + '시' : h + '시 30분'; }

  // 보기: 정답 + 같은 시의 정각↔30분 + 분이 같고 시만 다른 것
  function makeOptions(h, m) {
    var otherHour = shuffle(HOURS.filter(function (x) { return x !== h; }))[0];
    return shuffle([label(h, m), label(h, m === 0 ? 30 : 0), label(otherHour, m)]);
  }

  function makeRound() {
    var list = [];
    shuffle(HOURS).slice(0, 4).forEach(function (h) { list.push({ h: h, m: 0 }); });
    shuffle(HOURS).slice(0, 4).forEach(function (h) { list.push({ h: h, m: 30 }); });
    return shuffle(list).map(function (q) {
      return { h: q.h, m: q.m, answer: label(q.h, q.m), options: makeOptions(q.h, q.m) };
    });
  }

  // 시계 그림 (SVG 글자로 만들어 넣음)
  function clockMarkup(h, m) {
    var c = 100;
    var s = '<svg viewBox="0 0 200 200" role="img" aria-label="바늘 시계">';
    s += '<circle cx="100" cy="100" r="95" fill="#ffffff" stroke="#8fbcf5" stroke-width="6"/>';
    for (var i = 0; i < 60; i++) {           // 눈금
      var big = i % 5 === 0;
      s += '<line x1="100" y1="' + (big ? 10 : 11) + '" x2="100" y2="' + (big ? 18 : 15) +
        '" stroke="#b9b4c9" stroke-width="' + (big ? 2.5 : 1) + '" transform="rotate(' + (i * 6) + ' 100 100)"/>';
    }
    for (var n = 1; n <= 12; n++) {           // 숫자 1~12
      var rad = n * 30 * Math.PI / 180;
      var x = c + 66 * Math.sin(rad);
      var y = c - 66 * Math.cos(rad);
      s += '<text x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" text-anchor="middle" dominant-baseline="central"' +
        ' font-size="20" font-weight="700" fill="#3d3a4b">' + n + '</text>';
    }
    // 분침: 길고 가늘고 파랑
    s += '<line class="minute-hand" x1="100" y1="100" x2="100" y2="22" stroke="#3a7bd5" stroke-width="4"' +
      ' stroke-linecap="round" transform="rotate(' + minuteAngle(m) + ' 100 100)"/>';
    // 시침: 짧고 굵고 주황
    s += '<line class="hour-hand" x1="100" y1="100" x2="100" y2="52" stroke="#f08a24" stroke-width="10"' +
      ' stroke-linecap="round" transform="rotate(' + hourAngle(h, m) + ' 100 100)"/>';
    s += '<circle cx="100" cy="100" r="6" fill="#3d3a4b"/>';
    s += '</svg>';
    return s;
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
      guide.textContent = '몇 시일까요?';
      stage.appendChild(guide);

      var clock = document.createElement('div');
      clock.className = 'clock';
      clock.innerHTML = clockMarkup(q.h, q.m);
      stage.appendChild(clock);

      var row = document.createElement('div');
      row.className = 'btn-row choices clock-choices';
      var buttons = q.options.map(function (text) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'btn choice';
        b.textContent = text;
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
            answerText: q.answer,
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

  return {
    TOTAL: TOTAL, hourAngle: hourAngle, minuteAngle: minuteAngle, label: label,
    makeRound: makeRound, makeOptions: makeOptions, clockMarkup: clockMarkup, start: start
  };
})();

if (typeof document !== 'undefined') ClockGame.start();
