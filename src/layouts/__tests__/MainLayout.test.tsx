import { describe, it, expect, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
vi.mock('../../components/cursor/EthCursorTrail', () => ({ default: () => null }));
import MainLayout from '../MainLayout';
import { renderWithProviders } from '../../test/helpers/render';

describe('MainLayout 상단 메뉴', () => {
    it('묶음을 누르면 펼치고, Esc와 바깥 클릭으로 닫는다', () => {
        renderWithProviders(<MainLayout><p>본문</p></MainLayout>, { route: '/eips/7805' });
        const protocol = screen.getByRole('button', { name: /프로토콜/ });
        expect(protocol).toHaveAttribute('aria-expanded', 'false');

        fireEvent.click(protocol);
        expect(protocol).toHaveAttribute('aria-expanded', 'true');
        const menu = document.getElementById('nav-protocol')!;
        expect([...menu.querySelectorAll('a')].map((a) => a.getAttribute('href'))).toEqual(['/calls', '/eips', '/ercs']);
        expect(menu.querySelector('a[aria-current="page"]')).toHaveAttribute('href', '/eips');

        fireEvent.keyDown(document, { key: 'Escape' });
        expect(protocol).toHaveAttribute('aria-expanded', 'false');

        fireEvent.click(screen.getByRole('button', { name: /커뮤니티/ }));
        expect(document.getElementById('nav-community')).not.toBeNull();
        fireEvent.mouseDown(screen.getByText('본문'));
        expect(document.getElementById('nav-community')).toBeNull();
    });
});
