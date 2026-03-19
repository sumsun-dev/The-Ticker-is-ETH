import React, { useMemo } from 'react';
import { CatmullRomCurve3, Vector3 } from 'three';
import Ethereum3DLogo from './Ethereum3DLogo';

// Pre-compute deterministic path data outside component
function createPaths(count: number): CatmullRomCurve3[] {
    const results: CatmullRomCurve3[] = [];
    for (let i = 0; i < count; i++) {
        const h = (n: number) => (((n * 2654435761) >>> 0) / 4294967296) - 0.5;
        const start = new Vector3(0, 0, 0);
        const end = new Vector3(
            h(i * 3) * 12,
            h(i * 3 + 1) * 10,
            (h(i * 3 + 2) - 0.5) * 8,
        );
        const mid = new Vector3().lerpVectors(start, end, 0.5);
        mid.add(new Vector3(
            h(i * 3 + 10) * 3,
            h(i * 3 + 11) * 3,
            h(i * 3 + 12) * 3,
        ));
        results.push(new CatmullRomCurve3([start, mid, end]));
    }
    return results;
}

const NetworkCoordination: React.FC = () => {
    const paths = useMemo(() => createPaths(6), []);

    return (
        <group scale={1.5}>
            <Ethereum3DLogo />

            {/* Render items around the logo */}
            {paths.map((path, i) => (
                <group key={i}>
                    <mesh>
                        <tubeGeometry args={[path, 64, 0.012, 8, false]} />
                        <meshStandardMaterial
                            color="#3C4CA8"
                            transparent
                            opacity={0.1}
                            emissive="#1A1A3D"
                            emissiveIntensity={0.2}
                        />
                    </mesh>
                </group>
            ))}
        </group>
    );
};

export default NetworkCoordination;
