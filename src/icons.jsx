const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

function Icon({ children, size = 18 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export const Icons = {
  undo: (
    <Icon>
      <path {...stroke} d="M9 14L4 9l5-5" />
      <path {...stroke} d="M4 9h10a6 6 0 010 12h-3" />
    </Icon>
  ),
  redo: (
    <Icon>
      <path {...stroke} d="M15 14l5-5-5-5" />
      <path {...stroke} d="M20 9H10a6 6 0 000 12h3" />
    </Icon>
  ),
  bold: (
    <Icon>
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth={2.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M7 5h6a3.5 3.5 0 010 7H7z"
      />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth={2.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M7 12h7a3.5 3.5 0 010 7H7z"
      />
    </Icon>
  ),
  italic: (
    <Icon>
      <path {...stroke} d="M10 5h8" />
      <path {...stroke} d="M6 19h8" />
      <path {...stroke} d="M14 5l-4 14" />
    </Icon>
  ),
  strike: (
    <Icon>
      <path {...stroke} d="M5 12h14" />
      <path {...stroke} d="M16 7.5A4 4 0 0012 6c-2.8 0-4.5 1.5-4.5 3.2 0 3.3 7.5 1.7 7.5 5.1A3.4 3.4 0 0112 18c-2.2 0-4-1-4.8-2.4" />
    </Icon>
  ),
  ul: (
    <Icon>
      <path {...stroke} d="M9 6h11M9 12h11M9 18h11" />
      <circle cx="5" cy="6" r="1.2" fill="currentColor" />
      <circle cx="5" cy="12" r="1.2" fill="currentColor" />
      <circle cx="5" cy="18" r="1.2" fill="currentColor" />
    </Icon>
  ),
  ol: (
    <Icon>
      <path {...stroke} d="M11 6h9M11 12h9M11 18h9" />
      <g
        fill="currentColor"
        stroke="none"
        fontSize="8"
        fontWeight="700"
        fontFamily="system-ui, -apple-system, sans-serif"
      >
        <text x="3.5" y="8">
          1
        </text>
        <text x="3.5" y="14.2">
          2
        </text>
        <text x="3.5" y="20.4">
          3
        </text>
      </g>
    </Icon>
  ),
  quote: (
    <Icon>
      <path fill="currentColor" stroke="none" d="M6 17h3l2-4V7H5v6h3zm8 0h3l2-4V7h-6v6h3z" />
    </Icon>
  ),
  alignRight: (
    <Icon>
      <path {...stroke} d="M4 6h16M8 12h12M4 18h16" />
    </Icon>
  ),
  alignCenter: (
    <Icon>
      <path {...stroke} d="M4 6h16M7 12h10M4 18h16" />
    </Icon>
  ),
  alignLeft: (
    <Icon>
      <path {...stroke} d="M4 6h16M4 12h12M4 18h16" />
    </Icon>
  ),
  link: (
    <Icon>
      <path {...stroke} d="M10 13a5 5 0 007.07 0l1.41-1.41a5 5 0 00-7.07-7.07L10 5.93" />
      <path {...stroke} d="M14 11a5 5 0 00-7.07 0L5.52 12.4a5 5 0 007.07 7.07L14 18.07" />
    </Icon>
  ),
  image: (
    <Icon>
      <rect {...stroke} x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="9" cy="10" r="1.5" fill="currentColor" />
      <path {...stroke} d="M3 16l5-4 4 3 3-2 6 3" />
    </Icon>
  ),
  rtl: (
    <Icon>
      {/* q (standard pilcrow) */}
      <path
        fill="currentColor"
        stroke="none"
        d="M9 10v5h2V4h2v11h2V4h2V2H9C6.79 2 5 3.79 5 6s1.79 4 4 4z"
      />
      {/* arrow left */}
      <path fill="currentColor" stroke="none" d="M3 18l4-4v3H19v2H7v3l-4-4z" />
    </Icon>
  ),
  ltr: (
    <Icon>
      {/* P = mirrored pilcrow */}
      <g transform="translate(24 0) scale(-1 1)">
        <path
          fill="currentColor"
          stroke="none"
          d="M9 10v5h2V4h2v11h2V4h2V2H9C6.79 2 5 3.79 5 6s1.79 4 4 4z"
        />
      </g>
      {/* arrow right */}
      <path fill="currentColor" stroke="none" d="M21 18l-4-4v3H5v2h12v3l4-4z" />
    </Icon>
  ),
  hr: (
    <Icon>
      <path {...stroke} d="M4 12h16" />
    </Icon>
  ),
  indent: (
    <Icon>
      <path {...stroke} d="M4 6h16M12 12h8M4 18h16" />
      <path {...stroke} d="M4 9l4 3-4 3" />
    </Icon>
  ),
  outdent: (
    <Icon>
      <path {...stroke} d="M4 6h16M12 12h8M4 18h16" />
      <path {...stroke} d="M8 9L4 12l4 3" />
    </Icon>
  ),
  textColor: (
    <Icon>
      <path {...stroke} d="M6 16l3.5-9h1L14 16" />
      <path {...stroke} d="M7.5 13h5" />
    </Icon>
  ),
  bgColor: (
    <Icon>
      <path {...stroke} d="M8 4l8 8-4 4-8-8z" />
      <path {...stroke} d="M5 19h10" />
    </Icon>
  ),
  chevronDown: (
    <Icon size={12}>
      <path {...stroke} d="M6 9l6 6 6-6" />
    </Icon>
  ),
  code: (
    <Icon>
      <path {...stroke} d="M8 8L4 12l4 4" />
      <path {...stroke} d="M16 8l4 4-4 4" />
      <path {...stroke} d="M14 5l-4 14" />
    </Icon>
  ),
  close: (
    <Icon size={16}>
      <path {...stroke} d="M6 6l12 12M18 6L6 18" />
    </Icon>
  ),
};
