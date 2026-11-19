# U2 용량 요구사항

## Sources

U2 `functional-spec.md`와 `rules.md`, Inception `requirements.md`와 `contract-summary.md`, CodeKB `technology-stack.md`를 근거로 한다. 현재 실행 스택은 U1의 `package.json`, `package-lock.json` 및 `docs/u1-local-run.md`에서 확인했다.

## Requirements

| ID | 요구사항 | 확인 방법 |
| --- | --- | --- |
| NFR5.3.2 | 가구 쓰기는 기존 단일 노드 및 단일 SQLite 경계에서 유지한다. 초대의 가구·상태·만료 조회와 변경문은 해당 가구만 처리한다. 만료 데이터 정리와 정책 조정에 필요한 양을 측정한다. | 권한 검증과 소속·초대 경쟁을 포함한 부하를 합성한다. 현재 단계에서 다중 노드나 새 저장 서비스는 추가하지 않는다. 대상 부하 확정은 DS-014를 따른다. |
