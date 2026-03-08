import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import krFlag from '../../assets/kr-flag.svg';

const Conduit: React.FC<{ d: string; delay: number }> = ({ d, delay }) => (
    <g className="opacity-20">
        <path
            d={d}
            fill="none"
            stroke="white"
            strokeWidth="0.5"
            strokeDasharray="4 4"
        />
        <motion.path
            d={d}
            fill="none"
            stroke="white"
            strokeWidth="2"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{
                pathLength: [0, 0.4, 0],
                pathOffset: [0, 1],
                opacity: [0, 0.8, 0]
            }}
            transition={{
                duration: 4,
                repeat: Infinity,
                delay: delay,
                ease: "linear"
            }}
            style={{ filter: 'blur(1.5px)' }}
        />
    </g>
);

const FlagParticle: React.FC<{ delay: number; duration: number; pathId: number }> = ({ delay, duration, pathId }) => {
    // 8 radial paths: 0, 45, 90, 135, 180, 225, 270, 315 degrees
    const angle = (pathId * 45) * (Math.PI / 180);
    const radius = 80; // Match Conduit radius for perfect alignment

    // Start coordinates (percent)
    const startX = 50 + Math.cos(angle) * radius;
    const startY = 50 + Math.sin(angle) * radius;

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0, left: `${startX}%`, top: `${startY}%` }}
            animate={{
                opacity: [0, 1, 1, 0],
                scale: [0.2, 0.5, 0.6, 0],
                left: [`${startX}%`, '50%', '50%'],
                top: [`${startY}%`, '50%', '50%'],
            }}
            transition={{
                duration: duration,
                repeat: Infinity,
                delay: delay,
                ease: "easeIn",
            }}
            className="absolute pointer-events-none z-0 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center"
            style={{ width: '48px', height: '48px' }}
        >
            {/* Spherical Data Orb Wrapper */}
            <div className="relative w-full h-full flex items-center justify-center rounded-full overflow-hidden border border-theme-border bg-theme-surface backdrop-blur-sm shadow-[inset_0_0_15px_rgba(255,255,255,0.2)]">
                <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent opacity-50" />
                <img
                    src={krFlag}
                    alt="KR Flag"
                    className="w-[60%] h-auto object-contain relative z-10 opacity-90"
                />
            </div>

            {/* Outer Glow for the Sphere */}
            <div className="absolute inset-0 bg-white/10 blur-xl rounded-full -z-10" />
        </motion.div>
    );
};

const KoreanFlagFlow: React.FC = () => {
    const conduits = useMemo(() => {
        // Create 8 radial paths from edges to center (50, 50)
        return Array.from({ length: 8 }, (_, i) => {
            const angle = (i * 45) * (Math.PI / 180);
            const r = 80;
            const x = 50 + Math.cos(angle) * r;
            const y = 50 + Math.sin(angle) * r;
            return {
                id: i,
                d: `M ${x} ${y} L 50 50`,
                delay: i * 0.5
            };
        });
    }, []);

    const particles = useMemo(() => {
        return Array.from({ length: 12 }, (_, i) => {
            const hash = ((i * 2654435761) >>> 0) / 4294967296;
            const hash2 = (((i + 7) * 2654435761) >>> 0) / 4294967296;
            return {
                id: i,
                pathId: i % 8,
                delay: hash * 8,
                duration: 4 + hash2 * 4,
            };
        });
    }, []);

    return (
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[600px] pointer-events-none overflow-visible">
            {/* SVG Layer for Conduits/Tunnels */}
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                <defs>
                    <radialGradient id="absorptionGlow" cx="50%" cy="50%" r="20%">
                        <stop offset="0%" stopColor="white" stopOpacity="0.5" />
                        <stop offset="100%" stopColor="transparent" stopOpacity="0" />
                    </radialGradient>
                </defs>

                {/* Conduits radiating from center */}
                {conduits.map(c => (
                    <Conduit key={c.id} d={c.d} delay={c.delay} />
                ))}

                {/* Absorption Zone Focus */}
                <circle cx="50" cy="50" r="8" fill="url(#absorptionGlow)" className="animate-pulse" />
                <circle cx="50" cy="50" r="0.5" fill="white" className="opacity-50" />
            </svg>

            {/* Spherical Flag Particles */}
            <div className="absolute inset-0">
                {particles.map(p => (
                    <FlagParticle key={p.id} {...p} />
                ))}
            </div>
        </div>
    );
};

export default KoreanFlagFlow;
