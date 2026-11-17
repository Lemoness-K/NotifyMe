# Notify Me — 디자인 시스템 매핑

## 목적과 기준 입력

- `wireframes`: [저충실도 화면 구성](../../ideation/rough-mockups/wireframes.md)
- `user-flow`: [핵심 사용자 흐름](../../ideation/rough-mockups/user-flow.md)
- `stories`: [승인된 사용자 스토리](../user-stories/stories.md)
- `requirements`: [요구사항](../requirements-analysis/requirements.md)
- `team-practices`: [팀 실천](../practices-discovery/team-practices.md)
- 현재 단계는 화면 역할과 토큰 이름을 매핑한다. 저장소에서 아직 확정하지 않은 브랜드 팔레트, 글꼴 파일, 로고, 컴포넌트 라이브러리 또는 수치를 사실처럼 정의하지 않는다.
- 향후 제품 UI 가이드는 의미 기반 토큰과 공통 view 표현 계층을 바꾸어 적용한다. 도메인 상태, 권한, 저장 동작과 API 계약은 시각 테마에 종속시키지 않는다.

## 토큰 원칙

- 토큰은 색상 이름(`blue-600`)이 아니라 목적(`color.action.primary`)으로 명명한다. 브랜드 가이드가 확정되면 의미 토큰이 실제 색상·타이포그래피 값으로 연결된다.
- 한 토큰은 하나의 표현 책임을 가진다. 상태, 경계, 텍스트와 배경의 관계를 분리해 다크 모드나 새 브랜드 적용 시 의미를 보존한다.
- 모든 상태·선택·오류는 색상 단독으로 구분하지 않는다. 문자, 아이콘, 모양 또는 설명을 함께 제공한다.
- 레이아웃 값은 고정 화면 종류보다 콘텐츠 fit과 관계된 역할로 둔다. 고정된 viewport 최소 지원 폭을 token으로 만들지 않는다.
- 시스템 문구 리소스는 locale 별도로 관리한다. 사용자 작성 Reminder 텍스트는 locale formatter나 번역 리소스에 넣지 않는다.

## 의미 토큰 카탈로그

| 토큰 그룹 | 의미 토큰 예시 | 사용 위치 | 추후 값 결정 원칙 |
|---|---|---|---|
| Text | `color.text.primary`, `color.text.secondary`, `color.text.disabled`, `color.text.inverse` | 제목, 설명, 보조 정보, 비활성 표시 | 본문·큰 글자별 WCAG 텍스트 대비를 충족한다. |
| Surface | `color.surface.canvas`, `color.surface.raised`, `color.surface.selected`, `color.surface.overlay` | 페이지, 카드, 선택 행, 대화상자 | 주변 텍스트·경계와 구분하고 상태 의미를 색상에만 두지 않는다. |
| Action | `color.action.primary`, `color.action.secondary`, `color.action.destructive`, `color.action.focus` | 저장, 보조 동작, 영구 삭제, 키보드 초점 | 조작 가능성과 초점 상태가 인접 배경에서 식별되도록 한다. |
| Status | `color.status.info`, `color.status.success`, `color.status.warning`, `color.status.error` | 동기화, 권한, 완료·놓침·건너뜀, 검증 대기 | 각 상태는 텍스트 레이블과 필요시 아이콘을 함께 갖는다. |
| Border | `color.border.default`, `color.border.strong`, `color.border.error` | 입력 경계, 카드 분리, 오류 필드 | 구분이 필요한 UI 구성요소는 인접 색상 대비를 검사한다. |
| Typography | `type.display`, `type.heading`, `type.body`, `type.label`, `type.caption` | 페이지 제목, 섹션 제목, 본문, 필드, 보조 정보 | 한국어·영어의 글꼴 fallback, 길이, 줄바꿈과 확대를 모두 검토한다. |
| Spacing | `space.inline.*`, `space.stack.*`, `space.section.*` | 필드 내부, 목록 항목, 화면 섹션 | 체계는 후속 UI 가이드가 정한다. 현재 단계에서 임의 숫자 scale을 강제하지 않는다. |
| Shape | `shape.control`, `shape.card`, `shape.dialog` | 버튼·입력, 목록 카드, 확인 대화상자 | 모양이 선택·오류·위험 상태를 단독으로 뜻하지 않게 한다. |
| Focus | `focus.ring`, `focus.offset` | 키보드 초점 표시 | 화면 위에서 보이고 주변 요소와 구분되는 표시를 사용한다. |
| Motion | `motion.transition.short`, `motion.transition.layout` | 메뉴·필터·반응형 재배치 | 상태 이해에 불필요한 애니메이션을 줄이고 OS의 동작 감소 설정을 고려한다. |

## 화면 컴포넌트 매핑

| 화면 역할 | 컴포넌트 역할 | 토큰·상태 연결 | 내용·동작 출처 |
|---|---|---|---|
| 공통 헤더와 내비게이션 | 앱 셸, 선택 목적지, 프로필 메뉴 | `color.surface.canvas`, `color.text.primary`, `focus.ring`, 선택 목적지의 텍스트·아이콘 표시 | D-079, US1.1, US5.6 |
| 할 일 보기 | 세 보기 선택, 섹션 헤더, Reminder 행 | `color.surface.selected`, `color.status.*`, `color.action.primary` | D-078, US5.1–US5.3 |
| Reminder 생성·수정 | 필드, 구성원 picker, Trigger 선택, 반복 editor, 저장 footer | `color.border.*`, `color.text.*`, `color.status.error`, 입력 focus | US2.1–US2.3, US3.1–US3.2, US4.2 |
| 회차 동작과 검증 | 상태 badge, 완료·검증 action, 결과 메시지 | `color.status.*`와 상태 텍스트·아이콘, `color.action.*` | US2.4, US7.1–US7.2; Q-063 미결정 범위 보존 |
| 이력과 보관함 | 상태 이력 행, restore action, 삭제 확인 | `color.status.*`, `color.surface.raised`, `color.action.destructive` | US2.6–US2.7, US5.4–US5.5 |
| 설정 | 범주 탐색, scope 정보, locale 선택, OS 설정 링크 | `color.surface.selected`, `color.text.secondary`, `focus.ring` | US6.1–US6.4 |
| 조회·저장 피드백 | skeleton, empty panel, inline error, status message | `color.surface.*`, `color.status.*`, `motion.transition.*` | 모든 화면의 loading·empty·success·error·partial 상태 |

## 콘텐츠와 반응형 매핑

- `layout.content.readable`: 넓은 화면에서 본문 줄 길이를 제한하는 역할이다. 실제 폭 값은 검증 중 읽기 편한 경계를 정한 뒤 UI 가이드에서 확정한다.
- `layout.navigation.primary`: 목적지와 프로필이 가로로 들어맞으면 헤더 안에 배치한다. 들어맞지 않으면 하단 탐색이 있는 compact 구조로 바꾼다. 전환 기준은 사용 가능한 너비와 텍스트 길이다.
- `layout.form.related`: 짧고 의미상 함께 읽는 필드(예: 날짜와 시간)만 나란히 둔다. 좁은 폭·확대·가상 키보드에서는 단일 열로 되돌린다.
- `layout.list.item`: 상태, 제목, 메타데이터, 동작의 우선순위를 유지하고 텍스트 길이에 따라 높이를 늘린다. 내용 잘림으로 상태·담당자·시각이 사라지지 않게 한다.
- 반응형 스타일은 기기 category 또는 물리 pixel에 결합하지 않는다. 제품은 고정 최소 화면 너비를 선언하지 않는다. WCAG 2.1 AA Reflow의 320 CSS px 상당 조건은 적합성 검사를 위한 viewport이며 제품 지원 경계가 아니다 ([W3C WCAG 2.1 SC 1.4.10](https://www.w3.org/TR/WCAG21/#reflow)).
- `ko-KR`과 `en-US`에서 제목·버튼·보조 문구의 길이가 다를 수 있으므로 고정 너비 레이블, 절대 위치 텍스트와 한 줄 강제를 피한다. 날짜·시간은 locale과 승인된 IANA timezone 규칙을 따른다.

## 브랜드 가이드 적용 경로

1. 제품 브랜드 색상·서체·로고·일러스트 자산이 결정되면 값과 라이선스 출처를 UI 가이드에 추가한다.
2. 실제 값을 위 의미 토큰에 바인딩하고, 텍스트·비텍스트 대비를 확인한다.
3. 공통 버튼, 입력, 선택, 목록, dialog와 피드백 역할을 view 계층에 매핑한다.
4. 한국어·영어의 확대·줄바꿈, 키보드 초점과 반응형 전환을 다시 확인한다.
5. 새 시각 체계가 도메인 상태나 API 의미를 바꾸지 않았는지 관련 story acceptance criteria와 대조한다.

## 미결정 범위

- 브랜드 색·서체·로고, 실제 토큰 값, icon set과 motion preference는 확정하지 않는다.
- 지도/장소 검색 UI provider는 결정하지 않는다.
- Q-063 검증 정책과 Q-064 운영 보고·장애 알림 전달 정책에 종속되는 화면은 만들지 않는다.
- 관련 추적: `NFR6.1`, `NFR-UX-001`, `US5.6`, `US6.2`–`US6.3`, Q-063, Q-064.

## 텍스트 대체 설명

Notify Me는 브랜드 값이 아직 정해지지 않은 의미 기반 디자인 토큰을 사용한다. 공통 화면 역할은 사용자가 보는 콘텐츠 폭과 현지화 문구에 따라 재배치되고, 상태·접근성 표시를 색상만으로 전달하지 않으며, 이후 브랜드 스타일을 표현 계층에 연결할 수 있다.
