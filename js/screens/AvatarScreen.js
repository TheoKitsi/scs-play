/* ═══════════════════════════════════════
   SCS Play — Avatar Selection Screen
   Icon picker, color picker, photo upload.
   ═══════════════════════════════════════ */
import { CONFIG }           from '../config.js';
import { t, getLanguage }   from '../i18n.js';
import { $, $$, setHTML, showScreen, safeSrc } from '../helpers/dom.js';
import { updateAvatarDisplay } from '../helpers/avatarDisplayHelper.js';
import { avatarSVG }        from '../renderers/avatars.js';
import app                   from '../appState.js';

let uploadGeneration = 0;
let showingPhoto = false;
window.addEventListener('scs:screenchange', ({ detail }) => {
  if (detail?.prevScreen === 'avatarSelect' && detail.id !== 'avatarSelect') uploadGeneration++;
});

function renderAvatarPreview(icon, colorIndex, photo) {
  showingPhoto = Boolean(photo);
  const preview = $('#avatarPreviewSvg');
  let caption = $('#avatarPreviewCaption');
  if (!caption) {
    caption = document.createElement('div');
    caption.id = 'avatarPreviewCaption';
    caption.setAttribute('aria-live', 'polite');
    caption.innerHTML = '<span></span><strong></strong><small></small>';
    preview.after(caption);
  }
  caption.querySelector('span').textContent = t('design_preview');
  caption.querySelector('strong').textContent = photo ? t('avatar_upload') : t(`avatar_icon_${icon}`);
  caption.querySelector('small').textContent = photo ? '' : t(`avatar_color_${colorIndex + 1}`);
  caption.querySelector('small').hidden = Boolean(photo);
  if (photo) {
    setHTML('#avatarPreviewSvg', `<img src="${safeSrc(photo)}" alt="">`);
  } else {
    const color = CONFIG.COLORS.normal[colorIndex] || CONFIG.COLORS.normal[0];
    setHTML('#avatarPreviewSvg', avatarSVG(icon, color, 52));
  }
}

function photoStatus(state = '', key = '') {
  const status = $('#avatarUploadStatus');
  status.dataset.state = state;
  status.textContent = state === 'storage' ? (getLanguage() === 'de'
    ? 'Nicht gespeichert. Prüfe den freien Speicherplatz und versuche es erneut.'
    : 'Not saved. Check available storage and try again.') : key ? t(key) : '';
  $('#avatarFileInput').setAttribute('aria-invalid', String(state === 'error'));
  $('#btnAvatarSave').disabled = state === 'loading';
}

function selectIconPreview(icon, ci) {
  uploadGeneration++;
  photoStatus();
  renderAvatarPreview(icon, ci);
}

function renderAvatarIconGrid(selectedIcon, selectedCI) {
  const { audio } = app;
  const grid = $('#avatarIconGrid');
  if (!grid) return;
  /* Use CSS variable for icon color so it adapts to light/dark theme (P1 white-on-white fix) */
  const iconColor = 'var(--icon-on-surface)';
  grid.innerHTML = CONFIG.AVATAR_ICONS.map(icon => {
    const selected = icon === selectedIcon ? 'selected' : '';
    const color = selected ? (CONFIG.COLORS.normal[selectedCI] || iconColor) : iconColor;
    const label = t('avatar_icon_choice', { icon: t(`avatar_icon_${icon}`) });
    return `<button type="button" class="avatar-grid-item ${selected}" data-icon="${icon}" style="color:${color}" aria-label="${label}" aria-pressed="${icon === selectedIcon}">${avatarSVG(icon, 'currentColor', 28)}</button>`;
  }).join('');

  $$('.avatar-grid-item', grid).forEach(item => {
    item.addEventListener('click', () => {
      $$('.avatar-grid-item', grid).forEach(i => {
        i.classList.remove('selected');
        i.setAttribute('aria-pressed', 'false');
        i.style.color = iconColor;
      });
      item.classList.add('selected');
      item.setAttribute('aria-pressed', 'true');
      const ci = parseInt($('.avatar-color-item.selected')?.dataset.ci || '0');
      item.style.color = CONFIG.COLORS.normal[ci];
      selectIconPreview(item.dataset.icon, ci);
      audio.tap();
    });
  });
}

function renderAvatarColorGrid(selectedCI) {
  const { audio } = app;
  const grid = $('#avatarColorGrid');
  if (!grid) return;
  grid.innerHTML = CONFIG.AVATAR_COLORS_INDICES.map(ci => {
    const color = CONFIG.COLORS.normal[ci];
    const selected = ci === selectedCI ? 'selected' : '';
    const label = t('avatar_color_choice', { color: t(`avatar_color_${ci + 1}`) });
    return `<button type="button" class="avatar-color-item ${selected}" data-ci="${ci}" style="background:${color}" aria-label="${label}" aria-pressed="${ci === selectedCI}"></button>`;
  }).join('');

  $$('.avatar-color-item', grid).forEach(item => {
    item.addEventListener('click', () => {
      $$('.avatar-color-item', grid).forEach(i => {
        i.classList.remove('selected');
        i.setAttribute('aria-pressed', 'false');
      });
      item.classList.add('selected');
      item.setAttribute('aria-pressed', 'true');
      const selectedIcon = $('.avatar-grid-item.selected');
      if (selectedIcon) selectedIcon.style.color = CONFIG.COLORS.normal[item.dataset.ci];
      const icon = selectedIcon?.dataset.icon || 'circle';
      selectIconPreview(icon, parseInt(item.dataset.ci));
      audio.tap();
    });
  });
}

async function resizeImageToBase64(file, maxSize = 128) {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const min = Math.min(img.naturalWidth, img.naturalHeight);
    if (!min) throw new Error('Empty image');
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = maxSize;
    canvas.getContext('2d').drawImage(img, (img.naturalWidth - min) / 2, (img.naturalHeight - min) / 2, min, min, 0, 0, maxSize, maxSize);
    return canvas.toDataURL('image/webp', 0.8);
  } finally { URL.revokeObjectURL(url); }
}

function setupAvatarUpload() {
  uploadGeneration++;
  const { save, audio } = app;
  const unlocked = $('#avatarUploadUnlocked');
  const fileInput = $('#avatarFileInput');
  const removeBtn = $('#btnAvatarRemovePhoto');
  photoStatus();
  if (unlocked) unlocked.style.display = '';

  const avatar = save.getAvatar();
  if (removeBtn) removeBtn.hidden = !avatar.photo;


  if (fileInput) {
    fileInput.value = '';
    fileInput.setAttribute('aria-describedby', 'avatarUploadStatus');
    fileInput.onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const generation = ++uploadGeneration;
      if (!file.type.startsWith('image/') || file.size > 10 * 1024 * 1024) {
        photoStatus('error', 'avatar_upload_error');
        fileInput.value = '';
        return;
      }
      photoStatus('loading', 'loading');
      try {
        const base64 = await resizeImageToBase64(file, 128);
        if (generation !== uploadGeneration) return;
        try { await save.withBatch(() => save.setAvatarPhoto(base64)); }
        catch {
          if (generation === uploadGeneration) { photoStatus('storage'); fileInput.value = ''; }
          return;
        }
        if (generation !== uploadGeneration) return;
        app.engagement?.trackAvatarChange();
        renderAvatarPreview(null, null, base64);
        if (removeBtn) removeBtn.hidden = false;
        photoStatus('saved', 'avatar_upload_saved');
        audio.tap();
      } catch {
        if (generation === uploadGeneration) {
          photoStatus('error', 'avatar_upload_error');
          fileInput.value = '';
        }
      }
    };
  }

  if (removeBtn) {
    removeBtn.onclick = async () => {
      const generation = ++uploadGeneration;
      try { await save.withBatch(() => save.removeAvatarPhoto()); }
      catch { if (generation === uploadGeneration) photoStatus('storage'); return; }
      if (generation !== uploadGeneration) return;
      const av = save.getAvatar();
      renderAvatarPreview($('.avatar-grid-item.selected')?.dataset.icon ?? av.icon, Number($('.avatar-color-item.selected')?.dataset.ci ?? av.colorIndex));
      removeBtn.hidden = true;
      fileInput.value = '';
      photoStatus();
      fileInput.focus();
      audio.tap();
    };
  }
}

export function showAvatarSelect(showStore) {
  const { save } = app;
  showScreen('avatarSelect', app);
  const avatar = save.getAvatar();
  renderAvatarPreview(avatar.icon, avatar.colorIndex, avatar.photo);
  renderAvatarIconGrid(avatar.icon, avatar.colorIndex);
  renderAvatarColorGrid(avatar.colorIndex);
  setupAvatarUpload();
}

export function bindAvatarSave(showHome) {
  const { save } = app;
  $('#btnAvatarSave')?.addEventListener('click', async () => {
    const icon = $('.avatar-grid-item.selected')?.dataset.icon || 'circle';
    const ci = parseInt($('.avatar-color-item.selected')?.dataset.ci || '0');
    try {
      await save.withBatch(async () => {
        if (!showingPhoto && save.getAvatar().photo) await save.removeAvatarPhoto();
        await save.setAvatar(icon, ci);
      });
    } catch { photoStatus('storage'); $('#avatarUploadStatus').scrollIntoView({ block: 'nearest' }); return; }
    app.engagement?.trackAvatarChange();
    updateAvatarDisplay();
    showHome();
  });
}
