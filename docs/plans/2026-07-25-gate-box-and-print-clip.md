# Plan: Gate 박스 고정·좌측 정렬 + 인쇄 좌측 잘림

SPEC: docs/specs/2026-07-25-gate-box-and-print-clip.md

## Task 1 — app.js(exportExcel): 좌표 오프셋 + gate 고정
- 열 구성: A(스페이서 0.8) + B~E(32/12/12/42). 모든 merge/cell/border를
  한 열씩 우측 이동.
- pageSetup: horizontalCentered/verticalCentered 해제.
- Gate: 가변 높이 계산(PAGE_PT 잔여 흡수) 제거 → 고정 240pt(7행).
  제목 richText 15pt→12pt, alignment top/left.
- verify: `node --check app.js`

## Task 2 — index.html(미리보기): gate 스타일 동기화
- `.s-gate-title`/`.s-gate-nums` 좌측 정렬, 제목 12px.
- gate td에 고정 높이 클래스(`.s-gate`, 180px) 적용.
