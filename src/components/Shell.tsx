import { useEffect, useState } from 'react';
import { useDisclosure, useHotkeys } from '@mantine/hooks';
import {
  ActionIcon,
  AppShell,
  Box,
  Burger,
  Divider,
  Group,
  NavLink,
  Paper,
  ScrollArea,
  Stack,
  Text,
  Title,
  Tooltip,
  UnstyledButton,
  useComputedColorScheme,
  useMantineColorScheme,
} from '@mantine/core';
import {
  IconArrowsSort,
  IconGraph,
  IconGridDots,
  IconLetterCase,
  IconMoon,
  IconPlanet,
  IconSearch,
  IconSettings2,
  IconSun,
  IconTarget,
} from '@tabler/icons-react';
import { demos, type AlgorithmDemo, type DemoConfig } from '../algorithms';
import { simDemos, type SimDemo } from '../sims';
import { navigateTo, replaceHash, type LabRoute } from '../router';
import { AlgorithmStage } from './AlgorithmStage';
import { SettingsPanel } from './SettingsPanel';
import { SimulationStage } from './SimulationStage';
import { StyleBridgeDemo } from './StyleBridgeDemo';
import type { Icon } from '@tabler/icons-react';

interface Category {
  id: string;
  label: string;
  description: string;
  icon: Icon;
}

const categories: Category[] = [
  { id: 'sorting', label: '排序', description: '冒泡、快排、归并等排序过程动画', icon: IconArrowsSort },
  { id: 'search', label: '查找', description: '二分查找、DFS/BFS 搜索过程演示', icon: IconSearch },
  { id: 'dp', label: '动态规划', description: '状态转移表格的逐步填充', icon: IconGridDots },
  { id: 'graph', label: '图论', description: '最短路、最小生成树的图上动画', icon: IconGraph },
  { id: 'greedy', label: '贪心', description: '区间调度、Huffman 等贪心策略', icon: IconTarget },
  { id: 'string', label: '字符串', description: 'KMP、Trie 等字符串结构演示', icon: IconLetterCase },
  { id: 'simulation', label: '模拟', description: '生命游戏、遗传算法、流场寻路等交互模拟', icon: IconPlanet },
];

type AnyDemo = AlgorithmDemo | SimDemo;

/** 分类 -> demo 列表：算法分类走命令重放注册表，模拟分类走交互模拟注册表 */
function demoListOf(category: string): AnyDemo[] {
  return category === 'simulation' ? simDemos : (demos[category] ?? []);
}

/** 路由参数白名单校验 + 默认值回填；sig 用于比较路由是否变化 */
function resolveRoute(route: LabRoute | undefined) {
  const category =
    route?.category && categories.some((c) => c.id === route.category) ? route.category : 'sorting';
  const demoList = demoListOf(category);
  const demoId =
    route?.demoId && demoList.some((d) => d.id === route.demoId) ? route.demoId : demoList[0]?.id;
  const demo = demoList.find((d) => d.id === demoId);
  const cfg =
    (route?.demoId && route.demoId === demoId ? route.cfg : undefined) ??
    (demo && 'defaultConfig' in demo ? demo.defaultConfig : null) ??
    null;
  return { category, demoId, cfg, sig: JSON.stringify([category, demoId, cfg]) };
}

export function Shell({ route, onHome }: { route?: LabRoute; onHome?: () => void }) {
  const [opened, { toggle }] = useDisclosure();
  const [asideOpened, { toggle: toggleAside }] = useDisclosure(true);
  const init = resolveRoute(route);
  const [active, setActive] = useState(init.category);
  const [demoId, setDemoId] = useState(init.demoId);
  const [cfg, setCfg] = useState<DemoConfig | null>(init.cfg);
  const [prevSig, setPrevSig] = useState(init.sig);

  // 路由 → 状态：深链与浏览器前进/后退到达时同步（渲染期重置模式，禁 effect 级联）
  const next = resolveRoute(route);
  if (next.sig !== prevSig) {
    setPrevSig(next.sig);
    setActive(next.category);
    setDemoId(next.demoId);
    setCfg(next.cfg);
  }

  const { setColorScheme } = useMantineColorScheme();
  const computedColorScheme = useComputedColorScheme('light');
  const toggleColorScheme = () =>
    setColorScheme(computedColorScheme === 'dark' ? 'light' : 'dark');
  useHotkeys([['mod+J', toggleColorScheme]]);

  const category = categories.find((c) => c.id === active) ?? categories[0];
  const demoList = demoListOf(category.id);
  const algoList = demoList.filter((d): d is AlgorithmDemo => d.kind !== 'sim');
  const demo = demoList.find((d) => d.id === demoId) ?? demoList[0];

  // 状态 → hash：参数调整等本页操作以 replaceState 回写，不产生历史记录
  useEffect(() => {
    replaceHash(active, demoId, cfg ?? undefined);
  }, [active, demoId, cfg]);

  return (
    <AppShell
      header={{ height: 56 }}
      navbar={{ width: 220, breakpoint: 'sm', collapsed: { mobile: !opened } }}
      aside={{ width: 300, breakpoint: 'md', collapsed: { mobile: !asideOpened, desktop: !asideOpened } }}
      padding="md"
    >
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group gap="sm">
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
            {onHome ? (
              <UnstyledButton onClick={onHome} aria-label="返回首页">
                <Title order={3} size="h4">algo-viz</Title>
              </UnstyledButton>
            ) : (
              <Title order={3} size="h4">algo-viz</Title>
            )}
            <Text size="xs" c="dimmed" visibleFrom="sm">算法可视化实验室</Text>
          </Group>
          <Group gap="xs">
            <Tooltip label="参数设置">
              <ActionIcon
                variant={asideOpened ? 'light' : 'default'}
                color="violet"
                onClick={toggleAside}
                aria-label="参数设置"
                title="参数设置"
              >
                <IconSettings2 size={18} />
              </ActionIcon>
            </Tooltip>
            <ActionIcon
              variant="default"
              onClick={toggleColorScheme}
              aria-label="切换配色模式"
              title="切换配色模式 (Ctrl+J)"
            >
              {computedColorScheme === 'dark' ? <IconSun size={18} /> : <IconMoon size={18} />}
            </ActionIcon>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar>
        <Box p="md">
          <Stack gap="xs">
            {categories.map((c) => (
              <NavLink
                key={c.id}
                active={active === c.id}
                label={c.label}
                description={demos[c.id] ? undefined : '迁移中'}
                leftSection={<c.icon size={18} stroke={1.8} />}
                onClick={() => navigateTo(c.id)}
              />
            ))}
          </Stack>
        </Box>
      </AppShell.Navbar>

      <AppShell.Aside p="md">
        <ScrollArea h="100%" type="auto">
          {demo?.kind === 'sim' ? (
            <Paper withBorder radius="md" p="md">
              <Text size="xs" c="dimmed" tt="uppercase" mb={8}>
                关于此模拟
              </Text>
              <Text size="sm" lh={1.7}>{demo.description}</Text>
              <Divider my="md" />
              <Text size="xs" c="dimmed">
                控制参数在可视化画布下方，直接调节即时生效，无需播放器。
              </Text>
            </Paper>
          ) : demo && cfg ? (
            <SettingsPanel demo={demo} cfg={cfg} onChange={setCfg} />
          ) : (
            <Text size="sm" c="dimmed">该分类迁移后将开放参数设置。</Text>
          )}
        </ScrollArea>
      </AppShell.Aside>

      <AppShell.Main>
        {demo?.kind === 'sim' ? (
          <SimulationStage
            demo={demo}
            siblings={demoList.filter((d): d is SimDemo => d.kind === 'sim')}
            onSelect={(id) => navigateTo(active, id)}
          />
        ) : demo && cfg ? (
          <AlgorithmStage
            demo={demo}
            cfg={cfg}
            siblings={algoList}
            onSelect={(id) => navigateTo(active, id)}
          />
        ) : (
          <StyleBridgeDemo category={category.label} description={category.description} />
        )}
      </AppShell.Main>
    </AppShell>
  );
}
