/* Original vector artwork. Decorative only: never receives live puzzle data. */
export function prismIsland(completed = 0) {
  const island = (x, y, scale, index) => {
    const awake = Math.max(0, Math.min(4, completed - index * 4));
    const grass = awake ? '#407f72' : '#354d60';
    const light = awake ? '#91f5c9' : '#8eabc1';
    return `<g transform="translate(${x} ${y}) scale(${scale})">
      <ellipse cy="86" rx="115" ry="18" fill="#071020" opacity=".4"/>
      <path d="M-116-5-85 57-28 89 22 68 58 77 111 24 119-6Z" fill="#223e51"/>
      <path d="m-85 57 57 32-17-82-61-10Zm143 20 53-53-35-37-41 26Z" fill="#172c42"/>
      <path d="m-28 89 17-52 33 31Z" fill="#496278"/>
      <path d="m-123-16 57-36 99-5 85 34 5 37-51 32-110-1-81-25Z" fill="${grass}"/>
      <path d="m-123-16 57-36 99-5 85 34-53 33-103 1Z" fill="${awake ? '#70b59c' : '#5b7889'}"/>
      <path d="m-108-13 47-27 94-4 68 25-44 24-93-1Z" fill="#21394b"/>
      <path d="m-73-4 50-26 62 3 39 13-40 21-61 2Z" fill="#354e60"/>
      <path d="m-33-21 22 4-32 17-18-5Z" fill="#d3d7c9" opacity=".55"/>
      <path d="m-10-13 18 5-32 18-17-5Z" fill="#d3d7c9" opacity=".4"/>
      <path d="m-7-38 20-11 22 9v24L12-3-7-13Z" fill="#819fa6"/>
      <path d="m13-49 22 9-23 13-19-11Z" fill="#d7e5da"/>
      <path d="M12-27v24l23-13v-24Z" fill="#455e72"/>
      <path d="m2-47 10-39 11 38-11 10Z" fill="${light}"/>
      <path d="m12-86 11 38-11 10Z" fill="${awake ? '#4dc8a6' : '#607d9d'}"/>
      ${awake ? `<ellipse cx="12" cy="-48" rx="35" ry="12" fill="#92f7c5" opacity=".12"/><path d="M12-88v-35" stroke="#a8ffe2" stroke-width="2" opacity=".6"/>` : ''}
      <g fill="${awake ? '#90cba1' : '#698593'}">
        <path d="M-94-8v-29h5v29Z"/><ellipse cx="-92" cy="-35" rx="19" ry="10"/>
        <ellipse cx="-91" cy="-45" rx="13" ry="8"/>
        <path d="M78 7v-25h5V7Z"/><ellipse cx="80" cy="-19" rx="17" ry="10"/>
        <ellipse cx="81" cy="-29" rx="11" ry="8"/>
      </g>
      ${Array.from({ length: awake }, (_, i) => `<g transform="translate(${-50 + i * 26} ${20 + (i % 2) * 7})"><ellipse rx="7" ry="3" fill="#b3e6a5"/><path d="M0 0v-10m0 4-5-3m5 0 5-3" fill="none" stroke="#b3e6a5" stroke-width="2"/></g>`).join('')}
      <path d="m-64 27 12 5-6 18-10-5Zm115-4 9-7 2 13-6 9Z" fill="#94cfa9" opacity=".55"/>
    </g>`;
  };
  return `<svg class="pw-islands" viewBox="0 0 600 380" aria-hidden="true" focusable="false">
    <defs><linearGradient id="pw-sky" x2=".8" y2="1"><stop stop-color="#18344b"/><stop offset="1" stop-color="#101b32"/></linearGradient></defs>
    <rect width="600" height="380" rx="28" fill="url(#pw-sky)"/>
    <g fill="#d5edee" opacity=".055"><ellipse cx="75" cy="130" rx="130" ry="15"/><ellipse cx="500" cy="85" rx="160" ry="17"/><ellipse cx="420" cy="325" rx="180" ry="15"/></g>
    <g fill="#c6e4e4" opacity=".35"><circle cx="74" cy="51" r="1.5"/><circle cx="328" cy="37" r="1.5"/><circle cx="536" cy="179" r="1.5"/><circle cx="252" cy="322" r="1"/></g>
    <path d="m164 218 128-89m58 17 89 82" fill="none" stroke="${completed >= 4 ? '#83bcad' : '#496078'}" stroke-width="5" stroke-dasharray="3 7"/>
    ${island(128, 230, 0.85, 0)}${island(310, 140, 0.9, 1)}${island(474, 259, 0.85, 2)}
    <path d="m12 347 50-2m-25-6 31 2m450-136 41 1m-21-8 36 1" stroke="#83b5c1" opacity=".2" stroke-linecap="round"/>
  </svg>`;
}
