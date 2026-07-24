# SPEC: 클래스(WP/EY)별 빵·버터 규칙 + 표 형식 메뉴 인식

날짜: 2026-07-24

## 배경
- 갤리 시트 화면에는 클래스 개념이 없어, Premium Economy(WP)와 Economy(EY)의
  차이(1st Meal 빵·버터 제공 여부)를 반영할 수 없다.
- AI 메뉴 인식 프롬프트는 "A bowl :" / "D bowl :" 텍스트 라벨만 찾는다.
  [YP 101]처럼 Component 열(Entrée/Appetizer/Dessert/Bread)로 구성된 표 형식
  이미지에서는 에피타이저·디저트가 추출되지 않는다.

## 요구사항
1. 화면에 클래스 선택(EY 기본값 / WP)을 추가한다.
   - WP 선택 시 1st Meal 블록(미리보기·엑셀 공통)에 빵·버터 라인
     `Bread : 빵과 버터`가 자동 추가된다. EY는 추가하지 않는다.
   - 2nd Meal에는 클래스와 무관하게 추가하지 않는다.
   - 선택값은 기존 localStorage 모델(`galleySheet.v1`)에 함께 저장한다.
2. AI 인식 프롬프트가 표 형식 메뉴도 처리한다.
   - Category `1st`/`2nd` → 각 meal.
   - Component `Entrée`(비율 40%/60% 등 복수 옵션 포함) → dishes,
     `Appetizer` → A bowl, `Dessert` → D bowl, `Bread` 행은 무시
     (빵은 화면 클래스 규칙이 담당).
   - A bowl/D bowl 값은 한글 명칭 우선, 없으면 영문.

## 비범위
- 이미지의 Class 열(WP 등)로 화면 클래스를 자동 설정하는 것은 이번 범위 밖
  (오인식 시 빵·버터가 조용히 바뀌는 부작용 방지, 필요 시 후속).
