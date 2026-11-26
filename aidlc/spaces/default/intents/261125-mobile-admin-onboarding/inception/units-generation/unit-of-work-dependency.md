# 구현 단위 의존 관계

[구성요소](../domain-design/components.md)와 [요구사항](../requirements-analysis/requirements.md), [설계 결정](../domain-design/decisions.md)의 변경 경계는 한 서비스 안에서 내부 계약으로 연결한다.

```yaml
units:
  - name: u1-mobile-admin-onboarding
    kind: service
    depends_on: []
```

U1이 의존하는 별도 구현 단위는 없다. 브라우저와 인증·업무 API, 설치 상태와 SQLite 간의 통합은 각기 기존 서비스의 내부 인터페이스를 사용한다. 이번 변경의 단위 간 병렬 작업과 별도 API 계약은 없다.
