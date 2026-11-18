# U1 업무 규칙

## Sources

`requirements.md`, `stories.md`, `unit-of-work-story-map.md`, `components.md`, `contract-summary.md`.

```yaml
rules:
  - id: BR1.1
    statement: "인증 규칙"
    category: authorization
    applies_to: "인증"
    trigger: "로그인과 보호 요청"
    logic: "외부 신원이 검증됐으면 발급자와 주체로 내부 사용자를 찾는다"
    violation: "인증을 거부하고 개인정보를 반환하지 않는다"
    source: ["FR1.1","FR1.5"]
  - id: BR1.2
    statement: "세션 규칙"
    category: authorization
    applies_to: "세션"
    trigger: "보호 요청과 로그아웃"
    logic: "외부 토큰과 현재 앱 세션이 유효할 때만 접근한다. 로그아웃은 현재 세션을 종료한다"
    violation: "만료·종료·미존재 세션에 401을 반환한다"
    source: ["FR1.4","NFR1.1"]
  - id: BR1.3
    statement: "가구 범위 규칙"
    category: authorization
    applies_to: "가구 범위"
    trigger: "진입 및 모든 업무 조회 또는 변경"
    logic: "서버가 선택한 MVP 가구와 활성 소속을 확인한다. 요청 대상과 조회 결과를 가구 범위에 제한한다"
    violation: "비구성원은 접근 거부, 가구 밖 대상은 노출하지 않는다"
    source: ["FR1.2","FR1.3","NFR1.2","NFR1.3"]
  - id: BR1.4
    statement: "최초 설정 규칙"
    category: constraint
    applies_to: "최초 설정"
    trigger: "운영 초기화 명령"
    logic: "검증된 운영 절차와 Google 신원이 있고 초기화 전이면 내부 연결·가구·최초 관리자 소속을 원자적으로 생성한다"
    violation: "경합·재실행·검증 실패 시 부분 변경 없이 실패하고 공개 경로로 실행할 수 없다"
    source: ["FR1.6"]
  - id: BR2.1
    statement: "등록 규칙"
    category: validation
    applies_to: "등록"
    trigger: "유효한 시간 리마인더 등록"
    logic: "제목에 공백 아닌 내용이 있고 조건과 요청자·담당자가 유효하면 원문과 내부 작성자·요청자·담당자·최초 회차를 저장한다. 요청자·담당자의 기본값은 현재 사용자이며 지정된 요청자·담당자는 현재 가구의 활성 구성원이어야 한다"
    violation: "오류 코드와 관련 필드를 반환하고 입력을 유지하며 아무것도 저장하지 않는다"
    source: ["FR2.1","FR2.4","FR4.9","FR7.5"]
  - id: BR2.2
    statement: "재시도 규칙"
    category: constraint
    applies_to: "재시도"
    trigger: "동일 작업 키 재제출"
    logic: "인가 후 같은 범위의 동일 키·입력이면 원래 결과를 반환한다. 최초 요청은 등록과 결과 기록을 함께 저장한다"
    violation: "같은 키에 다른 입력은 409로 거부한다"
    source: ["NFR3.1","NFR3.2"]
  - id: BR2.3
    statement: "공유 조회 규칙"
    category: policy
    applies_to: "공유 조회"
    trigger: "인가된 웹 목록과 상세 조회"
    logic: "HTTPS API는 현재 가구에서 커밋된 최신 업무와 기준 회차를 조회한다"
    violation: "인증·가구 오류는 이전 캐시를 성공 결과로 보여주지 않는다"
    source: ["FR2.2","FR5.1","FR6.1"]
  - id: BR3.1
    statement: "공유 UI 규칙"
    category: policy
    applies_to: "공유 UI"
    trigger: "뷰포트·입력 수단·기기 기능이 바뀔 때"
    logic: "사용 가능한 공간을 기준으로 재배치하고 키보드·터치를 지원한다. 의미를 문구로 전달하고 지원하지 않는 기기 기능은 공용 기능 경계에서 안내한다"
    violation: "폼 내용과 기본 업무 흐름을 유지한다"
    source: ["FR6.3","NFR6.1","NFR6.2","NFR6.3","NFR8.1"]
  - id: BR3.2
    statement: "오류 응답 규칙"
    category: policy
    applies_to: "오류 응답"
    trigger: "API 오류 또는 상태 응답"
    logic: "번역된 문장 대신 안정된 코드와 구조화 값만 반환한다. UI는 번역 리소스와 코드를 사용해 오류를 표시한다"
    violation: "정의되지 않은 코드는 일반 오류 문구로 처리한다"
    source: ["NFR7.1","NFR7.4","FR7.5"]
```

| 규칙 | 요지 |
| --- | --- |
| BR1.1 인증 | 외부 신원이 검증됐으면 발급자와 주체로 내부 사용자를 찾는다 |
| BR1.2 세션 | 외부 토큰과 현재 앱 세션이 유효할 때만 접근한다. 로그아웃은 현재 세션을 종료한다 |
| BR1.3 가구 범위 | 서버가 선택한 MVP 가구와 활성 소속을 확인한다. 요청 대상과 조회 결과를 가구 범위에 제한한다 |
| BR1.4 최초 설정 | 검증된 운영 절차와 Google 신원이 있고 초기화 전이면 내부 연결·가구·최초 관리자 소속을 원자적으로 생성한다 |
| BR2.1 등록 | 조건과 요청자·담당자가 유효하면 원문과 내부 작성자·요청자·담당자·최초 회차를 저장한다. 요청자·담당자는 현재 가구의 활성 구성원이어야 한다. |
| BR2.2 재시도 | 인가 후 같은 범위의 동일 키·입력이면 원래 결과를 반환한다. 최초 요청은 등록과 결과 기록을 함께 저장한다 |
| BR2.3 공유 조회 | HTTPS API는 현재 가구에서 커밋된 최신 업무와 기준 회차를 조회한다 |
| BR3.1 공유 UI | 사용 가능한 공간을 기준으로 재배치하고 키보드·터치를 지원한다. 의미를 문구로 전달하고 지원하지 않는 기기 기능은 공용 기능 경계에서 안내한다 |
| BR3.2 오류 응답 | 번역된 문장 대신 안정된 코드와 구조화 값만 반환한다. UI는 번역 리소스와 코드를 사용해 오류를 표시한다 |
