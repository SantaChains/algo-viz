import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  ActionIcon,
  Box,
  Button,
  Group,
  Text,
  Title,
  useComputedColorScheme,
  useMantineColorScheme,
} from '@mantine/core';
import {
  IconArrowUpRight,
  IconArrowsSort,
  IconGraph,
  IconGridDots,
  IconLetterCase,
  IconMoon,
  IconSearch,
  IconSun,
  IconTarget,
} from '@tabler/icons-react';
import type { Icon } from '@tabler/icons-react';
import { FlowField } from './FlowField';
import styles from './Home.module.scss';

const REPO_URL = 'https://github.com/SantaChains/algo-viz';

type Card = { id: string; index: string; name: string; desc: string; count: string; span: 's5' | 's4' | 's3'; code?: string };

// 卡片计数与 desc 须与 src/algorithms/index.ts 的 demos 注册表保持一致（着陆页为代码分割不导入注册表，故手写）
const CATEGORY_CARDS: Card[] = [
  { id: 'sorting', index: '01', name: '排序', desc: '冒泡 · 快速', count: '02', span: 's5', code: '07  swap(a[j], a[j+1])' },
  { id: 'search', index: '02', name: '查找', desc: '二分查找', count: '01', span: 's3' },
  { id: 'dp', index: '03', name: '动态规划', desc: 'LIS · 编辑距离', count: '02', span: 's4' },
  { id: 'graph', index: '04', name: '图论', desc: 'DFS · BFS · Dijkstra · A*', count: '04', span: 's4' },
  { id: 'greedy', index: '05', name: '贪心', desc: '区间调度', count: '01', span: 's3' },
  { id: 'string', index: '06', name: '字符串', desc: 'KMP 匹配', count: '01', span: 's5' },
];

const REFERENCES = [
  { name: 'algorithm-visualizer', url: 'https://github.com/algorithm-visualizer/algorithm-visualizer' },
  { name: 'aoright/Algorithm-Visualizer', url: 'https://github.com/aoright/Algorithm-Visualizer' },
];

// 分类图标与实验室导航（Shell）保持一致，首页与内页同一套图标语言
const CATEGORY_ICONS: Record<string, Icon> = {
  sorting: IconArrowsSort,
  search: IconSearch,
  dp: IconGridDots,
  graph: IconGraph,
  greedy: IconTarget,
  string: IconLetterCase,
};

/** 卡片右上角算法族徽标：纯静态 stroke SVG，零运行时成本，hover 点亮 */
const MOTIFS: Record<string, ReactNode> = {
  sorting: (
    <svg viewBox="0 0 64 32" aria-hidden="true">
      <path d="M6 28V16 M16 28V8 M26 28V20 M36 28V4 M46 28V12 M56 28V22" />
    </svg>
  ),
  search: (
    <svg viewBox="0 0 64 32" aria-hidden="true">
      <path d="M4 16h56" />
      <path d="M14 11v10 M24 11v10 M44 11v10 M54 11v10" opacity="0.45" />
      <circle cx="34" cy="16" r="6" />
    </svg>
  ),
  dp: (
    <svg viewBox="0 0 64 32" aria-hidden="true">
      <path d="M12 26 32 16 52 6" opacity="0.45" />
      <circle cx="12" cy="26" r="3" />
      <circle cx="32" cy="16" r="3" />
      <circle cx="52" cy="6" r="3" />
      <circle cx="12" cy="6" r="3" opacity="0.45" />
      <circle cx="52" cy="26" r="3" opacity="0.45" />
    </svg>
  ),
  graph: (
    <svg viewBox="0 0 64 32" aria-hidden="true">
      <path d="M10 24 28 8 46 24 32 18Z M28 8 32 18" opacity="0.45" />
      <circle cx="10" cy="24" r="3.5" />
      <circle cx="28" cy="8" r="3.5" />
      <circle cx="46" cy="24" r="3.5" />
      <circle cx="32" cy="18" r="3.5" />
    </svg>
  ),
  greedy: (
    <svg viewBox="0 0 64 32" aria-hidden="true">
      <path d="M4 8h22 M30 16h28 M10 24h16" />
      <path d="M4 30h56" opacity="0.35" />
    </svg>
  ),
  string: (
    <svg viewBox="0 0 64 32" aria-hidden="true">
      <path d="M4 10h56" opacity="0.45" />
      <path d="M4 24h56" opacity="0.45" />
      <rect x="24" y="19" width="18" height="10" rx="2" />
    </svg>
  ),
};

/** 工作原理三步：hero 与 bento 网格之间的叙事带 */
const STEPS = [
  { n: '01', t: '命令流录制', d: '算法调用 tracer API，序列化为可存储、可回放的命令流' },
  { n: '02', t: '时间轴重放', d: '引擎按 delay 切帧重放，seek 回退前缀即可，无需快照' },
  { n: '03', t: '行锚定学习', d: '源码行随帧高亮，输入由种子复现，所见即所教' },
];

/** kinetic 动词：均为两字，轮换时不产生布局抖动 */
const WORDS = ['看见', '回放', '单步', '复现'];

interface Props {
  onEnter: (category?: string) => void;
}

/** 逐字打字机：整词停留 1.8s，删除后换下一词；reduced-motion 时静止 */
function useTypewriter() {
  const [text, setText] = useState(WORDS[0]);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let w = 0;
    let n = WORDS[0].length;
    let del = false;
    let timer = 0;
    const tick = () => {
      if (del) {
        n -= 1;
        setText(WORDS[w].slice(0, n));
        if (n === 0) {
          del = false;
          w = (w + 1) % WORDS.length;
          timer = window.setTimeout(tick, 400);
        } else {
          timer = window.setTimeout(tick, 70);
        }
      } else {
        n += 1;
        setText(WORDS[w].slice(0, n));
        if (n === WORDS[w].length) {
          del = true;
          timer = window.setTimeout(tick, 1800);
        } else {
          timer = window.setTimeout(tick, 150);
        }
      }
    };
    timer = window.setTimeout(tick, 1800);
    return () => window.clearTimeout(timer);
  }, []);
  return text;
}

/** 计数上滚：ease-out 三次方，约 0.9s 到位；reduced-motion 渲染期直接落终值 */
function useCountUp(target: number, duration = 900) {
  // 挂载时读一次即可：系统级偏好会话内几乎不变，与 useTypewriter 同款策略
  const [reduced] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [v, setV] = useState(0);
  useEffect(() => {
    if (reduced) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min((t - t0) / duration, 1);
      setV(Math.round(target * (1 - (1 - p) ** 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, reduced]);
  return reduced ? target : v;
}

/** 进入视口一次性触发，用于滚动 reveal */
function useInView<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { threshold: 0.12 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return { ref, inView };
}

const pad = (v: number) => String(v).padStart(2, '0');

/** 着陆页：种子流场 hero + kinetic 标题 + bento 分类网格，风格与实验室一致 */
export function Home({ onEnter }: Props) {
  const { setColorScheme } = useMantineColorScheme();
  const computedColorScheme = useComputedColorScheme('light');
  const scheme = computedColorScheme as 'light' | 'dark';
  const word = useTypewriter();
  const algos = useCountUp(11);
  const cats = useCountUp(6);
  const { ref: gridRef, inView } = useInView<HTMLElement>();
  const { ref: stepsRef, inView: stepsIn } = useInView<HTMLElement>();

  return (
    <Box className={styles.page}>
      <header className={styles.header}>
        <button className={styles.logo} onClick={() => onEnter()} aria-label="进入实验室">
          algo-viz<span className={styles.caret}>_</span>
        </button>
        <Group gap="xs">
          <a className={styles.monoLink} href={REPO_URL} target="_blank" rel="noreferrer">
            github/SantaChains
          </a>
          <ActionIcon
            variant="default"
            onClick={() => setColorScheme(scheme === 'dark' ? 'light' : 'dark')}
            aria-label="切换配色模式"
          >
            {scheme === 'dark' ? <IconSun size={18} /> : <IconMoon size={18} />}
          </ActionIcon>
        </Group>
      </header>

      <main>
        <section className={styles.hero}>
          <div className={styles.heroBg} aria-hidden="true">
            <FlowField scheme={scheme} />
          </div>
          <div className={styles.heroInner}>
            <Text className={styles.kicker} ff="monospace">// line-anchored algorithm learning</Text>
            <Title className={styles.headline} order={1}>
              <span className={styles.wordSlot}>
                {word}
                <span className={styles.typeCaret} aria-hidden="true">_</span>
              </span>
              算法的每一步
            </Title>
            <Text className={styles.sub} size="lg">
              命令流录制，时间轴重放；源码行随帧高亮，输入由种子复现。
            </Text>
            <Group gap="sm" mt="xl">
              <Button size="md" onClick={() => onEnter()} aria-label="进入实验室">
                进入实验室
              </Button>
              <Button
                size="md"
                variant="default"
                component="a"
                href={REPO_URL}
                target="_blank"
                rel="noreferrer"
                rightSection={<IconArrowUpRight size={16} />}
              >
                GitHub
              </Button>
            </Group>
            <div className={styles.metrics}>
              <span className={styles.stat}>
                <b>{pad(algos)}</b>
                <i>algorithms</i>
              </span>
              <span className={styles.stat}>
                <b>{pad(cats)}</b>
                <i>categories</i>
              </span>
              <span className={styles.stat}>
                <b>∞</b>
                <i>snapshots</i>
              </span>
            </div>
          </div>
          <span className={styles.scrollHint} aria-hidden="true">scroll ↓</span>
        </section>

        <section ref={stepsRef} className={styles.steps} aria-label="工作原理">
          {STEPS.map((s, i) => (
            <div
              key={s.n}
              className={`${styles.step} ${stepsIn ? styles.visible : styles.reveal}`}
              style={{ transitionDelay: stepsIn ? `${i * 80}ms` : '0ms' }}
            >
              <span className={styles.stepNum}>{s.n}</span>
              <span className={styles.stepTitle}>{s.t}</span>
              <span className={styles.stepDesc}>{s.d}</span>
            </div>
          ))}
        </section>

        <section ref={gridRef} className={styles.grid} aria-label="算法分类">
          {CATEGORY_CARDS.map((card, i) => {
            const CardIcon = CATEGORY_ICONS[card.id];
            return (
              <button
                key={card.id}
                className={`${styles.card} ${styles[card.span]} ${inView ? styles.visible : styles.reveal}`}
                style={{ transitionDelay: inView ? `${i * 60}ms` : '0ms' }}
                onClick={() => onEnter(card.id)}
                aria-label={`进入${card.name}`}
              >
                <span className={styles.cardIndex}>{card.index}</span>
                <span className={styles.motif}>{MOTIFS[card.id]}</span>
                <span className={styles.cardHead}>
                  {CardIcon && <CardIcon size={18} stroke={1.8} className={styles.cardIcon} />}
                  <span className={styles.cardName}>{card.name}</span>
                </span>
                <span className={styles.cardDesc}>{card.desc}</span>
                {card.code && <span className={styles.codeLine}>{card.code}</span>}
                <span className={styles.cardMeta}>
                  {card.count} algorithms
                  <IconArrowUpRight size={14} className={styles.cardArrow} />
                </span>
              </button>
            );
          })}
        </section>
      </main>

      <footer className={styles.footer}>
        <span className={styles.mono}>MIT © 2026 SantaChains</span>
        <span className={styles.mono}>
          致谢{' '}
          {REFERENCES.map((ref, i) => (
            <span key={ref.url}>
              {i > 0 && ' · '}
              <a className={styles.monoLink} href={ref.url} target="_blank" rel="noreferrer">
                {ref.name}
              </a>
            </span>
          ))}
        </span>
      </footer>
    </Box>
  );
}
