import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import type { Contribution } from '../../types/team';

interface ContributionGraphProps {
    data: Contribution[];
}

const DAYS = 7;
const CELL_SIZE = 12;
const GAP = 3;
const COL_WIDTH = CELL_SIZE + GAP;
const DAY_LABELS = ['', 'Mon', '', 'Wed', '', 'Fri', ''];

const getColor = (count: number): string => {
    if (count === 0) return 'rgba(255,255,255,0.05)';
    if (count === 1) return 'rgba(60,76,168,0.5)';
    if (count === 2) return 'rgba(60,76,168,1)';
    if (count <= 4) return 'rgba(123,107,216,1)';
    return 'rgba(160,134,252,1)';
};

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const ContributionGraph: React.FC<ContributionGraphProps> = ({ data }) => {
    const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const reversed = [...data].reverse();
    const weeks = Math.ceil(reversed.length / DAYS);

    // Build month labels with position, skip if too close to previous
    const MIN_LABEL_GAP = 45; // minimum px between labels
    const monthLabels: { weekIndex: number; label: string }[] = [];
    let lastLabel = '';
    let lastLabelPx = -MIN_LABEL_GAP;
    for (let w = 0; w < weeks; w++) {
        const entry = reversed[w * 7];
        if (!entry) continue;
        const d = new Date(entry.date);
        const m = d.getMonth();
        const y = d.getFullYear();
        const key = `${y}-${m}`;
        if (key !== lastLabel) {
            const px = w * COL_WIDTH;
            if (px - lastLabelPx >= MIN_LABEL_GAP) {
                const showYear = m === 0 || monthLabels.length === 0;
                monthLabels.push({
                    weekIndex: w,
                    label: showYear ? `${MONTH_SHORT[m]} '${String(y).slice(2)}` : MONTH_SHORT[m],
                });
                lastLabelPx = px;
            }
            lastLabel = key;
        }
    }

    const gridWidth = weeks * COL_WIDTH;

    return (
        <div ref={containerRef} className="w-full pb-2 relative select-none overflow-x-auto">
            {/* Month labels - absolute positioned on a relative track */}
            <div className="relative mb-1.5" style={{ height: 16, marginLeft: 36, width: gridWidth }}>
                {monthLabels.map(({ weekIndex, label }) => (
                    <span
                        key={weekIndex}
                        className="absolute text-[10px] text-theme-text-muted font-medium whitespace-nowrap"
                        style={{ left: weekIndex * COL_WIDTH, top: 0 }}
                    >
                        {label}
                    </span>
                ))}
            </div>

            <div className="flex" style={{ width: gridWidth + 36 }}>
                {/* Day labels */}
                <div className="flex flex-col shrink-0 gap-[3px]" style={{ width: 36 }}>
                    {DAY_LABELS.map((label, i) => (
                        <div key={i} className="text-[10px] text-theme-text-muted flex items-center justify-end pr-2" style={{ height: CELL_SIZE }}>
                            {label}
                        </div>
                    ))}
                </div>

                {/* Grid cells */}
                <div className="flex gap-[3px]">
                    {Array.from({ length: weeks }).map((_, weekIndex) => (
                        <div key={weekIndex} className="flex flex-col gap-[3px]">
                            {Array.from({ length: DAYS }).map((_, dayIndex) => {
                                const index = weekIndex * 7 + dayIndex;
                                const entry = reversed[index];
                                if (!entry) return <div key={`${weekIndex}-${dayIndex}`} style={{ width: CELL_SIZE, height: CELL_SIZE }} />;

                                const count = entry.count;
                                const dateStr = new Date(entry.date).toLocaleDateString('ko-KR', {
                                    year: 'numeric', month: 'short', day: 'numeric',
                                });

                                return (
                                    <motion.div
                                        key={`${weekIndex}-${dayIndex}`}
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ delay: Math.min(index * 0.001, 0.5), duration: 0.15 }}
                                        className="rounded-[2px] cursor-pointer transition-transform duration-100 hover:scale-[1.4] hover:z-10"
                                        style={{ width: CELL_SIZE, height: CELL_SIZE, backgroundColor: getColor(count) }}
                                        onMouseEnter={(e) => {
                                            const rect = e.currentTarget.getBoundingClientRect();
                                            const parent = containerRef.current!.getBoundingClientRect();
                                            setTooltip({
                                                x: rect.left - parent.left + rect.width / 2,
                                                y: rect.top - parent.top - 8,
                                                text: count > 0
                                                    ? `${dateStr} — ${count}건`
                                                    : `${dateStr} — 활동 없음`,
                                            });
                                        }}
                                        onMouseLeave={() => setTooltip(null)}
                                    />
                                );
                            })}
                        </div>
                    ))}
                </div>
            </div>

            {/* Tooltip */}
            {tooltip && (
                <div
                    className="absolute pointer-events-none z-50 px-2.5 py-1.5 rounded-lg text-[11px] text-theme-text-secondary bg-brand-surface-light border border-theme-border whitespace-nowrap shadow-lg"
                    style={{
                        left: tooltip.x,
                        top: tooltip.y,
                        transform: 'translate(-50%, -100%)',
                    }}
                >
                    {tooltip.text}
                </div>
            )}

            {/* Legend */}
            <div className="mt-3 flex items-center justify-end gap-2 text-[11px] text-theme-text-muted">
                <span>Less</span>
                <div className="flex gap-1">
                    {[0, 1, 2, 3, 5].map(c => (
                        <div
                            key={c}
                            className="w-3 h-3 rounded-[2px]"
                            style={{ backgroundColor: getColor(c) }}
                        />
                    ))}
                </div>
                <span>More</span>
            </div>
        </div>
    );
};

export default ContributionGraph;
