import type { ComponentType } from 'react';
import { SimLife } from './SimLife';
import { SimGA } from './SimGA';
import { SimMap } from './SimMap';
import { SimRTS } from './SimRTS';
import { SimHunt } from './SimHunt';
import { SimEvo } from './SimEvo';
import { SimBoids } from './SimBoids';
import type { SimProps } from './shared';

export type { SimProps } from './shared';

/** 模拟专题 demo 元数据：无命令流/源码面板，仅画布 + 控制参数 */
export interface SimDemo {
  id: string;
  kind: 'sim';
  title: string;
  description: string;
}

export const simDemos: SimDemo[] = [
  {
    id: 'sim-life',
    kind: 'sim',
    title: '生命游戏',
    description: 'B3/S23 元胞自动机：死格恰有 3 个活邻居则生，活格有 2 或 3 个邻居则存。拖拽绘制细胞，观察振荡器与滑翔机。',
  },
  {
    id: 'sim-ga',
    kind: 'sim',
    title: '遗传算法',
    description: '种群在多峰适应度地形上逐代进化：锦标赛选择、均匀交叉、变异驱动散点向峰值收敛，金圈标记当代最优。',
  },
  {
    id: 'sim-map',
    kind: 'sim',
    title: '地图生成',
    description: '分形值噪声逐倍频叠加出山脉与平原，海平面切割出深海、浅滩、森林与雪线。调参即时重绘。',
  },
  {
    id: 'sim-rts',
    kind: 'sim',
    title: 'RTS 流场寻路',
    description: '以集结点为源的 BFS 距离场一次驱动全部单位同时移动——RTS 大军寻路的经典方案。点击画布更换集结点。',
  },
  {
    id: 'sim-hunt',
    kind: 'sim',
    title: '怪物 AI 追踪',
    description: '怪物沿以玩家为源的 BFS 位势场逼近，超出感知半径则在连通网格上随机游走，轨迹混沌、扩散覆盖全图。地图强连通，卡死看门狗自动脱困。WASD 移动，E 投放炸弹——波及不分敌我，炸死的怪物本局出局，全歼即获胜，小心自爆。',
  },
  {
    id: 'sim-evo',
    kind: 'sim',
    title: '生存进化',
    description: '速度与感知基因决定觅食效率，进食繁殖、耗能死亡，突变驱动基因漂移。看种群如何在参数下演化或崩溃。',
  },
  {
    id: 'sim-boids',
    kind: 'sim',
    title: 'Boids 鸟群',
    description: 'Reynolds 三规则的自组织：分离避免碰撞、对齐统一航向、聚合抱团不散。调权重观鸟群分裂与汇聚，色相即航向。',
  },
];

export const simRegistry: Record<string, ComponentType<SimProps>> = {
  'sim-life': SimLife,
  'sim-ga': SimGA,
  'sim-map': SimMap,
  'sim-rts': SimRTS,
  'sim-hunt': SimHunt,
  'sim-evo': SimEvo,
  'sim-boids': SimBoids,
};
