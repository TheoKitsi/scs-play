/* Standalone, offline-capable legal pages. No account or storage access. */
const url = new URL(location.href);
const articles = [...document.querySelectorAll('article[lang]')];
const languages = [...document.querySelectorAll('header nav a[lang]')];
const backLinks = [...document.querySelectorAll('[data-legal-back]')];
const topLink = document.querySelector('[data-legal-top]');
const plainClick = event => event.button === 0 && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey;

for (const article of articles) {
  const contents = document.createElement('details');
  const summary = document.createElement('summary');
  summary.textContent = article.lang === 'de' ? 'Abschnitt wählen' : 'Jump to a section';
  contents.append(summary);
  article.querySelectorAll('h2').forEach((heading, index) => {
    heading.id = `${article.lang}-${index + 1}`;
    heading.tabIndex = -1;
    const link = document.createElement('a');
    link.href = `#${heading.id}`;
    link.textContent = heading.textContent;
    link.addEventListener('click', event => {
      if (!plainClick(event)) return;
      event.preventDefault();
      contents.open = false;
      heading.focus({ preventScroll: true });
      heading.scrollIntoView({ block: 'start' });
    });
    contents.append(link);
  });
  article.querySelector('.updated').after(contents);
}

function display(language) {
  document.documentElement.dataset.legalReady = '';
  document.documentElement.lang = language;
  for (const article of articles) article.hidden = article.lang !== language;
  const active = articles.find(article => !article.hidden);
  document.title = `SCS Play — ${active.querySelector('h1').textContent}`;
  for (const link of languages) {
    const target = new URL(location.href);
    target.searchParams.set('lang', link.lang);
    target.hash = '';
    link.href = target.href;
    if (link.lang === language) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
  for (const link of backLinks) link.textContent = language === 'de' ? '← Zurück zu SCS Play' : '← Back to SCS Play';
  topLink.textContent = language === 'de' ? 'Zum Anfang ↑' : 'Back to top ↑';
}

for (const link of languages) link.addEventListener('click', event => {
  if (!plainClick(event)) return;
  event.preventDefault();
  history.replaceState(null, '', link.href);
  display(link.lang);
  document.querySelector('main').focus();
});
topLink.addEventListener('click', event => {
  if (!plainClick(event)) return;
  event.preventDefault();
  document.querySelector('main').focus({ preventScroll: true });
  window.scrollTo(0, 0);
});
/* Settings opens a separate noopener tab so a paused round survives reading.
   Direct links and browsers which retain the tab can still navigate home. */
if (url.searchParams.get('from') === 'settings' && history.length === 1) {
  for (const link of backLinks) link.addEventListener('click', event => {
    if (!plainClick(event)) return;
    event.preventDefault();
    window.close();
    setTimeout(() => { if (!window.closed) location.assign(link.href); }, 150);
  });
}
const requested = url.searchParams.get('lang');
display(['de', 'en'].includes(requested) ? requested : navigator.language?.startsWith('de') ? 'de' : 'en');
