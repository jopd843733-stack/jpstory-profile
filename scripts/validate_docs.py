"""렌더링된 문서 3종(company-profile.md, service-policy.md, faq.md)을 검사한다.

오류(ERROR)가 하나라도 있으면 종료 코드 1, 경고(WARN)만 있으면 0.
사용법: python scripts/render_docs.py && python scripts/validate_docs.py
"""

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from render_docs import DOCS, HTML_DOCS, PUBLIC_DOCS, ROOT, SRC, load_facts, PLACEHOLDER  # noqa: E402

FAQ_CATEGORIES = {
    "회사·담당자 소개 / 문의 채널·응대 방식": 8,
    "매매·임대 중개": 14,
    "중개 의뢰 절차와 필요 정보": 8,
    "내집마련 컨설팅": 10,
    "일반 부동산 컨설팅의 범위와 한계": 6,
    "신축 분양": 8,
    "분양 현장 촬영": 8,
    "유튜브 촬영 협업": 8,
    "촬영 일정·장소·준비물": 6,
    "결과물·편집·수정": 6,
    "비용·수수료·정산": 6,
    "계약·취소·일정 변경": 4,
    "지역 및 서비스 가능 범위": 3,
    "개인정보·사진·영상 활용": 3,
    "투자 위험과 수익 보장": 2,
}
AUDIENCES = {"공통", "투자자·실수요자", "공인중개사"}

# 금지 표현. "보장"은 부정·질문형(보장하지 않습니다, 보장되나요)만 허용한다.
FORBIDDEN = ["최고", "1위", "100%", "무조건", "확실한", "대박", "급등", "놓치면 후회"]
FIRST = re.compile(r"(?<!생애)최초")  # "생애최초"는 제도 명칭이라 허용
GUARANTEE = re.compile(r"보장(?!하지 않|되지 않|하나요|되나요|하지는 않)")
# 앞 문맥에 기대는 표현 (챗봇 청크 단독 사용 불가)
CONTEXT_DEPENDENT = ["위에서 말씀드린", "앞서", "이 경우", "위에서 설명한", "저희"]
# 브랜딩 기준상 쓰지 않는 표현 (회사 규모·연차 강조 금지)
BRAND_EXCLUDED = ["1인 사무소", "1인 중개", "1인사무소", "년차", "대표가 직접", "같은 담당자"]

# 0-1 확정 사실·공개 자료 기준일·법령 산식에서 온 숫자
CONFIRMED_TOKENS = {"2026년", "11일", "100배", "70배", "100개"}
NUMBER_TOKEN = re.compile(
    r"\d+(?:[,.]\d+)*\s?(?:천만원|만원|억원|원|%|영업일|시간|개월|년|일|분|회|편|개|배|㎡)"
)
PHONE = re.compile(r"01\d-\d{3,4}-\d{4}")
OFFICIAL = {
    "상호": "월드원공인중개사사무소",
    "연락처": "010-3848-5949",
    "소재지": "서울시 강남구 봉은사로 129, 거평타운 1501호",
}

errors, warns = [], []


def err(msg):
    errors.append(msg)


def warn(msg):
    warns.append(msg)


def sentence_count(text):
    text = text.replace("[법률·운영 검토 필요]", "").strip()
    return len(re.findall(r"[.?!](?=\s|$)", text))


def parse_faqs(text):
    lines = text.split("\n")
    faqs, current_section = [], None
    i = 0
    while i < len(lines):
        line = lines[i]
        if line.startswith("## "):
            current_section = line[3:].strip()
        m = re.match(r"^### FAQ-(\d{3})\. (.+)$", line)
        if m:
            block = {"id": int(m.group(1)), "q": m.group(2), "section": current_section,
                     "meta": {}, "answer": []}
            i += 1
            while i < len(lines) and not lines[i].startswith("#"):
                meta = re.match(r"^- (카테고리|대상|상태|태그): (.*)$", lines[i])
                if meta:
                    block["meta"][meta.group(1)] = meta.group(2).strip()
                elif lines[i].strip():
                    block["answer"].append(lines[i].strip())
                i += 1
            faqs.append(block)
            continue
        i += 1
    return faqs


def check_faq(text):
    faqs = parse_faqs(text)
    if len(faqs) != 100:
        err(f"faq.md: FAQ 개수 {len(faqs)}개 (100개여야 함)")
    ids = [f["id"] for f in faqs]
    if ids != list(range(1, len(faqs) + 1)):
        err("faq.md: FAQ ID가 FAQ-001부터 연속되지 않거나 중복이 있음")

    counts = {}
    for f in faqs:
        tag = f"FAQ-{f['id']:03d}"
        cat = f["meta"].get("카테고리")
        for key in ("카테고리", "대상", "상태", "태그"):
            if not f["meta"].get(key):
                err(f"{tag}: '{key}' 항목 없음")
        if cat and cat != f["section"]:
            err(f"{tag}: 카테고리 '{cat}'가 소속 섹션 '{f['section']}'과 다름")
        counts[cat] = counts.get(cat, 0) + 1
        if f["meta"].get("대상") not in AUDIENCES:
            err(f"{tag}: 대상 값 '{f['meta'].get('대상')}' 허용 안 됨")
        answer = " ".join(f["answer"])
        if not answer:
            err(f"{tag}: 답변 없음")
        expected = "미확정" if "[확정 필요" in answer else "확정"
        if f["meta"].get("상태") != expected:
            err(f"{tag}: 상태 '{f['meta'].get('상태')}' ≠ 답변 기준 '{expected}'")
        n = sentence_count(answer)
        if not 2 <= n <= 5:
            err(f"{tag}: 답변 {n}문장 (2~5문장이어야 함)")

    for cat, want in FAQ_CATEGORIES.items():
        if counts.get(cat, 0) != want:
            err(f"faq.md: '{cat}' {counts.get(cat, 0)}개 (기준 {want}개)")
    for cat in counts:
        if cat not in FAQ_CATEGORIES:
            err(f"faq.md: 정의되지 않은 카테고리 '{cat}'")
    return faqs


def law_tokens(policy_text):
    m = re.search(r"<!-- law-table:start -->(.*?)<!-- law-table:end -->", policy_text, re.S)
    if not m:
        err("service-policy.md: 법령 요율표 구간 표시(law-table) 없음")
        return set(), policy_text
    tokens = {t.replace(" ", "") for t in NUMBER_TOKEN.findall(m.group(1))}
    return tokens, policy_text.replace(m.group(0), "")


def main():
    facts = load_facts()
    texts = {}
    for name in DOCS:
        path = ROOT / name
        if not path.exists():
            err(f"{name}: 파일 없음 (render_docs.py 먼저 실행)")
            continue
        raw = path.read_bytes()
        if raw.startswith(b"\xef\xbb\xbf"):
            err(f"{name}: UTF-8 BOM 있음")
        texts[name] = raw.decode("utf-8")
    if errors:
        report()

    allowed = set(CONFIRMED_TOKENS)
    for item in facts.values():
        if item["value"]:
            allowed |= {t.replace(" ", "") for t in NUMBER_TOKEN.findall(item["value"])}
        allowed |= {t.replace(" ", "") for t in NUMBER_TOKEN.findall(item["label"] or "")}
    law, policy_wo_law = law_tokens(texts["service-policy.md"])
    allowed |= law

    for name, text in texts.items():
        body = policy_wo_law if name == "service-policy.md" else text
        body = re.sub(r"https?://\S+", "", body)  # URL 인코딩(%EA 등)은 숫자가 아님
        if "{{" in text:
            err(f"{name}: 치환되지 않은 '{{{{' 남아 있음")
        h1 = [l for l in text.split("\n") if re.match(r"^# ", l)]
        if len(h1) != 1:
            err(f"{name}: H1 제목 {len(h1)}개 (1개여야 함)")
        if re.search(r"^#{4,} ", text, re.M):
            err(f"{name}: H4 이하 제목 사용")
        for word in FORBIDDEN:
            if word in text:
                err(f"{name}: 금지 표현 '{word}'")
        for no, line in enumerate(text.split("\n"), 1):
            # 제목·카테고리·태그의 "수익 보장"은 주제 이름이므로 본문 문장만 검사
            if line.startswith("#") or line.startswith(("- 카테고리:", "- 태그:")):
                continue
            if GUARANTEE.search(line):
                err(f"{name} {no}행: '보장'을 긍정 표현으로 사용")
            if FIRST.search(line):
                err(f"{name} {no}행: 금지 표현 '최초'")
        for word in CONTEXT_DEPENDENT:
            if word in text:
                err(f"{name}: 앞 문맥 의존 표현 '{word}'")
        for word in BRAND_EXCLUDED:
            if word in text:
                err(f"{name}: 브랜딩 제외 표현 '{word}'")
        for word in ("Claude", "AI 생성", "Generated with", "ChatGPT"):
            if word in text:
                err(f"{name}: 작성 도구 흔적 '{word}'")
        for key, value in OFFICIAL.items():
            if value not in text:
                err(f"{name}: {key} 공식 표기 '{value}' 없음")
        for phone in set(PHONE.findall(text)):
            if phone != OFFICIAL["연락처"]:
                err(f"{name}: 공식 연락처와 다른 전화번호 '{phone}'")
        for token in sorted({t.replace(" ", "") for t in NUMBER_TOKEN.findall(body)}):
            if token not in allowed:
                warn(f"{name}: facts.yaml·확정 사실·법령표에 없는 숫자 '{token}'")

    for out_path in list(HTML_DOCS.values()) + list(PUBLIC_DOCS.values()):
        rel = out_path.relative_to(ROOT).as_posix()
        if not out_path.exists():
            err(f"{rel}: 파일 없음 (render_docs.py 먼저 실행)")
            continue
        page = out_path.read_text(encoding="utf-8")
        visible = re.sub(r"<style.*?</style>|<[^>]+>", " ", page, flags=re.S)
        if "{{" in page:
            err(f"{rel}: 치환되지 않은 '{{{{' 남아 있음")
        for word in FORBIDDEN + BRAND_EXCLUDED + ["Claude", "AI 생성", "Generated with", "ChatGPT"]:
            if word in visible:
                err(f"{rel}: 금지 표현·흔적 '{word}'")
        for line in visible.split("\n"):
            if GUARANTEE.search(line) or FIRST.search(line):
                err(f"{rel}: 금지 표현 '{line.strip()[:40]}'")
        for key, value in OFFICIAL.items():
            if value not in visible:
                err(f"{rel}: {key} 공식 표기 '{value}' 없음")
        for phone in set(PHONE.findall(page)):
            if phone != OFFICIAL["연락처"]:
                err(f"{rel}: 공식 연락처와 다른 전화번호 '{phone}'")
        if out_path in PUBLIC_DOCS.values():
            # 공개 페이지에는 내부 체크리스트·미확정 표시가 없어야 한다
            for marker in ('class="pending"', "internal:start", "운영 전 확정할 항목", "facts.yaml"):
                if marker in page:
                    err(f"{rel}: 공개 페이지에 내부용 표시 '{marker}' 남아 있음")

    check_faq(texts["faq.md"])

    # facts.yaml used_in 표시가 실제 사용처와 맞는지
    for name in DOCS:
        used = set(PLACEHOLDER.findall((SRC / name).read_text(encoding="utf-8")))
        doc = name.removesuffix(".md")
        for key, item in facts.items():
            listed = doc in (item["used_in"] or [])
            if (key in used) != listed:
                warn(f"facts.yaml {key}: used_in 표시와 {name} 실제 사용 여부 불일치")
    unused = [k for k in facts if not any(
        k in PLACEHOLDER.findall((SRC / n).read_text(encoding="utf-8")) for n in DOCS)]
    for key in unused:
        warn(f"facts.yaml {key}: 어느 문서에서도 쓰이지 않음")

    report()


def report():
    for w in warns:
        print(f"WARN  {w}")
    for e in errors:
        print(f"ERROR {e}")
    print(f"\n결과: 오류 {len(errors)}건, 경고 {len(warns)}건")
    sys.exit(1 if errors else 0)


if __name__ == "__main__":
    main()
