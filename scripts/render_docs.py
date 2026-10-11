"""_src/*.md 템플릿에 _data/facts.yaml 값을 채워 작업 폴더 루트에 최종 문서를 만든다.

치환 규칙
- {{키}}        facts.yaml 의 value. value 가 null 이면 [확정 필요: label]
- {{@pending}}  이 문서에서 쓰인 키 중 value 가 null 인 항목 목록
- {{@status}}   FAQ 블록 안에서만 사용. 답변에 "[확정 필요" 가 있으면 미확정, 없으면 확정
- {{@chatbot}}  HTML 전용. 배포용 페이지에는 챗봇 스크립트 태그, 검토용 페이지에는 빈 문자열

사용법: python scripts/render_docs.py
"""

import html
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FACTS = ROOT / "_data" / "facts.yaml"
SRC = ROOT / "_src"
DOCS = ["company-profile.md", "service-policy.md", "faq.md"]
DOCS_DIR = ROOT / "docs"  # 챗봇 RAG 적재 대상(docs/*.md)
# 디자인 적용 웹페이지: _src 의 HTML 템플릿 → 출력 경로
HTML_DOCS = {"company-profile.html": ROOT / "design" / "company-profile.html"}
# 배포용 공개 페이지(Vercel 출력 폴더 public/): 내부 구역 제거, 미확정 값은 안내 문구로 대체
PUBLIC_DOCS = {"company-profile.html": ROOT / "public" / "index.html"}
PUBLIC_FALLBACK_DEFAULT = "상담 시 안내"
PUBLIC_FALLBACK = {"ops_email_official": ""}  # 빈 문자열이면 공개 페이지에서 표시하지 않음
INTERNAL_BLOCK = re.compile(r"[ \t]*<!-- internal:start -->.*?<!-- internal:end -->\n?", re.S)

PLACEHOLDER = re.compile(r"\{\{\s*([A-Za-z0-9_]+)\s*\}\}")
FAQ_HEADING = re.compile(r"^### FAQ-\d{3}\. ")


def parse_scalar(raw):
    raw = raw.strip()
    if raw.startswith('"'):
        end = raw.find('"', 1)
        return raw[1:end] if end != -1 else raw[1:]
    if raw.startswith("'"):
        end = raw.find("'", 1)
        return raw[1:end] if end != -1 else raw[1:]
    raw = re.split(r"\s+#", raw, maxsplit=1)[0].strip()
    if raw in ("", "null", "~"):
        return None
    if raw.startswith("[") and raw.endswith("]"):
        return [x.strip() for x in raw[1:-1].split(",") if x.strip()]
    return raw


def load_facts(path=FACTS):
    """facts.yaml 전용 단순 파서: 최상위 키 아래 label / value / used_in 만 읽는다."""
    facts, current = {}, None
    for no, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        top = re.match(r"^([A-Za-z0-9_]+):\s*$", line)
        if top:
            current = top.group(1)
            if current in facts:
                sys.exit(f"facts.yaml {no}행: 키 중복 '{current}'")
            facts[current] = {"label": current, "value": None, "used_in": []}
            continue
        field = re.match(r"^\s+(label|value|used_in):\s*(.*)$", line)
        if field and current:
            facts[current][field.group(1)] = parse_scalar(field.group(2))
            continue
        sys.exit(f"facts.yaml {no}행을 읽을 수 없습니다: {line}")
    return facts


def pending_text(text):
    return f"[확정 필요: {text}]"


def fill_status(text):
    """FAQ 블록마다 {{@status}} 를 확정/미확정으로 바꾼다."""
    lines = text.split("\n")
    starts = [i for i, l in enumerate(lines) if FAQ_HEADING.match(l)]
    for idx, start in enumerate(starts):
        end = len(lines)
        for j in range(start + 1, len(lines)):
            if lines[j].startswith("## ") or lines[j].startswith("### "):
                end = j
                break
        block = "\n".join(lines[start:end])
        status = "미확정" if "[확정 필요" in block else "확정"
        for j in range(start, end):
            lines[j] = lines[j].replace("{{@status}}", status)
    return "\n".join(lines)


def render(name, facts):
    src = (SRC / name).read_text(encoding="utf-8")
    used = []
    for key in PLACEHOLDER.findall(src):
        if key not in facts:
            sys.exit(f"{name}: facts.yaml 에 없는 키 '{{{{{key}}}}}'")
        if key not in used:
            used.append(key)

    def sub(m):
        item = facts[m.group(1)]
        return item["value"] if item["value"] is not None else pending_text(item["label"])

    out = PLACEHOLDER.sub(sub, src)

    nulls = [k for k in used if facts[k]["value"] is None]
    if nulls:
        listing = "\n".join(f"- [ ] {facts[k]['label']} (`{k}`)" for k in nulls)
    else:
        listing = "- 없음 (모든 정책 값이 확정되었습니다.)"
    out = out.replace("{{@pending}}", listing)
    out = fill_status(out)

    if "{{" in out:
        sys.exit(f"{name}: 치환되지 않은 자리표시자가 남아 있습니다.")
    DOCS_DIR.mkdir(exist_ok=True)
    (DOCS_DIR / name).write_text(out.rstrip("\n") + "\n", encoding="utf-8", newline="\n")
    return used, nulls


def render_html(name, out_path, facts, public=False):
    """HTML 템플릿용: 값은 HTML 이스케이프, 미확정은 <span class="pending"> 으로 표시한다.

    public=True 이면 internal 구역을 지우고, 미확정 값은 PUBLIC_FALLBACK 문구로 바꾼다.
    """
    src = (SRC / name).read_text(encoding="utf-8")
    if public:
        src = INTERNAL_BLOCK.sub("", src)
    used = []
    for key in PLACEHOLDER.findall(src):
        if key not in facts:
            sys.exit(f"{name}: facts.yaml 에 없는 키 '{{{{{key}}}}}'")
        if key not in used:
            used.append(key)

    def sub(m):
        key = m.group(1)
        item = facts[key]
        if item["value"] is not None:
            return html.escape(item["value"])
        if public:
            return html.escape(PUBLIC_FALLBACK.get(key, PUBLIC_FALLBACK_DEFAULT))
        return f'<span class="pending" data-fact="{key}">{html.escape(item["label"])}</span>'

    out = PLACEHOLDER.sub(sub, src)
    nulls = [k for k in used if facts[k]["value"] is None]
    if nulls:
        listing = "\n".join(
            f'        <li><span>{html.escape(facts[k]["label"])} <code>{k}</code></span></li>' for k in nulls)
    else:
        listing = "        <li><span>없음 (모든 정책 값이 확정되었습니다.)</span></li>"
    out = out.replace("{{@pending}}", listing)
    # 고객응대 챗봇은 배포용 페이지에만 붙인다 (검토용 페이지는 로컬 파일로 열기 때문)
    out = out.replace("{{@chatbot}}", '<script src="/chatbot.js" defer></script>' if public else "")
    if "{{" in out:
        sys.exit(f"{name}: 치환되지 않은 자리표시자가 남아 있습니다.")
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(out, encoding="utf-8", newline="\n")
    return used, nulls


def main():
    facts = load_facts()
    for name in DOCS:
        used, nulls = render(name, facts)
        print(f"{name}: 정책 값 {len(used)}개 사용, 미확정 {len(nulls)}개")
    for name, out_path in HTML_DOCS.items():
        used, nulls = render_html(name, out_path, facts)
        print(f"{out_path.relative_to(ROOT).as_posix()}: 정책 값 {len(used)}개 사용, 미확정 {len(nulls)}개")
    for name, out_path in PUBLIC_DOCS.items():
        used, nulls = render_html(name, out_path, facts, public=True)
        print(f"{out_path.relative_to(ROOT).as_posix()}: 공개용, 미확정 {len(nulls)}개는 '{PUBLIC_FALLBACK_DEFAULT}'로 표시")


if __name__ == "__main__":
    main()
