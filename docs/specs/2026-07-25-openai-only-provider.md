# SPEC: AI 도구 선택창 OpenAI만 노출

날짜: 2026-07-25

## 요구사항
- 도구 선택 select에 OpenAI만 표시. Claude/Gemini는 UI에서만 숨김
  (HTML 주석으로 보존, 서버 api/recognize.js의 3사 지원 코드는 유지 →
  나중에 옵션 주석만 해제하면 재활성화).
- 기존 localStorage에 claude/gemini가 저장돼 있어도 select가
  빈 값이 되지 않도록, 존재하는 옵션일 때만 복원 (아니면 openai 기본).
