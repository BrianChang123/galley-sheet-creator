# Plan: 썸네일 hover × 제거 버튼

SPEC: docs/specs/2026-07-24-thumb-remove-button.md

## Task 1 — index.html: 썸네일 래퍼 + × 버튼 스타일
- `.thumb`(relative 래퍼), `.thumb-x`(absolute 우측 상단, 기본 숨김,
  `.thumb:hover` 시 표시) CSS 추가.

## Task 2 — app.js: 렌더링/제거 로직
- `renderThumbs()`: 각 썸네일을 `.thumb` 래퍼로 감싸고 `data-idx` 달린
  `.thumb-x` 버튼 포함.
- `els.thumbs`에 위임 클릭 리스너 1개: × 클릭 시 해당 인덱스 제거 후
  재렌더; 목록이 비면 file input·상태 초기화.
- verify: `node --check app.js`
