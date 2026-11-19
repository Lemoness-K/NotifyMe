# U3 보안 설계

## Sources

U3의 `performance-requirements.md`, `security-requirements.md`, `scalability-requirements.md`, `reliability-requirements.md`, `observability-requirements.md`, `tech-stack-decisions.md`, `functional-spec.md`와 공통 `contract-summary.md`를 따른다.

- NFR1.1.4. U1 세션과 공급자 검증 정책을 재사용한다. 실패·취소·공급자 미확정 상태는 사용자 데이터와 변경 성공으로 이어지지 않는다.
- NFR1.2.3. 가구·회차·검증 요청을 현재 소속과 조건부 revision에 결합한다. 응답자는 지정된 활성 비담당 검증자여야 하고 철회자는 해당 요청을 제출한 사람이어야 한다. 소속 회수·승인·철회 경합에서 같은 대기 요청을 조건부 종료한다. 목록의 allowedActions는 화면 지침이며 쓰기 권한은 다시 검증한다.
- NFR1.3.3. 가구 ID는 필터 및 커서·작업 키와 결합하고 클라이언트가 제시한 객체 ID만으로 조회 범위를 정하지 않는다. 활성 가구 접근이 거부되면 해당 가구의 UI 응답을 버린다. 권한 회수와 현재 역할 부족은 서로 다른 화면 결과를 낸다.
- NFR2.1.3. 위치 정보는 승인된 업무·기기 계획 표면에서만 읽힌다. 로그·감사 기록·삭제 원장에는 정확한 좌표를 저장하지 않는다. 영구 삭제 후 앱 상세 원문과 공개 이력은 제거하고 기기 피드는 최소 식별자와 삭제 revision만 남긴다.
- NFR2.3.3. DB의 이력은 가구 인가를 적용하고 독립 저널은 최소 권한 로컬 프로세스에만 제공한다. 암호화 복구 사본·피드 tombstone·저널의 30일 상한을 독립적으로 확인하고, 보존 중인 유효 스냅샷의 삭제 검증에 필요한 구간이 없으면 복원을 공개하지 않는다.
