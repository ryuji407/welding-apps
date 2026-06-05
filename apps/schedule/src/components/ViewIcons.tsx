
export const GanttIcon = ({ size = 18 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 6h7" strokeWidth="3.5" opacity="0.8" />
        <path d="M14 6h6" strokeWidth="3.5" opacity="0.6" />
        <path d="M4 10h16" strokeWidth="3.5" />
        <path d="M4 14h10" strokeWidth="3.5" opacity="0.7" />
        <path d="M17 14h3" strokeWidth="3.5" opacity="0.5" />
        <path d="M4 18h6" strokeWidth="3.5" opacity="0.9" />
        <path d="M12 18h8" strokeWidth="3.5" opacity="0.7" />
    </svg>
);

export const StandardIcon = ({ size = 18 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        {/* Top half: 2 Chart rows with multiple bars (Thick) */}
        <path d="M4 5h5" strokeWidth="3.5" opacity="0.8" />
        <path d="M12 5h8" strokeWidth="3.5" opacity="0.6" />
        <path d="M4 9h16" strokeWidth="3.5" />
        {/* Bottom half: 2 List items (Bullet + Line) (Thin) */}
        <line x1="4" y1="15" x2="4.01" y2="15" strokeWidth="3.5" />
        <line x1="8" y1="15" x2="20" y2="15" strokeWidth="1.2" />
        <line x1="4" y1="19" x2="4.01" y2="19" strokeWidth="3.5" />
        <line x1="8" y1="19" x2="20" y2="19" strokeWidth="1.2" />
    </svg>
);

export const ListIcon = ({ size = 18 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <line x1="4" y1="6" x2="4.01" y2="6" strokeWidth="3.5" />
        <line x1="8" y1="6" x2="20" y2="6" strokeWidth="1.2" />
        <line x1="4" y1="10" x2="4.01" y2="10" strokeWidth="3.5" />
        <line x1="8" y1="10" x2="20" y2="10" strokeWidth="1.2" />
        <line x1="4" y1="14" x2="4.01" y2="14" strokeWidth="3.5" />
        <line x1="8" y1="14" x2="20" y2="14" strokeWidth="1.2" />
        <line x1="4" y1="18" x2="4.01" y2="18" strokeWidth="3.5" />
        <line x1="8" y1="18" x2="20" y2="18" strokeWidth="1.2" />
    </svg>
); export const OneRowIcon = ({ size = 18 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="9" width="16" height="6" rx="1" strokeWidth="2" />
    </svg>
);

export const TwoRowIcon = ({ size = 18 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="6" width="16" height="4" rx="1" strokeWidth="2" />
        <rect x="4" y="14" width="16" height="4" rx="1" strokeWidth="2" />
    </svg>
);
