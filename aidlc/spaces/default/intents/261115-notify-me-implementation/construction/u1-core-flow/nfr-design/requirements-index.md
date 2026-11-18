# U1 품질 설계 요구사항 색인

이 색인은 U1의 품질 설계와 인프라 계획을 연결한다. 기존 설계의 동작을 변경하지 않는다.

| ID | 설계 | 확인 |
| --- | --- | --- |
| NFR1.1 | security-design.md · 세션 발급, 로그아웃과 인증 오류 | 정상·교차 요청·만료·로그아웃·새 로그인 |
| NFR1.2 | security-design.md · 가구 권한 | 활성 소속과 최초 관리자 확인 |
| NFR1.3 | security-design.md · 객체와 가구 범위 | 다른 가구 조회·변경 거부 |
| NFR2.1 | security-design.md · 원문과 인증 비밀 보호 | HTTPS와 로그에서 민감값 제외 |
| NFR2.3 | observability-design.md · 안전한 로컬 진단 | 권한 없는 운영 로그 조회 거부 |
| NFR3.1 | reliability-design.md · 원자적 저장 | 부분 변경과 정상 재시작 후 조회 |
| NFR3.2 | reliability-design.md · 동일 키 재시도 | 중복과 상이한 입력 검증 |
| NFR4.1 | reliability-design.md · 일정 시각 유지 | UTC와 IANA 시간대, 표시와 저장 분리 |
| NFR4.2 | reliability-design.md · 시간대 경계 | DST 간격과 중복 시각 검증 |
| NFR5.1 | performance-design.md · 대상 Pi 응답 | 승인된 부하에서 p95 확인 |
| NFR5.2 | performance-design.md · 자원 예산 | 최대 메모리와 저장장치 쓰기 |
| NFR5.3 | scalability-design.md · 단일 장치 | 업무 흐름과 저장 경합 검증 |
| NFR10.1 | observability-design.md · 로컬 상태와 요청 ID | 제한된 경로에서 로그와 상태 확인 |
| NFR10.2 | observability-design.md · 비공개 관리 표면 | 공개 경로와 권한 있는 로컬 조회 비교 |
| NFR9.2 | observability-design.md · CI 검증 근거 | 커밋과 승인된 앱 검사 결과 연결 |

세부 기준은 NFR1.1.2 세션 재발급 보호, NFR9.2.1 CI 실행, NFR10.2.1 로컬 운영 경로 검증으로 이어진다. 인프라의 구체적 검증 위치는 인프라 설계의 `cicd-pipeline.md`와 `monitoring-design.md`에 있다.
