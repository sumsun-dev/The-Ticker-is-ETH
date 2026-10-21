import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import VideoPlayerModal from '../VideoPlayerModal';
import { renderWithProviders } from '../../../test/helpers/render';

const video = { id: 'abc123', title: '테스트 영상', event: 'ek1-genesis', day: 2 as const, date: '2026-09-29', duration: '10:00' };

describe('VideoPlayerModal', () => {
    it('should embed the video from youtube-nocookie', () => {
        renderWithProviders(<VideoPlayerModal video={video} onClose={vi.fn()} />);
        const frame = screen.getByTitle('테스트 영상');
        expect(frame.tagName).toBe('IFRAME');
        expect(frame).toHaveAttribute('src', 'https://www.youtube-nocookie.com/embed/abc123?autoplay=1&rel=0');
        expect(screen.getByRole('dialog')).toHaveAttribute('aria-label', '테스트 영상');
    });

    it('should link to the video on YouTube', () => {
        renderWithProviders(<VideoPlayerModal video={video} onClose={vi.fn()} />);
        expect(screen.getByRole('link', { name: /YouTube/ })).toHaveAttribute('href', 'https://www.youtube.com/watch?v=abc123');
    });

    it('should close with the close button and Escape', () => {
        const onClose = vi.fn();
        renderWithProviders(<VideoPlayerModal video={video} onClose={onClose} />);
        fireEvent.click(screen.getByRole('button', { name: '닫기' }));
        fireEvent.keyDown(window, { key: 'Escape' });
        expect(onClose).toHaveBeenCalledTimes(2);
    });

    it('should close when the backdrop is clicked but not the player', () => {
        const onClose = vi.fn();
        renderWithProviders(<VideoPlayerModal video={video} onClose={onClose} />);
        fireEvent.click(screen.getByTitle('테스트 영상'));
        expect(onClose).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('dialog'));
        expect(onClose).toHaveBeenCalledTimes(1);
    });
});

describe('VideoPlayerModal focus', () => {
    it('should return focus to the opener when closed', () => {
        const opener = document.createElement('button');
        document.body.appendChild(opener);
        opener.focus();
        const { unmount } = renderWithProviders(<VideoPlayerModal video={video} onClose={vi.fn()} />);
        expect(screen.getByRole('button', { name: '닫기' })).toHaveFocus();
        unmount();
        expect(opener).toHaveFocus();
        opener.remove();
    });
});
