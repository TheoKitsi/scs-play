import app from '../appState.js';
import { avatarHTML } from '../renderers/avatars.js';
import { setHTML } from './dom.js';

export function updateAvatarDisplay() {
  const avatar = app.save.getAvatar();
  setHTML('#homeAvatar', avatarHTML(avatar, 24));
}