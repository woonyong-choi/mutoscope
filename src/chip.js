// 점 위에 뜨는 글 상자의 크기와 자리. 움직이는 SVG, 재생기, 그림 검사가 시간표에 담은 같은 계획을 쓴다(docs/design/playback.md 이동 글).
import { measure } from './measure/fonts.js';
import { STYLE } from './measure/sizes.js';
import { values } from './tokens.js';

const SPACE = values.space;
/** 글 상자와 점 사이 간격 */
export const CHIP_GAP = SPACE['6'];
/** 글 상자가 판 위아래 끝에서 떨어져야 하는 거리. 판 안쪽 여백(그림 둘레 여백)과 같다. */
export const CHIP_MARGIN = SPACE['14'];
// 이름 글자와 겹친 넓이가 이 값 이하면 겹침 없음으로 본다(잰 글 폭의 반올림 차이)
export const OVERLAP_SLACK = 0.5;
// 잰 글 폭의 반올림 차이를 넘기 위한 여유
const FIT_SLACK = 0.5;
/** 보이는 글 상자 가장자리가 점에서 떨어질 수 있는 최대 거리. 이보다 멀어지는 자리는 쓰지 않고 그 구간은 흐리게 한다. */
export const CHIP_ANCHOR_MAX = SPACE['22'];
/** 글 상자가 도형, 글자, 알약, 다른 선, 그룹 틀에서 떨어져야 하는 최소 간격. 비켜 놓는 자리는 이만큼 띄운다. */
export const CHIP_CLEAR = SPACE['2'];
// 가리는 것을 비켜 올리거나 내리는 최대 거리. 올린 자리가 CHIP_ANCHOR_MAX 안에 있게 정한다.
const LIFT_MAX = CHIP_ANCHOR_MAX - CHIP_GAP;
// 후보 선택 순서 가중치. 점 위 0, 올림 0.3, 점 아래 1, 옆으로 비킴 2(가까움)와 4(멂). 아래 줄의 옆 후보도 이 값에 더해 순서가 섞이지 않는다
const ROW_LIFT = 0.3;
const ROW_BELOW = 1;
const SIDE_NEAR = 2;
const SIDE_FAR = 4;
// 후보 순위에서 옆으로 비킨 거리를 가르는 가중치. 후보 종류(위, 아래, 옆)의 순서를 넘지 않을 만큼 작다
const SHIFT_WEIGHT = 1 / 10000;
// 세로 줄 종류마다 선택 순서 가중치와 윗면. 윗면은 점 위 기본 윗면 above, 글 상자, 가리는 사각형 o로 정한다.
const ROW_ORDER = { above: 0, below: ROW_BELOW, lift: ROW_LIFT, drop: ROW_BELOW + ROW_LIFT };
const ROW_TOP = {
  above: (above) => above,
  below: (above, chip) => above + chip.h + CHIP_GAP * 2,
  lift: (above, chip, o) => o.y - chip.h - CHIP_CLEAR,
  drop: (above, chip, o) => o.y + o.h + CHIP_CLEAR,
};

// cost: time O(l·n), heap O(1), stack O(1)
// vars: l = 줄 수, n = 줄 글자 수
// basis: estimate
/** 글 상자 크기. 줄은 시간표가 이미 나눴다. */
export function sizeChip(lines) {
  const w = Math.max(...lines.map((line) => measure(line, STYLE.chip.size, STYLE.chip.face))) + SPACE['9'];
  return { w, h: lines.length * STYLE.chip.line + SPACE['4'] };
}

/** 두 사각형의 겹친 넓이 */
export function overlapArea(a, b) {
  return Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
}

// cost: time O(a²), heap O(a), stack O(1)
// vars: a = 피할 사각형 수
// basis: estimate
/**
 * 점 point 위의 글 상자 자리. 후보마다 아래 순서로 견주어 가장 나은 것을 쓴다.
 * 1. 그림 안에 있다. 2. 피할 사각형(글자, 도형 테두리, 선 라벨 알약)과 겹치지 않는다(겹치면 겹친 넓이가 작은 쪽). 3. 판 위아래 끝에서 CHIP_MARGIN 이상 떨어진다.
 * 4. 선택 순서는 점 위 그대로, 가리는 것을 비켜 조금 더 올린 자리, 선 반대쪽(점 아래)과 그것을 조금 더 내린 자리, 가리는 사각형의 양 끝에 붙게 옆으로 비킨 자리(점에서 글 상자 반 폭과 간격 안), 그보다 멀리 옆으로 비킨 자리다.
 * 점에서 CHIP_ANCHOR_MAX보다 먼 자리는 후보로 남지만 chip-plan이 쓸 수 없는 자리로 보아 그 구간을 흐리게 한다. 가리면 그림 검사(check.js)가 경고한다.
 * 옆으로는 그림 밖으로 나가지 않게 밀어 넣는다. 가장자리 여백(CHIP_GAP)을 지킨 자리가 가리면 여백을 CHIP_CLEAR까지 줄인 자리를 쓴다. 가려지지 않는 자리가 여백보다 앞선다.
 * @param field { scene, avoid }. scene은 { width, height }, avoid는 { x, y, w, h, name }[]
 * @returns { dx, dy, box, gap, isOutside, hits }. dx, dy는 점 위 기본 자리에서 옮긴 양, box는 그림 좌표의 글 상자 사각형이다. hits는 겹친 이름 목록이다
 */
export function placeChip(point, chip, field) {
  const best = chipCandidates(point, chip, field).reduce((a, b) => (compare(a.rank, b.rank) <= 0 ? a : b));
  const { rank, key, desc, ...placed } = best;
  return placed;
}

// cost: time O(a²), heap O(a), stack O(1)
// vars: a = 피할 사각형 수
// basis: estimate
/**
 * 점 point 위의 글 상자 후보 모두. 후보마다 desc(세로 줄, 가로 기준, 여백 종류)와 그 글 `key`가 있다. 같은 desc는 점이 움직여도 같은 종류의 자리라, chipCandidateAt이 다른 점에서 다시 만든다.
 * isWide면 가리지 않는 사각형이라도 글 상자 높이 안에 있으면 그 옆 줄을 후보로 더한다(이동 계획용). 점이 다가가면 곧 가릴 사각형 바로 옆 자리를 이동 내내 이어 쓰기 위해서다.
 * @returns { key, desc, dx, dy, box, isOutside, hits, rank }[]. rank는 [그림 밖, 겹친 넓이, 가까운 선 넓이, 위아래 끝 여백 부족, 가장자리 여백 부족, 선택 순서]이고 작을수록 낫다
 */
export function chipCandidates(point, chip, { scene, avoid = [], isWide = false, index }) {
  const ctx = { point, chip, scene, avoid, isWide, index };
  return rowDescs(ctx).flatMap((row) => sideDescs(ctx, rowFor(ctx, row).top).flatMap((side) => insetsOf(ctx, side).map((inset) => candidateOf(ctx, descOf(row, side, inset)))));
}

// cost: time O(a), heap O(1), stack O(1)
// vars: a = 피할 사각형 수
// basis: estimate
/** chipCandidates가 돌려준 desc(field에 담아 넘긴다)의 후보를 다른 점 point에서 다시 만든다. 바깥 틀(가리는 사각형 번호)이 같으면 같은 종류의 자리다. */
export function chipCandidateAt(point, chip, { scene, avoid = [], desc, index }) {
  return candidateOf({ point, chip, scene, avoid, index }, desc);
}

// cost: time O(a), heap O(a), stack O(1)
// vars: a = 피할 사각형 수
// basis: estimate
// 지금 점에서 만들 세로 줄 desc: 점 위, 점 아래, 점 위(아래)를 가리는 것 위로 올린(내린) 자리. 올리고 내리는 거리는 LIFT_MAX 안이다.
function rowDescs(ctx) {
  const { point, chip, avoid } = ctx;
  const above = point.y - chip.h - CHIP_GAP;
  const below = above + chip.h + CHIP_GAP * 2;
  const band = ctx.isWide ? chip.h : 0;
  const covering = (top) => avoid.flatMap((o, i) => (o.x < point.x + chip.w / 2 && point.x - chip.w / 2 < o.x + o.w && o.y < top + chip.h + band && top - band < o.y + o.h ? [i] : []));
  const lifts = covering(above).filter((i) => above - rowFor(ctx, ['lift', i]).top <= LIFT_MAX).map((i) => ['lift', i]);
  const drops = covering(below).filter((i) => rowFor(ctx, ['drop', i]).top - below <= LIFT_MAX).map((i) => ['drop', i]);
  return [['above'], ['below'], ...lifts, ...drops];
}

// cost: time O(1), heap O(1), stack O(1)
// basis: estimate
// 세로 줄 desc의 윗면과 선택 순서 가중치. dy는 점 위 기본 자리에서 옮긴 양이다.
function rowFor({ point, chip, avoid }, [kind, i]) {
  const above = point.y - chip.h - CHIP_GAP;
  const top = ROW_TOP[kind](above, chip, avoid[i]);
  return { top, order: ROW_ORDER[kind], dy: top - above };
}

// cost: time O(a), heap O(a), stack O(1)
// vars: a = 피할 사각형 수
// basis: estimate
// 가로 desc: 점 바로 위(아래)와, 같은 높이 띠의 사각형 양 끝에 붙는 자리.
function sideDescs({ chip, avoid }, top) {
  const ends = avoid.flatMap((o, i) => (o.y < top + chip.h && top < o.y + o.h ? [['end', i, 'r'], ['end', i, 'l']] : []));
  return [['mid'], ...ends];
}

// cost: time O(1), heap O(1), stack O(1)
// basis: estimate
// 가로 desc의 중심과 선택 순서 가중치. 점에서 반 폭과 간격 안이면 order 2, 더 멀면 4다.
function sideFor({ point, chip, avoid }, [kind, i, end]) {
  if (kind === 'mid') return { center: point.x, order: 0 };
  const center = end === 'r' ? avoid[i].x + avoid[i].w + chip.w / 2 + CHIP_CLEAR : avoid[i].x - chip.w / 2 - CHIP_CLEAR;
  return { center, order: Math.abs(center - point.x) <= chip.w / 2 + CHIP_GAP ? SIDE_NEAR : SIDE_FAR };
}

// cost: time O(1), heap O(1), stack O(1)
// basis: estimate
// 가로 중심을 그림 안으로 밀어 넣은 자리. 가장자리 여백 CHIP_GAP을 지킨 자리('gap')와, 그 자리가 막히면 쓰라고 여백을 CHIP_CLEAR까지 줄인 자리('clear')다.
function fitInset({ chip, scene }, center, inset) {
  const margin = inset === 'gap' ? CHIP_GAP : CHIP_CLEAR;
  return Math.min(scene.width - chip.w / 2 - margin, Math.max(chip.w / 2 + margin, center));
}

// cost: time O(1), heap O(1), stack O(1)
// basis: estimate
// 여백 desc 목록. 두 자리가 같으면 하나다.
function insetsOf(ctx, [kind, i, end]) {
  const { center } = sideFor(ctx, [kind, i, end]);
  return fitInset(ctx, center, 'gap') === fitInset(ctx, center, 'clear') ? ['gap'] : ['gap', 'clear'];
}

// desc 한 부분의 이름. 부분은 길이 1~3의 목록이고 `:`로 이은 글과 같다(배열을 만들지 않고 잇는다).
function partName([kind, index, end]) {
  if (index === undefined) return kind;
  return end === undefined ? `${kind}:${index}` : `${kind}:${index}:${end}`;
}

// cost: time O(1), heap O(1), stack O(1)
// basis: estimate
/** 세로 줄, 가로 기준, 여백 종류로 만든 desc. key는 같은 종류의 자리를 점이 움직여도 알아보는 이름이다. */
export function descOf(row, side, inset) {
  return { row, side, inset, key: `${partName(row)}/${partName(side)}/${inset}` };
}

// cost: time O(a), heap O(1), stack O(1)
// vars: a = 피할 사각형 수
// basis: estimate
// desc 하나의 후보
function candidateOf(ctx, desc) {
  const side = sideFor(ctx, desc.side);
  return candidateAt(ctx, { row: rowFor(ctx, desc.row), x: fitInset(ctx, side.center, desc.inset), order: side.order }, desc);
}

// cost: time O(a) 색인이 없을 때, O(m) 있을 때, heap O(m), stack O(1)
// vars: a = 피할 사각형 수, m = 글 상자 둘레 칸에 걸린 사각형 수(a 이하)
// basis: estimate
// 후보 하나의 자리와 순위. index(chip-grid.js)가 있으면 글 상자 둘레의 사각형만 잰다. 번호 순서를 지켜 합이 같다.
function candidateAt({ point, chip, scene, avoid, index }, { row, x, order: sideOrder }, desc) {
  const box = { x: x - chip.w / 2, y: row.top, w: chip.w, h: chip.h };
  // 선과 그룹 틀은 최소 간격 안에 들어와도 순위만 낮춘다.
  const padded = { x: box.x - CHIP_CLEAR, y: box.y - CHIP_CLEAR, w: box.w + CHIP_CLEAR * 2, h: box.h + CHIP_CLEAR * 2 };
  const { hits, area, nearArea } = overlapsOf({ box, padded }, avoid, index?.near(padded));
  const isOutside = isOutsideFigure(box, scene);
  const isTight = row.top < CHIP_MARGIN - FIT_SLACK || row.top + chip.h > scene.height - CHIP_MARGIN + FIT_SLACK;
  const isCrowded = Math.min(box.x, scene.width - box.x - box.w) < CHIP_GAP - FIT_SLACK;
  const order = row.order + sideOrder + (Math.abs(x - point.x) + Math.abs(row.dy)) * SHIFT_WEIGHT;
  return { dx: x - point.x, dy: row.dy, box, gap: gapToPoint(box, point), isOutside, hits, rank: [Number(isOutside), area, nearArea, Number(isTight), Number(isCrowded), order], key: desc.key, desc };
}

// cost: time O(m), heap O(h), stack O(1)
// vars: m = 잴 사각형 수(ids가 있으면 그 수, 없으면 avoid 전체), h = 가리는 이름 수
// basis: estimate
// 글 상자와 겹치는 도형, 글자, 알약의 이름과 겹친 넓이 합, 선과 그룹 틀(soft)과 간격을 둔 상자의 겹친 넓이 합. ids는 잴 번호(오름차순)이고 없으면 모두 잰다.
function overlapsOf({ box, padded }, avoid, ids) {
  const hits = [];
  let [area, nearArea] = [0, 0];
  for (let k = 0; k < (ids ? ids.length : avoid.length); k++) {
    const o = avoid[ids ? ids[k] : k];
    if (o.soft) nearArea += overlapArea(padded, o);
    else if (overlapArea(box, o) > OVERLAP_SLACK) {
      hits.push(o.name);
      area += overlapArea(box, o);
    }
  }
  return { hits, area, nearArea };
}

// cost: time O(r), heap O(1), stack O(1)
// vars: r = 순위 항목 수(6)
// basis: estimate
function compare(a, b) {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
}

/** 점에서 사각형 가장자리까지 거리. 점이 사각형 안이면 0이다. */
export function gapToPoint(box, point) {
  return Math.hypot(Math.max(box.x - point.x, 0, point.x - box.x - box.w), Math.max(box.y - point.y, 0, point.y - box.y - box.h));
}

/** 사각형이 그림 밖으로 나가는지(잰 글 폭의 반올림 차이는 넘긴다) */
export function isOutsideFigure(box, scene) {
  return box.x < -FIT_SLACK || box.y < -FIT_SLACK || box.x + box.w > scene.width + FIT_SLACK || box.y + box.h > scene.height + FIT_SLACK;
}
