# Music Files

Place `.mp3` music files here, named by game mode:

- `menu.mp3` — Home/menu background music
- `blitz.mp3` — Blitz mode game music (fast, energetic)
- `classic.mp3` — Classic/Marathon mode music (moderate tempo)
- `endless.mp3` — Endless mode music (chill, ambient)
- `competition.mp3` — Competition mode music (intense, high energy)

The AudioManager will automatically detect these files and prefer them
over the procedural synthesizer. If a file is missing for a mode,
the synth fallback plays instead.

**Format:** MP3, 128-192kbps, loopable recommended.
