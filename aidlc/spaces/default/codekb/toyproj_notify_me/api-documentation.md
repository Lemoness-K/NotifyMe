# API 문서

## 현황

구현된 HTTP endpoint, GraphQL operation, OpenAPI/AsyncAPI 명세가 없다. 저장소에는 서버 코드 및 API contract 파일도 없다. 따라서 method/path, request·response schema, status code, middleware chain을 구현 사실로 기록할 수 없다.

## 문서화된 목표 API 경계

설계상 NestJS API는 Firebase Authentication token을 검증하고 내부 User identity 및 활성 Household membership으로 인가한다. 모든 household 자원 접근은 서버가 household 소속을 확인해야 하며 client가 전달한 역할·소유자 값은 권한 근거가 아니다. API는 다음 업무 영역을 지원하도록 계획되어 있다.

- 초기 Household와 Admin을 한 번 생성하는 서버 bootstrap 명령
- 초대 발급·취소·가입 확인 및 일회용 수락
- Reminder 생성·조회·수정·보관·복원·영구 삭제와 Occurrence 완료/취소
- 구성원·역할 관리 및 설정 조회·수정
- DeviceInstallation 등록, revision 동기화 및 기기 Trigger 상태 조정
- Worker의 회차 생성, 작업 lease, outbox 및 재시도

정확한 HTTP method/path, pagination, 오류 code/envelope, DTO validation, versioning, API 문서 생성 방식은 미정이다. 보안 설계는 상태 변경을 GET으로 처리하지 말고 인증·초대 같은 endpoint에 요청 제한을 적용하라고 요구한다. 구체 API 계약은 구현 전에 작성되어야 한다.

## 외부 서비스 경계

- Firebase Authentication은 사용자 로그인 identity를 제공하며 서버가 ID token을 확인한다.
- FCM은 업무 본문이나 위치 좌표를 담지 않는 ChangeSignal 전송 경계다. 앱이 신호 뒤에 API로 최신 revision을 가져오도록 설계됐다.
- Caddy는 API를 외부에 직접 노출하지 않고 HTTPS 종료 및 내부 NestJS reverse proxy를 맡도록 정해졌다.

이 계약들은 구현 endpoint나 외부 API 호출 코드를 뜻하지 않는다.
