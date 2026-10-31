import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import AdminWrite from '../AdminWrite';
import { renderWithProviders } from '../../test/helpers/render';

// 에디터는 브라우저 전용이라 textarea로 대신한다
vi.mock('../../components/editor/BlockNoteEditor', () => ({
    default: ({ onChange }: { onChange: (md: string) => void }) => <textarea aria-label="본문 입력" onChange={(e) => onChange(e.target.value)} />,
}));

describe('AdminWrite', () => {
    beforeEach(() => sessionStorage.clear());
    afterEach(() => vi.unstubAllGlobals());

    it('비밀번호를 확인한 뒤 작성 화면을 연다', async () => {
        const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ success: true }) });
        vi.stubGlobal('fetch', fetchMock);
        renderWithProviders(<AdminWrite />);
        fireEvent.change(screen.getByLabelText('관리자 비밀번호'), { target: { value: 'pw' } });
        fireEvent.click(screen.getByRole('button', { name: '들어가기' }));
        expect(await screen.findByRole('button', { name: '발행' })).toBeInTheDocument();
        expect(fetchMock).toHaveBeenCalledWith('/api/auth/verify', expect.objectContaining({ method: 'POST' }));
        expect(sessionStorage.getItem('publishKey')).toBe('pw');
    });

    it('빈 칸이 있으면 발행하지 않고, 다 채우면 발행 API로 보낸다', async () => {
        sessionStorage.setItem('publishKey', 'pw');
        const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ id: 'research-1' }) });
        vi.stubGlobal('fetch', fetchMock);
        renderWithProviders(<AdminWrite />);
        fireEvent.click(screen.getByRole('button', { name: '발행' }));
        expect(await screen.findByRole('alert')).toHaveTextContent('제목, 요약, 본문');
        expect(fetchMock).not.toHaveBeenCalled();

        fireEvent.change(screen.getByLabelText('제목'), { target: { value: '새 글' } });
        fireEvent.change(screen.getByLabelText(/요약/), { target: { value: '한 줄 요약' } });
        fireEvent.change(screen.getByLabelText('본문 입력'), { target: { value: '# 본문' } });
        fireEvent.click(screen.getByRole('button', { name: '발행' }));
        expect(await screen.findByText('발행했습니다')).toBeInTheDocument();
        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toBe('/api/research/publish');
        expect(JSON.parse(init.body)).toMatchObject({ password: 'pw', title: '새 글', summary: '한 줄 요약', content: '# 본문', category: 'Research', thumbnailUrl: '/assets/thumbs/eck-navy.png' });
        await waitFor(() => expect(screen.getByRole('link', { name: '글 주소 열기' })).toHaveAttribute('href', '/contents/research-1'));
    });
});
