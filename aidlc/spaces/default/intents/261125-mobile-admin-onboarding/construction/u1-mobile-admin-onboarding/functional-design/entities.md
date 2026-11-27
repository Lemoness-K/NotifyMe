# 모바일 최초 관리자 등록 엔터티

```yaml
entities:
  - name: InstallationSetupGrant
    description: 운영자가 준비한 대상 데이터베이스에서만 유효한 외부 운영 기록
    attributes:
      - {name: setupCycle, type: identifier, required: true, unique: true}
      - {name: databaseIdentity, type: identifier, required: true}
      - {name: activationEpoch, type: identifier, required: true}
      - {name: phase, type: enum, required: true, allowed: [OPEN, COMMITTING, SEALED]}
      - {name: confirmingCandidate, type: identifier, required: false, references: SetupCandidate}
    constraints:
      - 설정 주기는 기존 데이터의 일반 기동이나 복원에서 발급하지 않는다
      - 데이터베이스 밖의 보호된 기록이며 일반 데이터 백업에서 복원하지 않는다
    relationships:
      - {to: SetupCandidate, cardinality: one-to-many, direction: outgoing}
      - {to: SetupCompletion, cardinality: one-to-zero-or-one, direction: outgoing}
  - name: SetupCandidate
    description: 유효한 설치 주기에서 검증된 단일 Google 계정에 부여한 교체 가능한 예약
    attributes:
      - {name: candidateId, type: identifier, required: true, unique: true}
      - {name: setupCycle, type: identifier, required: true, references: InstallationSetupGrant}
      - {name: verifiedIssuer, type: string, required: true}
      - {name: verifiedSubject, type: string, required: true}
      - {name: displayAccount, type: string, required: true}
      - {name: credentialDigest, type: digest, required: true, unique: true}
      - {name: authenticationTime, type: UTC-instant, required: true}
      - {name: expiresAt, type: UTC-instant, required: true}
    constraints:
      - 주기마다 한 시점에 유효한 후보는 한 명
      - 최초 예약 시점부터 10분이며 재인증 또는 새로고침으로 연장하지 않는다
      - 취소·대체·만료 후 예전 자격 증명으로는 확인하거나 취소할 수 없다
    relationships:
      - {to: InstallationSetupGrant, cardinality: many-to-one, direction: outgoing}
  - name: SetupCompletion
    description: 가구 및 ADMIN과 같은 트랜잭션으로 기록된 설정 성공 증거
    attributes:
      - {name: setupCycle, type: identifier, required: true, unique: true, references: InstallationSetupGrant}
      - {name: candidateId, type: identifier, required: true}
      - {name: householdId, type: identifier, required: true}
      - {name: userId, type: identifier, required: true}
      - {name: committedAt, type: UTC-instant, required: true}
    constraints:
      - 가구·멤버십이 종료되거나 정리되어도 운영 설정 권한을 되살리지 않는다
      - 일반 가구·사용자 도메인 데이터와 보존 정책을 구분하고 장기 후보 이메일은 남기지 않는다
    relationships:
      - {to: InstallationSetupGrant, cardinality: one-to-one, direction: outgoing}
```

설치 기록은 등록을 허용할 수 있는 신뢰 근거다. 후보는 계정 확인 동안의 임시 권한이고, 완료 기록은 가구·멤버십과 같은 트랜잭션의 결과를 확인한다. 기존 사용자·가구·멤버십 엔터티의 소유권은 유지한다.
