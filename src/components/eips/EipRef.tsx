import React from 'react';
import { Link } from 'react-router-dom';
import { eipUrl } from '../../data/eipsData';

/** 해설이 있으면 사이트 안 /eips/N, 없으면 EIP 원문 */
const EipRef: React.FC<{ n: number; known: ReadonlySet<number>; className?: string; children?: React.ReactNode }> = ({ n, known, className = '', children }) =>
    known.has(n) ? (
        <Link to={`/eips/${n}`} className={className}>
            {children ?? `EIP-${n}`}
        </Link>
    ) : (
        <a href={eipUrl(n)} target="_blank" rel="noopener noreferrer" className={className}>
            {children ?? `EIP-${n}`}
        </a>
    );

export default EipRef;
