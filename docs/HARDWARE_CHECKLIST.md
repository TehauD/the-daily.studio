# Real-hardware checklist

The automated tests run in a real browser but with a **fake microphone and camera**, so they cannot tell you how the-daily.studio behaves with your actual interface, microphone, headphones, camera, MIDI keyboard, or on an iPhone. This page is the part of the release that only a person with the gear can do. It takes about 45 minutes. Print it, tick it, write down anything odd.

Do it on the **deployed site** (the real `https://` address), not on `localhost`, because browsers treat the two differently for microphone, camera, install and storage.

Record for each run: date · device · operating system · browser and version · interface / microphone · result. Anything that fails goes in an issue with those details.

## 0 · Before you start

- [ ] Open the site in a **new private window**. Nothing should ask for the microphone or camera. (If a permission prompt appears before you press a button, that is a bug.)
- [ ] Press **Ctrl/Cmd + .** once with nothing running. The Audio button should say audio is off and nothing should break.
- [ ] Note the version in **About** (it should match the release).

## 1 · Audio interface or microphone (desktop Chrome or Edge)

Gear: an audio interface with a guitar (a Focusrite Scarlett, say) **or** a USB or built-in microphone.

- [ ] **I/O ▸ Connect** with the interface chosen. The browser asks for the microphone only now. The card changes to *Connected*.
- [ ] Play or sing. The input meter moves; the level bar in the header Audio button moves.
- [ ] **Set my level**: play your loudest part for a few seconds. It proposes a trim; accept it. Peaks sit around −12 to −6 dBFS.
- [ ] **Channels**: with a two-input interface, put the guitar on input 1 and a microphone on input 2. Both meters move independently.
- [ ] **Hear myself** is off at first. Put on headphones, switch it on, confirm you hear yourself, switch it off. (With speakers it should be left off.)
- [ ] **Loopback latency test** (I/O ▸ Advanced & troubleshooting): connect output 1 to input 1 with a cable and run it. A number appears. Note it.
- [ ] **Output test** plays a short tone in the output device you chose. Change the output device and repeat.
- [ ] **Ctrl/Cmd + .** — the recording indicator in the browser tab disappears at once. Pressing **Connect** brings it back; nothing reconnects by itself.
- [ ] Unplug the interface while connected. The app says the input went away and offers to reconnect; it does not crash or keep recording silence.
- [ ] Plug in a **second** interface. The app offers it (“new interface found”) and does not switch on its own.

## 2 · Recording, clips and the mix

- [ ] Arm the guitar lane (●) and press **R**. A count-in plays, the take records, and both a dry and a wet version are kept.
- [ ] Record a vocal on input 2 at the same time as the guitar on input 1. Two lanes appear from one pass.
- [ ] **Clips:** click the take; drag it a little (it jumps by whole beats); drag an edge to trim; drag the corner squares for fades; **Ctrl + E** splits at the playhead. **Ctrl + Z** steps back through every one.
- [ ] Play the arrangement. Trimmed parts are silent where they were trimmed; fades are smooth, with no click at the cut.
- [ ] **Auto-balance** (master menu ▸ ⚖): the plan lists your lanes; apply it, listen, undo it.
- [ ] **Bounce master WAV**: the progress window appears, finishes in a fraction of the song’s length, and the saved file plays in another player at the same loudness as you heard.
- [ ] Switch **Render WAVs faster than real time** off in Settings ▸ Export, bounce again, compare the two files by ear: they should sound identical.

## 3 · Backing track and stems

- [ ] Drop an MP3 or M4A on the page ▸ **Backing track**. Stems appear; tempo and key are filled in.
- [ ] Mute the vocals stem and play along. Move a stem fader, **reload the page**, reopen the song: the stem mix is as you left it.
- [ ] Load a long file (5 minutes or more) on a phone and note how long separation takes.

## 4 · MIDI

- [ ] Drop a `.mid` file with a melody and a few other tracks. The window lists the tracks; the melody is chosen; **Create song** gives chords, tempo, key and a lead tab. Press play.
- [ ] Drop a karaoke file (`.kar`) if you have one: the words are placed under the chords.
- [ ] A **MIDI controller** (Chrome or Edge): **I/O ▸ MIDI controllers** lists it (press Enable MIDI); map a knob or a pad to a footswitch. Safari and Firefox do not offer Web MIDI. That is expected.

## 5 · Camera and visuals

- [ ] **Go on stage** (or Visuals ▸ Camera backdrop). The browser asks for the camera only now. The picture appears behind the visuals.
- [ ] **Look: edges-in** and **person (green screen)**: the models download (the first time takes a few seconds); the cut-out follows you.
- [ ] **Record the stage** for 10 seconds with the song playing: a video file with the song’s sound is saved.
- [ ] **Ctrl/Cmd + .** stops the camera and any recording at once, and the unfinished recording is discarded.

## 6 · iPhone and iPad (Safari)

- [ ] Open the site in Safari (not installed). **⋯ More ▸ Keep songs safe** (and the **My songs** window) explains **Add to Home Screen** and has a **Back up all songs** button. After your first recording, a tip offers the same.
- [ ] **Share ▸ Add to Home Screen.** Open from the icon: the address bar is gone, and **Keep songs safe** now says your browser keeps the library.
- [ ] Connect the microphone (it asks the first time). Record a vocal. Check the input is the one you expect when headphones are plugged in.
- [ ] Rotate the phone: the layout follows; the arrangement lanes, clip bar and **More** sheet are all usable with a thumb.
- [ ] Select a take and use the clip bar: **Split**, **Duplicate**, **Delete**, the arrows to nudge.
- [ ] Lock the phone for a minute during playback and unlock. Audio resumes without a click or a crash. (iOS may suspend audio when locked. Note what happens.)
- [ ] Back up all songs, delete the app from the Home Screen, open the site again, **Open a file** and choose the backup: the songs return.

## 7 · Android (Chrome)

- [ ] Install from the browser menu (**Install app**). Microphone and camera prompts appear only on a button press.
- [ ] Bluetooth headphones: play through them. Expect extra delay while recording; it is the headphones, not the app.
- [ ] USB-C interface: it appears in **I/O**.

## 8 · Firefox and Safari on a desktop

- [ ] Start card, **Connect**, record, **Bounce master WAV**, drop a file. Anything that behaves differently from Chrome is noted (for example, no Web MIDI, different latency).
- [ ] Safari on a Mac: **File ▸ Add to Dock**, then confirm **Keep songs safe** now says the library is kept.

## 9 · Offline and the backup

- [ ] Load the site once, switch the computer to airplane mode, reload. The studio opens and a saved song plays.
- [ ] **My songs ▸ Back up all songs** saves one zip. Reset the app (**Reset…**), then **Open a file** with the zip: every song and recording returns.
- [ ] (Chrome or Edge) **Settings ▸ Backup folder**: choose a folder; edit a song; a `.daily-song.zip` appears there.

## What to send back

For each failed line: the line, what you saw, the device, browser and version, and — if you can — the browser’s console text (right-click ▸ Inspect ▸ Console). Screenshots help. Nothing in the app collects or sends this for you.
