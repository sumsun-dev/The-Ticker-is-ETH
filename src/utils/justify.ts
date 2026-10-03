/** 사진 사이 간격(px). JustifiedGallery의 gap-1.5와 맞춘다 */
export const GAP = 6;

/** 사진 비율을 지키면서 줄마다 너비를 꽉 채우도록 높이를 맞춘다 */
export function layoutRows(ratios: number[], width: number, target: number, maxRows: number): { count: number; height: number }[] {
    const rows: { count: number; height: number }[] = [];
    let i = 0;
    while (i < ratios.length && rows.length < maxRows) {
        let sum = 0;
        let j = i;
        while (j < ratios.length) {
            sum += ratios[j];
            j++;
            if (sum * target + GAP * (j - i - 1) >= width) break;
        }
        const count = j - i;
        const fitted = (width - GAP * (count - 1)) / sum;
        // 마지막 줄이 덜 찼으면 늘리지 않고 목표 높이를 유지한다
        rows.push({ count, height: Math.min(fitted, j === ratios.length ? target : fitted) });
        i = j;
    }
    return rows;
}
