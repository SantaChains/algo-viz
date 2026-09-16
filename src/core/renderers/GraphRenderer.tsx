import type { GraphEdge, GraphNode } from '../tracers';
import { RendererCard } from './RendererCard';
import { formatValue } from './format';
import styles from './GraphRenderer.module.scss';

interface GraphRendererProps {
  title: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  isDirected: boolean;
}

const RADIUS = 14;
const CENTER = 160;

export function GraphRenderer({ title, nodes, edges, isDirected }: GraphRendererProps) {
  // 每帧渲染都会遍历边，先建一次 id->node 索引，避免每条边 O(N) 线性查找
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  return (
    <RendererCard title={title}>
      <svg className={styles.svg} viewBox="0 0 320 320">
        <defs>
          <marker
            id="arrow"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="9"
            markerHeight="9"
            orient="auto-start-reverse"
            markerUnits="userSpaceOnUse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" className={styles.arrow} />
          </marker>
        </defs>
        {edges.map((edge) => {
          const source = nodeById.get(edge.source);
          const target = nodeById.get(edge.target);
          if (!source || !target) return null;
          const dx = target.x - source.x;
          const dy = target.y - source.y;
          const len = Math.hypot(dx, dy) || 1;
          const shorten = RADIUS + 2;
          const x1 = source.x + (dx / len) * shorten;
          const y1 = source.y + (dy / len) * shorten;
          const x2 = target.x - (dx / len) * shorten;
          const y2 = target.y - (dy / len) * shorten;
          return (
            <g key={`${edge.source}-${edge.target}`}>
              <line
                x1={CENTER + x1}
                y1={CENTER + y1}
                x2={CENTER + x2}
                y2={CENTER + y2}
                className={[styles.edge, edge.visitedCount > 0 ? styles.visited : '', edge.selectedCount > 0 ? styles.selected : ''].join(' ')}
                markerEnd={isDirected ? 'url(#arrow)' : undefined}
              />
              {edge.weight !== null && (
                <text x={CENTER + (x1 + x2) / 2} y={CENTER + (y1 + y2) / 2 - 4} className={styles.edgeWeight} textAnchor="middle">
                  {formatValue(edge.weight)}
                </text>
              )}
            </g>
          );
        })}
        {nodes.map((node) => (
          <g key={node.id} transform={`translate(${CENTER + node.x}, ${CENTER + node.y})`}>
            <circle
              r={RADIUS}
              className={[styles.node, node.visitedCount > 0 ? styles.visited : '', node.selectedCount > 0 ? styles.selected : ''].join(' ')}
            />
            <text className={styles.nodeId} textAnchor="middle" dy="4">
              {node.id}
            </text>
            {node.weight !== null && (
              <text className={styles.nodeWeight} textAnchor="middle" dy={RADIUS + 14}>
                {formatValue(node.weight)}
              </text>
            )}
          </g>
        ))}
      </svg>
    </RendererCard>
  );
}
