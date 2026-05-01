/* ═══════════════════════════════════════
   SCS Play — Avatar Selection Screen
   Icon picker, color picker, photo upload.
   ═══════════════════════════════════════ */
import { CONFIG }           from '../config.js';
import { $, $$, setHTML, showScreen, safeSrc } from '../helpers/dom.js';
import { updateAvatarDisplay } from '../helpers/avatarDisplayHelper.js';
import { avatarSVG }        from '../renderers/avatars.js';
import app                   from '../appState.js';

function renderAvatarPreview(icon, colorIndex, photo) {
  if (photo) {
    setHTML('#avatarPreviewSvg', `<img src="${safeSrc(photo)}" alt="Avatar" style="width:52px;height:52px;border-radius:50%;object-fit:cover">`);
  } else {
    const color = CONFIG.COLORS.normal[colorIndex] || CONFIG.COLORS.normal[0];
    setHTML('#avatarPreviewSvg', avatarSVG(icon, color, 52));
  }
}

function renderAvatarIconGrid(selectedIcon) {
  const { audio } = app;
  const grid = $('#avatarIconGrid');
  if (!grid) return;
  /* Use CSS variable for icon color so it adapts to light/dark theme (P1 white-on-white fix) */
  const iconColor = getComputedStyle(document.documentElement).getPropertyValue('--icon-on-surface').trim() || '#CBD5E1';
  grid.innerHTML = CONFIG.AVATAR_ICONS.map(icon => {
    const selected = icon === selectedIcon ? 'selected' : '';
    const color = selected ? (CONFIG.COLORS.normal[parseInt($('.avatar-color-item.selected')?.dataset.ci || '0')] || iconColor) : iconColor;
    return `<div class="avatar-grid-item ${selected}" data-icon="${icon}">${avatarSVG(icon, color, 28)}</div>`;
  }).join('');

  $$('.avatar-grid-item', grid).forEach(item => {
    item.addEventListener('click', () => {
      $$('.avatar-grid-item', grid).forEach(i => i.classList.remove('selected'));
      item.classList.add('selected');
      const ci = parseInt($('.avatar-color-item.selected')?.dataset.ci || '0');
      renderAvatarPreview(item.dataset.icon, ci);
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
    return `<div class="avatar-color-item ${selected}" data-ci="${ci}" style="background:${color}"></div>`;
  }).join('');

  $$('.avatar-color-item', grid).forEach(item => {
    item.addEventListener('click', () => {
      $$('.avatar-color-item', grid).forEach(i => i.classList.remove('selected'));
      item.classList.add('selected');
      const icon = $('.avatar-grid-item.selected')?.dataset.icon || 'circle';
      renderAvatarPreview(icon, parseInt(item.dataset.ci));
      audio.tap();
    });
  });
}

function resizeImageToBase64(file, maxSize = 128) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const min = Math.min(img.width, img.height);
        const sx = (img.width - min) / 2;
        const sy = (img.height - min) / 2;
        canvas.width = maxSize;
        canvas.height = maxSize;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, sx, sy, min, min, 0, 0, maxSize, maxSize);
        resolve(canvas.toDataURL('image/webp', 0.8));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function setupAvatarUpload(showStore) {
  const { save, audio } = app;
  const locked   = $('#avatarUploadLocked');
  const unlocked = $('#avatarUploadUnlocked');
  const fileInput = $('#avatarFileInput');
  const removeBtn = $('#btnAvatarRemovePhoto');
  const buyBtn   = $('#btnAvatarBuyUpload');

  const hasPurchased = save.hasPurchase('avatar_photo');
  if (locked)   locked.style.display = hasPurchased ? 'none' : '';
  if (unlocked) unlocked.style.display = hasPurchased ? '' : 'none';

  const avatar = save.getAvatar();
  if (removeBtn) removeBtn.style.display = avatar.photo ? '' : 'none';

  if (buyBtn) { buyBtn.onclick = () => { showStore(); audio.tap(); }; }

  if (fileInput) {
    fileInput.value = '';
    fileInput.onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file || !file.type.startsWith('image/')) return;
      try {
        const base64 = await resizeImageToBase64(file, 128);
        await save.setAvatarPhoto(base64);
        app.engagement?.trackAvatarChange();
        renderAvatarPreview(null, null, base64);
        if (removeBtn) removeBtn.style.display = '';
        audio.tap();
      } catch {}
    };
  }

  if (removeBtn) {
    removeBtn.onclick = async () => {
      await save.removeAvatarPhoto();
      const av = save.getAvatar();
      renderAvatarPreview(av.icon, av.colorIndex);
      removeBtn.style.display = 'none';
      audio.tap();
    };
  }
}

export function showAvatarSelect(showStore) {
  const { save } = app;
  showScreen('avatarSelect', app);
  const avatar = save.getAvatar();
  renderAvatarPreview(avatar.icon, avatar.colorIndex, avatar.photo);
  renderAvatarIconGrid(avatar.icon);
  renderAvatarColorGrid(avatar.colorIndex);
  setupAvatarUpload(showStore);
}

export function bindAvatarSave(showHome) {
  const { save } = app;
  $('#btnAvatarSave')?.addEventListener('click', async () => {
    const icon = $('.avatar-grid-item.selected')?.dataset.icon || 'circle';
    const ci = parseInt($('.avatar-color-item.selected')?.dataset.ci || '0');
    await save.setAvatar(icon, ci);
    app.engagement?.trackAvatarChange();
    updateAvatarDisplay();
    showHome();
  });
}
