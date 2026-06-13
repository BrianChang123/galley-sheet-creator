# Galley Sheet Creator

기내식 갤리 시트(YP132 양식)를 웹에서 입력하고, 동일한 포맷의 **엑셀(.xlsx)** 로 export 하는 도구입니다.
별도 설치·서버 없이 `index.html` 을 브라우저에서 열기만 하면 동작합니다.

## 사용법

1. `index.html` 을 더블클릭(또는 브라우저로 열기). 인터넷 연결 필요 (ExcelJS CDN).
2. 좌측 폼 입력 → 우측에 실시간 미리보기 → **엑셀(.xlsx) 다운로드** 버튼.

## 입력 필드

| 필드 | 설명 | 입력 방식 |
|------|------|-----------|
| **편명/제목 (YP132)** | 시트 상단 변수 | 직접 입력 |
| **PAX** | 당일 손님 수 | 직접 입력 |
| **1st / 2nd Meal** | 요리(한/영), A bowl, D bowl | **AI 자동 인식** 또는 직접 입력/수정 |
| **SSR** | 특별 승객 정보 | 직접 입력 |
| **미취식** | 미취식 정보 | 직접 입력 |
| **PAX 특이사항 및 약제공** | (엑셀에서 빨간 글씨) | 직접 입력 |
| **2 Door open Gate** | (엑셀에서 빨간 글씨) | 직접 입력 |

## AI 메뉴 인식 (서버리스 프록시)

- 페이지에서는 **AI 도구(Claude / Gemini / OpenAI)만 선택**합니다. API 키 입력칸은 없습니다.
- 키는 **서버 환경변수**에만 존재하며 브라우저로 내려가지 않습니다. 요청 흐름:
  `브라우저(도구+이미지) → /api/recognize (서버리스, 키는 env) → AI 제공자`
- 메뉴 이미지 첨부 → **🔍 AI로 메뉴 인식** → 1st/2nd Meal 필드 자동 채움 → 검토·수정.
- 이미지가 첨부됐는데 해당 키가 없거나 무효이면 **토스트 메시지**로 에러 안내.
- 모델 기본값(env로 변경 가능): Claude `claude-opus-4-8`, Gemini `gemini-2.5-flash`, OpenAI `gpt-4o`.

### 환경변수 (Vercel)

| 변수 | 용도 | 비고 |
|------|------|------|
| `ANTHROPIC_API_KEY` | Claude 키 | Claude 선택 시 필요 |
| `GEMINI_API_KEY` | Gemini 키 | Gemini 선택 시 필요 |
| `OPENAI_API_KEY` | OpenAI 키 | OpenAI 선택 시 필요 |
| `CLAUDE_MODEL` / `GEMINI_MODEL` / `OPENAI_MODEL` | 모델 override (선택) | 미설정 시 기본값 사용 |

> 사용할 제공자의 키만 설정하면 됩니다. 키가 없는 제공자를 선택하면 토스트로 "키가 서버에 설정되지 않았습니다" 안내가 뜹니다.

## 배포 (Vercel)

GitHub Pages는 정적 호스팅이라 서버리스 함수를 실행할 수 없으므로, AI 인식 기능은 **Vercel**(또는 동급 서버리스 호스팅)에 배포해야 동작합니다.

### 방법 A — Vercel 대시보드 (CLI 불필요, 권장)
1. https://vercel.com → **Add New… → Project** → GitHub의 `galley-sheet-creator` import.
2. Framework Preset: **Other**, Build/Output 설정 비움 (정적 + `/api` 자동 인식).
3. **Settings → Environment Variables** 에서 위 표의 키 추가 → **Deploy**.

### 방법 B — Vercel CLI
```bash
npm i -g vercel
cd galley-sheet-creator
vercel            # 최초 배포 (프로젝트 연결)
vercel env add ANTHROPIC_API_KEY     # 필요한 키들 추가
vercel env add GEMINI_API_KEY
vercel env add OPENAI_API_KEY
vercel --prod     # 프로덕션 배포
```

> 로컬에서 `index.html` 을 직접 열면 `/api/recognize` 가 없어 AI 인식은 동작하지 않습니다(엑셀/미리보기는 정상). 전체 기능은 Vercel 배포 환경에서 확인하세요.

## 엑셀 출력

원본 시트와 동일한 레이아웃을 재현합니다: 테두리, 셀 병합, 굵은 헤더, MEAL 블록(한/영), SSR·미취식·PAX 특이사항, 하단 Gate(빨간 글씨). 세로 A4, 한 페이지 맞춤.

## 파일 구성

- `index.html` — UI / 미리보기
- `app.js` — 상태관리, AI 호출(Claude/Gemini), ExcelJS export
