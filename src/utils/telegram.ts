export function formatDate(dateInput: string | Date): string {
    const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

// 컨트리뷰터 active/inactive 판정은 2개월짜리 캘린더 윈도우 기준.
// 윈도우 경계는 홀수월 1일 (1/1, 3/1, 5/1, 7/1, 9/1, 11/1).
// 직전 또는 현재 윈도우 내 1개 이상 메시지가 있으면 active.
const WINDOW_MONTHS = 2;

function getCurrentWindowStart(now: Date): Date {
    const month = now.getMonth();
    const windowMonth = month - (month % WINDOW_MONTHS);
    return new Date(now.getFullYear(), windowMonth, 1);
}

export function isStillActive(lastMessageDate: string): boolean {
    const lastDate = new Date(lastMessageDate);
    const windowStart = getCurrentWindowStart(new Date());
    const cutoff = new Date(windowStart);
    cutoff.setMonth(cutoff.getMonth() - WINDOW_MONTHS);
    return lastDate >= cutoff;
}
