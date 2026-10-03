# 칸 격자

| 항목 | 값 |
|---|---|
| 상태 | 구현 |

## 요약

칸 격자(`grid`)는 구조 그림 안에 칸 단위로 나뉜 도형 하나를 그린다. 비트 필드, 배열, 스택 슬롯, 행렬처럼 칸의 폭과 순서가 뜻인 자료를 칸마다 글 하나로 적는다. 격자는 elkjs 배치에서 크기가 고정된 도형 하나이고, 칸 하나를 `light`로 밝히거나 선 끝으로 쓸 수 있다. 칸에서 나가는 선은 이웃 칸 글을 가리지 않고 행 사이 통로로 돌아 격자 밖으로 나간다.

## 동기

16비트 주소를 윗 10비트와 아랫 6비트로 나누는 그림은 두 필드의 폭이 10 대 6이어야 읽힌다. 상자 두 개로는 폭이 글 길이를 따라가 비율이 깨지고, 테이블은 열 이름과 타입을 적는 스키마라 값이 든 칸을 둘 수 없다. 배열의 칸 순서, 행렬의 빈 칸, 길게 늘어선 항목을 건너뛴 자리도 상자와 카드로는 적을 수 없어, 개발 문서에서 가장 자주 나오는 이 그림들을 그림 도구 밖에서 따로 그려야 했다.

## 예시

### 비트 필드의 10 대 6 폭

```text
flow down
title "가상 주소를 VPN과 오프셋으로 나눈다"

grid va "가상 주소 (16비트)" cols=16 {
  item vpn "VPN (10비트)" col=0 cols=10
  item offset "오프셋 (6비트)" col=10 cols=6
}
grid pa "물리 주소 (16비트)" cols=16 {
  item pfn "PFN (10비트)" col=0 cols=10
  item offset "오프셋 (6비트)" col=10 cols=6
}
va -> pa "페이지 표 조회"

step "나누기" "윗 10비트는 페이지 번호이고 아랫 6비트는 페이지 안의 위치다"
  light va.vpn
  light va.offset
step "바꾸기" "페이지 번호만 프레임 번호로 바뀌고 오프셋은 그대로 간다"
  va -> pa "VPN을 PFN으로"
  light pa.pfn
  light pa.offset
```

1. `va`와 `pa`는 16칸 폭 격자이고, `vpn`은 10칸, `offset`은 6칸을 차지한다. 칸 폭은 10 대 6이다.
2. `va -> pa`는 격자 전체를 잇는 선이다. 격자는 상자처럼 위아래로 놓인다.
3. 첫 단계에서 두 칸이 밝아지고, 둘째 단계에서 점이 선을 지난 뒤 `pa`의 두 칸이 밝아진다.

### 칸을 합치고, 비우고, 글을 길게 쓰기

```text
flow right
title "페이지 표 항목의 필드"

box mmu "MMU" "주소 변환"
grid pte "페이지 표 항목 (PTE)" rows=4 cols=6 {
  item frame "프레임 번호" row=0 col=0 rows=2 cols=3
  item valid "V" row=0 col=3
  item dirty "D" row=0 col=4
  item ref "R" row=0 col=5
  item prot "권한 (읽기, 쓰기, 실행)" row=1 col=3 cols=3
  item note "참조 비트는 CPU가 접근할 때 켜고, 운영체제가 주기적으로 지워 최근에 쓰지 않은 페이지를 교체 후보로 고른다" row=2 col=0 rows=2 cols=5
}
mmu -> pte "조회"

step "상태" "유효, 수정, 참조 비트는 운영체제가 읽고 지운다"
  light pte.valid pte.dirty pte.ref
```

1. `frame`은 가로 3칸, 세로 2칸을 차지하는 합친 칸이다.
2. `note`는 긴 한글 글이라 칸 안에서 줄을 바꾸고, 그 줄이 들어가도록 모든 행이 같이 높아진다.
3. 마지막 열의 아래 두 자리에는 칸이 없어 점선 테두리의 빈 칸으로 남는다.

### 칸에서 칸으로 잇기

```text
flow right
title "가상 칸에서 페이지 표 행을 거쳐 물리 칸으로"

grid virt "가상 주소 공간" rows=3 {
  item p0 "페이지 0" row=0
  item p1 "페이지 1" row=1
  item p2 "페이지 2" row=2
}
grid table "페이지 표" rows=3 cols=3 {
  item hp "Page" row=0 col=0
  item hf "Frame" row=0 col=1
  item hg "Flags" row=0 col=2
  item p1 "1" row=1 col=0
  item f1 "7" row=1 col=1
  item g1 "RW" row=1 col=2
  item p2 "2" row=2 col=0
  item f2 "3" row=2 col=1
  item g2 "R" row=2 col=2
}
grid phys "물리 메모리" rows=4 {
  item fr3 "프레임 3" row=0
  gap skip "…" count=3 row=1
  item fr7 "프레임 7" row=2
}
virt.p1 -> table.p1
virt.p2 -> table.p2
table.f1 -> phys.fr7
table.f2 -> phys.fr3

step "조회" "페이지 1은 표의 둘째 행을 거쳐 프레임 7로 간다"
  virt.p1 -> table.p1 "페이지 1"
  light table.f1
  table.f1 -> phys.fr7 "7"
  light phys.fr7
```

1. `virt.p1`처럼 칸을 선 끝으로 쓴다. 칸이 격자의 왼쪽 가장자리에 걸치면 칸에서 바로 나가고 들어온다(`virt.p1`에서 `table.p1`로).
2. 표의 가운데 열 `table.f1`은 격자 안쪽 칸이라 그 아래 빈 줄(통로)로 내려가 격자 오른쪽으로 나간다. 통로는 행 사이를 벌린 빈 줄이라 이웃 칸 글을 가리지 않는다.
3. 이동은 `칸 -> 칸`으로 선을 고른다. 두 격자 사이 선이 하나뿐이면 `virt -> table`로 줄여 쓸 수 있다.

## 상세 설계

### 문법

| 줄 | 뜻 |
|---|---|
| `grid id "제목" [rows=N] [cols=N] {`, `}` | 격자. 구조 그림에서만 쓰고 그룹 안에도 둘 수 있다. 두 줄 사이에 칸을 둔다 |
| `item id "글" [row=N] [col=N] [rows=N] [cols=N]` | 값이 든 칸 |
| `gap id "글" count=N [row=N] [col=N] [rows=N] [cols=N]` | 생략한 칸. 글 뒤에 `×N`을 붙여 그린다 |
| `light 격자 격자.칸` | 격자 전체나 칸 하나를 밝힌다. 칸은 `item`만 밝힌다 |
| `격자.칸 -> 도형` , `도형 -> 격자.칸`, `격자.칸 -> 격자.칸` | 칸을 선 끝으로 쓴다. 같은 격자의 서로 다른 두 칸도 이을 수 있다(라벨 없음). 이동도 같은 이름으로 적는다 |

- 선택 사항의 값 형식과 판은 [그림 문법](figure-syntax.md#호환-규칙)의 문법 표가 정본이다. `rows`, `cols`의 기본값은 1이고, `row`, `col`의 기본값은 0이다.
- `row`와 `col`은 화면 좌표가 아니라 격자 안의 논리 인덱스다. 0부터 센다.
- 칸 이름은 격자 안에서만 겹치지 않으면 된다. 다른 격자의 칸과 같은 이름을 써도 되고, 격자 밖에서는 `격자.칸`으로 부른다. 격자 이름은 다른 도형, 그룹 이름과 겹치지 않는다.
- 오류: 크기가 0 이하이거나 정수가 아닌 값, 음수 인덱스, 격자 밖으로 나가는 칸, 겹치는 칸, 같은 칸 이름, `count` 없는 `gap`, 칸 없는 격자, 닫지 않은 격자, 격자 밖의 `item`과 `gap`, 격자 안의 다른 문장은 줄 번호가 붙은 원본 오류다.
- `grid`, `item`, `gap`은 이름 자리에서 예약어가 아니다. 이 낱말을 도형, 그룹, 칸, 테이블 열 이름으로 쓴 원본은 그대로 읽힌다. 첫 낱말 자리에 오는 `grid`만 격자 선언이다.
- `gap`은 선이나 이동의 끝이 될 수 없고 밝힐 수도 없다. 생략된 항목을 가리키려면 `item`으로 꺼내 쓴다. 칸(`a -> 격자.칸`)과 격자 전체(`a -> 격자`) 모두 선 끝으로 쓸 수 있다.
- 칸 선 끝의 오류: 없는 칸(가까운 이름을 제안), `gap`, 점이 둘 이상인 이름, 같은 칸으로 가는 선, 라벨을 쓴 두 칸 선은 줄 번호가 붙은 원본 오류다.
- 카드(`show`)는 격자에 쓰지 않는다. 칸이 이미 격자의 내용이다.

### 크기

크기는 [배치](layout.md)의 도형 크기 단계(2단계)에서 정하고, elkjs에는 그 사각형을 그대로 넘긴다.

- 칸 단위(가로, 세로)는 모든 행과 열에서 같다. 칸은 차지한 단위 수만큼 커져서, 합친 칸의 폭과 높이는 단위의 정수배다.
- 가로 단위는 칸마다 `(글 폭 + 안쪽 간격) / 차지한 열 수`를 구해 가장 큰 값으로 정한다. 글 폭은 `size.node.max-width`에서 도형 안쪽 간격을 뺀 값을 넘지 않는다. 글이 짧아도 토큰 `size.grid.cell`보다 좁아지지 않고, 제목이 격자보다 넓으면 제목이 들어갈 만큼 넓어진다.
- 칸 글은 칸 폭 안에서 줄을 나눈다. 세로 단위는 칸마다 `(줄 수 × 줄 높이 + 안쪽 간격) / 차지한 행 수`를 구해 가장 큰 값으로 정한다. 글이 긴 칸이 하나 있으면 모든 행이 그 높이로 같이 높아진다. 일부 칸만 늘려 비율을 깨뜨리지 않기 위해서다.
- 격자는 칸 묶음의 위에 제목 줄을 두고, 틀과 칸 사이 간격은 `space.6`이다.
- 칸이 없는 자리는 단위 하나짜리 빈 칸으로 그린다. 격자 크기에 비례해 걸리므로 긴 줄은 `gap`으로 접는다.

### 배치

- 격자는 `table`과 같은 도형이다. elkjs는 내부 칸을 모르고, 선은 격자 테두리의 네 면 어디나 닿는다. 그룹 안에 둘 수 있다.
- 칸 위치는 격자 왼쪽 위가 원점인 사각형으로 도형 크기와 함께 장면에 남는다(`scene.items[].cells`, `empties`). 그리는 코드와 글 상자 자리 계산이 같은 값을 쓴다.
- 칸을 이은 선은 칸이 걸친 격자 면에서 바로 나가거나, 걸치지 않은 안쪽 칸이면 칸 아래 통로를 거쳐 격자 옆면으로 나간다. 통로가 있으면 행 사이가 벌어지고 칸 폭 비율은 그대로다. 면 고르기, 통로 크기, 줄 배정은 [배치](layout.md#칸-연결점과-통로)가 정본이다.
- 한 줄짜리 비트 띠는 칸이 위아래 면에 모두 걸쳐 세로 흐름에서는 위아래 면으로, 가로 흐름에서는 칸 아래 통로로 나간다.

### 그리기와 색

- 틀과 칸은 `color.node` 면과 `color.border` 윤곽이고 글은 `color.fg`다. 생략 칸(`gap`)은 `color.surface` 면에 점선 윤곽과 `color.muted` 글이다. 빈 자리는 면 없이 점선 윤곽만 그린다.
- 밝힌 칸은 `color.card-on` 면에 `color.state.active` 윤곽(굵기 `border.edge`)이다. 이웃 칸과 맞닿은 변을 이웃 칸의 평소 윤곽이 덮어도 파랑이 보이게 한 굵기이고, 도형 `light`의 파랑 윤곽과 같은 색이다. 칸을 밝히는 전환(`duration.fast`) 도중에는 면만 먼저 옅게 보이므로, 밝힌 칸은 전환이 끝난 뒤의 모습으로 판단한다. 파랑은 "지금 일어나는 것"만 뜻하므로 값의 크고 작음을 이 색으로 나타내지 않는다.
- 이 짝들은 모두 [대비 기준](docs-integration.md#대비-기준)의 기존 짝(글자와 면, 경계와 면, 강조 그래픽과 면)이라 새 색 역할이 없다. 크기와 간격은 토큰 `size.grid.cell`과 기존 `space.*`뿐이다.

### 시간 흐름

- `light 격자.칸`은 도형의 `light`와 같은 박자 규칙이다. 한 단계 안에서 밝힌 칸은 남고 다음 단계가 시작하면 꺼진다. 시간표의 `partsOn`에 `격자.칸` 이름으로 들어가고, HTML 재생기와 움직이는 SVG가 같은 값을 읽는다.
- `light 격자`는 격자 틀을 밝히고 칸은 밝히지 않는다. 칸의 `light`도 틀을 밝히지 않는다.
- 멈춘 SVG는 칸을 밝히지 않는다.

### 요구사항

| 요구사항 | 검증 계획 |
|---|---|
| 칸의 너비와 높이는 차지한 칸 수에 비례한다(10 대 6 비트 필드, 합친 칸). | `test/layout.test.js`의 `buildFigure_grid_cells_are_as_wide_and_tall_as_the_units_they_occupy`. 10칸과 6칸, 8칸과 1칸, 2행과 1행 칸의 폭과 높이 비 확인 |
| 글이 긴 칸은 칸 안에서 줄을 바꾸고 모든 행의 높이가 같다. | `test/layout.test.js`의 `buildFigure_grid_long_korean_text_wraps_inside_its_cell_and_rows_keep_one_height`. 긴 한글 칸이 여러 줄이고 strict로 통과하는지 확인 |
| 칸이 없는 자리는 빈 칸이고, 칸끼리 겹치지 않으며 모두 격자 안에 있다. | `test/layout.test.js`의 `buildFigure_grid_positions_without_a_cell_stay_empty_and_every_cell_stays_inside_the_frame`. 칸과 빈 자리 사각형이 서로 겹치지 않는지 확인 |
| 격자는 구조 그림에서 크기가 고정된 도형 하나로 배치되고, 선은 격자 테두리에 닿는다. | `test/layout.test.js`의 `layoutGraph_box_sizes_equal_measured_sizes`(잰 크기와 같음), `buildFigure_grid_between_flow_boxes_is_one_shape_whose_edges_end_on_its_border` |
| 칸 자리와 선택 사항을 어긴 원본, 격자 밖 칸, 틀린 칸 연결, 밝힐 수 없는 칸을 줄 번호와 함께 알린다. | `test/grammar.test.js`의 `parseFigure_malformed_source_reports_the_line_and_the_rule`(격자 행) |
| `grid`, `item`, `gap`을 이름으로 쓴 옛 원본이 그대로 읽힌다. | `test/grammar.test.js`의 `parseFigure_valid_forms_read_without_errors`(격자 낱말 행), `test/compat.test.js`의 `compat_v1_every_fixture_builds_without_errors_and_matches_the_structure_snapshot`(`all-grid.muto`) |
| 문법 표에 모든 낱말과 선택 사항이 판 1로 있고 고정 묶음이 쓴다. | `test/compat.test.js`의 `compat_v1_covers_every_word_option_and_value_in_the_grammar_table`, `test/grammar.test.js`의 `grammarDoc_figure_syntax_tables_equal_the_tables_made_from_the_grammar` |
| 칸 `light`는 도형 `light`와 같은 박자 규칙이다. | `test/motion.test.js`의 `buildTimeline_grid_cell_light_stays_for_the_rest_of_the_step_like_a_node_light` |
| 칸에서 칸으로 가는 선이 칸 테두리에서 나가고 들어오며, 안쪽 칸으로 가는 선도 이웃 칸을 지나지 않는다. | `test/layout.test.js`의 `buildFigure_grid_cell_edges_start_and_end_on_their_cell_and_never_cross_another_cell_flow_right`, `..._flow_down`, `buildFigure_grid_edge_between_two_cells_of_one_grid_stays_inside_the_grid_frame`. 그림 검사 3번(칸), 4번(칸 테두리)이 strict 빌드에서 같은 규칙을 지킨다 |
| 합친 칸, 비트 띠, 같은 면에서 나가는 여러 선, 한 격자의 두 칸을 잇는 선이 섞여도 오류가 없다. | `npm run fuzz`(구조 그림에 칸 선 끝이 섞인다). [배치](layout.md)의 요구사항 표와 같은 명령 |
| 칸 면, 글, 윤곽은 모든 면에서 대비 기준을 넘는다. | `test/contrast.test.js`의 `contrast_text_pairs_reach_4_5_in_both_themes`, `contrast_graphic_pairs_reach_3_in_both_themes`. 칸이 쓰는 `fg`, `muted`, `border`, `state.active`와 `node`, `surface`, `card-on` 짝이 이 입력에 이미 들어 있다 |
| 문서의 예시와 예제 그림이 오류와 경고 없이 만들어지고 움직임이 시간표와 같다. | `test/grammar.test.js`의 `docExamples_every_design_doc_example_builds_without_errors_or_warnings`, `test/motion.test.js`의 `toSvg_moving_packets_match_the_timeline_at_every_example`(`examples/address-bits.muto` 외 세 파일 포함) |
| 올바른 무작위 구조 그림(칸 격자가 섞인)이 배치 오류나 그림 검사 오류가 되지 않는다. | `npm run fuzz`(구조 그림의 4분의 1이 칸 격자를 담는다). [배치](layout.md)의 요구사항 표와 같은 명령 |

## 단점

- 칸 단위가 모든 행과 열에서 같아서, 폭이 서로 다른 열이나 높이가 서로 다른 행은 쓸 수 없다. 글이 긴 칸 하나가 모든 행을 높인다.
- 칸 안에는 글만 둔다. 칸 안 도형, 칸의 색 구분, 수치 농도는 없다.
- 칸 선 끝이 안쪽 칸으로 돌아야 하면 행 사이가 벌어져 격자가 높아진다. 한 통로에 선이 많으면 `space.5`씩 더 벌어진다.
- 선이 칸 면에서 나가는 자리는 칸 폭을 고르게 나눈 곳이라 직접 고를 수 없다. 면 지정(`from-side`)은 없다.
- 빈 자리와 칸을 모두 그려서 SVG 크기가 격자 크기에 비례한다. 칸 하나만 선언한 격자가 100x100이면 SVG 0.73MB, 200x200이면 2.9MB, 400x400이면 11.6MB다(2026-10-03 측정). 폭이 넘치면 [그림 검사](figure-check.md) 10번이 경고한다.

## 미해결 질문

- 큰 격자의 칸 수에 한도를 두고 `gap`으로 접게 강제할지. ([#28](https://github.com/woonyong-choi/mutoscope/issues/28))
