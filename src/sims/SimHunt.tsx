import { useEffect, useRef, useState } from "react";
import { Group, Text } from "@mantine/core";
import { mulberry32, randomSeed } from "../core/random";
import { DiceButton, ParamSlider, ResetButton, SimStats } from "./controls";
import { drawHud, simColors, statAdd, useSimLoop, type SimProps } from "./shared";
import s from "./shared.module.scss";

const CELL = 22;
const PR = 6; // 玩家半径
const INF = -1;
const FUSE = 1.1; // 引信时长 s
const BLAST = 52; // 爆炸半径 px ≈ 2.4 格
const BOMB_CD = 2; // 投放冷却 s
const BLAST_DUR = 0.45; // 爆炸特效时长 s

interface Monster {
  x: number;
  y: number;
  dead: number; // <0 被炸出局（本局不复活），0 存活
  lx: number; // 看门狗上次采样位置
  ly: number;
  stuck: number; // 看门狗计时
  escCell: number; // 脱困目标格
  escT: number; // 脱困剩余时长 s
  tgtCell: number; // 追击路径目标格（-1 无目标，到达或失效才重选，杜绝每帧震荡）
  wanderCell: number; // 游荡路标格（-1 无，抵达即重选随机邻格）
  prevCell: number; // 游荡来路格，用于禁止立即原路返回，增强混沌扩散
}

interface Bomb {
  x: number;
  y: number;
  t: number;
}

interface World {
  cols: number;
  rows: number;
  wall: Uint8Array;
  dist: Int32Array;
  player: { x: number; y: number };
  monsters: Monster[];
  bombs: Bomb[];
  blasts: { x: number; y: number; t: number }[];
  cd: number; // 炸弹冷却剩余
  guard: number; // 玩家重生保护
  captures: number;
  won: boolean; // 本局全歼获胜
  rand: () => number;
  builtSeed: number;
  builtDensity: number;
  bakedPCell: number; // 上次烘焙位势场时的玩家格，跨格才重烘
}

/** 房间式墙体：随机墙段生成 + 连通性保证；可达面积过小时换种子重试 */
function build(w: number, h: number, seed: number, density: number): World {
  let wd = buildOnce(w, h, seed, density);
  for (let attempt = 1; attempt < 4; attempt++) {
    bakeField(wd);
    let open = 0;
    for (let i = 0; i < wd.dist.length; i++) if (wd.dist[i] >= 0) open++;
    if (open >= wd.cols * wd.rows * 0.25) break;
    wd = buildOnce(w, h, (seed + attempt * 0x9e37) | 0, density);
  }
  wd.builtSeed = seed; // 保留请求种子，组件按它判定是否重建
  wd.builtDensity = density;
  bakeField(wd); // 怪物巢选址依赖 dist
  return wd;
}

function buildOnce(w: number, h: number, seed: number, density: number): World {
  const cols = Math.max(10, Math.floor(w / CELL));
  const rows = Math.max(8, Math.floor(h / CELL));
  const wall = new Uint8Array(cols * rows);
  const rand = mulberry32(seed);
  const segments = Math.round(4 + cols * rows * density * 0.09);
  for (let sgm = 0; sgm < segments; sgm++) {
    const horiz = rand() < 0.5;
    const len = 3 + Math.floor(rand() * 6);
    let x = 1 + Math.floor(rand() * (cols - 2));
    let y = 1 + Math.floor(rand() * (rows - 2));
    for (let k = 0; k < len; k++) {
      if (rand() > 0.18) wall[y * cols + x] = 1;
      if (horiz) x = Math.min(cols - 2, x + 1);
      else y = Math.min(rows - 2, y + 1);
    }
  }
  const wd: World = {
    cols,
    rows,
    wall,
    dist: new Int32Array(cols * rows),
    player: { x: 0, y: 0 },
    monsters: [],
    bombs: [],
    blasts: [],
    cd: 0,
    guard: 0,
    captures: 0,
    won: false,
    rand: mulberry32(seed ^ 0x2545f491),
    builtSeed: seed,
    builtDensity: density,
    bakedPCell: -1,
  };
  wd.player = spawnOpen(wd, Math.floor(cols / 2), Math.floor(rows / 2));
  // 连通性保证：从玩家格洪水填充，不可达的开格一律转墙，
  // 杜绝怪物与玩家分处不同连通分量导致「永远追不上」的假卡死
  bakeField(wd);
  for (let i = 0; i < wall.length; i++) {
    if (!wall[i] && wd.dist[i] < 0) wall[i] = 1;
  }
  return wd;
}

function openAt(wd: World, gx: number, gy: number) {
  const { cols, rows, wall } = wd;
  for (let r = 0; r < 8; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const x = gx + dx;
        const y = gy + dy;
        if (x >= 0 && x < cols && y >= 0 && y < rows && !wall[y * cols + x]) return { x, y };
      }
    }
  }
  return { x: 0, y: 0 };
}

function spawnOpen(wd: World, gx: number, gy: number) {
  const cell = openAt(wd, gx, gy);
  return { x: cell.x * CELL + CELL / 2, y: cell.y * CELL + CELL / 2 };
}

/** 怪物巢：BFS 场最深区域随机取一格（保证与玩家连通且天然远离） */
function spawnFar(wd: World) {
  let max = 0;
  for (let i = 0; i < wd.dist.length; i++) if (wd.dist[i] > max) max = wd.dist[i];
  const deep: number[] = [];
  for (let i = 0; i < wd.dist.length; i++) if (wd.dist[i] >= max * 0.7) deep.push(i);
  const i = deep[Math.floor(wd.rand() * deep.length)];
  return { x: (i % wd.cols) * CELL + CELL / 2, y: ((i / wd.cols) | 0) * CELL + CELL / 2 };
}

/** 直线走向目标格中心。格中心连线沿格边中线，半径 PR 的圆不会斜穿墙角；
 *  「回当前格中心」用 target=当前格 表达。切勿在行进途中切换回退目标——
 *  旧版出中心 4.4px 后目标切回当前格中心，与走向邻格交替形成极限环卡死 */
function stepToward(wd: World, m: Monster, target: number, speed: number, dt: number) {
  const tx = (target % wd.cols) * CELL + CELL / 2;
  const ty = ((target / wd.cols) | 0) * CELL + CELL / 2;
  const dx = tx - m.x;
  const dy = ty - m.y;
  const len = Math.hypot(dx, dy) || 1;
  const stepLen = Math.min(speed * dt, len);
  const nx = m.x + (dx / len) * stepLen;
  const ny = m.y + (dy / len) * stepLen;
  if (!hitsWall(wd, nx, ny, PR)) {
    m.x = nx;
    m.y = ny;
  } else if (!hitsWall(wd, nx, m.y, PR)) {
    m.x = nx;
  } else if (!hitsWall(wd, m.x, ny, PR)) {
    m.y = ny;
  }
}

/** 以玩家格为源的 BFS 位势场 */
function bakeField(wd: World) {
  const { cols, rows, wall, dist, player } = wd;
  dist.fill(INF);
  const px = Math.min(cols - 1, Math.max(0, Math.floor(player.x / CELL)));
  const py = Math.min(rows - 1, Math.max(0, Math.floor(player.y / CELL)));
  const start = py * cols + px;
  if (wall[start]) return;
  const queue = new Int32Array(cols * rows);
  let head = 0;
  let tail = 0;
  dist[start] = 0;
  queue[tail++] = start;
  while (head < tail) {
    const cur = queue[head++];
    const d = dist[cur] + 1;
    const x = cur % cols;
    const y = (cur / cols) | 0;
    if (x > 0 && !wall[cur - 1] && dist[cur - 1] === INF) {
      dist[cur - 1] = d;
      queue[tail++] = cur - 1;
    }
    if (x < cols - 1 && !wall[cur + 1] && dist[cur + 1] === INF) {
      dist[cur + 1] = d;
      queue[tail++] = cur + 1;
    }
    if (y > 0 && !wall[cur - cols] && dist[cur - cols] === INF) {
      dist[cur - cols] = d;
      queue[tail++] = cur - cols;
    }
    if (y < rows - 1 && !wall[cur + cols] && dist[cur + cols] === INF) {
      dist[cur + cols] = d;
      queue[tail++] = cur + cols;
    }
  }
}

/** 圆与墙格相交（近似 AABB 四角采样） */
function hitsWall(wd: World, x: number, y: number, r: number) {
  const x0 = Math.floor((x - r) / CELL);
  const x1 = Math.floor((x + r) / CELL);
  const y0 = Math.floor((y - r) / CELL);
  const y1 = Math.floor((y + r) / CELL);
  for (let gy = y0; gy <= y1; gy++) {
    for (let gx = x0; gx <= x1; gx++) {
      if (gx < 0 || gy < 0 || gx >= wd.cols || gy >= wd.rows) return true;
      if (wd.wall[gy * wd.cols + gx]) return true;
    }
  }
  return false;
}

/** 怪物 AI 追踪：BFS 位势场逼近 + 感知半径切换游荡，WASD 移动玩家 */
export function SimHunt({ scheme }: SimProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const worldRef = useRef<World | null>(null);
  const keysRef = useRef(new Set<string>());
  const eEatenRef = useRef(false); // E 键单次触发：按住不连投
  const [monsterCount, setMonsterCount] = useState(3);
  const [monsterSpeed, setMonsterSpeed] = useState(1);
  const [sense, setSense] = useState(7);
  const [density, setDensity] = useState(0.4);
  const [seed, setSeed] = useState(() => randomSeed());

  // WASD / 方向键：全局监听，输入框聚焦时忽略
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable))
        return;
      keysRef.current.add(e.code);
    };
    const up = (e: KeyboardEvent) => {
      keysRef.current.delete(e.code);
      if (e.code === "KeyE") eEatenRef.current = false;
    };
    const blur = () => keysRef.current.clear();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, []);

  useSimLoop(canvasRef, true, (ctx, w, h, dt) => {
    const colors = simColors(scheme);
    let wd = worldRef.current;
    if (!wd || wd.builtSeed !== seed || wd.builtDensity !== density) {
      wd = worldRef.current = build(w, h, seed, density);
      for (let i = 0; i < monsterCount; i++) {
        const nest = spawnFar(wd);
        wd.monsters.push({
          ...nest,
          dead: 0,
          lx: nest.x,
          ly: nest.y,
          stuck: 0,
          escCell: 0,
          escT: 0,
          tgtCell: -1,
          wanderCell: -1,
          prevCell: -1,
        });
      }
    }

    // 玩家移动：输入向量归一化 + 分轴碰撞滑动
    const keys = keysRef.current;
    wd.guard = Math.max(0, wd.guard - dt);
    let vx = 0;
    let vy = 0;
    if (keys.has("KeyW") || keys.has("ArrowUp")) vy -= 1;
    if (keys.has("KeyS") || keys.has("ArrowDown")) vy += 1;
    if (keys.has("KeyA") || keys.has("ArrowLeft")) vx -= 1;
    if (keys.has("KeyD") || keys.has("ArrowRight")) vx += 1;
    if (vx || vy) {
      const len = Math.hypot(vx, vy);
      const sp = 150 * dt;
      const nx = wd.player.x + (vx / len) * sp;
      const ny = wd.player.y + (vy / len) * sp;
      if (!hitsWall(wd, nx, wd.player.y, PR)) wd.player.x = nx;
      if (!hitsWall(wd, wd.player.x, ny, PR)) wd.player.y = ny;
    }

    const cellOf = (x: number, y: number) => {
      const gx = Math.min(wd.cols - 1, Math.max(0, Math.floor(x / CELL)));
      const gy = Math.min(wd.rows - 1, Math.max(0, Math.floor(y / CELL)));
      return gy * wd.cols + gx;
    };

    // 位势场按需烘焙：墙是静态的，场只随玩家格变化，跨格才重烘。
    // 每帧重烘不仅浪费，还会让最优邻格随玩家微动而翻转，放大追击震荡
    const pcell = cellOf(wd.player.x, wd.player.y);
    if (wd.bakedPCell !== pcell) {
      bakeField(wd);
      wd.bakedPCell = pcell;
    }

    // 怪物数量跟随参数（本局已获胜则不再补充）
    if (!wd.won) {
      while (wd.monsters.length < monsterCount) {
        const nest = spawnFar(wd);
        wd.monsters.push({
          ...nest,
          dead: 0,
          lx: nest.x,
          ly: nest.y,
          stuck: 0,
          escCell: 0,
          escT: 0,
          tgtCell: -1,
          wanderCell: -1,
          prevCell: -1,
        });
      }
    }
    if (wd.monsters.length > monsterCount) wd.monsters.length = monsterCount;

    // 炸弹：E 投放（冷却限制），引信到点爆炸，波及不分敌我
    wd.cd = Math.max(0, wd.cd - dt);
    if (keys.has("KeyE") && !eEatenRef.current) {
      eEatenRef.current = true;
      if (wd.cd <= 0) {
        wd.cd = BOMB_CD;
        wd.bombs.push({ x: wd.player.x, y: wd.player.y, t: 0 });
        statAdd("sim-hunt", "bombs");
      }
    }
    for (let i = wd.bombs.length - 1; i >= 0; i--) {
      const b = wd.bombs[i];
      b.t += dt;
      if (b.t < FUSE) continue;
      wd.blasts.push({ x: b.x, y: b.y, t: 0 });
      const aliveOf = () => wd.monsters.reduce((n, m) => (m.dead < 0 ? n : n + 1), 0);
      const aliveBefore = aliveOf();
      for (const m of wd.monsters) {
        if (m.dead < 0) continue;
        if (Math.hypot(m.x - b.x, m.y - b.y) < BLAST + PR) {
          m.dead = -1; // 出局：本局不再复活
          statAdd("sim-hunt", "kills");
        }
      }
      if (aliveBefore > 0 && aliveOf() === 0) {
        wd.won = true; // 全歼：一局结束
        statAdd("sim-hunt", "wins");
      }
      if (Math.hypot(wd.player.x - b.x, wd.player.y - b.y) < BLAST) {
        wd.player = spawnOpen(wd, Math.floor(wd.cols / 2), Math.floor(wd.rows / 2));
        wd.guard = 1.5;
        statAdd("sim-hunt", "deaths");
      }
      wd.bombs.splice(i, 1);
    }

    // ---- 渲染 ----
    ctx.fillStyle = colors.bg;
    ctx.fillRect(0, 0, w, h);
    // 位势场淡显（怪物感知范围相关）
    for (let i = 0; i < wd.dist.length; i++) {
      const d = wd.dist[i];
      if (d >= 0 && d <= sense && !wd.wall[i]) {
        ctx.globalAlpha = 0.1 * (1 - d / sense);
        ctx.fillStyle = colors.bad;
        ctx.fillRect((i % wd.cols) * CELL + 1, ((i / wd.cols) | 0) * CELL + 1, CELL - 2, CELL - 2);
        ctx.globalAlpha = 1;
      }
    }
    ctx.fillStyle = colors.wall;
    for (let gy = 0; gy < wd.rows; gy++) {
      for (let gx = 0; gx < wd.cols; gx++) {
        if (wd.wall[gy * wd.cols + gx]) ctx.fillRect(gx * CELL, gy * CELL, CELL - 1, CELL - 1);
      }
    }

    // 炸弹：危险圈 + 闪烁引信体
    for (const b of wd.bombs) {
      const k = Math.min(1, b.t / FUSE);
      const blink = 0.5 + 0.5 * Math.sin(b.t * (8 + k * 26));
      ctx.globalAlpha = 0.08 + 0.18 * k * blink;
      ctx.strokeStyle = colors.bad;
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.arc(b.x, b.y, BLAST, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = colors.text;
      ctx.beginPath();
      ctx.arc(b.x, b.y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.35 + 0.65 * blink;
      ctx.fillStyle = colors.bad;
      ctx.beginPath();
      ctx.arc(b.x, b.y, 2.6 + k * 1.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // 爆炸特效：闪光 + 冲击环 + 火花
    for (let i = wd.blasts.length - 1; i >= 0; i--) {
      const e = wd.blasts[i];
      e.t += dt;
      if (e.t >= BLAST_DUR) {
        wd.blasts.splice(i, 1);
        continue;
      }
      const p = e.t / BLAST_DUR;
      const eo = 1 - (1 - p) * (1 - p);
      if (p < 0.35) {
        ctx.globalAlpha = (0.35 - p) * 2;
        ctx.fillStyle = colors.warn;
        ctx.beginPath();
        ctx.arc(e.x, e.y, BLAST * 0.85, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = (1 - p) * 0.85;
      ctx.strokeStyle = colors.bad;
      ctx.lineWidth = 1 + 3 * (1 - p);
      ctx.beginPath();
      ctx.arc(e.x, e.y, BLAST * (0.2 + 0.8 * eo), 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 1;
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(e.x + Math.cos(a) * BLAST * 0.35 * eo, e.y + Math.sin(a) * BLAST * 0.35 * eo);
        ctx.lineTo(e.x + Math.cos(a) * BLAST * eo, e.y + Math.sin(a) * BLAST * eo);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    let chasing = 0;
    let alive = 0;
    for (const m of wd.monsters) {
      if (m.dead < 0) continue; // 被炸出局，本局不再复活
      alive++;
      const gi = cellOf(m.x, m.y);
      const d = wd.dist[gi];
      const inSense = d >= 0 && d <= sense;
      const gx = gi % wd.cols;
      const gy = (gi / wd.cols) | 0;
      if (inSense) {
        chasing++;
        m.wanderCell = -1; // 进入追击，作废旧游荡路标，脱离感知后重新起游
        if (m.escT > 0) {
          stepToward(wd, m, m.escCell, 95 * monsterSpeed, dt); // 脱困期直奔脱困格
        } else {
          // 目标粘性：行进途中直线直达目标格中心不回退，走到格中心才重新评估。
          // 之前每帧重选目标 + 出中心即回退，玩家一动或遇等值带就形成极限环 → 路上卡死
          const atCenter =
            Math.hypot(
              (gi % wd.cols) * CELL + CELL / 2 - m.x,
              ((gi / wd.cols) | 0) * CELL + CELL / 2 - m.y,
            ) <
            CELL * 0.2;
          if (atCenter && (m.tgtCell < 0 || gi === m.tgtCell)) {
            // 沿位势场下降方向逼近玩家；等值邻格随机选路，打破多怪对顶
            const nbs = [gi - 1, gi + 1, gi - wd.cols, gi + wd.cols];
            const ok = [
              gx > 0 && !wd.wall[nbs[0]] && wd.dist[nbs[0]] >= 0,
              gx < wd.cols - 1 && !wd.wall[nbs[1]] && wd.dist[nbs[1]] >= 0,
              gy > 0 && !wd.wall[nbs[2]] && wd.dist[nbs[2]] >= 0,
              gy < wd.rows - 1 && !wd.wall[nbs[3]] && wd.dist[nbs[3]] >= 0,
            ];
            let bestD = Infinity;
            const ties: number[] = [];
            for (let k = 0; k < 4; k++) {
              if (!ok[k]) continue;
              const dv = wd.dist[nbs[k]];
              if (dv < bestD) {
                bestD = dv;
                ties.length = 0;
                ties.push(nbs[k]);
              } else if (dv === bestD) {
                ties.push(nbs[k]);
              }
            }
            m.tgtCell = ties.length > 0 ? ties[Math.floor(wd.rand() * ties.length)] : -1;
          }
          if (m.tgtCell >= 0) stepToward(wd, m, m.tgtCell, 95 * monsterSpeed, dt);
          else stepToward(wd, m, gi, 95 * monsterSpeed, dt); // 不在中心：先回当前格中心
        }
      } else if (m.escT > 0) {
        m.tgtCell = -1; // 出感知圈，旧目标作废
        m.wanderCell = -1;
        // 游荡脱困：直接走向脱困格
        stepToward(wd, m, m.escCell, 45 * monsterSpeed, dt);
      } else {
        // 游荡：在连通网格图上做随机游走——随机选一个开放邻格作路标，直线走过去，
        // 抵达格中心即重选下一格。连通图上的随机游走会遍历全图，扩散范围覆盖全局
        // 而非困守巢区；禁止立即原路返回（prevCell）打散 A↔B 横跳，让轨迹更混沌
        const wc = m.wanderCell;
        const atWp =
          wc < 0 ||
          Math.hypot(
            (wc % wd.cols) * CELL + CELL / 2 - m.x,
            ((wc / wd.cols) | 0) * CELL + CELL / 2 - m.y,
          ) <
            CELL * 0.3;
        if (atWp) {
          const open: number[] = [];
          if (gx > 0 && !wd.wall[gi - 1]) open.push(gi - 1);
          if (gx < wd.cols - 1 && !wd.wall[gi + 1]) open.push(gi + 1);
          if (gy > 0 && !wd.wall[gi - wd.cols]) open.push(gi - wd.cols);
          if (gy < wd.rows - 1 && !wd.wall[gi + wd.cols]) open.push(gi + wd.cols);
          const fwd = open.filter((c) => c !== m.prevCell);
          const pool = fwd.length > 0 ? fwd : open; // 死格（唯一邻格即来路）才允许原路返回
          if (pool.length > 0) {
            m.prevCell = gi;
            m.wanderCell = pool[Math.floor(wd.rand() * pool.length)];
          }
        }
        if (m.wanderCell >= 0) stepToward(wd, m, m.wanderCell, 45 * monsterSpeed, dt);
      }
      // 卡死看门狗：0.6s 位移不足 5px 时随机可达邻格脱困（对顶/夹角/死角通吃）
      m.stuck += dt;
      if (m.stuck >= 0.6) {
        if (Math.hypot(m.x - m.lx, m.y - m.ly) < 5 && m.escT <= 0) {
          const cand = [
            gx > 0 && !wd.wall[gi - 1] ? gi - 1 : -1,
            gx < wd.cols - 1 && !wd.wall[gi + 1] ? gi + 1 : -1,
            gy > 0 && !wd.wall[gi - wd.cols] ? gi - wd.cols : -1,
            gy < wd.rows - 1 && !wd.wall[gi + wd.cols] ? gi + wd.cols : -1,
          ].filter((c) => c >= 0);
          if (cand.length > 0) {
            m.escCell = cand[Math.floor(wd.rand() * cand.length)];
            m.escT = 0.5;
            m.tgtCell = -1; // 脱困期旧路径作废，结束后重新评估
            m.wanderCell = -1; // 脱困结束后重新起游，避免走回旧路标
          }
        }
        m.stuck = 0;
        m.lx = m.x;
        m.ly = m.y;
      }
      if (m.escT > 0) m.escT -= dt;
      // 捕获：玩家重置到中心，怪物回巢
      if (
        dt > 0 &&
        wd.guard <= 0 &&
        Math.hypot(m.x - wd.player.x, m.y - wd.player.y) < CELL * 0.45
      ) {
        wd.captures++;
        statAdd("sim-hunt", "caps");
        const home = spawnOpen(wd, Math.floor(wd.cols / 2), Math.floor(wd.rows / 2));
        wd.player = home;
        wd.guard = 1.2;
        const nest = spawnFar(wd);
        m.x = nest.x;
        m.y = nest.y;
        m.lx = m.x;
        m.ly = m.y;
        m.stuck = 0;
        m.escT = 0;
        m.tgtCell = -1;
        m.wanderCell = -1;
        m.prevCell = -1;
      }
      // 追踪连线
      if (inSense) {
        ctx.globalAlpha = 0.25;
        ctx.strokeStyle = colors.bad;
        ctx.setLineDash([4, 4]);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(m.x, m.y);
        ctx.lineTo(wd.player.x, wd.player.y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      }
      ctx.fillStyle = colors.bad;
      ctx.beginPath();
      ctx.arc(m.x, m.y, 6, 0, Math.PI * 2);
      ctx.fill();
    }

    // 玩家
    ctx.fillStyle = colors.info;
    ctx.beginPath();
    ctx.arc(wd.player.x, wd.player.y, PR, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = colors.text;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // 重生保护环
    if (wd.guard > 0) {
      ctx.globalAlpha = Math.min(1, wd.guard);
      ctx.strokeStyle = colors.info;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.arc(wd.player.x, wd.player.y, PR + 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }

    // 胜利横幅：本局全歼
    if (wd.won) {
      ctx.globalAlpha = 0.9;
      ctx.font = "600 20px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
      ctx.textAlign = "center";
      ctx.fillStyle = colors.good;
      ctx.fillText("怪物全歼 · 本局获胜", w / 2, h / 2);
      ctx.textAlign = "left";
      ctx.globalAlpha = 1;
    }

    drawHud(
      ctx,
      wd.won
        ? `全歼获胜 · 重置或掷骰开新一局`
        : `追击 ${chasing}/${alive} · 被捕 ${wd.captures}${wd.cd > 0 ? ` · 装填 ${wd.cd.toFixed(1)}s` : " · 炸弹就绪"}`,
      colors.dim,
    );
  });

  // 置空世界，下一帧按当前参数重建
  const rebuild = () => {
    worldRef.current = null;
  };

  return (
    <>
      <div className={s.frame}>
        <canvas ref={canvasRef} className={s.canvas} />
      </div>
      <div style={{ height: 8 }} />
      <Group gap="sm" wrap="wrap" className={s.controls}>
        <ParamSlider
          label="怪物数"
          value={monsterCount}
          min={1}
          max={8}
          onChange={setMonsterCount}
        />
        <ParamSlider
          label="怪物速度"
          value={monsterSpeed}
          min={0.5}
          max={2}
          step={0.25}
          onChange={setMonsterSpeed}
          format={(v) => `${v}×`}
        />
        <ParamSlider
          label="感知半径"
          value={sense}
          min={2}
          max={14}
          onChange={setSense}
          format={(v) => `${v} 格`}
        />
        <ParamSlider
          label="墙体密度"
          value={density}
          min={0.1}
          max={0.9}
          step={0.05}
          onChange={(v) => {
            setDensity(v);
            rebuild();
          }}
          format={(v) => `${Math.round(v * 100)}%`}
        />
        <DiceButton
          onClick={() => {
            setSeed(randomSeed());
            rebuild();
          }}
        />
        <ResetButton label="重开一局" onClick={rebuild} />
        <Text size="xs" c="dimmed" className={s.hint}>
          WASD / 方向键移动 · E 放炸弹
        </Text>
      </Group>
      <SimStats
        sim="sim-hunt"
        items={[
          { key: "bombs", label: "炸弹" },
          { key: "kills", label: "消灭" },
          { key: "caps", label: "被捕" },
          { key: "deaths", label: "阵亡" },
          { key: "wins", label: "获胜" },
        ]}
      />
    </>
  );
}
