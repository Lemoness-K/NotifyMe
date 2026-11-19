# U2 인프라 명세

## Sources

같은 U2의 `performance-design.md`, `security-design.md`, `scalability-design.md`, `reliability-design.md`, `observability-design.md`, `logical-components.md`, `functional-spec.md`와 Inception `components.md`, `contract-summary.md`를 사용한다.

## Deployment

| 항목 | 선택 | 이유 |
| --- | --- | --- |
| 컴퓨팅 | U1에 이어 ARM64 Raspberry Pi의 기존 Node.js systemd 서비스 하나 | 가구·설정과 만료 배치를 같은 경계에 두고 별도 서비스 없이 운영 |
| 네트워크 | Caddy HTTPS → loopback Node, 외부 연결은 승인된 Firebase·Google 사용 | 앱 포트와 로컬 헬스는 외부 접근을 허용하지 않음 |
| 출처 판별 | Caddy에서 실제 접속 주소로 전달 헤더를 덮어쓰고 Node는 신뢰한 Caddy 연결에서만 사용 | 신뢰되지 않은 전송 헤더로 초대 제한을 우회하지 못하게 함 |
| 저장 | 서비스 전용 로컬 SQLite 파일과 제한된 디렉터리 권한 | 기존 Household와 User 값을 마이그레이션하고 가구·배정 동시 쓰기 유지 |
| 환경 | 개발·CI는 합성 신원과 테스트 전용 DB, 실제 신원은 승인된 비운영 환경에서 별도 시험 | 운영 계정이나 비밀을 CI에 전달하지 않음 |
| 구성 | 기존 Caddyfile 및 systemd 예시를 갱신. 검증 기한·초대 요청 제한·정리 주기는 서버 실행 환경에서 검증 | 제품 설정과 운영 설정의 소유 경계 유지 |
| 자원 | 단일 Node와 단일 SQLite. 최종 Pi 및 데이터량·동시 요청·메모리·쓰기 budget은 DS-014 | 로컬 실행은 재현성 확인에 사용하고 대상 합격은 별도 실측 |

## Infrastructure Services

| 서비스 | 역할 | 구성 | 비고 |
| --- | --- | --- | --- |
| SQLite | DB | 기존 경로의 파일, 단계별 Prisma 마이그레이션, 가구·만료 인덱스 | 임시 개발/CI 파일과 운영 파일 분리 |
| Caddy | HTTPS 진입 | 접근 로그 비활성, 세션·초대 응답 비캐시, 보안 헤더와 실제 출처 전달 | 로컬 헬스 외부 차단을 기존 경계에서 유지 |
| Firebase Google | 신원 | U1 검증 정책과 자격 증명 경로 재사용 | 요청 제한 뒤 외부 호출, 외부 서비스 장애는 안전한 503 |
| 만료 정리 | 배치 | 부팅 시 및 기본 5분 주기, 최대 100개 쓰기 묶음 | 같은 DB에 조건부 반영. 스케줄러가 겹치지 않게 한다. |

## Shared Infrastructure

| 자원 | 기준 소유 | 사용 단위 | 경계 |
| --- | --- | --- | --- |
| DB와 앱 역할 | U1 호스트, 데이터별 담당 컴포넌트 | U2·U3·U4 | 연결을 서버 내부에서 공유하고 작업별 권한과 가구 범위를 검증 |
| 기록 | U1 journald, U2 가구·설정 이벤트 | U5 후속 운영 | 사용자 데이터 및 비밀을 로그로 내보내지 않고 운영 권한으로만 읽음 |
| 개발·CI 검증 | 기존 U1 앱 파이프라인 | U2와 이후 Unit | 같은 격리 환경, 운영 자격 증명 미사용 |
