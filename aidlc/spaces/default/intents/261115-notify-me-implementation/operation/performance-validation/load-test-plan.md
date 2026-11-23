# 부하 시험 계획

## 범위와 실행

현재 호스트의 Raspberry Pi 5에서 합성 가구 한 개, 구성원 네 명, 세션 한 개, 리마인더 100건을 사용한다. NestJS와 실제 SQLite를 임시 DB로 기동한다. 합성 인증 공급자를 사용하되 앱의 세션·가구 인가를 적용한다. 서버는 루프백에만 바인딩한다.

```bash
npm run build
node aidlc/spaces/default/intents/261115-notify-me-implementation/operation/performance-validation/load-probe.mjs
```

경로마다 동시 요청 1·4·8개를 순차 적용한다. 조합마다 준비 요청 24건을 제외하고 240건을 집계한다. 각 동시 요청 작업자는 이전 응답을 모두 읽은 뒤 다음 요청을 보낸다. 이 시험은 일정 요청률을 강제하는 개방형 트래픽을 모델링하지 않는다. 응답 본문까지 읽은 HTTP 200 응답의 p50·p95·p99를 nearest-rank로, 성공 처리량을 요청 성공 수/경과 초로 계산한다. 시간 초과·전송 오류·HTTP 실패는 별도로 기록한다. RSS는 20ms마다 표본을 만들며 클라이언트와 서버가 같은 프로세스인 예비 측정의 상한 표본이다.

| 대상 | 예비 측정 | 승인 환경에서 확대할 시험 |
| --- | --- | --- |
| U1 목록 | 보호 목록 첫 페이지 | 목록과 상세, 승인 데이터 규모별 읽기·쓰기 혼합 |
| U2 구성원 | 보호 구성원 목록 | 설정 조회·쓰기와 정리 작업, 공급자 정상·불능 조건을 별도 구간으로 측정 |
| U3 업무 상세 | 합성 리마인더의 보호 상세 | 반복 생성·삭제 작업과 이력 페이지, SQLite 잠금·삭제 대기 |
| U4 설치 | 계획에 포함 | 초기 FULL, 변경분 sync, 용량 목록, 99·100·101 슬롯 경계 |
| U5 백업 | 계획에 포함 | 백업·삭제 동시 실행의 대표 경로 p95와 최대 차단 시간, 격리 복구의 RSS·쓰기량 |

## DS-014 후속 측정

대상 기기와 저장장치, 가구·사용자 수, 데이터 크기와 분포, 동시 부하와 목표 처리량, 준비·측정 시간, 수치화된 RSS·쓰기 예산을 정한다. 평상시·혼합 피크·순간 집중 구간을 나눠 시험하고 날짜, Git 커밋, CPU 온도/주파수, 메모리, 대상 볼륨과 SQLite/WAL 크기를 기록한다. 별도 부하 프로세스에서 Caddy/TLS 경로를 사용하고 서버 RSS 및 전용 볼륨의 장치 쓰기 증분을 확인한다. 요청 생성·응답 완독·실패 종류·표본 수를 기록하고 외부 의존성을 별도 시험 구간으로 구분한다.

대표 보호 API는 승인된 조건에서 p95 500ms 이하다. 승인된 처리량과 자원 예산은 추후 등록한다. 비교 가능한 표본을 수집한 뒤 지연이 집중되는 경로의 쿼리·페이지 크기와 백업/반복/삭제의 SQLite 경합을 대조한다. MVP는 단일 노드로 검증하며 자동 확장은 후속 범위다.

[U1 성능 요구](../../construction/u1-core-flow/nfr-requirements/performance-requirements.md) · [U1 확장성 요구](../../construction/u1-core-flow/nfr-requirements/scalability-requirements.md) · [U5 성능 설계](../../construction/u5-operations-and-recovery/nfr-design/performance-design.md) · [U5 확장성 설계](../../construction/u5-operations-and-recovery/nfr-design/scalability-design.md) · [운영 상태 조회](../observability-setup/dashboards.md)
