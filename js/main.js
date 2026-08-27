import { UI } from './ui.js';

window.addEventListener('DOMContentLoaded', () => UI.init());

// PWA: регистрация не должна мешать игре, если офлайн-кэш не нужен или
// не поддерживается (например, при открытии файла напрямую с диска).
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
