import { Box, Card, Stack, Text, Title } from '@mantine/core';
import styles from './StyleBridgeDemo.module.scss';

/**
 * 迁移中分类的占位页：同时是三轨样式协作的范式演示。
 * Mantine 提供交互组件与主题令牌，Tailwind 负责布局与一次性原子类，
 * SCSS modules 承载主题化视觉（含 m.dark / light-dark()）。
 */
export function StyleBridgeDemo({ category, description }: { category: string; description: string }) {
  return (
    <Stack gap="md" maw={960}>
      <Box>
        <Title order={2}>{category}</Title>
        <Text size="sm" c="dimmed">{description} —— 该分类算法迁移中，下方为三轨样式协作范式。</Text>
      </Box>

      <Card withBorder radius="md" padding="lg">
        <Text size="xs" c="dimmed" tt="uppercase" mb="sm">
          Mantine Card + Tailwind grid + SCSS module，切换配色观察三块色卡同步
        </Text>

        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border border-yellow-500/40 bg-yellow-100 p-3 dark:border-yellow-400/40 dark:bg-yellow-500/10">
            <Text size="sm" fw={600} c="yellow.8" className="dark:text-yellow-300">Tailwind</Text>
            <Text size="xs" c="dimmed">
              布局与一次性原子类，dark: 变体直接跟随 Mantine 配色属性
            </Text>
          </div>

          <div className={styles.scssCard}>
            <Text size="sm" fw={600}>SCSS module</Text>
            <Text size="xs" c="dimmed">
              主题化视觉走 module，@include m.dark 与 light-dark() 可用
            </Text>
          </div>

          <div className="flex items-center justify-between rounded-lg bg-violet-100 p-3 dark:bg-violet-500/10">
            <div>
              <Text size="sm" fw={600}>混合</Text>
              <Text size="xs" c="dimmed">同一元素三轨并用</Text>
            </div>
            <span className="inline-block h-6 w-6 rounded-full bg-violet-500" />
          </div>
        </div>

        <Text size="xs" c="dimmed" mt="sm">
          覆盖 Mantine 组件自身属性时，Tailwind 工具类需用重要后缀（如 <code>bg-red-500!</code>）或改走 SCSS。
        </Text>
      </Card>
    </Stack>
  );
}
