# JP이야기(월드원공인중개사사무소) 회사 문서·웹페이지

웹사이트 카피와 고객응대 챗봇 지식으로 쓰는 문서 3종과, 디자인을 적용한 회사 소개 웹페이지입니다.

## 구성

| 경로 | 내용 |
|---|---|
| `company-profile.md` | 회사 소개서 |
| `service-policy.md` | 서비스 및 계약·정산 정책 |
| `faq.md` | 자주 묻는 질문 100개 |
| `public/index.html` | 배포용 회사 소개 웹페이지 (Vercel 출력 폴더) |
| `design/company-profile.html` | 검토용 웹페이지 (미확정 항목을 "확정 필요"로 표시) |
| `design/jp_real_estate_media/DESIGN.md` | 디자인 시스템 |
| `_src/` | 문서·웹페이지 원본 템플릿 |
| `_data/facts.yaml` | 비용·기간 등 운영 정책 값 (한 곳에서 관리) |
| `_research/sources.md` | 자료 수집 기록, 수집 실패·불일치 목록 |
| `scripts/` | 문서 생성(`render_docs.py`)·검사(`validate_docs.py`) 스크립트 |

## 정책 값 반영 방법

1. `_data/facts.yaml` 에서 `value: null` 을 실제 값으로 바꿉니다.
2. 문서와 웹페이지를 다시 만듭니다.

   ```bash
   python scripts/render_docs.py
   python scripts/validate_docs.py
   ```

3. 변경 사항을 커밋하고 GitHub에 푸시합니다.
4. Vercel 프로젝트(`jpstory-profile`)에 다시 배포합니다. 푸시할 때마다 자동으로 배포되게 하려면 Vercel 대시보드의 프로젝트 Settings → Git 에서 이 저장소를 연결합니다.

웹페이지 주소: https://jpstory-profile.vercel.app

문서와 웹페이지는 생성 결과물입니다. 내용을 고칠 때는 `_src/` 의 원본을 수정합니다.
