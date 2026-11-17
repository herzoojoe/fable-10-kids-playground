/* 꼬마 놀이터 — 별 스티커와 공통 화면
   전역 객체는 window.Stars 하나만 만듭니다.
   - 별 개수는 localStorage 의 'kkoma-stars' 에 저장합니다.
   - 저장이 막힌 환경에서는 지금 열린 화면 안에서만 별을 기억합니다.
   - 공통 상자는 아이가 버튼을 눌러야만 닫힙니다 (저절로 넘어가지 않음). */
(function () {
  var KEY = 'kkoma-stars';
  var memory = 0;   // 저장이 안 될 때 쓰는 이 화면 안의 별 개수

  function load() {
    try {
      var raw = window.localStorage.getItem(KEY);
      var n = parseInt(raw, 10);
      return isNaN(n) || n < 0 ? 0 : n;
    } catch (e) {
      return memory;
    }
  }

  function save(n) {
    try {
      window.localStorage.setItem(KEY, String(n));
    } catch (e) {
      /* 저장할 수 없어도 화면 안에서는 계속 셉니다 */
    }
  }

  memory = load();

  function count() {
    var saved = load();
    // 저장소가 동작하면 저장된 값, 아니면 화면 안의 값
    memory = Math.max(memory, saved);
    return memory;
  }

  function refreshCounters() {
    if (typeof document === 'undefined') return;
    var els = document.querySelectorAll('[data-star-count]');
    for (var i = 0; i < els.length; i++) els[i].textContent = String(count());
  }

  function add() {
    memory = count() + 1;
    save(memory);
    refreshCounters();
    return memory;
  }

  /* ---------- 상자 만들기 ---------- */
  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  function closeOverlay() {
    var old = document.getElementById('stars-overlay');
    if (old && old.parentNode) old.parentNode.removeChild(old);
  }

  // parts: { emoji, pop, title, text, buttons:[{label, onClick, href, cls}], center }
  function openOverlay(parts) {
    closeOverlay();
    var overlay = el('div', 'overlay' + (parts.center ? ' is-center' : ''));
    overlay.id = 'stars-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');

    // 끝 화면은 가운데 큰 상자, 나머지는 문제(그림·시계)를 가리지 않도록 위쪽 띠 모양
    var panel = el('div', 'panel' + (parts.center ? '' : ' panel-bar'));
    var emoji = el('div', 'panel-emoji' + (parts.pop ? ' star-pop' : ''), parts.emoji);
    emoji.setAttribute('aria-hidden', 'true');
    panel.appendChild(emoji);
    var body = el('div', 'panel-body');
    if (parts.title) body.appendChild(el('p', 'panel-title', parts.title));
    if (parts.text) body.appendChild(el('p', 'panel-text', parts.text));
    panel.appendChild(body);

    var row = el('div', 'btn-row');
    var first = null;
    parts.buttons.forEach(function (b) {
      var node;
      if (b.href) {
        node = el('a', 'btn ' + (b.cls || ''), b.label);
        node.href = b.href;
      } else {
        node = el('button', 'btn ' + (b.cls || ''), b.label);
        node.type = 'button';
        node.addEventListener('click', function () {
          closeOverlay();
          if (typeof b.onClick === 'function') b.onClick();
        });
      }
      row.appendChild(node);
      if (!first) first = node;
    });
    panel.appendChild(row);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);
    if (first && first.focus) first.focus();
    return overlay;
  }

  /* 받침이 있으면 '이에요', 없으면 '예요' (숫자는 읽는 소리 기준) */
  var DIGIT_HAS_FINAL = { '0': true, '1': true, '2': false, '3': true, '4': false,
    '5': false, '6': true, '7': true, '8': true, '9': false };
  function copula(word, hasFinalGiven) {
    var s = String(word).replace(/\s+$/, '');
    var last = s.charAt(s.length - 1);
    var code = last.charCodeAt(0);
    var hasFinal;
    if (typeof hasFinalGiven === 'boolean') {
      hasFinal = hasFinalGiven;                 // 영어 단어처럼 게임이 알려 준 경우
    } else if (code >= 0xAC00 && code <= 0xD7A3) {
      hasFinal = (code - 0xAC00) % 28 !== 0;
    } else if (DIGIT_HAS_FINAL.hasOwnProperty(last)) {
      hasFinal = /10$/.test(s) ? true : DIGIT_HAS_FINAL[last];   // 10 = 십
    } else {
      hasFinal = false;
    }
    return s + (hasFinal ? '이에요' : '예요');
  }

  /* ---------- 공통 화면 ---------- */
  function showCorrect(onNext) {
    return openOverlay({
      emoji: '⭐', pop: true,
      title: '잘했어요!',
      text: '별 스티커를 받았어요!',
      buttons: [{ label: '다음 ▶', onClick: onNext }]
    });
  }

  function showRetry(onRetry) {
    return openOverlay({
      emoji: '🤗',
      title: '괜찮아요!',
      text: '한 번 더 해 볼까요?',
      buttons: [{ label: '다시 해 볼게요', onClick: onRetry }]
    });
  }

  function showAnswer(answerText, onNext, hasFinal) {
    return openOverlay({
      emoji: '🙂',
      title: '같이 볼까요?',
      text: '정답은 ' + copula(answerText, hasFinal) + '.',
      buttons: [{ label: '다음 ▶', onClick: onNext }]
    });
  }

  function showEnd(earned, onAgain) {
    return openOverlay({
      emoji: '🎉', pop: true, center: true,
      title: '다 했어요!',
      text: '이번 놀이에서 별 ⭐ ' + earned + '개를 모았어요',
      buttons: [
        { label: '한 번 더 하기', onClick: onAgain },
        { label: '🏠 처음으로', href: '../index.html', cls: 'home-link' }
      ]
    });
  }

  /* 보기 하나를 눌렀을 때의 공통 흐름 (영어 단어·계산하기·시계 게임이 함께 씀)
     opt = { button, isCorrect, correctButton, answerText, answerHasFinal(없어도 됨), state, onNext }
     state 는 문제마다 새로 만드는 {} 이며, 몇 번 다시 했는지 기억합니다.
     onNext(gotStar) — 「다음 ▶」을 누르면 실행. 별을 받았으면 true */
  function choose(opt) {
    var state = opt.state;
    if (state.done) return;
    if (opt.isCorrect) {
      state.done = true;
      opt.button.classList.add('is-correct');
      add();                                   // 한 문제에 별은 1개
      showCorrect(function () { opt.onNext(true); });
      return;
    }
    opt.button.classList.add('is-dim');        // 고른 보기는 흐리게, 다시 못 누름
    opt.button.disabled = true;
    state.tries = (state.tries || 0) + 1;
    if (state.tries === 1) {
      showRetry(function () {});
    } else {
      state.done = true;
      opt.correctButton.classList.add('is-answer');
      showAnswer(opt.answerText, function () { opt.onNext(false); }, opt.answerHasFinal);
    }
  }

  window.Stars = {
    add: add,
    count: count,
    showCorrect: showCorrect,
    showRetry: showRetry,
    showAnswer: showAnswer,
    showEnd: showEnd,
    choose: choose
  };

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', refreshCounters);
    } else {
      refreshCounters();
    }
  }
})();
