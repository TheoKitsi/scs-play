import { modePreview } from './modePreview.js';

/* End-of-round and result artwork use the same actual stage/objects as the
   selector, not a second set of schematic vector worlds. Static and inert. */
export function modeArtwork(mode) {
  return modePreview(mode);
}
