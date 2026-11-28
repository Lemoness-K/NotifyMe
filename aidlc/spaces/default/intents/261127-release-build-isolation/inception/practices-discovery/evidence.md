# DS-030 개발·운영 방식 확인 근거

상태: 읽기 전용 조사와 사용자 답변 요약 확인을 마치고 최종 통합했다. 단계 승인·규칙 승격은 대기 중이다. 조사 기준 2026-11-27T13:26:15Z(2026-11-27 22:26:15 Asia/Seoul), 최종 통합 시각 2026-11-27T14:04:05Z(2026-11-27 23:04:05 Asia/Seoul). 브랜치 `master`, 조사·최종 통합 HEAD `63acbc1ebd82a58862fefd55f28f7005def0409d`. 작업 트리는 다수 미커밋 변경을 포함하므로 HEAD를 현재 사용 릴리스의 전체 버전으로 간주하지 않는다.

## Sources

### 기준 문서와 사용자 결정

- `AGENTS.md`, `AGENT.md`: 문서 우선순위, 한국어·안정 ID, 운영·테스트 분리, 타 세션 변경 보존, 검토 게시 경계.
- `docs/decision-register.md`: D-070(개발 루프·환경 분리), D-071(테스트 우선), D-077(systemd), D-104(DS-027 실기기 수용), D-105(DS-030 선택). 관련 없는 열린 질문은 그대로 유지한다.
- `docs/00-master-design.md`: G-005(저비용 Pi 운영), F-OPS-005(안전한 업데이트), NFR-REL-007(자동 시작·복원), 웹·API·영속 데이터 경계.
- `docs/09-feature-design-coverage-and-backlog.md`: DS-030(사용 릴리스·개발 build 분리), §8.8 공통 반환 조건, §8.9 DS-030 전달 프롬프트.
- `docs/06-deployment-and-operations.md` §7: 기존 공유 `dist` 확인과 분리 전 build 금지의 원본.
- `docs/08-test-strategy.md` §§2–7: TDD, 전체 80% line coverage, synthetic·임시 SQLite, 개발 루프와 운영·기기 검증의 구분.
- `aidlc/spaces/default/memory/{org,team,project}.md`, `phases/inception.md`: 기존 확정 방식과 보완 규칙. 오래된 사실과 최신 원본의 차이는 아래에 명시한다.

### 기존 CodeKB 입력과 한계

다음 여섯 입력을 모두 읽었다. 이들은 온보딩 작업 전후의 집중 분석이며 현재 런타임을 직접 확인하지 않았거나 교체된 관리자 CLI 흐름을 포함하므로 최신 서비스 사실의 근거로 단독 사용하지 않는다.

- `aidlc/spaces/default/codekb/toyproj_notify_me/code-structure.md`: source·배포·테스트 경로와 구성요소 분류.
- `aidlc/spaces/default/codekb/toyproj_notify_me/technology-stack.md`: Node 24·TypeScript·NestJS·Vite·Prisma·SQLite·Vitest·Playwright.
- `aidlc/spaces/default/codekb/toyproj_notify_me/dependencies.md`: 인증·DB·구성·정적 root의 의존 방향.
- `aidlc/spaces/default/codekb/toyproj_notify_me/code-quality-assessment.md`: 기존 검증 명령·당시 결과. 이 단계에서 테스트 통과를 재주장하지 않는다.
- `aidlc/spaces/default/codekb/toyproj_notify_me/architecture.md`: systemd·Caddy·Tailscale·공유 SPA·NestJS 구성과 과거 CLI 온보딩.
- `aidlc/spaces/default/codekb/toyproj_notify_me/business-overview.md`: 가족 업무·Android와 웹의 제품 경계. 최초 관리자 등록은 최신 D-099(모바일 최초 관리자)로 대체된 점을 유의한다.

## 현재 읽기 전용 확인

| 대상 | 방법·관찰 | 의미·한계 |
|---|---|---|
| 공유 작업 트리 | `git status --short`, `git log -8`, `git branch --show-current`, `git rev-parse HEAD` | DS-027 UI, 온보딩·운영·설계·테스트 등 다수 기존 변경·미추적 파일이 있다. 어떤 파일도 되돌리거나 stage·커밋하지 않았다. |
| 사용 서비스 | `systemctl --user show`로 상태·PID·WorkingDirectory·unit 위치·기동 시각만 조회 | API와 프록시는 모두 active/running. API의 WorkingDirectory와 main.js는 현재 개발 checkout의 루트·`dist/server/main.js`다. 서비스 기동 시각은 2026-11-27 16:25:48 KST다. |
| 실제 프로세스·DB 경계 | `/proc`에서 cwd·main.js 위치와 허용된 DB 설정 두 개만 읽어 대조 | 실행 파일은 공유 `dist/server`; 두 DB 설정은 동일한 checkout 밖 사용자 영속 SQLite를 가리킨다. 환경 전체·비밀값·DB 내용은 읽거나 출력하지 않았다. 게시 문서에는 홈·DB·호스트 주소를 싣지 않는다. |
| 사용 정적 root | 실제 Caddyfile에서 root·reverse_proxy 줄만 추출 | root는 현재 checkout `dist/web`; API는 기존 loopback API로 전달한다. 재시작·reload·설정 변경 없음. |
| 사용 응답 | 기존 loopback HTTP에서 index·현재 JS·CSS를 GET하여 메모리에서 SHA-256 비교 | 아래 세 파일은 로컬 `dist/web`와 실제 제공 응답이 각각 일치한다. 로그인·계정·업무 API 요청이나 상태 변경을 수행하지 않았다. |
| build 경계 | `package.json`, `tsconfig.build.json`, `vite.config.ts`, `src/server/main.ts` 정적 읽기 | build는 Prisma generate 후 `dist/server`·`dist/web`에 출력하고 Node도 상대 `dist/web`를 사용한다. 현재 공유 checkout의 build 금지가 필요하다. |
| 테스트 격리 | `tests/u1/fixtures.ts`, `tests/u5/fixture.ts`, `tests/e2e/u1/core-flow.spec.ts`, `tests/e2e/u3/reminder-workflows.spec.ts` 경로·환경 구성 정적 읽기 | 임시 synthetic DB·loopback 프로세스를 사용하지만 E2E 실행 파일은 작업 복사본의 `dist/server`다. 데이터 분리만으로 산출물 분리를 입증하지 못한다. 실제 테스트는 실행하지 않았다. |
| CI | `.github/workflows/u1-app-ci.yml`, `android-u4-ci.yml`, `package.json`, `vitest.config.ts`, `playwright.config.ts` | 별도 GitHub runner checkout에서 `verify:u1` 또는 Android build를 수행한다. 사용 호스트 자동 전환은 이 파일들에 없다. 현재 CI 실행 결과를 조회하거나 제품 CI를 실행하지 않았다. |

### 정적 파일 기준선

다음 SHA-256은 로컬 파일과 현재 loopback 제공 응답에서 각각 동일했다. 고정 릴리스 manifest가 아니며, 이후 전환 직전에는 다시 확인해야 한다.

| 파일 | SHA-256 |
|---|---|
| `dist/web/index.html` | `d6f96d3e3420604a41abd76e459875b6a3f44165dee7c754d62ae8bd69e8fd40` |
| `dist/web/assets/index-CQYWdQRW.js` | `1dde57ae22339d8e1644112224a21fe62d20f82c977421a4d0edbcc04a862e07` |
| `dist/web/assets/index-CfSltg2k.css` | `4047eba896800da240f1c8a9922323a2615a8af074842086a3d526c9514ca9d4` |

웹 파일이 서비스 기동 이후 생성된 기존 점검 사실을 뒤집을 근거는 없다. 현재 웹과 실행 중 API가 같은 고정 build 버전이라는 보장은 아직 없다. DS-027(상태 표시와 버튼 구분)의 사용자 수용은 D-104(실기기 승인)를 따르며 이 조사로 새 실기기 수용을 주장하지 않는다.

## 확인된 방식과 낡은 기록

- 다섯 영역의 새 질문은 만들지 않는다. 작업 방식은 기존 최신 프로젝트 기준과 이번 명시적 순서·보존 지시, 최소 전체 흐름 검증은 기존 팀 기준, 테스트는 D-070·D-071과 현재 80%, 배포는 D-077·D-105 및 별도 전환 승인, 스타일은 기존 관례·현재 도구 보존으로 정리할 수 있다.
- `team.md`의 “docs/08은 고정 전체 비율을 두지 않는다”는 메모는 현재 §3·Vitest 80%와 불일치한다. 과거 불일치를 현재 미결정으로 다시 묻지 않는다.
- `team.md`의 “앱 코드가 생긴 뒤 배포 정책 결정”, “systemd/Caddy는 계획”과 `docs/08`의 “코드/runner 없음”은 현재 구현·실행 상태를 설명하지 못한다. 최종 문서에서 현재 사실과 승인된 전환 경계를 구분했다.
- 팀의 과거 PR/rebase 관행은 프로젝트의 최신 직접 반영 기록과 함께 읽는다. 이번 조사에서 저장소 반영·게시를 실행하지 않았으며 다른 세션 변경을 포함하지 않는다.
- 릴리스 디렉터리·권한·짧은 중단 허용 여부·전환 원자성·이전 릴리스 복구의 구체 선택은 후속 설계 단계에서 제안하고 승인받을 사항이다. 이 사실 확인에서 선택 완료로 취급하지 않는다.

## 사용자 최초 요청 원문

최초 전달에서 작업 제목만 작업 설명에 기록되었으므로 아래 전체 조건을 함께 보존한다. 이 원문은 비밀값이나 실제 계정·호스트·DB 경로를 포함하지 않는다.

```text
사용자가 선택한 Notify Me DS-030을 진행해줘.

먼저 AGENTS.md·AGENT.md·docs/decision-register.md·docs/00-master-design.md를 읽고,
docs/09-feature-design-coverage-and-backlog.md의 DS-030 및 §8.8,
§8.9의 “사용 서비스와 개발·테스트 build 분리 — DS-030” 전달 프롬프트를 따라줘.

목표는 개발·테스트 빌드가 사용 중인 웹과 API 릴리스를 변경하지 않도록 분리하는 것이다.
현재 배치 근거는 docs/06-deployment-and-operations.md §7에 있다.

기존 데이터·계정·주소·DS-027 화면 변경과 다른 세션의 미커밋 작업을 보존해줘.
현재 공유 dist에서 build·verify:u1을 실행하지 마.

읽기 전용 재확인 → 최소 변경 계획 → 분리된 환경의 구현·검증 →
구체적인 서비스 전환·복구 절차 준비 순서로 진행해줘.
실제 전환은 AI-DLC 승인 절차를 따라줘.

완료 후 변경·검증·적용 버전·복구 근거·잔여 작업을 이 로드맵 세션에
전달할 수 있도록 정리해줘.
```

사용자는 이후 `infra` 계획 설명을 요청하고 “인프라 계획으로 진행 ㄱㄱ”라고 선택했다(메시지 `6183d73d`). 이는 이 계획 착수이며 실제 서비스 전환 승인이 아니다.

## 답변 요약 확인과 최종 통합

- [답변 요약 확인](practices-discovery-questions.md#consolidated-summary-confirmation)에는 새 일반 질문 없이 다섯 영역의 기존 확정 기준을 정리했다.
- 사용자는 “ㅇㅇ 그렇게하자”(메시지 `839706fc`)로 확인했다. 파일의 확인값은 `[Answer]: Looks correct`이며 부모 진행자가 확인 기록을 성공적으로 남겼다.
- 확인 내용은 타 세션 작업·DS-027 보존과 승인 산출물만 취급, 별도 복사본 build 전후 사용 경로·hash·DB 불변 검증, TDD·개발 루프·80%, 기존 데이터·주소·키·백업 보존과 별도 전환 승인, 기존 언어·도구·한국어 문서 기준이다.
- 이 확인을 근거로 네 산출물을 최종 통합했다. 별도 지원 검토자는 없고 릴리스 담당자가 조사·작성·최종 통합을 수행했다. 새로운 제품 결정·질문 ID를 만들거나 기존 열린 질문을 닫지 않았다.
- 실제 서비스 전환·운영 복구·미커밋 변경 반영·다음 단계에 대한 승인을 이 확인에서 추론하지 않는다.

## 미수행·남은 확인

- build·verify·typecheck·unit/API/E2E·coverage와 실기기·운영 전환·복구는 실행하지 않았다. 현재 단계는 읽기 전용 조사다.
- 네 단계 산출물은 답변 요약 확인 뒤 최종 통합했다. 본 단계 승인·규칙 승격·PR·커밋·푸시·Issue/Pages 게시를 수행하지 않았다.
- 별도 검증 작업 복사본, 고정 릴리스 manifest, 산출물 안전 복사, 웹/API 정합 전환, DB 경계 불변, 서비스 설정 복구 절차의 구현·검증은 후속 단계에 남아 있다.
