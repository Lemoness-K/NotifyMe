# U3 논리 컴포넌트

## Sources

U3의 `performance-requirements.md`, `security-requirements.md`, `scalability-requirements.md`, `reliability-requirements.md`, `observability-requirements.md`, `tech-stack-decisions.md`, `functional-spec.md`와 공통 `contract-summary.md`를 따른다.

| 컴포넌트 | 책임 |
| --- | --- |
| 공유 웹 | NFR6.1.3~NFR6.4.3. 여러 뷰포트와 줌에서 가로 넘침 없이, 키보드·터치 및 색 이외 단서로 핵심 흐름을 제공한다. 장치 권한 거부 상태에서도 기본 업무·이력은 사용 가능하다. 검증 대기만 있는 업무는 검증 대기 영역에서 요청 시각과 안정 ID로 정렬한다. |
| 회차 API | NFR7.4.3, NFR8.1.3. 현재 회차·독립 대기 건수·allowedActions를 제공한다. 공개 계약의 신규 응답 값은 U1 호환 때문에 선택 필드지만 U3 서버는 count와 현재 호출자의 actions를 항상 제공한다. 구버전 응답에서 빠지면 클라이언트는 권한을 추정하지 않고 지원하지 않는 버튼을 숨긴다. |
| 공용 언어 리소스 | NFR7.1.3~NFR7.3.3, NFR7.5.3. U2의 계정 설정 우선순위를 적용한다. 시스템 문구와 원문을 분리하며 저장한 텍스트를 변형하지 않는다. |
| 저장소 및 런타임 | NFR8.2.3. Node.js·NestJS·Prisma SQLite와 ARM64를 유지한다. 로컬 ARM64와 대상 Pi를 구별해 native SQLite 어댑터 로드·마이그레이션·실제 트랜잭션 smoke 결과를 확보한다. 지원하지 않는 아키텍처와 어댑터 실패는 시작 실패로 진단한다. |
| CI·검증 | NFR9.1.3~NFR9.3.3. U3 테스트를 기존 전체 검증 명령에 연결하고 U1/U2 회귀를 유지한다. Red/Green, 데이터베이스·원장 오류 주입, 웹 종단, 전체 라인 80%를 검증한다. |
