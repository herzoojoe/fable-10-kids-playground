/* 같은 그림 찾기 — 카드 12장(그림 6쌍)을 두 장씩 뒤집어 짝을 찾는 놀이
   짝이 아니면 두 카드를 1초 동안 보여 준 뒤 다시 뒤집음 (카드를 기억할 시간이며 시간 제한이 아님) */
var MatchGame = (function () {
  var PAIRS = 6;
  var ANIMALS = ['🐶', '🐱', '🐰', '🐻', '🐼', '🐵', '🦊', '🐯', '🐷', '🐮'];
  var SHOW_MS = 1000;

  function shuffle(list) {
    var a = list.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  // 카드 12장: 그림 6개를 골라 두 장씩
  function makeDeck() {
    var picked = shuffle(ANIMALS).slice(0, PAIRS);
    return shuffle(picked.concat(picked));
  }

  function start() {
    var stage = document.getElementById('stage');
    var progress = document.getElementById('progress');
    document.getElementById('my-stars').innerHTML = '⭐ <span data-star-count></span>';

    var deck, cards, first, locked, found, earned, message;

    function refreshStars() {
      Array.prototype.forEach.call(document.querySelectorAll('[data-star-count]'), function (e) {
        e.textContent = String(Stars.count());
      });
    }

    function setProgress() {
      progress.textContent = '찾은 짝 ' + found + ' / ' + PAIRS;
    }

    function faceDown(card) {
      card.classList.remove('is-open');
      card.firstChild.textContent = '❓';
      card.setAttribute('aria-label', '뒤집힌 카드');
    }

    function faceUp(card) {
      card.classList.add('is-open');
      card.firstChild.textContent = card.dataset.animal;
      card.setAttribute('aria-label', card.dataset.animal);
    }

    function newGame() {
      deck = makeDeck();
      first = null;
      locked = false;
      found = 0;
      earned = 0;
      stage.innerHTML = '';
      setProgress();
      refreshStars();

      var board = document.createElement('div');
      board.className = 'board';
      cards = deck.map(function (animal) {
        var card = document.createElement('button');
        card.type = 'button';
        card.className = 'btn card';
        card.dataset.animal = animal;
        var face = document.createElement('span');
        face.className = 'card-face';
        card.appendChild(face);
        faceDown(card);
        card.addEventListener('click', function () { pick(card); });
        board.appendChild(card);
        return card;
      });
      stage.appendChild(board);

      message = document.createElement('p');
      message.className = 'match-message';
      message.textContent = '괜찮아요! 어디 있었는지 기억해 봐요';
      stage.appendChild(message);
    }

    function pick(card) {
      // 뒤집히는 1초 동안, 또는 이미 열린 카드는 아무 일도 없음
      if (locked || card.classList.contains('is-open')) return;
      message.classList.remove('is-show');
      faceUp(card);
      if (!first) {
        first = card;
        return;
      }
      var a = first;
      first = null;
      if (a.dataset.animal === card.dataset.animal) {
        a.classList.add('is-found');
        card.classList.add('is-found');
        var star = document.createElement('span');
        star.className = 'card-star star-pop';
        star.textContent = '⭐';
        card.appendChild(star);
        Stars.add();
        earned++;
        found++;
        setProgress();
        if (found === PAIRS) Stars.showEnd(earned, newGame);
      } else {
        locked = true;
        message.classList.add('is-show');
        setTimeout(function () {
          faceDown(a);
          faceDown(card);
          locked = false;
        }, SHOW_MS);
      }
    }

    newGame();
  }

  return { PAIRS: PAIRS, ANIMALS: ANIMALS, SHOW_MS: SHOW_MS, makeDeck: makeDeck, start: start };
})();

if (typeof document !== 'undefined') MatchGame.start();
