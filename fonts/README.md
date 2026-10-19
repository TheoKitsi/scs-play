# Bundled fonts

Unmodified Google Fonts **static** Latin WOFF2 subsets, downloaded 2026-10-19.
Outfit v15 ships weights 300/400/500/600/700/800/900; Space Grotesk v22 ships
400/500/600/700. Together they are 150,088 bytes (146.6 KiB).

Source CSS: https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=Space+Grotesk:wght@400;500;600;700&display=swap

The provider's Chrome/60 user-agent variant supplies static WOFF2s; only the
`/* latin */` resources were taken. Static cuts are deliberate: Windows
Playwright WebKit decoded the variable files but rendered their weight axes
incorrectly. The regression test checks actual regular/bold raster coverage,
not merely a fulfilled `document.fonts.load()` promise. No runtime font probe
or user-agent sniffing is added to the game.

Individual original resource suffixes (under `https://fonts.gstatic.com/s/`):

| Local file | Provider path |
| --- | --- |
| `outfit-300.woff2` | `outfit/v15/QGYyz_MVcBeNP4NjuGObqx1XmO1I4W61O4a0Ew.woff2` |
| `outfit-400.woff2` | `outfit/v15/QGYyz_MVcBeNP4NjuGObqx1XmO1I4TC1O4a0Ew.woff2` |
| `outfit-500.woff2` | `outfit/v15/QGYyz_MVcBeNP4NjuGObqx1XmO1I4QK1O4a0Ew.woff2` |
| `outfit-600.woff2` | `outfit/v15/QGYyz_MVcBeNP4NjuGObqx1XmO1I4e6yO4a0Ew.woff2` |
| `outfit-700.woff2` | `outfit/v15/QGYyz_MVcBeNP4NjuGObqx1XmO1I4deyO4a0Ew.woff2` |
| `outfit-800.woff2` | `outfit/v15/QGYyz_MVcBeNP4NjuGObqx1XmO1I4bCyO4a0Ew.woff2` |
| `outfit-900.woff2` | `outfit/v15/QGYyz_MVcBeNP4NjuGObqx1XmO1I4ZmyO4a0Ew.woff2` |
| `space-grotesk-400.woff2` | `spacegrotesk/v22/V8mQoQDjQSkFtoMM3T6r8E7mF71Q-gOoraIAEj7oUXskPMA.woff2` |
| `space-grotesk-500.woff2` | `spacegrotesk/v22/V8mQoQDjQSkFtoMM3T6r8E7mF71Q-gOoraIAEj7aUXskPMA.woff2` |
| `space-grotesk-600.woff2` | `spacegrotesk/v22/V8mQoQDjQSkFtoMM3T6r8E7mF71Q-gOoraIAEj42VnskPMA.woff2` |
| `space-grotesk-700.woff2` | `spacegrotesk/v22/V8mQoQDjQSkFtoMM3T6r8E7mF71Q-gOoraIAEj4PVnskPMA.woff2` |

Both are distributed under the included `OFL.txt`. These Latin subsets cover
the application's German/English text (including ä, ö, ü, ß). Symbols outside
the subsets use the system fallback; gameplay symbols use SVG, not font glyphs.
No font-CDN request is made by the game. Only regular Outfit is preloaded;
the browser requests other cuts as needed. The production build copies files
unchanged and the service worker precaches all cuts for the first offline reload.
