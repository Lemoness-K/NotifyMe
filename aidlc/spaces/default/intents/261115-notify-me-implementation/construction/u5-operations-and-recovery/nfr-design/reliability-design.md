# U5 reliability-design

## Sources

`security-requirements.md`, `reliability-requirements.md`, `performance-requirements.md`, `scalability-requirements.md`, `observability-requirements.md`, `tech-stack-decisions.md`, `functional-spec.md`, `contract-summary.md`를 따른다.

## Design

- NFR3.1.5. 삭제 원장의 누적 인증 상태는 이전 인증값과 각 행의 정규 직렬화를 연결한다. U3의 REQUESTED를 저장하고 설정된 독립 증거 저장소에 최신 끝을 내구 반영한 뒤만 DB 삭제를 시작한다. COMMITTED 또는 ABORTED의 증거도 성공 응답 전에 반영한다. 각 중단점에서 원본 DB의 증거와 전이가 확인된 경우만 조정한다.
- NFR3.1.5. 복구 시간의 최신 끝은 운영 DB와 선택한 원장·스냅샷 파일 밖에 있는 권위 있는 저장 위치만 읽는다. 현재 기준점이 없는 신규 설치 초기화는 확인된 운영 DB에서 운영 절차로 한 번 수행하며 복원 절차에서는 초기화하지 않는다. 원본 호스트 유실 리허설은 기존과 같은 ID인 잘린 파일, 잘못된 체인, 권위 저장소 누락 또는 신뢰할 수 없는 사본 각각에서 공개가 차단되는지 확인한다.
- NFR3.2.5. 카탈로그 연산과 원장 정리를 직렬화한다. 원장 정리는 가장 이른 선택 가능 사본·진행 중 복구 이후를 보전하고 인증 증거가 유지되는 연속 종결 구간에서만 바닥을 이동한다. 복원 중 원장 바닥이 후보 기준점을 넘을 수 없다.
- NFR3.3.5, NFR3.4.5. 세대별 DB 경로와 epoch를 포함한 활성화 레코드를 관리한다. 시작 전에 차단을 영속화하고 후보 지문과 종료 위치를 검증한 뒤 정확한 세대로 전환한다. 런타임은 불일치 레코드에서 readiness를 공개하지 않는다. 같은 사본의 검증 반복은 삭제를 중복 적용하지 않는다.
- NFR4.1.5. 보고 주기는 운영 시간대의 달력 주로 식별한다. 기기·가구 일정에는 손대지 않으며 복원은 저장된 UTC/IANA 값을 유지한다.
