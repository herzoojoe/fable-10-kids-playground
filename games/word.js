/* 영어 단어 맞추기 — 그림을 보고 맞는 영어 단어를 고르는 놀이
   [그림, 영어 단어, 한국어로 읽을 때 끝소리에 받침이 있는지]
   세 번째 값은 「정답은 lion이에요 / cow예요」처럼 뒤에 붙는 말을 고르는 데만 씀 */
var WordGame = (function () {
  var WORDS = [
    ['🦋', 'butterfly', false], ['🦁', 'lion', true], ['🥒', 'cucumber', false],
    ['🥛', 'milk', false], ['🍌', 'banana', false], ['🍅', 'tomato', false],
    ['🚂', 'train', true], ['🧢', 'cap', true], ['🍇', 'grapes', false],
    ['🦛', 'hippo', false], ['🐸', 'frog', false], ['🐋', 'whale', true],
    ['🍆', 'eggplant', false], ['🕐', 'clock', true], ['🐘', 'elephant', false],
    ['🍕', 'pizza', false], ['🍐', 'pear', false], ['🪑', 'chair', false],
    ['🕷️', 'spider', false], ['🚌', 'bus', false], ['🦆', 'duck', true],
    ['🍎', 'apple', true], ['🦊', 'fox', false], ['🦝', 'raccoon', true],
    ['👞', 'shoe', false], ['🧀', 'cheese', false], ['🍠', 'sweet potato', false],
    ['🥝', 'kiwi', false], ['🐄', 'cow', false], ['🦀', 'crab', true]
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
  // 한 판 안에서는 정답과 보기를 통틀어 같은 단어가 두 번 나오지 않음
  // (10문제 × 보기 3개 = 30칸, 단어 30개를 섞어 한 번씩만 씀)
  function makeRound() {
    var mixed = shuffle(WORDS);
    var picked = mixed.slice(0, TOTAL);              // 정답 10개
    var rest = mixed.slice(TOTAL);                    // 나머지는 다른 보기로 2개씩
    return picked.map(function (item, i) {
      var others = rest.slice(i * 2, i * 2 + 2).map(function (w) { return w[1]; });
      return { emoji: item[0], answer: item[1], answerHasFinal: item[2],
               options: shuffle([item[1]].concat(others)) };
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
      guide.textContent = '그림에 맞는 영어 단어를 눌러 보세요';
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
            answerHasFinal: q.answerHasFinal,
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
