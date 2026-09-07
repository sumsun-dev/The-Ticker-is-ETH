import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Debate, DebateHolder, DebateStance } from '../../data/ethDebatesData';
import { initialsOf } from '../../utils/debates';

type NodeStance = DebateStance | 'unknown';
interface Node {
    key: string;
    holder: DebateHolder;
    stance: NodeStance;
    x: number;
    y: number;
}
interface Edge {
    from: Node;
    to: Node;
    count: number;
    relation: 'reply' | 'quote';
}

const COLOR: Record<NodeStance, string> = {
    pro: '#629FFF',
    con: '#fbbf24',
    neutral: '#5eead4',
    other: '#A086FC',
    unknown: '#9ca3af',
};
const COLUMN: Record<NodeStance, number> = { pro: 0, neutral: 1, other: 1, unknown: 1, con: 2 };
const COL_X = [100, 320, 540];
const ROW_H = 84;
const TOP = 56;
const R = 22;

const keyOf = (h: Pick<DebateHolder, 'handle' | 'name'>) => (h.handle ?? h.name).toLowerCase();

interface RelationGraphProps {
    debate: Debate;
    /** 노드 클릭 → 그 인물의 발언 팝업 */
    onSelect?: (holder: DebateHolder) => void;
    /** 사이드바용: 카드 안에 제목만 작게 */
    compact?: boolean;
}

/** 누가 누구에게 답했는지: 찬성은 왼쪽, 반대는 오른쪽, 중립·기타·미확인은 가운데. 화살표는 답글·인용 방향. */
const RelationGraph: React.FC<RelationGraphProps> = ({ debate, onSelect, compact = false }) => {
    const { t } = useTranslation('debates');
    const [broken, setBroken] = useState<Set<string>>(new Set());

    const { nodes, edges, height } = useMemo(() => {
        const byKey = new Map<string, Node>();
        for (const p of debate.positions) {
            for (const h of p.holders) {
                const k = keyOf(h);
                if (!byKey.has(k)) byKey.set(k, { key: k, holder: h, stance: p.stance, x: 0, y: 0 });
                if (h.handle) byKey.set(h.handle.toLowerCase(), byKey.get(k)!);
                byKey.set(h.name.toLowerCase(), byKey.get(k)!);
            }
        }
        const find = (ref: string) => byKey.get(ref.replace(/^@/, '').toLowerCase());
        const edgeMap = new Map<string, Edge>();
        for (const entry of debate.timeline) {
            if (!entry.replyTo || (entry.relation !== 'reply' && entry.relation !== 'quote')) continue;
            const from = find(entry.by);
            let to = find(entry.replyTo);
            if (!from) continue;
            if (!to) {
                const handle = entry.replyTo.replace(/^@/, '');
                to = { key: handle.toLowerCase(), holder: { handle, name: handle }, stance: 'unknown', x: 0, y: 0 };
                byKey.set(to.key, to);
            }
            if (from === to) continue;
            const id = `${from.key}->${to.key}`;
            const prev = edgeMap.get(id);
            edgeMap.set(id, prev ? { ...prev, count: prev.count + 1 } : { from, to, count: 1, relation: entry.relation });
        }
        const edges = [...edgeMap.values()];
        // 관계에 등장하는 인물만 그린다 (없으면 그래프를 숨긴다)
        const used = new Set(edges.flatMap((e) => [e.from, e.to]));
        const nodes = [...new Set(byKey.values())].filter((n) => used.has(n));
        const perColumn: Node[][] = [[], [], []];
        for (const n of nodes) perColumn[COLUMN[n.stance]].push(n);
        const rows = Math.max(...perColumn.map((c) => c.length), 1);
        const height = TOP + rows * ROW_H;
        perColumn.forEach((col, ci) => {
            const offset = ((rows - col.length) * ROW_H) / 2;
            col.forEach((n, ri) => {
                n.x = COL_X[ci];
                n.y = TOP + offset + ri * ROW_H;
            });
        });
        return { nodes, edges, height };
    }, [debate]);

    if (edges.length === 0) return null;

    const path = (e: Edge) => {
        const dx = e.to.x - e.from.x;
        const dy = e.to.y - e.from.y;
        const len = Math.hypot(dx, dy) || 1;
        // 노드 원 가장자리에서 시작·종료, 살짝 휘어서 양방향 화살표가 겹치지 않게
        const ux = dx / len;
        const uy = dy / len;
        const sx = e.from.x + ux * (R + 4);
        const sy = e.from.y + uy * (R + 4);
        const ex = e.to.x - ux * (R + 8);
        const ey = e.to.y - uy * (R + 8);
        const bend = 18;
        const cx = (sx + ex) / 2 - uy * bend;
        const cy = (sy + ey) / 2 + ux * bend;
        return { d: `M${sx},${sy} Q${cx},${cy} ${ex},${ey}`, mx: (sx + 2 * cx + ex) / 4, my: (sy + 2 * cy + ey) / 4 };
    };

    return (
        <figure className={compact ? 'rounded-2xl border border-theme-border bg-theme-surface p-5 flex flex-col gap-3 m-0' : 'my-10'}>
            <h2 className="text-[11px] font-mono uppercase tracking-widest text-theme-text-muted">{t('graph')}</h2>
            <div className={compact ? 'overflow-x-auto' : 'rounded-2xl border border-theme-border bg-theme-surface overflow-x-auto'}>
                <svg viewBox={`0 0 640 ${height}`} className={`block w-full h-auto ${compact ? '' : 'min-w-[520px]'}`} role="img" aria-label={t('graphCaption')}>
                    <defs>
                        {(Object.keys(COLOR) as NodeStance[]).map((s) => (
                            <marker key={s} id={`arrow-${s}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
                                <path d="M0,0 L10,5 L0,10 z" fill={COLOR[s]} />
                            </marker>
                        ))}
                        {nodes.map((n) => (
                            <clipPath key={n.key} id={`clip-${n.key}`}>
                                <circle cx={n.x} cy={n.y} r={R} />
                            </clipPath>
                        ))}
                    </defs>
                    {[t('stance.pro'), t('stance.neutral'), t('stance.con')].map((label, i) => (
                        <text key={label} x={COL_X[i]} y={24} textAnchor="middle" fontSize="11" fill={COLOR[(['pro', 'neutral', 'con'] as const)[i]]} fontFamily="ui-monospace, monospace" letterSpacing="0.1em">
                            {label.toUpperCase()}
                        </text>
                    ))}
                    {edges.map((e) => {
                        const { d, mx, my } = path(e);
                        const rebuttal = e.from.stance !== e.to.stance && e.from.stance !== 'unknown' && e.to.stance !== 'unknown';
                        return (
                            <g key={`${e.from.key}-${e.to.key}`}>
                                <path
                                    d={d}
                                    fill="none"
                                    stroke={COLOR[e.from.stance]}
                                    strokeWidth={rebuttal ? 2.5 : 1.4}
                                    strokeDasharray={e.relation === 'quote' ? '5 4' : undefined}
                                    opacity={rebuttal ? 0.95 : 0.55}
                                    markerEnd={`url(#arrow-${e.from.stance})`}
                                />
                                {e.count > 1 && (
                                    <text x={mx} y={my - 4} textAnchor="middle" fontSize="10" fill={COLOR[e.from.stance]} fontFamily="ui-monospace, monospace">
                                        ×{e.count}
                                    </text>
                                )}
                            </g>
                        );
                    })}
                    {nodes.map((n) => (
                        <g
                            key={n.key}
                            onClick={onSelect ? () => onSelect(n.holder) : undefined}
                            role={onSelect ? 'button' : undefined}
                            tabIndex={onSelect ? 0 : undefined}
                            onKeyDown={onSelect ? (e) => { if (e.key === 'Enter' || e.key === ' ') onSelect(n.holder); } : undefined}
                            style={onSelect ? { cursor: 'pointer' } : undefined}
                        >
                            <circle cx={n.x} cy={n.y} r={R + 2} fill="none" stroke={COLOR[n.stance]} strokeWidth="2" />
                            <circle cx={n.x} cy={n.y} r={R} fill="#1a1a2e" />
                            {n.holder.avatar && !broken.has(n.key) ? (
                                <image
                                    href={n.holder.avatar}
                                    x={n.x - R}
                                    y={n.y - R}
                                    width={R * 2}
                                    height={R * 2}
                                    clipPath={`url(#clip-${n.key})`}
                                    preserveAspectRatio="xMidYMid slice"
                                    onError={() => setBroken((prev) => new Set(prev).add(n.key))}
                                />
                            ) : (
                                <text x={n.x} y={n.y + 4} textAnchor="middle" fontSize="12" fontWeight="700" fill="#F5F5FA">
                                    {initialsOf(n.holder)}
                                </text>
                            )}
                            <text x={n.x} y={n.y + R + 16} textAnchor="middle" fontSize="11" fill="#F5F5FA" fontWeight="600">
                                {n.holder.name.length > 18 ? `${n.holder.name.slice(0, 17)}…` : n.holder.name}
                            </text>
                            {n.holder.role && (
                                <text x={n.x} y={n.y + R + 29} textAnchor="middle" fontSize="9.5" fill="#9ca3af">
                                    {n.holder.role.length > 22 ? `${n.holder.role.slice(0, 21)}…` : n.holder.role}
                                </text>
                            )}
                        </g>
                    ))}
                </svg>
            </div>
            <figcaption className={`text-xs text-theme-text-muted ${compact ? '' : 'mt-2'}`}>{t('graphCaption')}</figcaption>
        </figure>
    );
};

export default RelationGraph;
