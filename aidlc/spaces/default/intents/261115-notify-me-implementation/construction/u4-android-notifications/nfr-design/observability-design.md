# U4 observability-design

## Sources

`performance-requirements.md`, `security-requirements.md`, `scalability-requirements.md`, `reliability-requirements.md`, `observability-requirements.md`, `tech-stack-decisions.md`, `functional-spec.md`, `contract-summary.md`를 따르고 D-097과 기능 검토 후속 사항을 반영한다.

## Design

- NFR10.1.4. 설치 등록, 용량 거부와 대기, sync 유형과 처리 지연, epoch 정리 완료·실패, FCM 전달 결과, OS 게시 실패를 유형별로 집계한다. 만료 및 미적용 계획을 분리한다.
- NFR10.2.4. 로그는 요청 ID·동작 코드·시간·집계로 구성한다. 작성 원문, 권한 토큰, 상세 좌표, 실시간 위치를 제외한다. 가구 회수와 권한 실패의 상태 코드를 구분한다.
