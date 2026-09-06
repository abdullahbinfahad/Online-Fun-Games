# Arcade Evolution modernization

This repository now includes a shared, lightweight modernization layer for every game page except **Tetris Quantum** (`Tetris-Game`), **Fluffy Bird** (`Flappy-Bird-Game`), and **Cyber Road Crossing** (`Crossy-Road-Game`). Those three pages were intentionally left untouched.

The layer is implemented in `arcade-enhancer.css` and `arcade-enhancer.js`, which are referenced by the 29 eligible game pages. It provides a full-viewport responsive shell with safe-area support, a compact HUD for coins, XP, level, and streak, local progress persistence, daily gifts, sound feedback, a story panel, loadout messaging, reward toasts, and a shared `window.ArcadeEvolution.reward()` hook that future game-specific scoring code can call without coupling to the UI. The CSS avoids global layout assumptions and uses fixed overlays so it does not change the original game board dimensions.

Progress is stored per game in `localStorage`, so one game cannot overwrite another game's progression. The enhancement layer uses lightweight Web Audio beeps only after a user interaction or when sound is enabled; no large assets or new network requests were added.

## Verification

The repository was checked with JavaScript syntax validation, HTML injection checks, `git diff --check`, and a local static-server browser smoke test. The 2048 and Archery pages loaded with one HUD, no horizontal overflow, a dark full-viewport background, and a working `ArcadeEvolution` API. The excluded Tetris page loaded without the enhancement HUD. The shared script is intentionally non-invasive and does not replace any original game scripts.
