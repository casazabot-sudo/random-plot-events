# Random Plot Events for SillyTavern

Version: 2.0.0

A small open-source SillyTavern UI extension that asks the model to organically introduce a story event into the next roleplay response.

## Features

- Random automatic trigger interval (20–30 messages by default).
- Independent toggle for automatic events.
- Manual trigger button that queues an event for the next generation.
- Event categories: discovery, complication, unexpected encounter, danger, social conflict, mystery/clue, opportunity, environmental event, consequence, romance.
- Event intensity: subtle, balanced, dramatic.
- Optional avoidance of recently used categories.
- Per-chat trigger state and recent category history.
- No extra API calls: the event instruction is added to the prompt sent for the next response.

## Installation from GitHub

1. Make sure Git is installed.
2. In SillyTavern, open **Extensions → Install Extension**.
3. Paste this repository's URL, for example `https://github.com/YOUR-USERNAME/random-plot-events`.
4. Press Install and enable **Random Plot Events** in the Extensions panel.
5. If needed, refresh SillyTavern.

You can also install manually by placing this folder under:
`SillyTavern/data/<user-handle>/extensions/random-plot-events/`

## Settings

- **Automatic events**: enable or disable automatic triggers. The manual button still works when this is off.
- **Minimum / Maximum messages**: the next interval is randomly selected from this inclusive range.
- **Intensity**: controls how disruptive the event should be.
- **Avoid recent repeats**: tries not to choose categories that were used among the last three events.
- **Categories**: select which event types can be chosen. If all are disabled, a safe default set is used.

## How it works

The `generate_interceptor` hook inserts a temporary instruction into the prompt for the next assistant generation. The model is asked to preserve continuity, respect character agency, and reveal the event naturally in the scene.

## Development / troubleshooting

- Check the browser developer console (`F12 → Console`) for `[Random Plot Events]` errors.
- SillyTavern extension APIs can change; test against your current SillyTavern release.
- Do not install third-party extensions unless you trust their source.
- Before publishing, replace `YOUR-USERNAME` in `manifest.json` with your GitHub username and repository name.
