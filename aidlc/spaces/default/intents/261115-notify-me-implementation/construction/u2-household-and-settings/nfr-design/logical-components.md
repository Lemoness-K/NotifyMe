# U2 논리 컴포넌트

## Sources

같은 U2의 `performance-requirements.md`, `security-requirements.md`, `scalability-requirements.md`, `reliability-requirements.md`, `observability-requirements.md`, `tech-stack-decisions.md`, `functional-spec.md` 및 공통 `contract-summary.md`를 따른다.

| 경계 | 책임과 장애 영향 |
| --- | --- |
| 공유 웹 | 가구와 개인 설정 화면, 반응형·키보드·터치, 번역 리소스와 로케일 선택. 새 locale은 기존 업무 모델을 수정하지 않고 연결한다. API 오류 코드와 사용자 원문은 보존한다. |
| U1 인증과 U2 가구 관리 | 외부 신원을 검증한 뒤 가구 정책을 확인한다. 가입만 별도 도달 범위를 갖고 모든 일반 요청은 앱 세션을 사용한다. |
| U2 설정 및 카탈로그 | 메타데이터 조회와 가구·사용자 값의 쓰기를 나눠 제공한다. 변경 시 버전과 검증을 확인한다. |
| 공유 SQLite | 역할·초대·설정·배정·감사 상태를 원자적으로 저장한다. 장애 시 실패를 반환하고 성공처럼 표시하지 않는다. |
| 만료 정리 | 같은 서버에서 만료 이메일을 배치 처리한다. 수락 가용성은 데이터의 기한 검사로 결정한다. |
| U3·U4 연결 | 서버 내부 트랜잭션 계약과 커밋 뒤 별도 설치 동기화. Android SDK는 서버나 공유 UI에 직접 추가하지 않는다. |

U1과 같은 Node.js·NestJS·React·Prisma/SQLite 스택을 이어 쓴다. 대상 ARM64 검증을 개발 ARM64와 구분한다. 같은 U1 검증 명령의 테스트 범위에 U2 시나리오와 실제 DB를 포함하고 TDD와 80% 전체 라인 커버리지를 적용한다.
