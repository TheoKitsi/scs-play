/** The visual review uses the same asserted navigation as the surface gate;
 * it never deletes overlays or forces screen classes to hide broken flows. */
import { resolve } from 'node:path';
import { runSurfaceReview } from './surface-release-test.mjs';

const out = process.env.SCS_REVIEW_OUT || resolve(process.env.LOCALAPPDATA || process.cwd(), 'Temp/opencode/scs-surface-review');
await runSurfaceReview({ out });
console.log(`Visual review screenshots: ${out}`);
