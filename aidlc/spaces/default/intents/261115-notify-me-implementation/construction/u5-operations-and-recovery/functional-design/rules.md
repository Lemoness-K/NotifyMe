# U5 운영·복구 업무 규칙

```yaml
rules:
  - {id: BR5.1, category: authorization, applies_to: 진단, trigger: 운영 확인, logic: 호스트 권한으로만 헬스와 실행 결과를 조회한다, violation: 공개 요청은 차단한다, source: [FR10.2, FR10.6, NFR10.2]}
  - {id: BR5.2, category: policy, applies_to: 로컬 보고, trigger: 새 주 또는 장애 상태 전이, logic: 각 기능이 켜져 있을 때 주간 요약과 중복을 억제한 장애 기록을 남긴다, violation: 외부 수신 연동은 후속이며 검사 실패는 별도로 기록한다, source: [FR9.1, FR9.2, FR9.3]}
  - {id: BR5.3, category: constraint, applies_to: 스냅샷, trigger: 백업 기준점 생성, logic: 배타 삭제 경계와 일관 SQLite 사본 및 같은 사본의 증거를 검증한다, violation: 불명확한 기준점은 게시하지 않는다, source: [FR10.3, NFR3.4]}
  - {id: BR5.4, category: constraint, applies_to: 보관, trigger: 암호화 백업 게시, logic: 키를 분리하고 인증된 사본을 최대 30일 회전하며 필요한 원장 증거를 우선 보존한다, violation: 미확인 및 만료 사본을 사용하지 않는다, source: [FR10.5, FR2.6, NFR2.3]}
  - {id: BR5.5, category: policy, applies_to: 일일 백업, trigger: 일정 또는 운영 실행, logic: 매일 일관 백업을 시도하고 결과를 로컬에 보존한다, violation: 실패하며 기존 유효 사본은 유지한다, source: [FR10.8]}
  - {id: BR5.6, category: constraint, applies_to: 재적용, trigger: 격리 복구, logic: 인증된 원장의 연속 구간에서 확정 삭제만 멱등 재적용한다, violation: 누락 미확정 또는 적용 실패 때 공개하지 않는다, source: [FR10.7, NFR3.4]}
  - {id: BR5.7, category: policy, applies_to: 기동과 전환, trigger: 부팅 또는 업데이트와 복원, logic: 단일 노드의 데이터와 이전 버전을 보전하며 검증된 후보와 새 epoch로 전환한다, violation: 조회 불일치나 실패 때 서비스를 열지 않는다, source: [FR10.1, FR10.4, NFR8.2]}
```

| 범위 | 규칙 |
| --- | --- |
| 로컬 상태·보고 | BR5.1~BR5.2 |
| 백업과 보존 | BR5.3~BR5.5 |
| 복원·전환 | BR5.6~BR5.7 |
