/**
 * Mindstella-Logo: Bildzeichen über dem Schriftzug.
 *
 * Vorläufiges Bildzeichen (vierstrahliger Stern über einem Horizontbogen mit
 * kleinem Mond). Der in der Beauftragung erwähnte Mindstella-Entwurf lag der
 * Entwicklung nicht vor; das Zeichen ist hier zentral hinterlegt und lässt
 * sich durch den freigegebenen Entwurf ersetzen.
 */
export const SIGNET_SVG = `
<svg class="signet" viewBox="0 0 64 64" role="img" aria-hidden="true" focusable="false">
  <path d="M32 6 C33.2 18 35.5 22.6 46 25 C35.5 27.4 33.2 32 32 44 C30.8 32 28.5 27.4 18 25 C28.5 22.6 30.8 18 32 6 Z" fill="currentColor"/>
  <circle cx="47.5" cy="12.5" r="2.6" fill="var(--logo-moon, #a9c3d6)"/>
  <path d="M8 56 Q32 41 56 56" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" opacity="0.75"/>
</svg>`;

export function logoMarkup({ size = 'large' } = {}) {
  return `<div class="logo logo--${size}" role="img" aria-label="Mindstella">${SIGNET_SVG}<span class="wordmark">Mindstella</span></div>`;
}
