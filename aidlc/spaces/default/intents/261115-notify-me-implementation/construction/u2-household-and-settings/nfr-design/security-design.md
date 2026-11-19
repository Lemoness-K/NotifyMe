# U2 보안 설계

## Sources

같은 U2의 `performance-requirements.md`, `security-requirements.md`, `scalability-requirements.md`, `reliability-requirements.md`, `observability-requirements.md`, `tech-stack-decisions.md`, `functional-spec.md` 및 공통 `contract-summary.md`를 따른다.

## 인증과 권한

- 일반 데이터는 U1 유효 앱 세션과 현재 활성 소속을 동시에 확인한다. 초대 수락만 Google/Firebase Bearer 전용 경계를 사용한다. 검증된 Google provider와 `email_verified`, 대상 이메일 일치, 동일 HTTPS 출처, 명시적 POST가 필요하다. 새 신원에 데이터 읽기나 Admin 역할을 부여하지 않는다. 초대 수락 시 먼저 검증하고 권한에 영향을 주는 상태는 트랜잭션에서 재검사한다.
- 초대 상세 원문은 최초 발급 응답뿐이다. TLS, `Cache-Control: no-store`, fragment 제거 및 referrer 미전송으로 보호한다. 일반 관리 화면을 다시 열 때는 가구 Admin 전용 `GET /households/{householdId}/invitations`를 구현 계획의 계약 변경으로 등록한다. 상태·발급 및 만료 시각·초대 ID를 반환하고 코드나 대상 이메일은 반환하지 않는다. 페이지는 발급 시각과 초대 ID로 안정 정렬한다.
- 모든 제한과 소유권은 서버가 검사한다. 역할 변경과 구성원 제거는 최신 revision, 변경 권한, 후임 자격을 쓰기 단위에서 검사한다. 임의로 가구 ID를 바꾸면 동일한 권한 경계가 적용된다.

## 요청 제한

- 검증 전 초대 수락은 신뢰할 수 있는 접속 출처 단위로 1분 창당 30건을 기본 제한한다. 소스 IP는 신뢰한 loopback ingress가 덮어쓴 값만 쓰며 클라이언트가 직접 제공한 전달 헤더는 사용하지 않는다.
- 공급자 확인 뒤 수락은 검증된 외부 발급자·주체 기준으로 1분 창당 기본 10건을 허용한다. 발급·취소·역할 변경·제거는 인증된 내부 Admin과 가구 조합으로 1분 창당 기본 20건을 허용한다. 모든 값은 운영 구성으로 변경 가능하다.
- 제한 상태는 단일 서버 메모리에 두고 만료한 버킷을 정리한다. 버킷 수 상한 시 새 키 수락을 제한하고 로그에는 식별자 대신 결과 코드와 경로만 남긴다. 재기동으로 제한 상태가 초기화되더라도 DB의 초대 1회 사용·만료·작업 키 정책은 유지된다.
- 한도를 넘으면 변경 없이 429와 정수 초 `Retry-After`를 반환한다. 시간 대역으로 한도 직전·직후·경과, 요청 출처 변조, 다른 가구 격리, 기존 키 재시도를 검증한다. 사용자가 재시도할 때 UI는 같은 키와 미확정 입력을 유지한다.
