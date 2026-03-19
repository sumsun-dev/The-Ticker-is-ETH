import { useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useModalStatus } from '@privy-io/react-auth';

// --- Constants ---
const POOL_SIZE = 15;
const SPAWN_INTERVAL = 60;
const LIFETIME = 600;
const CURSOR_SIZE = 28;
const PARTICLE_SIZE = 14;

const CLICK_POOL_SIZE = 5;
const CLICK_LIFETIME = 700;
const CLICK_SIZE = 36;

// --- Types ---
interface Particle {
  el: HTMLDivElement | null;
  born: number;
  x: number;
  y: number;
  active: boolean;
}

interface ClickParticle {
  el: HTMLDivElement | null;
  born: number;
  x: number;
  y: number;
  active: boolean;
}

// --- SVG ---
const ETH_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 417" preserveAspectRatio="xMidYMid">
  <path fill="#A086FC" d="M127.961 0l-2.795 9.5v275.668l2.795 2.79 127.962-75.638z"/>
  <path fill="#C4B5FD" d="M127.962 0L0 212.32l127.962 75.639V154.158z"/>
  <path fill="#A086FC" d="M127.961 312.187l-1.575 1.92V414.45l1.575 4.6L256 236.587z"/>
  <path fill="#C4B5FD" d="M127.962 419.05V312.187L0 236.587z"/>
  <path fill="#7B6BD8" d="M127.961 287.958l127.96-75.637-127.96-58.162z"/>
  <path fill="#9B8AE8" d="M0 212.32l127.96 75.639v-133.8z"/>
</svg>`;

const TAEGEUK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" preserveAspectRatio="xMidYMid">
  <circle cx="100" cy="100" r="96" fill="white" opacity="0.15"/>
  <path d="M100 4 A96 96 0 0 1 100 196 A48 48 0 0 1 100 100 A48 48 0 0 0 100 4z" fill="#C60C30"/>
  <path d="M100 4 A96 96 0 0 0 100 196 A48 48 0 0 0 100 100 A48 48 0 0 1 100 4z" fill="#003478"/>
</svg>`;

const encodedSvg = `data:image/svg+xml,${encodeURIComponent(ETH_SVG)}`;
const encodedTaegeuk = `data:image/svg+xml,${encodeURIComponent(TAEGEUK_SVG)}`;

// --- Detection ---
function shouldShowCustomCursor(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  // Only use pointer media query - navigator.maxTouchPoints is unreliable on Windows
  return window.matchMedia('(pointer: fine)').matches;
}

// --- Component ---
const EthCursorTrail: React.FC = () => {
  const { isOpen: isPrivyModalOpen } = useModalStatus();
  const containerRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const poolRef = useRef<Particle[]>([]);
  const clickPoolRef = useRef<ClickParticle[]>([]);
  const mouseRef = useRef({ x: -100, y: -100 });
  const lastSpawnRef = useRef(0);
  const rafRef = useRef(0);
  const animateRef = useRef<((now: number) => void) | null>(null);

  const initPool = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    // Trail particles
    const pool: Particle[] = [];
    for (let i = 0; i < POOL_SIZE; i++) {
      const el = document.createElement('div');
      el.style.cssText = `
        position: fixed;
        width: ${PARTICLE_SIZE}px;
        height: ${PARTICLE_SIZE}px;
        pointer-events: none;
        opacity: 0;
        will-change: transform, opacity;
        z-index: 9998;
        filter: drop-shadow(0 0 4px rgba(160, 134, 252, 0.5));
      `;
      const img = document.createElement('img');
      img.src = encodedSvg;
      img.style.cssText = 'width: 100%; height: 100%;';
      img.alt = '';
      img.draggable = false;
      el.appendChild(img);
      container.appendChild(el);
      pool.push({ el, born: 0, x: 0, y: 0, active: false });
    }
    poolRef.current = pool;

    // Click particles (Taegeuk)
    const clickPool: ClickParticle[] = [];
    for (let i = 0; i < CLICK_POOL_SIZE; i++) {
      const el = document.createElement('div');
      el.style.cssText = `
        position: fixed;
        width: ${CLICK_SIZE}px;
        height: ${CLICK_SIZE}px;
        pointer-events: none;
        opacity: 0;
        will-change: transform, opacity;
        z-index: 9998;
      `;
      const img = document.createElement('img');
      img.src = encodedTaegeuk;
      img.style.cssText = 'width: 100%; height: 100%;';
      img.alt = '';
      img.draggable = false;
      el.appendChild(img);
      container.appendChild(el);
      clickPool.push({ el, born: 0, x: 0, y: 0, active: false });
    }
    clickPoolRef.current = clickPool;
  }, []);

  // Store animate in a ref to avoid circular dependency
  useEffect(() => {
    animateRef.current = (now: number) => {
      const { x, y } = mouseRef.current;
      const cursor = cursorRef.current;
      const pool = poolRef.current;
      const clickPool = clickPoolRef.current;

      // Update cursor position (top-center of ETH diamond aligns with pointer)
      if (cursor) {
        cursor.style.transform = `translate3d(${x - CURSOR_SIZE / 2}px, ${y}px, 0)`;
      }

      // Spawn new trail particle
      if (now - lastSpawnRef.current > SPAWN_INTERVAL) {
        lastSpawnRef.current = now;
        const inactive = pool.find((p) => !p.active);
        if (inactive) {
          inactive.active = true;
          inactive.born = now;
          inactive.x = x;
          inactive.y = y;
        }
      }

      // Update trail particles
      for (const p of pool) {
        if (!p.active || !p.el) continue;

        const age = now - p.born;
        if (age >= LIFETIME) {
          p.active = false;
          p.el.style.opacity = '0';
          continue;
        }

        const progress = age / LIFETIME;
        const eased = 1 - Math.pow(1 - progress, 3);
        const opacity = 1 - eased;
        const scale = 1 - 0.7 * eased;
        const rotation = progress * 30;

        p.el.style.opacity = String(opacity);
        p.el.style.transform = `translate3d(${p.x - PARTICLE_SIZE / 2}px, ${p.y}px, 0) scale(${scale}) rotate(${rotation}deg)`;
      }

      // Update click particles (Taegeuk)
      for (const cp of clickPool) {
        if (!cp.active || !cp.el) continue;

        const age = now - cp.born;
        if (age >= CLICK_LIFETIME) {
          cp.active = false;
          cp.el.style.opacity = '0';
          continue;
        }

        const progress = age / CLICK_LIFETIME;
        const eased = 1 - Math.pow(1 - progress, 3);
        const opacity = (1 - eased) * 0.8;
        const scale = 0.3 + eased * 1.2;
        const rotation = progress * 360;
        const drift = eased * 30;

        cp.el.style.opacity = String(opacity);
        cp.el.style.transform = `translate3d(${cp.x - CLICK_SIZE / 2}px, ${cp.y - drift}px, 0) scale(${scale}) rotate(${rotation}deg)`;
      }

      rafRef.current = requestAnimationFrame(animateRef.current!);
    };
  }, []);

  const handleClick = useCallback((e: MouseEvent) => {
    const clickPool = clickPoolRef.current;
    const inactive = clickPool.find((p) => !p.active);
    if (inactive) {
      inactive.active = true;
      inactive.born = performance.now();
      inactive.x = e.clientX;
      inactive.y = e.clientY;
    }
  }, []);

  // Hide custom cursor while Privy modal is open
  useEffect(() => {
    if (!shouldShowCustomCursor()) return;

    const cursor = cursorRef.current;
    const container = containerRef.current;
    if (isPrivyModalOpen) {
      document.documentElement.style.cursor = '';
      if (cursor) cursor.style.display = 'none';
      if (container) container.style.display = 'none';
    } else {
      document.documentElement.style.cursor = 'none';
      if (cursor) cursor.style.display = '';
      if (container) container.style.display = '';
    }
  }, [isPrivyModalOpen]);

  useEffect(() => {
    if (!shouldShowCustomCursor()) return;

    // Hide native cursor only when custom cursor is active
    document.documentElement.style.cursor = 'none';

    initPool();

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current.x = e.clientX;
      mouseRef.current.y = e.clientY;
    };

    const startAnimate = (now: number) => {
      animateRef.current?.(now);
    };

    // Page Visibility API: pause RAF when tab is hidden
    const handleVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(rafRef.current);
      } else {
        rafRef.current = requestAnimationFrame(startAnimate);
      }
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('click', handleClick, { passive: true });
    document.addEventListener('visibilitychange', handleVisibility);
    rafRef.current = requestAnimationFrame(startAnimate);

    return () => {
      document.documentElement.style.cursor = '';
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('click', handleClick);
      document.removeEventListener('visibilitychange', handleVisibility);
      cancelAnimationFrame(rafRef.current);
    };
  }, [initPool, handleClick]);

  // Don't render on touch devices or when reduced motion is preferred
  if (!shouldShowCustomCursor()) {
    return null;
  }

  return createPortal(
    <>
      {/* Particle container */}
      <div ref={containerRef} style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 9998 }} />

      {/* Main cursor */}
      <div
        ref={cursorRef}
        style={{
          position: 'fixed',
          width: CURSOR_SIZE,
          height: CURSOR_SIZE,
          pointerEvents: 'none',
          zIndex: 9999,
          filter: 'drop-shadow(0 0 8px rgba(160, 134, 252, 0.6))',
          willChange: 'transform',
          top: 0,
          left: 0,
        }}
      >
        <img
          src={encodedSvg}
          alt=""
          draggable={false}
          style={{ width: '100%', height: '100%' }}
        />
      </div>
    </>,
    document.body,
  );
};

export default EthCursorTrail;
