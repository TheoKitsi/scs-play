const FOCUSABLE = [
  'button:not([disabled]):not([hidden])',
  '[href]',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

const stack = [];

function getFocusable(modal) {
  return [...modal.querySelectorAll(FOCUSABLE)].filter(el => {
    const style = getComputedStyle(el);
    return !el.hidden && style.display !== 'none' && style.visibility !== 'hidden';
  });
}

function topEntry() {
  return stack[stack.length - 1] || null;
}

function handleKeydown(event) {
  const entry = topEntry();
  if (!entry) return;

  if (event.key === 'Escape') {
    event.preventDefault();
    event.stopPropagation();
    dismissTopModal('escape');
    return;
  }
  if (event.key !== 'Tab') return;

  const focusable = getFocusable(entry.element);
  if (!focusable.length) {
    event.preventDefault();
    entry.element.focus();
    return;
  }

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && (document.activeElement === first || !entry.element.contains(document.activeElement))) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && (document.activeElement === last || !entry.element.contains(document.activeElement))) {
    event.preventDefault();
    first.focus();
  }
}

document.addEventListener('keydown', handleKeydown, true);

export function openModal(element, options = {}) {
  if (!element) return false;
  const existing = stack.find(entry => entry.element === element);
  if (existing) return true;

  const previous = topEntry();
  if (previous) previous.element.setAttribute('aria-hidden', 'true');

  const entry = {
    element,
    returnFocus: document.activeElement instanceof HTMLElement ? document.activeElement : null,
    onDismiss: options.onDismiss,
    canDismiss: options.canDismiss,
    addedTabIndex: !element.hasAttribute('tabindex'),
    inerted: [...(element.parentElement?.children || [])].filter(sibling => sibling !== element && !sibling.inert),
  };
  stack.push(entry);

  element.setAttribute('role', 'dialog');
  element.setAttribute('aria-modal', 'true');
  element.setAttribute('aria-hidden', 'false');
  if (entry.addedTabIndex) element.setAttribute('tabindex', '-1');
  element.classList.add('active');
  entry.inerted.forEach(sibling => { sibling.inert = true; });

  requestAnimationFrame(() => {
    if (topEntry() !== entry) return;
    const initial = options.initialFocus
      ? element.querySelector(options.initialFocus)
      : getFocusable(element)[0];
    (initial || element).focus();
  });
  return true;
}

export function closeModal(element, { restoreFocus = true } = {}) {
  const index = stack.findIndex(entry => entry.element === element);
  if (index < 0) {
    element?.classList.remove('active');
    element?.setAttribute('aria-hidden', 'true');
    return false;
  }

  const [entry] = stack.splice(index, 1);
  element.classList.remove('active');
  element.setAttribute('aria-hidden', 'true');
  entry.inerted.forEach(sibling => { sibling.inert = false; });
  if (entry.addedTabIndex) element.removeAttribute('tabindex');

  const top = topEntry();
  if (top) top.element.setAttribute('aria-hidden', 'false');
  if (restoreFocus) {
    requestAnimationFrame(() => {
      if (top) {
        if (top.element.contains(entry.returnFocus)) entry.returnFocus.focus();
        else (getFocusable(top.element)[0] || top.element).focus();
      } else if (entry.returnFocus?.isConnected) {
        entry.returnFocus.focus();
      }
    });
  }
  return true;
}

export function dismissTopModal(reason = 'dismiss') {
  const entry = topEntry();
  if (!entry) return false;
  if (entry.canDismiss && !entry.canDismiss(reason)) return true;
  if (entry.onDismiss) entry.onDismiss(reason);
  else closeModal(entry.element);
  return true;
}
