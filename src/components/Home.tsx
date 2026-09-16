import { useEffect, useRef, useState } from 'react';
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
import { IconArrowUpRight, IconMoon, IconSun } from '@tabler/icons-react';
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

/** 计数上滚：ease-out 三次方，约 0.9s 到位 */
function useCountUp(target: number, duration = 900) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min((t - t0) / duration, 1);
      setV(Math.round(target * (1 - (1 - p) ** 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return v;
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
              {word}算法的每一步
              <span className={styles.typeCaret} aria-hidden="true">_</span>
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
            <Text className={styles.metrics} ff="monospace">
              <b>{pad(algos)}</b> algorithms · <b>{pad(cats)}</b> categories · <b>∞</b> snapshots
            </Text>
          </div>
          <span className={styles.scrollHint} aria-hidden="true">scroll ↓</span>
        </section>

        <section ref={gridRef} className={styles.grid} aria-label="算法分类">
          {CATEGORY_CARDS.map((card, i) => (
            <button
              key={card.id}
              className={`${styles.card} ${styles[card.span]} ${inView ? styles.visible : styles.reveal}`}
              style={{ transitionDelay: inView ? `${i * 60}ms` : '0ms' }}
              onClick={() => onEnter(card.id)}
              aria-label={`进入${card.name}`}
            >
              <span className={styles.cardIndex}>{card.index}</span>
              <span className={styles.cardName}>{card.name}</span>
              <span className={styles.cardDesc}>{card.desc}</span>
              {card.code && <span className={styles.codeLine}>{card.code}</span>}
              <span className={styles.cardMeta}>
                {card.count} algorithms
                <IconArrowUpRight size={14} className={styles.cardArrow} />
              </span>
            </button>
          ))}
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
