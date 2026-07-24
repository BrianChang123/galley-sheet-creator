# Plan: 클래스(WP/EY)별 빵·버터 + 표 형식 메뉴 인식

SPEC: docs/specs/2026-07-24-wp-bread-and-table-recognition.md

## Task 1 — index.html: 클래스 선택 UI
- 기본 정보 fieldset에 `#cls` select 추가 (EY 기본 / WP), 힌트 문구 포함.
- verify: `node --check` 대상 아님(마크업), Task 3에서 동작 확인.

## Task 2 — app.js: 모델/렌더링에 클래스 반영
- `els.cls` 등록, `getModel()`에 `cls` 포함, `load()`에서 복원(기본 "EY").
- `buildMealLines()`: 1st Meal에 한해 `cls === "WP"`이면
  `Bread : 빵과 버터` 라인을 A/D bowl 뒤에 추가.
- `change` 리스너 연결(미리보기·저장 갱신).
- verify: `node --check app.js`

## Task 3 — api/recognize.js: 표 형식 인식 프롬프트
- EXTRACT_PROMPT에 두 레이아웃(텍스트/표) 설명 추가:
  Entrée→dishes, Appetizer→aBowl, Dessert→dBowl, Bread 행 무시,
  bowl 값은 한글 우선.
- verify: `node --check api/recognize.js`
