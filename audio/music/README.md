# Music Files

List available music tracks in `tracks.json`, then place the matching `.mp3` files here.

Example `tracks.json`:

```json
{
	"tracks": ["menu", "blitz", "classic"]
}
```

Supported mode names:

- `menu.mp3` — Home/menu background music
- `blitz.mp3` — Blitz mode game music (fast, energetic)
- `classic.mp3` — Classic/Marathon mode music (moderate tempo)
- `endless.mp3` — Endless mode music (chill, ambient)
- `competition.mp3` — Competition mode music (intense, high energy)

The AudioManager reads `tracks.json` first and only tries file playback for
listed modes. Unlisted or missing tracks fall back to the procedural synth.

Generated tracks should be arranged, not tiny phrase loops. The in-repo
generator targets 64 bars per track, which gives roughly 110-213 seconds
depending on tempo. Keep endings close to the intro energy so native loop
playback does not feel abrupt.

**Format:** MP3, 128-192kbps, loopable recommended.
