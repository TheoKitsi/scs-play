/* Standalone, offline-capable legal pages. No account or storage access. */
const requested = new URL(location.href).searchParams.get('lang');
const language = ['de', 'en'].includes(requested) ? requested : navigator.language?.startsWith('de') ? 'de' : 'en';
document.documentElement.lang = language;
for (const article of document.querySelectorAll('article[lang]')) article.hidden = article.lang !== language;
for (const link of document.querySelectorAll('nav a[lang]')) {
  if (link.lang === language) link.setAttribute('aria-current', 'page');
}
const back = document.querySelector('[data-legal-back]');
if (back) back.textContent = language === 'de' ? '← Zurück zu SCS Play' : '← Back to SCS Play';
document.title = `SCS Play — ${document.querySelector('article:not([hidden]) h1')?.textContent || 'Legal'}`;
