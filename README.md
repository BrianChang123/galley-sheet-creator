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

## AI 메뉴 인식

- **AI 제공자**: Claude(Anthropic) / Gemini(Google) / OpenAI(GPT) 중 선택.
- **모델**: 기본값 — Claude `claude-opus-4-8`, Gemini `gemini-2.5-flash`, OpenAI `gpt-4o` (수정 가능).
- **API Key**: 사용자가 본인 키 입력. 키는 브라우저 `localStorage` 에만 저장되며 외부 서버로 전송되지 않습니다(AI 제공자 API로만 직접 호출).
- 메뉴 이미지를 첨부하고 **🔍 AI로 메뉴 인식** 클릭 → 1st/2nd Meal 필드 자동 채움 → 직접 검토·수정 가능.

> 참고: 브라우저에서 Anthropic API 를 직접 호출하기 위해 `anthropic-dangerous-direct-browser-access` 헤더를 사용합니다. 개인/내부용 도구에 적합하며, 키 노출이 우려되는 공개 배포에는 서버 프록시 사용을 권장합니다.

## 엑셀 출력

원본 시트와 동일한 레이아웃을 재현합니다: 테두리, 셀 병합, 굵은 헤더, MEAL 블록(한/영), SSR·미취식·PAX 특이사항, 하단 Gate(빨간 글씨). 세로 A4, 한 페이지 맞춤.

## 파일 구성

- `index.html` — UI / 미리보기
- `app.js` — 상태관리, AI 호출(Claude/Gemini), ExcelJS export
