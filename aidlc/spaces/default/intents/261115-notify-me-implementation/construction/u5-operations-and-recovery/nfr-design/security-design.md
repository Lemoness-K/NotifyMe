# U5 security-design

## Sources

`security-requirements.md`, `reliability-requirements.md`, `performance-requirements.md`, `scalability-requirements.md`, `observability-requirements.md`, `tech-stack-decisions.md`, `functional-spec.md`, `contract-summary.md`를 따른다.

## Design

- NFR1.1.5~NFR1.3.5. 로컬 계정·파일 권한이 운영 명령을 보호한다. 복원은 별도 전용 경로에서 네트워크 공개 없이 실행하며 원장의 가구·업무·삭제 요청을 대조한다. 합성 가구의 정상 조회와 다른 가구가 유지되는 것을 검증한다.
- NFR1.4.5, NFR2.1.5. 키는 별도 로컬 자격 파일로 전달한다. 백업을 AES-256-GCM으로 스트리밍 암호화하고 생성별 새 nonce를 사용한다. 포맷 버전·계보 ID·스냅샷 ID·기준점과 사본 증거를 인증한다. 완전한 태그 확인 전 DB 복호화 임시 파일을 열거나 전환하지 않는다. 별도 형식·키의 인증으로 최신 원장 증거를 확인한다.
- NFR2.3.5. 만료한 사본은 카탈로그에서 먼저 내리고 관리하는 모든 물리 사본·임시 파일의 제거 결과를 검사한다. 삭제 실패를 운영 장애로 남기고 오래된 사본은 재승격하지 않는다.
