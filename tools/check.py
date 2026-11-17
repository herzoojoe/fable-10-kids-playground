#!/usr/bin/env python3
"""꼬마 놀이터 금지 사항 점검 도구.

사용법:  python3 tools/check.py
사이트 파일(index.html, games/, css/, js/)을 검사해 항목별로 통과/실패를 출력합니다.
하나라도 실패하면 종료 코드 1을 돌려줍니다.
이 파일은 점검용이며, 사이트 화면은 이 파일을 불러오지 않습니다.
"""
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE_DIRS = ["games", "css", "js"]
SITE_TOP_FILES = ["index.html"]
TEXT_EXT = (".html", ".css", ".js")
BANNED_FILE_EXT = (".png", ".jpg", ".jpeg", ".gif", ".svg",
                   ".woff", ".woff2", ".ttf", ".otf")


def site_files():
    files = []
    for name in SITE_TOP_FILES:
        p = os.path.join(ROOT, name)
        if os.path.isfile(p):
            files.append(p)
    for d in SITE_DIRS:
        for base, _dirs, names in os.walk(os.path.join(ROOT, d)):
            for n in sorted(names):
                files.append(os.path.join(base, n))
    return files


def read(p):
    with open(p, encoding="utf-8", errors="replace") as f:
        return f.read()


def find_all(files, patterns, regex=False):
    """patterns 중 하나라도 들어 있는 (파일, 줄 번호, 패턴) 목록."""
    hits = []
    for p in files:
        if not p.endswith(TEXT_EXT):
            continue
        for i, line in enumerate(read(p).splitlines(), 1):
            for pat in patterns:
                found = re.search(pat, line) if regex else (pat in line)
                if found:
                    hits.append((os.path.relpath(p, ROOT), i, pat))
    return hits


def main():
    files = site_files()
    results = []

    def check(title, hits):
        results.append((title, hits))

    check("외부 주소(http://, https://) 없음",
          find_all(files, ["http://", "https://"]))
    check("모듈·서버 기능(type=\"module\", import, export, fetch(, XMLHttpRequest) 없음",
          find_all(files, ['type="module"', "type='module'", "import ", "export ",
                           "fetch(", "XMLHttpRequest"]))
    check("입력 칸(<input, <textarea, <form) 없음",
          find_all(files, ["<input", "<textarea", "<form"]))

    banned_files = []
    for base, dirs, names in os.walk(ROOT):
        rel = os.path.relpath(base, ROOT)
        # .git 과 점검 도구 폴더(tools/, 스크린샷 포함)는 사이트가 아니므로 제외
        if rel.split(os.sep)[0] in (".git", "tools"):
            continue
        for n in names:
            if n.lower().endswith(BANNED_FILE_EXT):
                banned_files.append((os.path.relpath(os.path.join(base, n), ROOT), 0, "파일"))
    check("그림·글꼴 파일(.png .jpg .jpeg .gif .svg .woff .woff2 .ttf .otf) 없음",
          banned_files)

    words = ["틀렸", "땡", "아니야", "실패", "바보", "왜 몰라", "오답", "벌점", "다시는"]
    check("쓰지 않는 말(" + ", ".join(words) + ") 없음 (주석 포함)",
          find_all(files, words))

    check("사이트 파일이 tools/ 를 불러오지 않음",
          find_all(files, ["tools/"]))

    check("빨간색 계열 색과 ✕ 표시 없음",
          find_all(files, [r"\bred\b", r"#f00\b", r"#ff0000", r"\bcrimson\b",
                           r"\bfirebrick\b", r"\bdarkred\b", r"\bindianred\b",
                           "✕", "✖", "❌", "❎"], regex=True))

    fails = 0
    print("꼬마 놀이터 점검 (검사한 사이트 파일 %d개)" % len(files))
    print("-" * 50)
    for title, hits in results:
        if hits:
            fails += 1
            print("[실패] " + title)
            for f, line, pat in hits[:20]:
                print("        %s:%s  (%s)" % (f, line, pat))
        else:
            print("[통과] " + title)
    print("-" * 50)
    print("통과 %d / 실패 %d" % (len(results) - fails, fails))
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
