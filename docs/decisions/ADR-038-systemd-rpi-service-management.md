# ADR-038: MVP Raspberry Pi에서 systemd로 서비스 실행

- 상태: 승인됨
- 작성일: 2026-11-10
- 관련 결정: `D-025`, `D-077`
- 관련 요구사항: `F-OPS-001`, `F-OPS-002`, `F-OPS-004`, `PR-AC-062`, `NFR-REL-007`
- 관련 상세 설계: [배포·운영](../06-deployment-and-operations.md), `DS-008`

## 맥락

MVP 서버는 단일 Raspberry Pi에서 NestJS API와 Worker를 실행한다. 정전·재부팅 뒤 사람의 수동 key 입력 없이 시작하고, 비정상 종료 때 복구하며, 운영자가 최소한의 서비스 상태와 로그를 확인해야 한다(`D-025`, `NFR-REL-007`).

선택지는 호스트의 `systemd`가 Node.js 프로세스를 직접 감독하는 방식과 Docker Compose가 컨테이너 환경·수명주기를 관리하는 방식이다. systemd 방식은 단일 RPi에서 설치 구성요소를 줄이고 Linux 서비스 도구와 바로 연결한다. Docker Compose는 실행환경을 이미지로 고정해 다른 호환 장비에 배포하기 편하지만, MVP에는 Docker 엔진·이미지·볼륨 관리가 추가된다.

## 결정

MVP에서는 NestJS 장기 실행 프로세스를 호스트 `systemd` 서비스로 직접 실행한다. 부팅 시 자동 시작하며 비정상 종료는 `systemd`가 재시작한다. 애플리케이션 로그는 표준 출력·오류로 내보내 `journald`에서 확인한다.

운영자는 systemd 서비스 상태와 최근 로그, 공개 Caddy 경로에 노출되지 않는 로컬 헬스체크, 디스크·메모리 사용량과 백업 결과를 명령으로 확인한다. 별도 대시보드를 만들지 않는다. 같은 앱 프로세스의 재시작 책임은 한 supervisor만 맡는다.

MVP에서는 Docker를 사용하지 않는다. 향후 Docker Compose 이전을 막지 않도록 애플리케이션 실행환경과 영속 데이터·설정·비밀값을 분리한다. Docker 이미지를 만들거나 이전하는 작업 자체는 MVP에 포함되지 않으며, 실제 이전 시 SQLite 백업·복원과 기동 검증을 별도로 수행한다.

구체적인 unit 개수와 이름, 실행 사용자, 설치·데이터·환경 파일 경로, health endpoint, 로그 보존량, 운영 명령과 재부팅·장애 smoke 절차는 `DS-008`에서 RPi 사양 확인 후 정한다.

## 결과

- 단일 RPi의 초기 운영은 호스트의 systemd·journald 도구로 진단할 수 있다.
- Node.js 버전과 ARM64 native dependency 호환성은 RPi 구축 때 확인·고정해야 한다.
- MVP 서비스 배포는 Docker 이미지에 의존하지 않는다.
- 추후 containerization에는 실행환경과 state/config 경계 확인, 일관된 SQLite 백업·복원, 재기동 검증이 필요하다.
- RPi systemd unit과 host-level smoke는 매 개발 루프가 아니라 배포·운영 변경 시 확인한다(`D-070`, `PR-AC-062`).

## 참고 자료

- [systemd.service — `Restart=` 동작](https://www.freedesktop.org/software/systemd/man/latest/systemd.service.html)
- [Docker Docs — container restart policies](https://docs.docker.com/engine/containers/start-containers-automatically/)
- [Docker Docs — persistent storage](https://docs.docker.com/engine/storage/)
