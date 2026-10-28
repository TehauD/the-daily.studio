# Security policy

the-daily.studio runs entirely in the browser and has no server component, accounts or telemetry. The relevant risks are therefore about **what the page can access** (microphone, camera, MIDI, local storage) and **what it loads**. The only other sites it can reach are jsDelivr and Google storage, only after the visitor agrees to a one-time MediaPipe download; see [docs/SECURITY_MODEL.md](docs/SECURITY_MODEL.md).

## Supported versions

Security fixes go to the latest release on `main`.

## Reporting a vulnerability

Please **do not open a public issue** for a security problem. Use GitHub's **Report a vulnerability** button on the repository's *Security* tab (private vulnerability reporting). Include the browser, steps to reproduce and the impact. You will get an acknowledgement within a few days.

## Scope notes

* The app makes no third-party requests by default. Optional camera features (hand tracking, person cut-out) load MediaPipe from jsDelivr and Google storage when you enable them (see `docs/HOSTING.md` to self-host the files). A hash-based Content-Security-Policy is built into the page (and sent as a header by the deployed site, with framing denied), so only the shipped script can run. Microphone access is never requested until you press a button, and Ctrl/Cmd + . stops all audio and releases it. See `docs/SECURITY_MODEL.md` for the full model.
* Project files you import (JSON, WAV, MP3, presets) are parsed locally. A malformed file should produce an error message, never code execution; please report any case where it does.
* Saved data lives in the browser's `localStorage` for the site's origin. Anyone with access to your browser profile can read it.
