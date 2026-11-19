# U2 성능 설계

## Sources

같은 U2의 `performance-requirements.md`, `security-requirements.md`, `scalability-requirements.md`, `reliability-requirements.md`, `observability-requirements.md`, `tech-stack-decisions.md`, `functional-spec.md` 및 공통 `contract-summary.md`를 따른다.

- 가구·소속·초대 활동은 기본 키와 가구 선행 인덱스를 사용한다. 초대 정리는 만료 시각 순으로 읽고 대상 이메일이 남은 행만 제한해 갱신한다.
- 공급자 호출은 기존 전체 기한과 재시도를 재사용하고 쓰기 트랜잭션 밖에서 끝낸다. 쓰기 안에서는 인가·revision·상태를 현재 데이터로 재검사한다.
- 인증·가구 결정과 계정별 응답은 공유 캐시를 사용하지 않는다. 카탈로그의 정적 정의와 번역 리소스만 버전 단위로 재사용한다.
- 주요 보호 화면의 p95 500ms 목표는 DS-014 대상 Pi와 workload를 고정한 뒤 측정한다. 요청 경로와 공급자 정상/일시 장애 조건, 만료 정리 활성 여부, 런타임 메모리 최댓값과 저장 쓰기를 분리해 기록한다. 개발 장비 실측을 대상 판정에 사용하지 않는다.
