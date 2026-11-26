# 모바일 최초 관리자 등록 규칙

```yaml
rules:
  - id: BR11.1
    statement: "신규 주기와 최초 후보 획득"
    category: authorization
    applies_to: 모바일 최초 관리자 등록
    trigger: "로그인 증명 검증 성공"
    logic: "일치하는 운영 기록과 DB가 OPEN이고 살아 있는 후보가 없을 때에만 한 트랜잭션에서 먼저 성공한 검증 계정을 예약한다."
    violation: "후보 없음, 이미 예약됨 또는 등록 불가를 구분하며 다른 사람의 식별 정보는 반환하지 않는다."
    source: [FR11.1, NFR12, NFR13]
  - id: BR11.2
    statement: "모바일 계정 표시와 현재 계정 확인"
    category: authorization
    applies_to: 모바일 최초 관리자 등록
    trigger: "후보 화면 열기, 확인, 취소"
    logic: "동일 주기의 후보용 자격 증명과 서버가 확인한 현재 제공자 발급자·주체·로그인 시각이 모두 맞아야 계정을 표시하거나 후보 상태를 바꾼다. 후보에는 가구 API 권한이 없다."
    violation: "재인증 안내 또는 권한 거부. 후보의 이메일 및 Google 증명을 로그에 남기지 않는다."
    source: [FR11.2, FR11.4, NFR13]
  - id: BR11.3
    statement: "최초 관리자 확정 및 성공 복귀"
    category: constraint
    applies_to: 모바일 최초 관리자 등록
    trigger: "유효한 후보의 설정 시작"
    logic: "동일 활성 DB의 확인·전환·종료를 직렬화한다. 유효한 후보, 주기, 가구 상태를 검사하고 최초 가구·ADMIN·완료를 한 트랜잭션으로 기록한다. 확정된 계정에 기존 앱 세션을 발급한다."
    violation: "다른 계정이나 주기의 요청은 거부한다. 응답 유실에서 같은 계정은 기존 가구로 돌아간다."
    source: [FR11.3, FR11.4, NFR11, NFR12]
  - id: BR11.4
    statement: "후보 취소와 10분 예약"
    category: policy
    applies_to: 모바일 최초 관리자 등록
    trigger: "취소 또는 만료 또는 재인증"
    logic: "취소가 먼저 확정되면 즉시 해제한다. 종료나 새로고침으로 연장하지 않는다. 동일 계정 재인증은 원래 종료 시각까지 사용할 수 있다."
    violation: "만료된 요청과 이미 교체된 후보 요청을 거부한다. 후보가 없으면 새 로그인으로 신청할 수 있다."
    source: [FR11.4, NFR11]
  - id: BR11.5
    statement: "기존 설치의 동작 보존"
    category: authorization
    applies_to: 모바일 최초 관리자 등록
    trigger: "로그인, 초대 수락, 일반 API"
    logic: "닫힌 설치에서 이미 연결된 활성 사용자는 일반 로그인, 이메일 지정 초대는 기존 초대 검증을 사용한다."
    violation: "최초 등록을 통해 일반 권한을 우회하지 못한다."
    source: [FR11.5, NFR12]
  - id: BR11.6
    statement: "설치 및 복원 절차"
    category: policy
    applies_to: 모바일 최초 관리자 등록
    trigger: "설치 준비, 초기화, 장애, 복원, 종료"
    logic: "운영자 전용 접근과 의도적으로 준비한 새 SQLite 식별자를 비교한다. 복원 후 등록을 SEALED 상태로 유지하고 운영 가이드에 격리 환경의 Android Chrome 절차를 제공한다."
    violation: "가구가 없어도 자동 등록을 열지 않으며 운영 DB의 삭제 또는 초기화는 승인과 분리한다."
    source: [FR11.6, NFR12, NFR14]
```

| 규칙 | 적용 |
|---|---|
| BR11.1 | 신규 주기와 최초 후보 획득 |
| BR11.2 | 모바일 계정 표시와 현재 계정 확인 |
| BR11.3 | 최초 관리자 확정 및 성공 복귀 |
| BR11.4 | 후보 취소와 10분 예약 |
| BR11.5 | 기존 설치의 동작 보존 |
| BR11.6 | 설치 및 복원 절차 |
