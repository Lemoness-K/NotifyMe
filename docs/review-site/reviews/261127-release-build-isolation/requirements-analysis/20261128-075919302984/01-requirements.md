---
layout: review
title: "DS-030 사용 릴리스와 개발·테스트 build 분리 요구사항"
source_path: "aidlc/spaces/default/intents/261127-release-build-isolation/inception/requirements-analysis/requirements.md"
permalink: "/reviews/261127-release-build-isolation/requirements-analysis/20261128-075919302984/01-requirements/"
---

# DS-030 사용 릴리스와 개발·테스트 build 분리 요구사항

## Intent Analysis

가족이 쓰는 Notify Me 웹·API가 개발·자동 검증의 build 때문에 바뀌지 않게 한다. 먼저 사용 중인 경로와 화면의 기준선을 보존하고, 별도 작업 복사본에서 검증한 산출물을 고정 릴리스로 준비한다. 실제 서비스 전환은 구체적인 설정·검증·복구 절차를 제시한 뒤 승인된 범위에서 실행한다. 전환 전 준비 완료와 실제 운영 적용 완료는 다른 결과로 기록한다. [desc] [source:S1] [source:S2]

현재 사용 서비스는 개발 checkout의 API 실행 파일·Caddy root·Node webRoot와 `dist`를 공유한다. 이전 점검에서 로컬·응답의 HTML·JS·CSS 해시가 일치했다. 웹과 실행 중 API가 같은 고정 build라는 보장은 없으며, Git HEAD만으로 미커밋 DS-027(상태 배지와 버튼 구분)을 포함한 현재 릴리스를 식별하지 않는다. 이 관찰은 조사 시점의 사실이다. 적용 전에는 다시 확인한다. [source:S3]

이 문서의 `FR1`~`FR6`, 하위 `FRn.m`, `NFR1`~`NFR6`는 **이 intent `261127-release-build-isolation` 안의 영구 추적 키**다. 다른 intent의 동명 키와 합치거나 기존 제품 ID를 재번호화하지 않는다. 제품 원본 ID는 DS-030(릴리스 분리), F-OPS-005(안전한 업데이트), NFR-REL-007(자동 시작·복원) 등이며 연결은 아래 추적표를 따른다. 각 요구사항의 `Status: Proposed`는 명시적인 단계 승인 전의 상태이고, 상위 제품 결정의 승인 여부나 테스트 통과를 뜻하지 않는다.

## Sources

| 태그 | 원본과 의미 |
|---|---|
| [desc] | Initial description: 사용자가 선택한 Notify Me DS-030을 진행해줘. `aidlc engine workspace project-description`의 원문. 전체 최초 요청은 [앞 단계 근거의 원문](../practices-discovery/evidence.md#사용자-최초-요청-원문)에 보존되어 있다. |
| [scope] | Workflow-selected scope: infra. 10단계 계획 선택이며 실제 서비스 전환 승인과 구분한다. |
| [source:S1] | 프로젝트 루트 `docs/decision-register.md` D-105(DS-030 다음 작업 선택), D-104(DS-027 실기기 수용), D-070(환경 분리·개발 루프), D-071(테스트 우선), D-077(systemd). |
| [source:S2] | 프로젝트 루트 `docs/09-feature-design-coverage-and-backlog.md` DS-030·§8.8·§8.9. DocumentKB `01a22019-2917-70d6-81f5-9cdf6cba3a07`, 원문 사본 SHA-256 `29e479305cb6235e9c48483234dcdc76619b1ae26dda5570092f1ae129f02372`. 전체 추출은 200000자에서 잘려 대상 절을 보존된 원문 사본에서 별도로 읽었다. |
| [source:S3] | 프로젝트 루트 `docs/06-deployment-and-operations.md` §7·§7.1 및 [앞 단계 현재 경로·해시 근거](../practices-discovery/evidence.md#현재-읽기-전용-확인). |
| [memory:M1] | [승인된 개발·운영 방식](../practices-discovery/team-practices.md), D-070·D-071을 적용하는 프로젝트 루트 `AGENT.md` §8, `docs/08-test-strategy.md` §§2–7. |
| [source:S4] | 프로젝트 루트 `docs/00-master-design.md` G-005(저비용 Pi 운영), F-OPS-005(안전한 업데이트), NFR-REL-007(자동 시작·복원). |
| [source:S5] | `aidlc/spaces/default/codekb/toyproj_notify_me/business-overview.md`, `architecture.md`, `code-structure.md`: 제품·구성요소 경계 참고. 과거 최초 관리자 CLI 설명은 최신 D-099(모바일 최초 관리자)와 상위 원본을 우선한다. 현재 운영 사실은 S3을 사용한다. |
| [source:S6] | [요구사항 범위 확인](requirements-analysis-questions.md#consolidated-summary-confirmation). 사용자 메시지 bba03874의 “좋아보여 이대로 하자”로 확인한 범위다. 원본을 보존하는 통상적인 문서 처리 변경은 사용자 f4979976의 지시대로 별도 승인 질문 없이 진행한다. |

`User`는 명시된 사용자 요청·선택, `Derived`는 그 요청을 실제로 만족시키는 데 필요한 조건이다. 각 Derived 행에 필연성을 적는다. 추가 제품 정책이나 선택적 AI 제안은 이 요구사항에 포함하지 않았다.

## Functional Requirements

모든 기능 요구사항의 우선순위는 Must다. 이번 첫 결과를 벗어나는 자동 배포·인프라 확대는 제외한다. 각 표의 정상·실패 시나리오는 실행할 검증의 합격 기준이며 실행 결과가 아니다.

### FR1 — 현재 사용 상태와 기존 작업 보존

| ID | Type | Origin | Status | 요구·근거 |
|---|---|---|---|---|
| FR1 | FR | User | Proposed | 사용 데이터·계정·주소·DS-027 화면·다른 세션 미커밋 변경을 보존한다. [desc] [source:S1] [source:S2] |
| FR1.1 | FR | User | Proposed | 서비스·정적 root·API 실행 파일·DB 대상·웹 asset hash를 읽기 전용으로 재확인하고, 비밀값·DB 내용을 출력하지 않는 기준선을 남긴다. [source:S2] [source:S3] |
| FR1.2 | FR | Derived | Proposed | 미커밋 작업과 현재 산출물을 Git HEAD만으로 대체하지 않는다. 읽는 도중 관련 파일·경로가 달라지면 기준선을 다시 확인하고 변경된 사실을 기록한다. 현재 DS-027 보존 요구상 다른 버전의 파일을 같은 릴리스라고 가정할 수 없기 때문이다. [source:S1] [source:S3] |

| ID | 정상 시나리오 | 실패·경계 시나리오와 검증 |
|---|---|---|
| FR1.1 | Given 기존 서비스가 실행 중일 때 When 사전 점검하면 Then 실행 경로·webRoot·DB 대상·HTML과 참조 asset의 해시를 함께 기록하고 서비스·설정은 유지한다. | Given 경로를 읽을 권한이 없거나 대상이 누락되면 When 점검하면 Then 해당 대상을 미확인으로 기록하며 확인 완료로 처리하지 않는다. 비밀·DB 내용이 결과에 없는지도 검사한다. |
| FR1.2 | Given 미커밋 DS-027이 포함된 기준선일 때 When 작업 복사본을 준비하면 Then 그 입력 revision과 변경 포함 범위를 식별하고 원래 작업 트리를 유지한다. | Given 준비 중 입력이 바뀌면 When 재대조하면 Then 불일치를 검출하며 혼합 상태를 검증된 버전으로 승격하지 않는다. 파일 변경을 삭제·stash·reset·clean으로 해결하지 않는다. |

### FR2 — 개발·테스트 산출물의 사용 릴리스 격리

| ID | Type | Origin | Status | 요구·근거 |
|---|---|---|---|---|
| FR2 | FR | User | Proposed | 별도 검증 작업 복사본과 build·API 실행·웹 root를 사용 서비스에서 분리한다. [desc] [source:S2] |
| FR2.1 | FR | User | Proposed | 사용 서비스가 참조하지 않는 작업 복사본의 산출물로 build·관련 unit/API/E2E를 실행한다. 테스트 DB·인증 fixture·설정·프로세스도 실사용 대상과 분리한다. [source:S2] [memory:M1] |
| FR2.2 | FR | User | Proposed | 분리된 검증 전후 사용 웹 asset hash·서비스 실행 경로·DB 대상이 불변임을 비교한다. [source:S2] |
| FR2.3 | FR | Derived | Proposed | 복사본·출력·실행·웹 root를 실제 경로로 대조해 사용 대상과 겹치는 구성은 검증 전에 거부한다. 별칭·symlink·상대 경로가 같은 사용 산출물로 귀착하면 디렉터리 이름만 다르게 해서는 격리 요구를 만족할 수 없기 때문이다. [source:S2] [source:S3] |

| ID | 정상 시나리오 | 실패·경계 시나리오와 검증 |
|---|---|---|
| FR2.1 | Given 별도 복사본과 synthetic 임시 SQLite가 준비됐을 때 When 검증하면 Then 그 복사본의 웹/API로 실행하고 명령·입력·결과를 남긴다. | Given 운영 DB·자격 증명·사용 산출물을 대상으로 감지하면 When 검증을 시작하려 할 때 Then 시작하지 않고 잘못된 경계를 알린다. 테스트가 운영 대상을 열지 않았는지 fixture로 확인한다. |
| FR2.2 | Given 검증 직전 기준선이 있을 때 When 별도 환경에서 build·테스트를 마치면 Then 같은 방법으로 비교한 사용 경로·해시·DB 대상이 같다. | Given 값이 다르거나 사후 확인이 실패하면 When 결과를 판정하면 Then 격리 수용을 통과시키지 않고 차이·미확인을 기록한다. |
| FR2.3 | Given 독립된 실제 경로일 때 When 사전 점검하면 Then 격리 검증을 허용한다. | Given 겉보기 경로만 다르고 symlink 또는 부모 경로가 사용 root로 연결될 때 When 사전 점검하면 Then 겹침을 검출한다. 경로의 공백·한글도 정확히 취급한다. |

### FR3 — 검증 버전과 고정 릴리스 준비

| ID | Type | Origin | Status | 요구·근거 |
|---|---|---|---|---|
| FR3 | FR | User | Proposed | 사용 웹/API를 개발 build로부터 독립된 고정 릴리스로 준비하고 같은 버전으로 식별한다. [source:S2] |
| FR3.1 | FR | Derived | Proposed | 릴리스 식별자·입력 revision/미커밋 포함 범위·웹/API 산출물 해시·검증 결과를 연결한다. 같은 버전의 전환·복구를 검증하려면 HEAD만으로 부족한 현재 상태에서 실제 파일 집합의 식별이 필요하기 때문이다. [source:S2] [source:S3] |
| FR3.2 | FR | Derived | Proposed | 검증된 웹/API·필요 실행 의존 파일만 준비하고 완료된 릴리스를 개발 build로 덮어쓰지 않는다. 준비 중 실패하거나 파일이 불완전하면 사용 대상으로 선택하지 않는다. 고정 릴리스와 검증 산출물 전환 요구상 필요한 조건이다. [source:S2] |
| FR3.3 | FR | User | Proposed | 릴리스 산출물에서 운영 DB·계정 자료·키·비밀·백업을 제외한다. 기존 영속 대상은 이동·초기화하지 않고 런타임 경계에서 유지한다. [desc] [source:S2] |

| ID | 정상 시나리오 | 실패·경계 시나리오와 검증 |
|---|---|---|
| FR3.1 | Given 웹/API가 함께 검증된 입력일 때 When 릴리스를 준비하면 Then 두 산출물과 검사 결과가 하나의 식별자로 연결된다. | Given 웹과 API가 다른 입력이거나 해시 확인이 실패하면 When 준비 완료를 판정하면 Then 같은 검증 릴리스로 취급하지 않는다. |
| FR3.2 | Given 준비 완료된 릴리스가 있을 때 When 다른 복사본을 build하면 Then 완료 릴리스 파일·식별정보는 유지된다. | Given 중단·디스크 부족·권한 오류로 준비가 끝나지 않으면 When 릴리스를 선택하려 할 때 Then 미완료를 알리고 기존 사용 경로를 유지한다. |
| FR3.3 | Given 분리된 런타임 영속 대상이 있을 때 When 릴리스 목록을 검사하면 Then 배포 산출물에 실사용 자료가 없다. | Given 복사 입력에 비밀·DB 또는 그 대상으로 향하는 링크가 섞이면 When 준비하면 Then 제외하거나 준비를 거부하며 비밀 내용을 로그로 노출하지 않는다. |

### FR4 — 승인된 웹/API 서비스 전환

| ID | Type | Origin | Status | 요구·근거 |
|---|---|---|---|---|
| FR4 | FR | User | Proposed | 구체적인 전환·검증·복구 절차를 준비한 뒤 사용자 승인 범위에서 웹/API를 같은 검증 버전으로 전환한다. [desc] [source:S1] [source:S2] |
| FR4.1 | FR | User | Proposed | 대상/현재 릴리스·변경할 서비스/프록시 설정·권한·예상 중단·확인 명령·실패 시 복구를 구체적으로 제시하고 실제 전환 승인을 받는다. [source:S2] [memory:M1] |
| FR4.2 | FR | User | Proposed | 승인된 전환에서 Caddy와 Node 정적 root, API 실행 파일이 같은 선택 릴리스를 사용하고 기존 주소·DB·계정·키 경계를 유지하는지 확인한다. [source:S2] [source:S3] |
| FR4.3 | FR | Derived | Proposed | 전환 도중 오류·중복 실행·다른 변경·버전 불일치·확인 실패를 감지하면 성공 판정을 중단하고 승인된 복구 절차로 처리하거나 운영자에게 복구 필요 상태를 알린다. 명시적이고 일관된 전환 및 타 작업 보존을 위해 실패를 숨길 수 없기 때문이다. [desc] [source:S2] |

| ID | 정상 시나리오 | 실패·경계 시나리오와 검증 |
|---|---|---|
| FR4.1 | Given 검증된 후보와 복구 절차가 준비됐을 때 When 실제 전환 승인을 받으면 Then 승인된 대상·설정·실행 범위만 적용한다. | Given 계획/요구사항만 승인됐거나 후보·설정이 달라졌을 때 When 실제 전환을 요청하면 Then 기존 승인을 다른 전환의 권한으로 사용하지 않는다. |
| FR4.2 | Given 승인된 전환을 실행했을 때 When 서비스 경로·정적 응답·식별정보·기동을 확인하면 Then 웹/API가 같은 후보를 사용하고 영속 대상·주소가 유지된다. | Given API는 이전 버전이거나 Caddy/Node root가 다르면 When 사후 점검하면 Then 배포 성공으로 판정하지 않는다. |
| FR4.3 | Given 격리 리허설에서 정상 전환할 때 When 끝까지 점검하면 Then 하나의 전환 결과가 남는다. | Given 중단·재시작 실패·겹치는 전환이 발생하면 When 결과를 판정하면 Then 오류와 현재 상태·복구 행동을 남긴다. 다른 작업을 덮어쓰거나 반복 실행으로 성공을 가장하지 않는다. |

### FR5 — 이전 릴리스 복구와 기존 데이터 접근

| ID | Type | Origin | Status | 요구·근거 |
|---|---|---|---|---|
| FR5 | FR | User | Proposed | 이전 릴리스로 돌아가는 구체 절차와 기존 데이터 접근 확인 근거를 확보한다. [source:S2] |
| FR5.1 | FR | Derived | Proposed | 전환 전 이전 웹/API 파일 집합과 서비스·프록시 설정, 원래 영속 대상의 연결 근거를 보존한다. 새 파일을 과거 dist 위에 덮어쓰거나 Git HEAD로만 복구할 수 없기 때문이다. [source:S2] [source:S3] |
| FR5.2 | FR | User | Proposed | 임시 synthetic 환경에서 전환·복구를 검증하고, 실제 전환 승인에 복구 범위도 포함해 이전 릴리스의 기동·웹/API 정합·기존 데이터 접근을 확인한다. 실제 업무 조작을 하는 자동 테스트는 운영에 실행하지 않는다. [source:S2] [memory:M1] |

| ID | 정상 시나리오 | 실패·경계 시나리오와 검증 |
|---|---|---|
| FR5.1 | Given 전환 직전일 때 When 복구 근거를 점검하면 Then 이전 산출물·설정·DB 연결 경계를 식별할 수 있다. | Given 현재 웹/API가 이미 혼합 상태라면 When 이전 후보를 준비하면 Then 혼합 파일을 검증된 단일 버전이라고 주장하지 않고 복구 대상·가능 범위를 재검증한다. 복구 근거가 부족하면 실제 전환하지 않는다. |
| FR5.2 | Given 검증된 이전 후보와 승인된 복구가 있을 때 When 이전 릴리스로 돌아가면 Then 웹/API가 함께 기동하고 같은 영속 대상의 기존 자료에 접근한다. | Given 이전 파일·권한·설정이 누락되거나 호환 확인에 실패하면 When 복구를 판정하면 Then 성공으로 처리하지 않고 보존한 자료를 유지해 수동 복구에 필요한 상태를 알린다. 운영 DB를 초기화하지 않는다. |

### FR6 — 운영 문서와 로드맵 반환

| ID | Type | Origin | Status | 요구·근거 |
|---|---|---|---|---|
| FR6 | FR | User | Proposed | 검증·적용·복구·미수행·후속 작업을 문서와 로드맵에 반환한다. [desc] [source:S2] |
| FR6.1 | FR | User | Proposed | 운영 §7, AGENT.md의 임시 제약, 배포·복구 가이드와 ID 추적을 실제 변경·검증 상태에 맞춰 갱신한다. 분리 확인 전 공유 dist 제약은 유지한다. [source:S2] |
| FR6.2 | FR | User | Proposed | 파일·diff/커밋·검증 명령·환경·결과·미수행, 실제 적용 버전·복구 근거, Android/Web 사용자 확인·잔여 Q/DS를 구분해 전달한다. [desc] [source:S2] |

| ID | 정상 시나리오 | 실패·경계 시나리오와 검증 |
|---|---|---|
| FR6.1 | Given 분리 검증과 적용 사실이 확보되면 When 문서를 갱신하면 Then 원본·추적표·로컬 안내의 상태와 링크가 일치한다. | Given 구현만 됐거나 운영 적용이 미수행이면 When 완료 상태를 기록하면 Then 서비스 적용 완료로 표기하거나 기존 제약을 제거하지 않는다. |
| FR6.2 | Given 결과를 반환할 때 When 검증 기록을 확인하면 Then 실행 환경·버전·통과/실패/미수행과 복구 근거를 찾을 수 있다. | Given 실기기·운영 복구 등 일부를 실행하지 못했다면 When 보고하면 Then 미수행과 다음 행동을 명시하고 자동 테스트만으로 실기기·운영 수용을 주장하지 않는다. |

## Non-Functional Requirements

각 항목은 Must이며 이 intent의 독립 검증 대상이다. 인위적인 성능·중단 시간 수치를 만들지 않는다.

| ID | Type | Origin | Status | 요구·도출 근거 | 정상·실패 검증 기준 |
|---|---|---|---|---|---|
| NFR1 | NFR | User | Proposed | 개발 검증과 사용 서비스 간 산출물·데이터·인증 경계를 분리한다. [desc] [source:S2] [memory:M1] | 격리 환경의 전체 관련 검증 전후 FR2.2 기준이 불변이다. 운영 대상 감지·경로 겹침·비교 실패가 있으면 수용 실패다. |
| NFR2 | NFR | User | Proposed | 기존 DB·계정·주소·보호 키·권위 볼륨·백업과 DS-027 수용 화면을 보존한다. [desc] [source:S1] [source:S2] | 승인 전환 전후 영속 대상·주소·인증 경계를 대조하고 사용자 수용 화면을 확인한다. 자동 테스트는 synthetic 자료만 쓰며 실사용 자료를 조회·복사·변경해 검증하지 않는다. 수동 기존 데이터 접근 확인은 사용자 승인 범위에서만 한다. |
| NFR3 | NFR | User | Proposed | 비밀·실사용 데이터가 검증 fixture·릴리스 산출물·게시 문서·로그로 전파되지 않게 한다. [source:S2] [memory:M1] | 합성 비밀/DB 자료를 넣은 부정 사례에서 혼입을 거부 또는 제외하고 내용은 출력하지 않는다. 실제 환경 파일 전체·DB 내용·계정 자료가 증거에 없는지 확인한다. |
| NFR4 | NFR | Derived | Proposed | 전환·복구 후 기존 systemd 감독과 자동 시작·재시작 경계를 유지한다. 배포 경로 변경으로 D-077·NFR-REL-007을 깨면 보존 요구를 만족하지 못하기 때문이다. [source:S1] [source:S4] | 격리 리허설 후 승인된 운영 절차에서 기동·비정상 종료 재시작·자동 시작 설정을 검증한다. 실제 재부팅/재시작이 미수행이면 따로 기록하고 통과를 주장하지 않는다. |
| NFR5 | NFR | User | Proposed | TDD·전체 typecheck·관련 unit/API integration·필요 E2E와 전체 line coverage 80%를 유지한다. [memory:M1] | 새 검증이 잘못된 격리/불일치를 잡는지 확인하고 독립 작업 복사본에서 실행한다. 실패를 통과시키기 위해 assertion·격리·coverage 기준을 낮추지 않는다. Kotlin 변경 시 해당 JVM 검증도 포함한다. |
| NFR6 | NFR | Derived | Proposed | 사후 검증·오류·복구 상태를 경로·해시·버전과 연관지어 진단할 수 있게 한다. 명시적 전환·복구와 결과 반환을 위해 검증된 후보와 실제 적용 결과를 구분해야 하기 때문이다. [source:S2] | 정상 전환과 실패/미수행의 구분이 기록에서 재현된다. 상태가 미확인·버전이 불일치하면 성공 표기를 하지 않는다. 중단/복구 시간 목표는 후속 설계 승인 전까지 미결정으로 유지한다. |

## Constraints

- 현재 공유 checkout의 `dist`를 쓰는 build·verify:u1 및 동등 명령은 실행하지 않는다. 별도 검증 복사본도 사용 서비스가 참조하지 않는지 먼저 확인한다. [desc] [memory:M1]
- 현재 웹/API·프록시·서비스를 조사 목적으로 이동·재시작·reload하지 않는다. 요구사항이나 계획의 승인을 실제 서비스 전환 승인으로 대신하지 않는다. [desc] [source:S2]
- 현재 Raspberry Pi 단일 호스트, systemd·Caddy·Tailscale의 승인된 접근 경계와 SQLite 영속 대상을 유지한다. 구체 디렉터리·권한·전환 방식은 후속 설계 대상이다. [source:S1] [source:S3]
- 테스트에는 synthetic 임시 데이터·인증 fake만 쓴다. 운영 DB·자격 증명·키를 작업 복사본이나 테스트 fixture에 복사하지 않는다. [memory:M1]
- 타 세션 미커밋 변경·원격 이력·DS-027을 보존한다. 완료된 온보딩 intent를 재개하지 않는다. [desc] [source:S2]
- 문서의 원본은 기존 docs와 이 intent의 산출물이며 DocumentKB는 revision이 식별되는 참고 사본이다. 원본이 달라지면 최신 내용을 재확인하며 사본이 자동 동기화됐다고 가정하지 않는다. [source:S2] [source:S6]

## Assumptions & Open Questions

추가 제품 가정은 없다. 다음은 후속 설계의 명시적인 결정 조건이며 현재 승인된 값이 아니다. 기존 제품 질문의 열림/해결 상태는 유지한다.

| 미결정 | 책임·해결 시점 | 현재 제한 |
|---|---|---|
| 전환 중 허용 중단 시간과 복구 목표 | 사용자·운영 담당자; NFR 설계와 실제 전환 계획 승인 전 | 임의 수치·무중단 보장을 요구사항으로 만들지 않고 미확정이면 실제 전환하지 않는다. |
| 고정 릴리스 경로·권한·선택 방식·정확한 서비스/프록시 변경·중복 전환 방지 | 인프라·배포 설계; 환경 변경 전 구체안 제시 | symlink 등 특정 구현을 이미 승인한 것으로 취급하지 않는다. |
| 현재 DS-027을 보존하는 이전 릴리스·웹/API 정합·복구 가능성 | 구현·운영 담당자; 후보 준비 및 실제 전환 전 | 기동 중 API와 현재 디스크 파일의 버전 일치를 가정하지 않는다. 기존 파일을 보존하고 복구 리허설로 확인한다. |
| 평소 주소·로그인·기존 목록·DS-027 화면의 최종 확인 | 사용자; 승인된 전환 후 | 실제 자료 자동 테스트로 대체하지 않는다. 미수행은 남은 작업으로 반환한다. |

관련 없는 Q-019(iOS), Q-030(추가 인증), Q-072(공개 배포 최초 관리자 보호), Q-075~Q-080(로드맵 아이디어)은 이 작업으로 닫거나 변경하지 않는다. 이 절의 설계 조건을 별도 인터뷰 질문으로 제시할 때는 기존 AGENT.md 절차에 따라 Q ID·원문·추적을 등록한다.

## Out of Scope

제품 화면·상태/권한/알림 정책 변경, DS-027의 재설계, Android 네이티브 새 기능·스토어 배포, Docker·새 서버·클라우드/유료 서비스 추가, 네트워크 공개 범위 확대, 자동 배포 확대, 운영 DB 초기화·schema migration·자료 이전, 기존 키·주소 교체는 이번 범위가 아니다. 필요성이 발견되면 영향과 별도 승인 범위를 먼저 정리한다. [desc] [source:S1] [source:S2]

## Traceability & Verification Handoff

| 요구사항 | 제품 원본·결정 | 설계·구현 책임 | 검증 위치·완료 판정 |
|---|---|---|---|
| FR1.1, FR1.2 | DS-030(릴리스 분리), D-104(화면 수용), D-105(작업 선택), DS-015(기준선) | 인프라 설계의 현황/보존 절; 구현 미착수 | 앞 단계 evidence는 조사 근거. 전환 전 경로·해시·입력 snapshot 재대조는 미수행 |
| FR2.1, FR2.2, FR2.3, NFR1, NFR5 | DS-030, D-070(환경 분리), D-071(테스트 우선), DS-014(검증) | NFR/인프라·CI 설계의 격리 검증; 구현 미착수 | 별도 복사본의 typecheck·unit/API/E2E와 불변성 검증을 CI/배포 산출물에 연결. 현재 미수행 |
| FR3.1, FR3.2, FR3.3, NFR3 | DS-030, F-OPS-005(안전한 업데이트), DS-008(배포), D-105 | 인프라·배포 설계의 고정 릴리스·안전 복사; 구현 미착수 | 식별·혼입·경로/파일 변경·불완전 릴리스 부정 검증. 현재 미수행 |
| FR4.1, FR4.2, FR4.3, NFR2, NFR4, NFR6 | DS-030, F-OPS-005, D-077(systemd), NFR-REL-007(자동 시작) | NFR·배포/환경·운영 전환의 구체 승인안; 구현·운영 적용 미착수 | synthetic 전환/실패 리허설 및 승인 후 운영 확인. 현재 미수행 |
| FR5.1, FR5.2 | DS-030, DS-008, DS-015, F-OPS-005 | 인프라·배포 설계의 이전 릴리스/설정 복구; 구현 미착수 | 격리 전환·rollback과 승인 범위의 기존 데이터 접근. 현재 미수행 |
| FR6.1, FR6.2 | DS-030, DS-008, DS-015, D-105 | 운영 원본·배포 가이드·로드맵 반환 | 영향받는 docs/06 §7·AGENT.md·배포 가이드·백로그 추적의 실제 적용 상태 및 링크 점검. 현재 완료 처리하지 않음 |

후속 문서와 검증은 하위 ID 및 NFR ID를 보존하고 독립적으로 합격/실패를 기록한다. 상위 FR는 탐색 그룹이며 하위 동작의 검증을 대신하지 않는다. 기계 판독 ID 목록은 [traceability.json](traceability.json), 합의된 범위와 확인은 [질문·요약 기록](requirements-analysis-questions.md)에 있다. 이 문서 작성 단계에서는 제품 코드·실사용 dist·서비스·DB를 변경하거나 테스트하지 않았다.
