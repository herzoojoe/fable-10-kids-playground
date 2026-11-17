/* 낱말 맞추기 — 그림을 보고 맞는 낱말을 고르는 놀이
   낱말은 모두 받침이 없습니다: (글자 코드 - 0xAC00) % 28 === 0 */
var WordGame = (function () {
  var WORDS = [
    ['🦋', '나비'], ['🦁', '사자'], ['🥒', '오이'],
    ['🥛', '우유'], ['🍌', '바나나'], ['🍅', '토마토'],
    ['🚂', '기차'], ['🧢', '모자'], ['🍇', '포도'],
    ['🦛', '하마'], ['🐸', '개구리'], ['🐋', '고래'],
    ['🍆', '가지'], ['🕐', '시계'], ['🐘', '코끼리'],
    ['🍕', '피자'], ['🍐', '배'], ['🪑', '의자'],
    ['🕷️', '거미'], ['🚌', '버스'], ['🦆', '오리'],
    ['🍎', '사과'], ['🦊', '여우'], ['🦝', '너구리'],
    ['👞', '구두'], ['🧀', '치즈'], ['🍠', '고구마'],
    ['🥝', '키위'], ['🐄', '소']
  ];
  var TOTAL = 10;

  function shuffle(list) {
    var a = list.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  // 한 판(10문제)을 만듦: [{ emoji, answer, options:[3개] }]
  function makeRound() {
    var picked = shuffle(WORDS).slice(0, TOTAL);      // 같은 그림이 두 번 나오지 않음
    return picked.map(function (item) {
      var others = shuffle(WORDS.filter(function (w) { return w[1] !== item[1]; }))
        .slice(0, 2).map(function (w) { return w[1]; });
      return { emoji: item[0], answer: item[1], options: shuffle([item[1]].concat(others)) };
    });
  }

  function start() {
    var stage = document.getElementById('stage');
    var progress = document.getElementById('progress');
    var myStars = document.getElementById('my-stars');
    myStars.innerHTML = '⭐ <span data-star-count></span>';

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
      guide.textContent = '그림에 맞는 낱말을 눌러 보세요';
      stage.appendChild(guide);

      var pic = document.createElement('div');
      pic.className = 'picture';
      pic.setAttribute('aria-hidden', 'true');
      pic.textContent = q.emoji;
      stage.appendChild(pic);

      var row = document.createElement('div');
      row.className = 'btn-row choices';
      var buttons = q.options.map(function (word) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'btn choice';
        b.textContent = word;
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

  return { WORDS: WORDS, TOTAL: TOTAL, makeRound: makeRound, start: start };
})();

if (typeof document !== 'undefined') WordGame.start();
