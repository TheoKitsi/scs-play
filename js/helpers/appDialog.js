import { openModal, closeModal } from './modal.js';
import { t } from '../i18n.js';

let root = null;
let pending = null;

function finish(value, restoreFocus = true) {
  if (!pending) return;
  const resolve = pending;
  pending = null;
  closeModal(root, { restoreFocus });
  resolve(value);
}

/** One bounded, text-only application dialog. Back/Escape never confirm. */
export function appDialog({ title, message, confirmLabel, cancelLabel, copyText } = {}) {
  finish(false);
  if (!root) {
    root = document.createElement('div');
    root.id = 'appDialog';
    root.className = 'app-dialog-overlay';
    root.hidden = root.inert = true;
    root.setAttribute('aria-labelledby', 'appDialogTitle');
    root.setAttribute('aria-describedby', 'appDialogMessage');
    root.innerHTML = '<section class="app-dialog-panel"><h2 id="appDialogTitle"></h2><p id="appDialogMessage"></p><textarea id="appDialogCopy" readonly hidden></textarea><div class="app-dialog-actions"><button type="button" id="appDialogCancel" class="btn btn-secondary"></button><button type="button" id="appDialogConfirm" class="btn btn-primary"></button></div></section>';
    document.body.appendChild(root);
    root.querySelector('#appDialogConfirm').addEventListener('click', () => finish(true));
    root.querySelector('#appDialogCancel').addEventListener('click', () => finish(false));
    root.addEventListener('click', event => { if (event.target === root) finish(false); });
    window.addEventListener('scs:screenchange', () => finish(false, false));
  }
  root.querySelector('#appDialogTitle').textContent = title || t('app_title');
  root.querySelector('#appDialogMessage').textContent = message || '';
  root.querySelector('#appDialogConfirm').textContent = confirmLabel || t('dialog_ok');
  const cancel = root.querySelector('#appDialogCancel');
  cancel.hidden = !cancelLabel;
  cancel.textContent = cancelLabel || '';
  const copy = root.querySelector('#appDialogCopy');
  copy.hidden = copyText == null;
  copy.value = copyText || '';
  copy.setAttribute('aria-label', t('share_copy_prompt'));
  return new Promise(resolve => {
    pending = resolve;
    openModal(root, { initialFocus: cancelLabel ? '#appDialogCancel' : '#appDialogConfirm', onDismiss: () => finish(false) });
  });
}
