# Sample tracks

This folder is empty on purpose: the app ships with no bundled music. Audio files you add here appear under **Sample tracks** in the *Stems* and *Transcribe* panels so anyone who opens the site can play along without uploading anything.

**Add one:** drop an `.m4a`, `.mp3`, `.wav`, `.ogg` or `.flac` file here, optionally give it a title in `info.json` (`{ "My_Track.m4a": { "title": "My Track", "note": "Sample track" } }`), describe its licence in `LICENSE.md`, then run `npm run build` (it regenerates `manifest.json`) and commit. Keep files modest (a few MB each): the browser downloads a track only when someone taps it.

Only add music you own or have the right to share. Everything committed to a public repository is public.
