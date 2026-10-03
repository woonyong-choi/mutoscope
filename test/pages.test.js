// 페이지: 목록 쪽(gallery)과 문서 미리보기가 브라우저에서 보이는 모양(docs/design/playback.md 문서 미리보기, layout.md 카드 머리).
// Chrome이 없으면 건너뛴다. 경로는 CHROME_PATH로 바꿀 수 있다.
import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { after, before, describe, test } from 'node:test';
import { chromium } from 'playwright-core';
import { buildFigure } from '../src/build.js';
import { CHIP_ANCHOR_MAX } from '../src/chip.js';
import { toDocument, toGallery, toHtml } from '../src/html.js';
import { values } from '../src/tokens.js';
import { withFolder } from './helpers.js';

const CHROME = [process.env.CHROME_PATH, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].find((path) => path && existsSync(path));
const SKIP = CHROME ? false : 'Chrome이 없다';
const FIGURES = [{ name: 'call-registers', title: '호출 중 레지스터 값의 변화', kind: 'flow', isChart: false, href: 'call-registers' }];
const WIDTH = 1400;
const GAP_TOLERANCE = 0.5;
const AXIS_TOLERANCE = 1;
const RING_WAIT_MS = 600;
const SEMIBOLD = 600;
const CHIP_FIGURES = ['test/fixtures/layout/chip-above-pill.muto', 'examples/memory.muto'];
const CHIP_SAMPLES = 9;
const CHIP_SHOWN_MIN = 0.1;
const CAPTION = '단계 설명 글. 막대와 같은 가운데 축에 놓인다.';
const CODE_FIGURE = 'flow right\nbox a "일반 `code` 글"\nbox b "B"\na -> b "보냄"\nstep "s"\n  a -> b';
const BAR_FIGURE = 'chart bar\nx "정확도(%)"\nseries a "A"\nrow "항목" a=3\nrow "둘째" a=5';

// cost: time O(page), heap O(page), stack O(1), io page
// vars: page = 페이지 하나를 여는 비용
// basis: estimate
// HTML을 연 페이지로 body(page)를 돌린다. html이 문자열이면 page.html 하나고, 객체면 { 파일 이름: 내용 }이며 page.html을 연다(iframe 자식 문서를 같이 둘 때). 끝나면 임시 폴더를 지운다.
function withPage(browser, html, body) {
  return withFolder(async (folder) => {
    for (const [name, text] of Object.entries(typeof html === 'string' ? { 'page.html': html } : html)) writeFileSync(join(folder, name), text);
    const page = await browser.newPage({ viewport: { width: WIDTH, height: 900 }, colorScheme: 'dark' });
    await page.goto(`file://${join(folder, 'page.html')}`);
    await body(page);
    await page.close();
  });
}

describe('pages', { skip: SKIP }, () => {
  let browser;
  before(async () => {
    browser = await chromium.launch({ executablePath: CHROME });
  });
  after(async () => {
    await browser.close();
  });

  // 근거: 버그 #18 "카드 머리의 제목과 파일 이름이 붙어 나옴": 제목, 파일 이름, 꼬리표 사이는 space.3이고 한 줄에 놓인다
  test('cardHead_title_name_and_kind_are_apart_by_the_token_gap_on_one_line', async () => {
    for (const html of [toGallery(FIGURES, '예제'), toDocument(FIGURES, '예제')]) {
      await withPage(browser, html, async (page) => {
        const [title, name, kind] = await Promise.all(['h2 .title', 'h2 .name', 'h2 .kind'].map((selector) => page.locator(selector).first().boundingBox()));

        assert.ok(name.x - (title.x + title.width) >= values.space['3'] - GAP_TOLERANCE, `제목과 파일 이름 사이 ${name.x - (title.x + title.width)}`);
        assert.ok(kind.x - (name.x + name.width) >= values.space['3'] - GAP_TOLERANCE, `파일 이름과 꼬리표 사이 ${kind.x - (name.x + name.width)}`);
        for (const box of [name, kind]) assert.ok(Math.abs(box.y + box.height / 2 - (title.y + title.height / 2)) < title.height, '한 줄에 놓인다');
      });
    }
  });

  // 근거: 설계 playback.md 요구사항 "조작 막대와 설명이 한 가운데 축", "탭 묶음과 둥근 단추의 높이가 같다", "탭은 segmented 방식", "진행 표시는 일시정지 단추 고리"(사용자 결정)
  test('player_controls_share_one_axis_and_height_and_the_ring_and_active_tab_show_state', async () => {
    const html = await toHtml(await buildFigure(readFileSync(new URL('../examples/memory.muto', import.meta.url), 'utf8'), { baseDir: 'examples' }), 'memory');
    await withPage(browser, html, async (page) => {
      await page.evaluate((text) => { document.querySelector('.fl-caption').textContent = text;
        document.querySelector('.fl-rate').textContent = '0.25×';
      }, CAPTION);
      const box = (selector) => page.locator(selector).first().boundingBox();
      const center = (b) => b.x + b.width / 2;
      const [tabs, caption, bar, pause, ring, round] = await Promise.all(['.fl-tabs', '.fl-caption', '.fl-bar', '.fl-pause', '.fl-ring', '.fl-pause'].map(box));
      const offsetAt = () => page.evaluate(() => Number.parseFloat(getComputedStyle(document.querySelector('.fl-ring-fill')).strokeDashoffset));
      const first = await offsetAt();
      await page.waitForTimeout(RING_WAIT_MS);
      const style = await page.evaluate(() => {
        const read = (el) => { const c = getComputedStyle(el); return { weight: Number(c.fontWeight), background: c.backgroundColor, color: c.color }; };
        const on = document.querySelector('.fl-tabs button.on');
        const off = [...document.querySelectorAll('.fl-tabs button:not(.on)')].find(Boolean);
        return { on: read(on), off: read(off), group: getComputedStyle(document.querySelector('.fl-tabs')).backgroundColor };
      });

      assert.ok(Math.abs(center(tabs) - center(caption)) <= AXIS_TOLERANCE, `탭과 설명의 축 차이 ${center(tabs) - center(caption)}`);
      assert.ok(Math.abs(center(tabs) - center(bar)) <= AXIS_TOLERANCE, '탭 묶음이 조작 막대 가운데에 있다');
      assert.ok(Math.abs(tabs.height - round.height) <= AXIS_TOLERANCE, `탭 묶음 높이 ${tabs.height}, 둥근 단추 높이 ${round.height}`);
      assert.ok(Math.abs(center(ring) - center(pause)) <= AXIS_TOLERANCE && ring.width >= pause.width, '진행 고리가 일시정지 단추 둘레에 있다');
      assert.ok(first > (await offsetAt()) || first === 0, '고리 채움이 시간에 따라 늘어난다');
      assert.ok(style.on.weight >= SEMIBOLD && style.off.weight < SEMIBOLD, '켜진 탭만 굵은 글');
      assert.notEqual(style.on.background, style.group, '켜진 탭은 묶음 바탕과 다른 알약 면');
      assert.notEqual(style.on.color, style.off.color);
    });
  });

  // 근거: 설계 layout.md 요구사항 "차트 숫자는 tabular-nums", "고정폭 글꼴은 코드에만"(사용자 결정)
  test('player_chart_numbers_are_tabular_and_monospace_is_used_only_for_code', async () => {
    const chart = await toHtml(await buildFigure(BAR_FIGURE), 'bar');
    await withPage(browser, chart, async (page) => {
      const variants = await page.$$eval('.chart-value, .chart-tick', (nodes) => nodes.map((n) => getComputedStyle(n).fontVariantNumeric));

      assert.ok(variants.length > 0 && variants.every((v) => v.includes('tabular-nums')), variants.join());
    });
    const flow = await toHtml(await buildFigure(CODE_FIGURE), 'code');
    await withPage(browser, flow, async (page) => {
      const families = await page.evaluate(() => {
        const mono = (el) => /Mono/.test(getComputedStyle(el).fontFamily);
        const plain = [...document.querySelectorAll('svg .label, svg .edgelabel, .fl-tabs button, .fl-rate, .fl-caption')];
        return { plainMono: plain.filter(mono).length, codeMono: [...document.querySelectorAll('svg .code')].every(mono), codeCount: document.querySelectorAll('svg .code').length };
      });

      assert.equal(families.plainMono, 0);
      assert.ok(families.codeCount > 0 && families.codeMono);
    });
  });

  // 근거: 설계 playback.md 요구사항 "목록 쪽 테마 단추가 목록과 iframe 그림을 함께 바꾼다"(루트 color-scheme과 고른 값 저장), 감사 C9 "실제 자식 HTML 없이 루트만 확인했다"
  test('gallery_theme_buttons_set_the_root_color_scheme_and_remember_the_choice', async () => {
    const child = await toHtml(await buildFigure(CODE_FIGURE), 'call-registers');
    await withPage(browser, { 'page.html': toGallery(FIGURES, '예제'), 'call-registers.html': child }, async (page) => {
      await page.waitForFunction(() => document.querySelector('iframe').style.height !== '');
      const frame = page.frames().find((f) => f !== page.mainFrame());
      const labels = await page.locator('.theme button').allTextContents();
      await page.click('.theme button[data-mode="light"]');
      await frame.waitForFunction(() => document.documentElement.getAttribute('data-theme') === 'light');

      assert.deepEqual(labels, ['시스템', '라이트', '다크']);
      assert.equal(await page.evaluate(() => document.documentElement.style.colorScheme), 'light');
      assert.equal(await page.evaluate(() => localStorage.getItem('mutoscope-theme')), 'light');
      assert.equal(await frame.evaluate(() => document.readyState), 'complete');
      assert.ok(await frame.locator('svg').count() > 0, '자식 문서에 그림이 있다');
    });
  });

  // 근거: 이슈 #40, 설계 playback.md 요구사항 "점에서 CHIP_ANCHOR_MAX 안". 브라우저에 그려진 점 원과 글 상자의 getBoundingClientRect로 잰다
  test('player_visible_chip_stays_within_the_anchor_distance_of_its_dot_as_drawn', async () => {
    let shown = 0;
    for (const file of CHIP_FIGURES) {
      const result = await buildFigure(readFileSync(file, 'utf8'), { baseDir: 'examples' });
      const html = await toHtml(result, 'chip');
      await withFolder(async (folder) => {
        writeFileSync(join(folder, 'page.html'), html);
        const page = await browser.newPage({ viewport: { width: WIDTH, height: 900 } });
        for (const [i, seg] of result.timeline.segs.entries()) {
          const hop = seg.hops.find((h) => h.data);
          if (!hop) continue;
          const first = result.timeline.segs.findIndex((s) => s.si === seg.si);
          await page.clock.install({ time: 0 });
          await page.goto(`file://${join(folder, 'page.html')}`);
          await page.locator('[role=tab]').nth(seg.si).click();
          let now = 0;
          for (let k = 1; k <= CHIP_SAMPLES; k++) {
            const at = seg.t0 - result.timeline.segs[first].t0 + (hop.ms * k) / (CHIP_SAMPLES + 1);
            await page.clock.runFor(at - now);
            now = at;
            const drawn = await page.evaluate(() => {
              const packet = [...document.querySelectorAll('.fl-packet')].find((g) => g.querySelector('rect'));
              const dot = packet.querySelectorAll('circle')[1].getBoundingClientRect();
              const box = packet.querySelector('rect').getBoundingClientRect();
              const [cx, cy] = [dot.x + dot.width / 2, dot.y + dot.height / 2];
              return { opacity: Number(packet.querySelector('rect').parentNode.style.opacity || 1), gap: Math.hypot(Math.max(box.x - cx, 0, cx - box.right), Math.max(box.y - cy, 0, cy - box.bottom)) };
            });
            if (drawn.opacity < CHIP_SHOWN_MIN) continue;
            shown += 1;
            assert.ok(drawn.gap <= CHIP_ANCHOR_MAX + GAP_TOLERANCE, `${file} seg${i} ${k}/${CHIP_SAMPLES}: 글 상자가 점에서 ${drawn.gap.toFixed(1)}px 떨어진다`);
          }
        }
        await page.close();
      });
    }
    assert.ok(shown > 10, `잰 표본 ${shown}개`);
  });
});
