# DS-030 작업 제약

상태: 사용자가 명시한 제약과 확인된 답변 요약을 최종 통합했다. 단계 승인과 프로젝트 규칙 승격은 아직 대기 중이다. D-105(사용 릴리스·build 분리 선택), `AGENT.md` §§8–11, DS-030(릴리스 분리)의 전달 조건만 정리했다.

## Mandated

- ALWAYS 기존 데이터·계정·주소·DS-027(상태 표시와 버튼 구분) 화면과 다른 세션의 미커밋 작업을 보존한다.
- ALWAYS 읽기 전용 현황 재확인, 최소 변경 계획, 분리된 환경의 구현·검증, 구체적인 서비스 전환·복구 준비 순서로 진행한다.
- ALWAYS `dist`를 쓰는 검증은 사용 서비스가 참조하지 않는 별도 작업 복사본·산출물에서 수행하고, 사용 asset hash·실행 경로·DB 대상 불변성을 대조한다.
- ALWAYS 실제 서비스 전환 전에 구체적인 설정·검증·복구 절차를 준비하고 AI-DLC 승인 범위에서 전환한다.
- ALWAYS 실행한 검증·미수행, 실제 적용 환경·버전, 복구 근거와 후속 작업을 구분해 로드맵 세션에 전달한다.

## Forbidden

- NEVER 현재 사용 서비스와 공유하는 checkout의 `dist`에서 `npm run build`, `npm run verify:u1` 또는 동일 산출물을 쓰는 명령을 실행한다.
- NEVER 승인되지 않은 서비스·프록시 전환, 재시작·reload나 기존 사용 산출물의 삭제·과거 버전 복원을 실행한다.
- NEVER 운영 DB·실사용 데이터·계정·운영 자격 증명을 자동 테스트에 사용하거나 환경 파일 전체·비밀값·DB 내용을 출력한다.
- NEVER 다른 세션의 작업을 덮어쓰거나 stash·reset·clean 등으로 공유 작업 트리를 임의 정리한다.
- NEVER 완료된 온보딩 작업을 DS-030(릴리스 분리)을 위해 임의 재개하거나 미결정 질문·미승인 기능을 자동 확정한다.

## Sources

사용자의 이 세션 최초 요청 전체는 [증거 기록](evidence.md)의 원문에 보존했다. 프로젝트의 원본 조건은 `AGENT.md` §§8–11, `docs/09-feature-design-coverage-and-backlog.md` DS-030·§8.8·§8.9, `docs/decision-register.md` D-105(DS-030 선택)이다. [답변 요약](practices-discovery-questions.md#consolidated-summary-confirmation)은 메시지 `839706fc`의 “ㅇㅇ 그렇게하자”로 확인됐다.
