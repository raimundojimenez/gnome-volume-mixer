# UX Vocabulary / Vocabulario UX

## Purpose / Propósito

This glossary standardizes UI terminology for this GNOME extension in both English and Spanish.
Este glosario estandariza la terminología de UI para esta extensión de GNOME en inglés y español.

Use these terms in issues, PRs, commits, and bug reports to avoid ambiguity.
Usa estos términos en issues, PRs, commits e informes de bugs para evitar ambigüedades.

## Surfaces / Superficies

| Recommended Term (EN) | Término recomendado (ES) | What it means | Dónde aplica |
|---|---|---|---|
| Quick Settings | Ajustes rápidos | GNOME panel menu opened from top-right system status area. | GNOME Shell core UI |
| Quick Settings Tile | Tile de Ajustes rápidos | A toggle/action card inside the Quick Settings grid. | `src/volumeBoostIndicator.js` |
| System Indicator | Indicador del sistema | Icon/entry attached to Quick Settings via `SystemIndicator`. | `src/volumeBoostIndicator.js` |
| Panel Icon | Icono de panel | Top bar icon shown in GNOME panel status area. | `src/panelIndicator.js` |
| Panel Popup Menu | Menú emergente del icono de panel | Menu opened when clicking the panel icon. | `src/panelIndicator.js` |
| Volume Menu | Menú de volumen | Native GNOME audio submenu where the extension injects app sliders. | `src/extension.js`, `src/volumeMixerPopupMenu.js` |
| Menu Section | Sección de menú | Group of menu items inserted as a unit (`PopupMenuSection`). | `src/volumeMixerPopupMenu.js` |

## Controls / Controles

| Recommended Term (EN) | Término recomendado (ES) | What it means | Dónde aplica |
|---|---|---|---|
| Slider | Deslizador | Horizontal value control for volume level. | `src/deviceStreamSlider.js`, `src/applicationStreamSlider.js` |
| Device Slider | Deslizador de dispositivo | Slider bound to default output/input stream. | `src/deviceStreamSlider.js` |
| Application Slider | Deslizador de aplicación | Slider bound to one app audio stream (`sink input`). | `src/applicationStreamSlider.js` |
| Toggle | Interruptor | Two-state switch (on/off). | Quick Settings tile, panel popup switch |
| Volume Boost | Amplificación de volumen | System setting allowing >100% output volume. | `org.gnome.desktop.sound::allow-volume-above-100-percent` |
| Empty State | Estado vacío | Informational row shown when no eligible app streams exist. | `src/volumeMixerPopupMenu.js` |

## Audio Model Terms / Términos del modelo de audio

| Recommended Term (EN) | Término recomendado (ES) | What it means |
|---|---|---|
| Stream | Flujo de audio | Generic GVC stream object returned by mixer control. |
| Application Stream / Sink Input | Flujo de aplicación / Sink Input | Per-app output stream shown in app mixer. |
| Output Device / Sink | Dispositivo de salida / Sink | Default audio output endpoint (speakers, HDMI, USB headset). |
| Input Device / Source | Dispositivo de entrada / Source | Default audio input endpoint (microphone). |
| Muted | Silenciado | Audio is explicitly muted regardless of slider value. |

## Naming Rules / Reglas de nomenclatura

1. Use `Quick Settings tile` for grid cards, not for menu rows.
2. Use `panel icon` for top bar indicator, not `extension icon`.
3. Use `panel popup menu` for the menu opened from panel icon.
4. Use `volume menu section` for injected `PopupMenuSection` in native sound menu.
5. Use `application stream` (or `sink input`) when referring to per-app sliders.
6. Use `empty state` only when there are no visible app streams.

## Terms to Avoid / Términos a evitar

| Avoid | Prefer |
|---|---|
| "botón de volumen" (generic) | `slider`, `toggle`, or `tile` depending on control |
| "icono de la extensión" (ambiguous) | `panel icon` or `Quick Settings tile icon` |
| "menu de audio" (generic) | `volume menu` or `panel popup menu` |
| "aplicación activa" (ambiguous) | `application stream` |

## Example Phrases / Frases de ejemplo

- EN: "The **Quick Settings tile** toggles boost correctly, but the **panel popup slider** still caps at 100%."
- ES: "El **tile de Ajustes rápidos** activa el boost correctamente, pero el **deslizador del popup del panel** sigue limitado al 100%."

- EN: "The **empty state** is visible even with an active Chrome **application stream**."
- ES: "El **estado vacío** aparece aunque exista un **flujo de aplicación** activo de Chrome."

- EN: "A stale **volume menu section** remained after extension reload."
- ES: "Quedó una **sección de menú de volumen** huérfana tras recargar la extensión."
