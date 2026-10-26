/** Packaged localhost URLs cannot be played on a recipient's device. Browser
    builds keep their current deployment path; native shares use the public app. */
export function prismChallengeUrl(levelId, href, native = false) {
  const source = native ? new URL('https://theokitsi.github.io/scs-play/') : new URL(href);
  const url = new URL(source.pathname, source.origin);
  url.searchParams.set('prism', levelId);
  return url.href;
}
