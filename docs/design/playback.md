# 재생

| 항목 | 값 |
|---|---|
| 상태 | 구현 |
| 관련 결정 | [그림 문법과 배치를 직접 맡고 D2 호환을 버린다](../decisions/2026-10-01-own-syntax-and-layout.md) |

## 요약

재생은 시간 흐름을 박자 순서로 보여 주는 기능이다. 모든 그림 종류와 차트가 같은 시간표 형식을 쓰고, 결과는 세 가지다. HTML은 단계 탭, 일시정지, 배속, 전체 화면이 있는 재생기이고, 움직이는 SVG는 스크립트 없이 모든 단계를 이어 반복하며, 멈춘 SVG는 그림 전체 구조를 보이는 한 장이다.

## 동기

설계 문서의 그림은 "무엇이 어디로 가는지"를 보여야 하는데, 멈춘 그림은 순서를 보여 주지 못한다. README는 스크립트를 실행하지 않아 움직이는 SVG가 따로 필요하고, 인쇄와 PDF에는 멈춘 그림이 필요하다. 구조 그림과 차트가 다른 재생 방식을 쓰면 문서 안에서 조작과 속도가 달라진다.

## 예시

### HTML에서 한 단계 다시 보기

1. 사용자가 그림의 HTML을 연다.
2. 첫 단계가 재생되고, 탭 아래 막대가 단계 진행만큼 찬다.
3. 사용자가 둘째 탭을 누르면 둘째 단계의 첫 박자 상태로 바뀐다. 차트라면 첫 단계에서 드러낸 계열도 함께 보인다.

### README에 움직이는 그림 넣기

1. 사용자가 `docs/assets/architecture.svg`를 README에 이미지로 넣는다.
2. GitHub가 이미지를 보이면 모든 단계가 이어 재생되고, 그림 아래에 단계 이름과 설명이 바뀌어 보인다. GitHub는 README의 SVG 이미지에서 CSS keyframes와 SMIL 움직임을 실행한다(2026-10-01 확인, 이 저장소 README).

## 상세 설계

### 시간표

시간표는 박자 구간(segment)의 목록이다. 원본을 읽고 배치한 뒤 한 번 만들고, 세 결과가 같은 시간표를 쓴다.

| 구간 값 | 뜻 |
|---|---|
| `si`, `bi` | 단계 번호와 박자 번호 |
| `t0`, `t1` | 그림 전체에서 이 박자의 시작과 끝(ms) |
| `move` | 점이 선을 지나는 시간. 이동이 없으면 0 |
| `hops` | 이동 목록. 선 번호, 거꾸로 여부, 글 상자 줄, 글 상자 자리 계획 `chipPath`(진행 비율마다 `[비율, dx, dy, 불투명도]`) |
| `edgesOn`, `nodesOn`, `partsOn` | 보이는 선, 밝은 도형과 그룹, 밝은 부분(테이블 열, 격자 칸) |
| `cards`, `cardsBefore`, `cardsAt` | 카드 내용과 바뀌는 시점([그림 문법](figure-syntax.md)의 도착 규칙) |
| `series`, `growing`, `lights` | 차트에서 보이는 계열, 이 박자에 자라는 계열, 밝힌 행 |
| `labelShifts` | 막대 차트 행마다 이름을 세로로 옮길 거리(px) 목록. 행의 보이는 막대 묶음 가운데로 맞춘다. 계열이 모두 보이면 0이고, 막대 차트가 아니거나 계열이 하나면 빈 목록 |
| `caption` | 그 박자의 설명 |

- 시간표 전체 값은 박자 목록 `segs`, 전체 길이 `total`, 단계 이름 `steps`, 차트 계열이 자라는 시간 `growMs`다.
- 이동 시간(`hops[].ms`)은 `time=`이 있으면 그 값이고, 없으면 선 길이에 비례한다(`선 길이 / size.packet.hop-ref × speed`, 아주 짧은 선만 최소 `duration.hop-min`, 규칙 전체는 [그림 문법](figure-syntax.md) 이동 시간). 선 길이는 배치가 끝난 장면에서 구하므로 시간표는 배치 뒤에 만든다. `move`는 그 박자 이동 시간 가운데 가장 긴 값이다.
- 박자 길이는 `max(move, 자라는 시간) + wait 시간 + 멈춤 시간`이다. 자라는 시간은 차트 `reveal`이 있을 때 `speed`이고, `wait 시간`은 `wait` 박자의 시간이다. 멈춤 시간은 새 설명 글자 수에 비례하고, 토큰 `duration.dwell`보다 짧지 않고 `duration.dwell-max`를 넘지 않는다. 단계 마지막 박자는 토큰 `duration.step-end`만큼 더 멈춘다. 그래서 박자 길이는 늘 0보다 크다.
- 플레이어는 시간표를 읽기만 하고 상태를 다시 계산하지 않는다. `labelShifts`처럼 화면에 필요한 값도 시간표를 만들 때 미리 계산해 담는다.
- 시간표는 상태를 박자마다 완전히 적는다. 앞 박자를 몰라도 그 박자 상태를 그릴 수 있어서, 탭으로 건너뛰어도 상태가 맞다.
- 글 상자 줄은 시간표를 만들 때 토큰 `size.chip.max-width` 너비로 나눈다. HTML과 SVG가 같은 줄을 쓰기 위해서다.

### 박자 상태

| 상태 | 한 단계 안에서 | 단계가 바뀔 때 |
|---|---|---|
| 밝은 선 | 지나간 선 전부 | 초기화 |
| 밝은 도형 | 밝은 선의 양 끝, `light` 대상, 카드가 찬 도형 | 초기화 |
| 카드 내용 | `show`마다 줄이 쌓이고 `clear`로 비워짐 | 초기화 |
| 조용한 선 | 처음 지나는 박자부터 단계 끝까지 보임 | 숨김 |
| 차트 계열 | 드러낸 계열 유지 | 유지 |
| 설명 | 마지막 설명, 없으면 단계 설명 | 새 단계 설명 |

### HTML 재생기

- 점은 경로 위를 출발과 도착이 느린 곡선(토큰 `easing.move`)으로 지난다. 점을 만들면 같은 프레임에 경로 시작점에 둔다.
- 글 상자 자리는 시간표를 만들 때 한 번 정해 이동의 `chipPath`에 담는다. 움직이는 SVG와 재생기는 이 값을 그대로 쓰고 다시 계산하지 않는다. 자리 규칙은 다음과 같다. 점 위가 기본이고, 후보마다 다음 순서로 견주어 가장 나은 것을 쓴다.
  1. 그림 안에 있다. 그림 밖으로 나가면 옆으로 밀어 넣는다. 밀어 넣는 가장자리 여백은 `CHIP_GAP`이 먼저이고, 그 자리가 글자나 도형 테두리를 가리면 `CHIP_CLEAR`까지 줄인 자리도 후보가 된다. 점이 도형 바로 옆의 좁은 틈(도형과 그림 오른쪽 끝 사이)을 지날 때 글 상자가 도형 테두리를 스치는 것을 막으려는 것이다. 가리지 않는 자리가 여백이 넓은 자리보다 앞선다.
  2. 도형 이름과 부제, 테이블 머리와 열 이름과 타입, 그룹 제목(그림에 그려진 글자 사각형)과 겹치지 않는다. 겹치면 점 아래로 내리고, 그래도 겹치면 가리는 글자 사각형 양 끝에 붙게 옆으로 비킨다(점에서 글 상자 반 폭과 간격 안만). 어느 쪽도 안 되면 겹친 넓이가 가장 작은 자리를 쓰고 그림 검사 7번이 경고한다.
  3. 판 위아래 끝에서 `space.14`(판 안쪽 여백) 이상 떨어진다. 글 상자가 판 위쪽 끝에 붙어 보이지 않게 하려고, 점 위의 윗면이 그보다 가까우면 점 아래로 내린다.
  4. 점 위, 점 아래, 옆으로 비킨 점 위, 옆으로 비킨 점 아래 순서다.
- 글 상자는 피할 것에서 최소 간격 `CHIP_CLEAR`(토큰 `space.2`)만큼 떨어져 놓는다(비켜 올리거나 옆으로 비킬 때). 다른 선(자기 선 제외)과 그룹 틀의 변은 가리면 읽을 수 없는 것이 아니라 붙어 보이는 것이라 순위만 낮춘다. 후보 순위는 그림 밖, 가린 글자 넓이, 선과 틀에 `CHIP_CLEAR` 안으로 든 넓이, 판 위아래 끝 여백, 판 좌우 끝 여백(`CHIP_GAP`), 선택 순서다. 선과 틀 때문에 그림 검사 7번이 경고하지는 않는다. 예제와 CS:APP 그림에서 선과 틀 가까이 지나는 글 상자 지점이 6617에서 2238로 줄었다.
- 글 상자가 피하는 것은 글자(도형 이름, 열, 그룹 제목)만이 아니라 도형 테두리(사람 머리와 몸통, 원통 뚜껑 포함, 출발과 도착 노드 포함)와 선 라벨 알약(자기 선의 것도)이다. 그룹 틀은 이동이 그 안에서 일어나므로 제목 글자만 피한다.
- 후보 순서는 아래와 같고, 한 점에서 위 순위로 견준 값이 후보의 비용이다. 1) 점 위. 2) 가리는 것을 조금 비켜 올린 자리(점에서 `CHIP_ANCHOR_MAX` 안까지). 3) 선 반대쪽인 점 아래, 그리고 그것을 조금 내린 자리. 4) 가리는 사각형 양 끝에 붙게 옆으로 비킨 자리. 점에서 글 상자 반 폭과 간격 안이면 먼저, 더 멀면 마지막이다. 5) 그래도 겹치면 그림 검사 7번이 경고한다.
- 글 상자는 점에서 가장자리까지 `CHIP_ANCHOR_MAX`(`space.22`, 44px) 안에 있을 때만 보인다. 선 라벨 알약이 선 위에 있어 점 위가 막히면 위 순서대로 알약 반대쪽(점 아래), 알약과 나란히(알약 옆), 그래도 안 되면 그 구간에서 글 상자를 점을 따라가며 흐리게 한다. 허공에 뜬 자리를 보이느니 흐리는 쪽이 낫다. 거리 상한은 계획이 구성으로 지키므로 그림 검사 항목을 따로 두지 않는다. 흐려진 시간이 이동의 25%를 넘으면 가린 글자가 있는 한 7번이 알린다.
- 이동 전체의 자리는 지점마다 따로 고르지 않고 이동 하나를 통째로 푼다(`src/chip-plan.js`). 계획 지점(2프레임 간격)마다 이동 중 한 번이라도 깨끗했던 자리 종류(점 위, 점 아래, 어느 사각형을 비킨 줄, 어느 사각형 끝 옆)를 모두 다시 만들고, 자리 바꿈 횟수가 가장 적은 열을 동적 계획으로 고른다. 비용은 겹침과 `CHIP_ANCHOR_MAX`보다 멂(10^7, 멀면 넘은 px를 더한다), 자리 바꿈 한 번(10^6), 가까운 선, 판 끝 여백, 선택 순서 차례로 크다. 경로 전체에서 한 자리가 깨끗하면 바꿈 없이 그 자리를 쓰고, 바꿈보다 싸면 쓴다.
- 자리를 바꿔야 하면 순간 이동하지 않는다. 두 자리 사이를 토큰 `duration.chip-slide`(300ms) 이상 시간에 선형으로 미끄러지고, 거리가 멀면 한 프레임에 `CHIP_STEP_MAX`(6px)를 넘지 않게 시간을 2배, 4배로 늘린다. 미끄러지는 중간 프레임이 하나라도 도형, 글자, 알약을 가리거나 그림 밖이면 그 미끄러짐은 쓰지 않는다.
- 계획은 결과를 바꾸지 않는 방법으로 줄여 잰다. 같은 선, 글, 시간, 방향의 이동은 계획을 한 번만 세우고 그림 검사 7번도 그 계획을 쓴다. 겹침과 가까운 선은 격자 색인(`src/chip-grid.js`)으로 글 상자 둘레의 사각형만 재고, 지금 비용을 낮추지 못하는 미끄러짐은 가능한지 재지 않는다. 예제와 문서 그림, CS:APP 그림의 빌드 시간은 `npm run perf`(로컬, CI 아님)가 `scripts/perf-baseline.json` 기준의 1.6배를 넘으면 실패한다. 기준 파일은 잰 그림 목록과 그림마다 내용 해시, 기준 코드의 커밋 해시를 함께 적고, 비교는 그 목록의 그림만 잰다. 그림 내용이 달라졌거나 없어졌으면 비교하지 않고 실패하며, 새 기준은 있는 파일을 덮어쓰지 않고 새 파일(`--write 파일`)로만 쓴다.
- 미끄러질 길이 없으면 바꾸지 않고, 겹치는 구간에서 글 상자를 흐리게 한다(`chipPath`의 불투명도). 겹치는 지점과 그 이웃은 0이고 멀어질수록 토큰 `duration.chip-fade`(150ms)에 걸쳐 1이 된다. 계획 뒤에 60fps 프레임마다 다시 재서 지점 사이에 겹침이 남으면 그 둘레도 흐리게 한다. 흐려진 시간이 이동의 25% 이하면 그림 검사 7번은 알리지 않고, 넘으면 알린다(그림 밖은 늘 알린다).
- 지점은 같은 직선 위에 놓이면 줄인다. 한 자리를 지키는 이동은 지점이 둘이다.
- 점의 자리는 점이 실제로 따라가는 둥근 모서리 경로 기준으로 잰다(꺾은선 기준이면 모서리 뒤에서 점이 몇 px 앞서 글자에 닿는다). 지점 사이는 시간에 선형으로 잇는다(SVG의 `animateTransform`과 재생기가 같다).
- 도형에 마우스를 올리면 닿은 선을 밝힌다. 조용한 선도 그때 보인다.
- 스페이스는 일시정지다. 단추에 초점이 있으면 그 단추를 누르는 키다.
- 전체 화면은 브라우저 전체 화면을 쓰고, 쓸 수 없으면 창을 덮는 모양으로 대신한다. `Esc`로 닫는다.
- 확대, 축소, 끌어 옮기기는 전체 화면에서만 켠다. 문서 안에서는 그림 전체가 보이는 편이 읽기 쉽기 때문이다. 배율은 1배에서 토큰 `scale.zoom-max`배 사이이고, 화면 좌표는 브라우저 변환 행렬로 그림 좌표로 바꾼다.
- `prefers-reduced-motion`이 켜져 있으면 멈춘 채로 시작하고 차트는 다 자란 상태로 그린다.
- iframe 안에서는 테두리를 빼고 틀이 카드 너비를 다 채우며, 본문 높이를 바깥 쪽에 알린다.
- 표시 폭 규칙은 문서 미리보기, 목록 카드, 재생기가 같다. 컨테이너 폭은 화면 폭에서 좌우 바깥 여백(`space.16`)을 둘 뺀 값이고, 그림 표시 폭은 `min(표준 캔버스 폭 size.figure-canvas, 컨테이너 폭)`이다. 컨테이너 최대 폭(`size.document.column`, `size.gallery.column`, 재생기 `.fl-figure`)이 모두 캔버스 폭이라 1400 화면에서는 세 곳 모두 960, 900 화면에서는 세 곳 모두 836이다.
- 이 규칙이 지켜지도록 컨테이너는 그림 둘레에 좌우 여백을 두지 않고, 카드와 재생기 테두리는 레이아웃 폭을 차지하지 않는 고리(`box-shadow`)로 그린다.
- 재생기와 목록 카드는 그림을 캔버스 폭(`size.figure-canvas`, `width wide` 그림은 `size.figure-canvas-wide`) 아래로 줄이지 않고, 화면 높이에 맞춰 줄이지도 않는다. 줄이면 글자가 가장 작은 글 토큰(`size.text`의 최솟값)보다 작아져 읽을 수 없기 때문이다. 세로로 긴 그림은 페이지가 길어지고, 조작 막대는 화면 아래에 붙어 따라온다(`position: sticky`). 화면 폭이 캔버스 폭보다 좁으면(모바일) 그림 영역이 가로로 스크롤되고 가운데에서 시작한다. 문서 미리보기는 README처럼 그림을 컨테이너 폭에 맞춰 줄이되 높이로는 줄이지 않는다. 전체 화면은 확대와 이동이 있어 이 규칙 밖이다.
- 좁은 내용은 viewBox를 가운데로 넓혀 그리고, 넓은 내용은 표시 폭만 줄인다([배치](layout.md)).
- 분할 조작(재생기 탭 묶음, 목록 쪽과 문서 미리보기의 테마 묶음)과 둥근 단추(일시정지, 배속, 전체 화면)는 한 모양이다. 묶음은 바깥 높이 `size.control.outer`(30)에 반지름 `radius.full`이고 안쪽 단추는 `size.control.inner`(22)에 반지름 `radius.full`이다. 탭이 여러 줄로 감기면 높이만 늘어난다.
- 역할은 둘로 나뉜다. 탭은 선택만 맡고, 시간 진행은 일시정지 단추가 맡는다. 탭 안에는 진행 요소를 두지 않고, 끝난 탭과 아직 안 한 탭을 가르는 표시도 없다.
- 탭 묶음은 segmented 방식이다. 묶음 바탕은 `color.bg`이고, 켜진 탭은 `color.ui.control-on` 꽉 찬 알약에 `color.border` 고리(탭 묶음 바탕과 대비 3)를 두른다. `ui.control-on`은 라이트에서 카드 바탕(`color.node`, 흰색)과 같고, 다크에서는 `palette.neutral.750`이다. 켜짐 표시는 면이 아니라 고리가 맡는다. 켜진 탭 글자는 `color.fg`에 `weight.semibold`, 꺼진 탭 글자는 `color.muted`다. 묶음과 원 단추 테두리는 도형 윤곽과 같은 `color.border` 층(대비 3 이상)이고, 카드와 판 바깥 고리(`color.frame`)보다 한 층 진하다.
- 진행 고리는 일시정지 단추 테두리 위를 12시에서 시계 방향으로 도는 `color.ui.progress` 선이다. 트랙은 단추 테두리(`color.border`) 그대로다. 보여 주는 값은 현재 탭(장면) 전체 시간 대비 지난 비율이고, 탭이 바뀌면 0부터 다시 시작한다. 멈추면 고리도 그 자리에 머물고, `prefers-reduced-motion`이어도 값은 갱신한다. 고리 색은 [색 역할 표](docs-integration.md#색-역할)의 `ui.progress`다.
- 고리 크기는 토큰에서 계산한다. 고리는 단추 바깥 테두리(`size.control.outer`)를 덮고, 선 굵기는 `border.edge`, 반지름은 `(size.control.outer - border.edge) / 2`다. 마크업은 `html.js`가 이 값으로 그리고, `player/controls.js`는 마크업의 반지름에서 둘레를 구해 쓴다.
- 조작 막대와 설명 줄은 한 가운데 축을 쓴다. 막대는 `1fr auto 1fr` 격자라 일시정지와 배속 단추가 양옆에 같은 폭을 차지하고, 배속 글자가 `0.5×`로 바뀌어도 탭 묶음과 설명의 가운데가 움직이지 않는다. 조작 줄 안쪽 여백은 위아래 모두 `space.8`이고 막대와 설명 사이는 `space.6`이다. 둥근 단추와 탭의 글자 크기는 `size.text.13`으로 같고, 마우스를 올리면 글자가 `color.fg`로 바뀐다. 초점은 `color.state.active` 고리다.
- 재생기(단독 HTML, 전체 화면)와 목록 쪽 카드 안은 제목 줄, 그림 영역, 조작 줄까지 모두 `color.bg`(라이트 옅은 회색, 다크 어두운 색) 한 톤이다. 카드가 곧 그림 판이라 판이 카드 안에 따로 보이지 않는다. 차트 HTML은 바탕 사각형을 그리지 않고 카드 바탕이 비친다. 숫자 둘레 halo, 선 라벨 알약, 점 테두리는 `color.bg`를 그대로 써서 맞는다. 카드 바깥 목록 쪽 페이지와 단독 재생기의 바깥 여백은 `color.page`(라이트 흰색)라 회색 카드가 흰 바탕 위에 보인다. 둥근 모서리 회색 판(SVG 바탕 사각형)은 문서에 넣는 SVG 파일(움직이는 SVG, 멈춘 SVG)에만 있다. 흰 문서 안에서 그림 경계를 만드는 용도다.

### 움직이는 SVG

- 켜짐과 꺼짐 순서가 같은 요소끼리 CSS keyframes 하나를 나눠 쓴다.
- 켜짐과 꺼짐은 값이 바뀌는 시각에서 `duration.fast`(200ms) 동안 서서히 바뀐다. HTML 재생기의 CSS `transition`과 같은 느낌이 되도록, 앞 구간과 값이 다른 구간은 시작에서 앞 값을 잡고 200ms 뒤 새 값에 닿는 keyframes를 쓰고 `linear`로 잇는다(예전 `step-end`는 단계 끝에서 선 다섯 개와 카드 셋이 한 프레임에 꺼졌다). 재생기 쪽을 SVG에 맞추지 않고 SVG를 재생기에 맞춘 것은, 서서히 바뀌는 쪽이 더 자연스럽고 SVG는 keyframes만으로 같은 모양을 낼 수 있기 때문이다.
- 설명 글과 단계 이름은 교차 페이드하지 않는다. 앞 글이 `duration.caption-fade`(200ms) 동안 사라진 뒤에 뒤 글이 같은 시간 동안 나타나서, 같은 자리의 두 글이 겹쳐 읽히는 프레임이 없다. 움직이는 SVG는 새 글 구간 시작을 그만큼 늦춰 만들고, 재생기는 같은 토큰을 읽어 앞 글을 지운 뒤 뒤 글을 넣는다. 첫 글과 `prefers-reduced-motion`에서는 바로 바꾼다.
- 설명 글 아래 여백은 그림 내용 위 여백(`space.14`)과 같다. 마지막 설명 줄 기준선 아래 `space.2`(글자 내림)와 `space.14`를 둔다.
- 점은 SMIL `animateMotion`으로 경로를 지난다. 곡선은 `keySplines`에 넣은 토큰 `easing.move`라서 HTML 재생기와 같다. 이동 전에는 선의 시작에, 이동 뒤에는 끝에 머문다.
- 점의 보임(`opacity`, 이산 값)과 이동과 글 상자 옮김과 흐려짐은 모두 SMIL이라 한 시계로 돈다. 보임을 CSS keyframes에 두면 CSS와 SMIL 시계가 따로 반복해, 한 바퀴가 돌아올 때 점이 이전 바퀴의 끝 지점에 잠깐 보였다가 시작 지점으로 뛰었다(Chrome 약 50ms, WebKit 30ms 이상 확인). 보임 창과 이동 구간은 같은 keyTimes 값을 쓴다. 선, 도형, 카드의 켜짐은 점과 위치를 다투지 않아 CSS keyframes로 남기고, 시계가 어긋나도 색이 바뀌는 시각만 수십 ms 달라진다.
- 한 바퀴 길이(`dur`)는 시간표 `total`을 1ms 단위로 쓴다. 0.1초로 반올림하면 keyTimes와 퍼센트가 `total` 기준인 채 한 바퀴가 최대 50ms 달라져 HTML 재생기와 어긋난다. keyTimes는 한 바퀴를 1로 본 비율로 소수 다섯째 자리까지 쓰고, 값은 늘어나기만 한다(시작이 0이면 0이 겹치는 키를 만들지 않는다).
- 글 상자는 시간표의 `chipPath`(위 규칙)를 그대로 건다. 이동 곡선을 거꾸로 풀어 점이 그 지점에 닿는 시각을 구한 뒤 SMIL `animateTransform`(옮김)과 `animate`(불투명도)로 그 사이를 잇는다. 모든 지점이 점 위 기본 자리면 옮김을, 모두 불투명이면 불투명도를 넣지 않는다. HTML 재생기는 같은 지점 시각 사이를 같은 방식으로 선형 보간한다.
- 그림 아래에 단계 이름과 설명을 박자에 맞춰 바꿔 보인다. 단계 이름 줄은 본문 글꼴(Inter와 Noto Sans KR, semibold)이고 재생기 탭 글자와 같은 글꼴이다. 고정폭이면 한글 자리가 벌어져 보여서 쓰지 않는다.
- 시간표 전체를 반복한다. 시간 흐름이 없는 차트는 토큰 `duration.chart-cycle`마다 다시 자란다.

### 멈춘 SVG

- 멈춘 SVG는 시간 흐름과 상관없이 모든 선(조용한 선 포함)과 모든 도형을 보이고, 카드는 비우고, 차트는 모든 계열을 다 자란 상태로 그린다. 어느 한 단계의 상태가 아니라 그림 전체의 구조를 보이기 위해서다.
- 점, 글 상자, 단계 이름 줄은 그리지 않는다. 차트의 행 이름도 옮기지 않고 막대 묶음 가운데에 둔다.
- `--static`은 단계가 있는 차트도 첫 단계가 아니라 모든 계열을 다 자란 상태로 그린다. 시간표를 쓰지 않고 `@keyframes`를 만들지 않기 때문이다.

### 결과 파일

| 명령 | 쓰는 파일 |
|---|---|
| `render 원본` | 움직이는 SVG `{이름}.svg` |
| `render 원본 --static` | 멈춘 SVG `{이름}.svg` |
| `render 원본 --html` | `{이름}.svg`와 HTML 재생기 `{이름}.html`. `--static`과 함께 주면 SVG가 멈춘 SVG다 |
| `migrate 원본` | 쓰지 않음. 옛 형식을 고칠 때 바뀔 줄을 표준 출력에 보인다. `--write`면 원본 파일을 고친다([그림 문법](figure-syntax.md#호환-규칙)) |
| `md 문서` | [마크다운 반영과 배포](markdown.md)가 정한다. 블록마다 SVG `{문서 이름}-{이름 또는 순번}.svg`와 문서의 이미지 줄 |
| `gallery 폴더` | 폴더 안 원본마다 `{이름}.svg`와 `{이름}.html`, 목록 쪽 `index.html`, 문서 미리보기 `document.html`. 목록 쪽은 그림마다 HTML과 SVG를 잇는다. 원본이 하나도 없거나 하나라도 오류면 전체가 실패(종료 1)이고 아무 파일도 쓰지 않는다 |

- 한 번의 실행은 `{이름}.svg`를 하나만 쓴다. 움직이는 SVG와 멈춘 SVG가 같은 이름을 다투지 않게 하기 위해서다.
- HTML은 미리보기와 목록 쪽용이다. 문서 저장소에는 SVG만 넣는다([문서 스킬 연동](docs-integration.md)).

### 목록 쪽

- `gallery` 명령은 HTML 결과를 iframe으로 모은 `index.html`을 쓴다.
- `gallery`가 받는 선택 사항은 `--out`, `--title`, `--strict`, `--no-deprecated`, `--require-data`, `--require-ci`이고 `--html`은 받기만 한다(늘 HTML을 쓴다). 그 밖의 선택 사항(`--static`, `--json`)은 사용법 오류(종료 2)다. `--strict`는 폴더의 모든 원본에 걸리고, 경고가 있는 원본이 하나라도 있으면 전체가 실패한다.
- iframe 높이는 그림 쪽이 알린 본문 높이에 맞추고, 카드는 줄에서 가장 긴 카드 높이로 늘이지 않는다.
- 위쪽에 테마 단추 "시스템 / 라이트 / 다크"가 있다. 고르면 목록 쪽과 모든 iframe 그림이 그 모드로 바뀐다.
- 시스템은 루트에 `color-scheme: light dark`를 걸어 OS 설정을 따른다. 라이트와 다크는 루트에 `color-scheme`을 그 값으로 걸고 목록 쪽 자체 색은 토큰 CSS의 `data-theme`로 바꾼다. iframe 안 문서는 Chrome에서 부모의 `color-scheme`을 `prefers-color-scheme`에 안정적으로 받지 못해(OS 다크에서 라이트를 골라도 어둡게 남음), 목록 쪽이 iframe에 `{ theme }` 메시지를 보내고 iframe 문서가 자기 루트의 `data-theme`과 `color-scheme`을 바꾼다. 새로 뜬 iframe은 `themeRequest`로 현재 테마를 받는다.
- 고른 값은 `localStorage`의 `mutoscope-theme`에 기억하고 첫 그림 전에 적용한다. 단독 재생기 HTML에는 이 단추가 없고 OS 설정만 따른다.

### 문서 미리보기

- `document.html`은 README처럼 흰(라이트) 또는 어두운(다크) 문서 바탕에 제목, 문단, 그림마다 움직이는 SVG를 `<img>`로 넣은 쪽이다. GitHub README가 SVG를 넣는 방식과 같아, 회색 판이 문서 위에서 어떻게 보이는지 라이브로 확인한다. 모든 그림이 같은 캔버스 폭이고 `max-width: 100%`라 본문 폭(`size.document.column`, 캔버스 폭과 같다)에 맞춰 목록 카드와 재생기와 같은 폭으로 보인다. 실제 GitHub README는 본문 폭이 880쯤이라 그림이 더 줄어 보이는 점만 이 미리보기와 다르다. 그림 문단은 가운데 정렬(`.figure`)이다. 목록 쪽 카드와 단독 재생기 안의 그림도 가운데에 둔다.
- 위쪽에 목록 쪽과 같은 "시스템 / 라이트 / 다크" 단추와 목록으로 가는 링크가 있고, 목록 쪽 `index.html` 위쪽에는 이 쪽으로 가는 링크가 있다. 고른 테마는 같은 `localStorage` 값을 쓴다.
- 테마는 루트 `color-scheme`으로 바꾼다. Chrome에서는 img로 넣은 SVG의 `prefers-color-scheme`이 이 값을 따른다(OS 다크에서 라이트 단추, OS 라이트에서 다크 단추 모두 확인).

### 요구사항

| 요구사항 | 검증 계획 |
|---|---|
| 박자 상태가 앞 박자와 상관없이 완전하다. | 아무 박자를 골라 시간표만으로 그린 상태와 처음부터 재생한 상태 비교 |
| 목록 쪽 테마 단추가 목록과 iframe 그림을 함께 바꾼다. | `test/pages.test.js`의 `gallery_theme_buttons_set_the_root_color_scheme_and_remember_the_choice`(Chrome이 있을 때). 시스템을 다크로 둔 브라우저에서 실제 자식 HTML을 iframe으로 연 목록 쪽의 라이트 단추를 눌러, 목록 루트와 자식 문서의 테마가 모두 라이트로 바뀌고 자식 문서가 로드를 마쳐 그림을 그렸는지 확인. 카드 전체가 그림과 같은 한 톤인지는 캡처로 본다 |
| 재생기 안에는 그림 바탕 판이 없고, SVG 파일에만 있다. | `test/cli.test.js`의 `main_render_svg_keeps_the_rounded_plate_and_the_html_player_has_none` |
| gallery가 통과하면 안 되는 입력(경고 있는 원본의 `--strict`, 오류 원본 섞임, 원본 없음, 받지 않는 선택 사항)에서 실패하고 파일을 쓰지 않는다. | `test/cli.test.js`의 `main_gallery_fails_without_writing_any_file_when_the_input_must_not_pass`. 반대로 경고만 있는 원본은 `--strict` 없이 통과한다(`main_gallery_still_writes_the_files_for_a_warning_without_strict_and_accepts_its_options`) |
| gallery가 문서 미리보기를 쓴다. | `test/cli.test.js`의 `main_gallery_writes_the_index_and_the_document_preview_with_each_figure_and_a_card_head` |
| 차트 계열은 단계가 바뀌어도 남고, 탭으로 건너뛰어도 보인다. | `test/motion.test.js`의 `buildTimeline_revealed_chart_series_stay_across_steps`. 둘째 탭 상태의 계열 목록 확인 |
| HTML과 움직이는 SVG의 글 상자 줄이 같다. | 두 결과의 글 상자 줄 비교 |
| 그림 옆 경계에 가까운 선의 글 상자는 움직이는 SVG에서도 안으로 밀린다. | `test/chip.test.js`의 `buildFigure_every_example_and_demo_chip_stays_inside_clear_near_its_dot_and_never_jumps_in_any_60fps_frame`(경계 가까운 선 원본 두 개 포함) |
| 이동 글 상자가 모든 예제와 CS:APP, async 데모(`test/fixtures`)에서 60fps 프레임마다 보이는 동안 도형 이름, 열, 그룹 제목, 알약을 가리지 않고 그림 안에 있고 점에서 `CHIP_ANCHOR_MAX` 안이다(선 라벨 알약이 선 위에 있는 재현 원본 `test/fixtures/layout/chip-above-pill.muto` 포함, 이슈 #40). 한 프레임에 점의 움직임보다 `CHIP_STEP_MAX` 넘게 더 움직이지 않는다(순간 이동 없음). 미끄러질 수 있으면 흐리지 않고, 길이 없으면 바꾸지 않고 흐린다. SVG와 재생기가 같은 계획을 쓴다. | `test/chip.test.js`의 `buildFigure_every_example_and_demo_chip_stays_inside_clear_near_its_dot_and_never_jumps_in_any_60fps_frame`, `placeChip_places_the_chip_clear_of_obstacles_or_reports_what_it_cannot_avoid`, `planChip_slides_to_the_other_side_instead_of_jumping_when_one_side_is_blocked_midway`, `planChip_fades_instead_of_switching_when_every_slide_would_cover_something`, `toHtml_and_toSvg_share_the_chip_plan_from_the_timeline`, `test/pages.test.js`의 `player_visible_chip_stays_within_the_anchor_distance_of_its_dot_as_drawn`(Chrome이 있을 때. 그려진 점 원과 글 상자의 `getBoundingClientRect` 간격) |
| 움직이는 SVG의 점이 시간표와 같은 시각에 같은 위치에 있다. keyTimes는 늘어나기만 하고 keySplines 수가 맞으며, 보임 창과 이동 구간이 시간표 이동과 같고, 경로와 점이 한 좌표 그룹에 있다. | `test/motion.test.js`의 `toSvg_moving_packets_match_the_timeline_at_every_example`. 예제마다 25ms 간격으로 SMIL 값을 풀어 시간표 기대와 비교 |
| 전체 화면에서 휠로 확대하면 커서 아래 지점이 고정된다. | 브라우저에서 확대 전후 커서 아래 그림 좌표 비교 |
| 멈춘 SVG는 모든 선과 계열을 보이고 움직임이 없다. | `test/motion.test.js`의 `toSvg_static_output_has_no_motion_and_shows_every_series`. 결과에 `@keyframes`와 `animateMotion`이 없는지, 단계가 있는 차트는 모든 계열이 숨김 없이 있는지 확인 |
| 막대 차트 행 이름이 보이는 막대와 세로로 맞는다. | `test/chart.test.js`의 `buildTimeline_bar_label_shift_follows_the_visible_bars_and_is_zero_when_all_are_shown`, `drawChart_bar_label_of_a_row_with_a_missing_series_is_centered_on_its_only_bar` |
| 조작 막대의 탭 묶음과 설명이 한 가운데 축에 있고, 탭 묶음 높이가 둥근 단추 높이와 같다. | `test/pages.test.js`의 `player_controls_share_one_axis_and_height_and_the_ring_and_active_tab_show_state`(Chrome이 있을 때). `getBoundingClientRect`로 가운데 축 차이 1px 이하, 높이 차이 1px 이하 확인 |
| 현재 탭의 진행은 일시정지 단추 둘레의 고리로 보이고 시간에 따라 채워진다. | `test/pages.test.js`의 `player_controls_share_one_axis_and_height_and_the_ring_and_active_tab_show_state`(Chrome이 있을 때). 고리가 단추를 감싸고 `stroke-dashoffset`이 줄어드는지 확인 |
| 탭은 segmented 방식이라 켜진 탭만 채운 알약 면과 굵은 글을 갖는다. | `test/pages.test.js`의 `player_controls_share_one_axis_and_height_and_the_ring_and_active_tab_show_state`(Chrome이 있을 때). 켜진 탭과 나머지 탭의 계산된 글 굵기, 면, 글 색 비교 |

## 단점

- 움직이는 SVG는 마우스 반응과 탭이 없다.
- 시간표가 박자마다 상태를 다 적어서 박자가 많으면 HTML이 커진다.

## 대안

- 박자마다 바뀐 것만 적는 시간표: 탭으로 건너뛸 때 앞 박자를 다시 계산해야 하고, HTML과 SVG가 같은 계산을 두 번 구현해야 해서 버렸다.
