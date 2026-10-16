'use strict';
// Progressive enhancement only. Site content and contact work without JavaScript.
const menu = document.querySelector('.menu-mobile');
if (menu) {
  menu.querySelectorAll('a').forEach(link => link.addEventListener('click', () => { menu.open = false; }));
  document.addEventListener('keydown', event => { if (event.key === 'Escape') menu.open = false; });
  document.addEventListener('click', event => { if (menu.open && !menu.contains(event.target)) menu.open = false; });
}

// Countdown: geplanter Release-TAG in Deutschland, nicht verbindlicher Termin.
(function () {
  const display = document.querySelector('[data-release]');
  if (!display) return;
  const releaseDate = new Date(display.getAttribute('data-release'));
  const fields = [document.getElementById('count-days'), document.getElementById('count-hours'), document.getElementById('count-minutes'), document.getElementById('count-seconds')];
  const end = document.getElementById('countdown-end');
  const pad = value => String(value).padStart(2, '0');
  function update() {
    const remaining = Math.max(0, releaseDate.getTime() - Date.now());
    const seconds = Math.floor(remaining / 1000);
    const values = [Math.floor(seconds/86400), Math.floor((seconds%86400)/3600), Math.floor((seconds%3600)/60), seconds%60];
    fields.forEach((node, i) => { if (node) node.textContent = i === 0 ? String(values[i]) : pad(values[i]); });
    if (end) end.hidden = remaining > 0;
    if (remaining === 0 && tick) clearInterval(tick);
  }
  const tick = setInterval(update, 1000);
  update();
})();
