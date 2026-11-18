# U1 신뢰성 설계

## Sources

U1의 `functional-spec.md`, `contract-summary.md`, `performance-requirements.md`, `security-requirements.md`, `scalability-requirements.md`, `reliability-requirements.md`, `observability-requirements.md`, `tech-stack-decisions.md`를 기준으로 한다.

## Consistent storage and retry

- 최초 Admin 설정은 단일 초기화 조건과 가구·소속·신원 연결을 함께 커밋한다. 업무 생성은 리마인더, 조건, 회차, 담당자와 재시도 결과를 함께 커밋한다. 실패·강제 재시작 검증에서 부분 쓰기와 중복 생성이 없어야 한다.
- 등록 요청의 가구·주체·동작·키와 입력을 연결한다. 완료 여부가 불명확하면 동일 키로 재요청한다. 일시적 저장소 오류만 제한된 간격으로 재시도하고 다른 입력의 같은 키와 권한 오류는 반려한다.
- 상태와 지속 데이터는 분리한다. 서버 재시작 뒤 정상적으로 인증할 수 있고 승인된 시각과 최초 회차를 다시 조회할 수 있어야 한다.
- UTC instant와 일정 IANA 시간대를 저장한다. 가구 기본값으로 시작하고 DST 간격·중복 규칙을 동일한 시각 변환 경계에 둔다. UI 표시 locale이나 시간대 변경 시 저장한 값이 바뀌지 않아야 한다.
- 제공자 장애 중에는 보호 경로를 일시 중단하고 데이터는 반환하지 않는다. U1에서 정상 재시작과 저장 일관성을 확인하고, 백업 복원 전체는 U5에서 검증한다.
