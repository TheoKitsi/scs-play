import { t } from '../../i18n.js';

/** Keep the visible hearts and their single accessible description in sync. */
export function renderArenaLives(container, remaining) {
  if (!container) return;
  const hearts = container.querySelectorAll('.endless-heart');
  const count = remaining ?? hearts.length;
  container.setAttribute('role', 'img');
  container.setAttribute('aria-label', `${t('endless_lives')}: ${count}/${hearts.length}`);
  hearts.forEach((heart, index) => {
    heart.style.opacity = index < count ? '1' : '0.2';
    heart.style.transform = index < count ? '' : 'scale(0.6)';
  });
}
