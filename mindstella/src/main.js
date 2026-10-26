import './styles.css';
import { createStore } from './app/store.js';
import { createApp } from './app/app.js';
import { createWorld } from './world/world.js';
import { isNative } from './platform/platform.js';
import { closeSheet, currentSheet } from './ui/sheets.js';
import { App } from '@capacitor/app';
import { updateSettings } from './domain/state.js';

async function boot() {
  const store = await createStore();
  const prefersReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (prefersReduced && !store.state.profile.avatarId && !store.state.settings.reducedMotion) {
    // Systemeinstellung beim ersten Start übernehmen; danach entscheidet der Nutzer.
    await store.commit(updateSettings(store.state, { reducedMotion: true }), { immediate: true });
  }
  let world;
  try {
    world = createWorld(document.getElementById('world'), { reducedMotion: store.state.settings.reducedMotion });
  } catch (err) {
    console.error(err);
    document.getElementById('ui').innerHTML =
      '<div class="card" style="margin:auto"><h1>3D-Darstellung nicht verfügbar</h1><p>Dieses Gerät unterstützt WebGL nicht oder hat es deaktiviert. Der Prototyp benötigt WebGL.</p></div>';
    return;
  }
  const app = createApp({ store, world, root: document.getElementById('ui') });
  await app.init();

  if (isNative) {
    App.addListener('backButton', () => {
      if (currentSheet()) closeSheet();
      else App.minimizeApp();
    });
  }
  window.__mindstella = { store, app, world };
}

boot();
