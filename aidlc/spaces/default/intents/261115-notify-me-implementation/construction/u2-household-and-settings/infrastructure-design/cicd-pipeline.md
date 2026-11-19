# U2 CI와 검증

## Sources

같은 U2의 `performance-design.md`, `security-design.md`, `scalability-design.md`, `reliability-design.md`, `observability-design.md`, `logical-components.md`, `functional-spec.md`와 Inception `components.md`, `contract-summary.md`를 사용한다.

| 단계 | 실행과 통과 기준 |
| --- | --- |
| 클린 환경 | Node.js 24와 고정 lockfile. 새 SQLite 시험 파일에 초기 스키마와 U2 마이그레이션을 순서대로 적용한다. |
| 회귀 | U1에 저장된 가구·Admin·업무·배정을 보존하고 U2 기능을 켠다. 기존 및 신규 단위·통합 테스트와 전체 라인 커버리지 80%를 검사한다. |
| 브라우저 | 초대 발급·수락, 구성원 권한 회수, 가구 설정 및 같은 계정의 locale 조회를 합성 인증과 실제 시험 DB로 검증한다. |
| 계약 | 후임 Admin 입력, 초대 목록의 비밀 미반환, 발급 응답 유실의 409와 미중복, 요청 제한의 429·Retry-After, 본인 계정 설정의 유효 세션 경계를 명세에 반영한다. |
| 검증 명령 | 승인된 `npm run verify:u1` 호출이 기존 U1과 U2의 단위·통합·종단 시험을 모두 포함하도록 코드 계획에서 테스트 탐색 경로를 확장한다. CI도 같은 npm 명령을 사용한다. |
| 대상 전환 | 현재 CI는 테스트 결과까지만 제공한다. 목표 장치 검증 또는 배포는 별도 승인과 실행 환경이 확보돼야 한다. |
| 되돌리기 | 마이그레이션 전에 보호된 DB 사본과 앱 버전을 짝지어 기록한다. 마이그레이션 실패 시 앱 승격을 막고 이전 호환 구성을 확인한다. 실제 백업 복구 검증은 U5에서 수행한다. |

원격 GitHub Actions와 Raspberry Pi 및 실제 외부 신원 검증은 로컬 통과와 별도 기록한다.
