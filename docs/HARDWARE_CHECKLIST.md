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

## 10 · The first page, the Concert visual and the Show setup (2.4, 2.6)

- [ ] On a phone, open the site in a private tab: the headline, the three lead features and **Begin in the studio** are on the first screen without scrolling, and nothing asks for the microphone or camera until you press a button.
- [ ] **Try the demo song** opens a finished song with no microphone or camera prompt.
- [ ] Stage ▸ Concert on a projector or a second monitor (drag the **Clean output window** across and double-click it): the picture is smooth, the beams and the LED wall follow the chord and the drums, and the colour changes when the song moves to a new key.
- [ ] **Light comfort**: in Full show, on a real projector or TV in a dim room, the chorus never flashes more than about three times a second and nothing is uncomfortable to look at for a whole song; in Calm there is no strobe at all and the movement is slow and soft.
- [ ] **The six looks**: on the projector or second monitor, play the demo song through with each look (Stage ▸ Show setup ▸ Looks). Each looks different from the others, not just in colour: Theatre has no lasers or strobe; Backlight's beams come from the floor; Blades follow the spectrum; the Laser room's patterns land on the groove and change at the start of a phrase, not at random.
- [ ] **Output**: with the real projector, choose **Test pattern ▸ Bars** and **Grid** and line the picture up; check **Mirror** (rear projection) and **Flip** (ceiling mount) are the right way round; press <kbd>0</kbd> for blackout (it fades and returns) and <kbd>9</kbd> to freeze, and check the flash meter stays under 3. **Frame rate 30** is smooth on the slowest computer you will use.
- [ ] **Cues**: set a chorus cue, press **Preview** with no song and watch the picture on the real screen; then play the song and check the chorus does what you set.
- [ ] **Your pictures**: add a band photo as a backdrop, a logo and a picture as the LED wall; they show on the projector, change at each new section (two backdrops), and are still there after a reload. Remove one: it disappears everywhere.
- [ ] On a slow or old machine the show drops its laser halos and some lights rather than stuttering, and comes back when you stop other work.
- [ ] **Teach** lens on a TV across the room: the chord, its numeral and the next chords can be read from where the audience sits. **Sky** after a few minutes of playing: **⤓ Save sky** gives a picture you would print.

## 11 · Guided sessions and the Show preflight (2.7)

The sessions are tested against the app's own state. These need a real microphone, interface and projector, and ideally a person who has never seen the app.

- [ ] **Hum to a song, with a real microphone**: from the first page choose *Turn a hum into a song*. The card points at *Sing or hum*; the browser asks for the microphone only after you press it; humming 10–30 seconds and pressing Stop ticks the next steps; the band plays; changing the style ticks the step; *Done* finishes with the outro text.
- [ ] **Record guitar and voice, with an interface**: the sessions menu ▸ *Record guitar and voice* ▸ Connect ▸ your interface appears ▸ arm ▸ play ▸ Stop ▸ the take is heard back. Each step ticks without you touching the card.
- [ ] **Capture, with a real guitar**: Write ▸ ● Capture ▸ play single notes on each string, then open chords (E, A, D, G, C, Am, Em) and a barre chord. Check each lands on the right string and fret and the bar is named correctly. Repeat with a chord still ringing, with a dirty tone and with the interface gain high and low. Known limit: a quiet low note under a loud ringing chord may be missed.
- [ ] **Write on a phone**: Capture on a phone with the guitar plugged in; the tab and fretboard fit together and the keypad steps aside.
- [ ] **A first-time guitarist, five minutes**: without help, can they open *Play with a band* or *Write down what you play* and finish it? Note where they hesitate.
- [ ] **Loop & layer, with a real guitar**: *Record, loop and layer* ▸ connect the interface ▸ ⟲ Loop & layer, 4 bars, band off ▸ play chords for one pass ▸ play a lead on the second pass. Listen: do the chords stay in time with the click on the next pass? Is a note in the last beat before the loop point clipped? (Expected: a little, within your interface's delay.) Try *Keep looping*, *Add a layer*, *Undo layer*, and then export the mix.
- [ ] **Learn a song**: load a real song file. The session waits for the split to finish before it ticks *Load a song*; muting a part and pressing play ticks the next steps.
- [ ] **Show preflight, on the real output**: open the pop-out on the projector, run Bars, set the master level, press <kbd>0</kbd> twice, play the song. Each line ticks as it is done, and *Start over* clears them.
- [ ] **A first-time user** (a friend, a bandmate): without any help, can they hear something they made within about two minutes? Note where they hesitate, which word they do not know, and which card they close without reading. This is the measure that matters.
- [ ] **On a phone**: the first page shows all four goals and the way in on one screen; the session card is a slim strip above the bottom navigation and does not hide the control it points at.

## 12 · The harmony looks (2.10)

The ten looks were checked on simulated notes. These need a real voice and guitar.

- [ ] **Hex Resonance is the default**: a fresh browser profile opens on it, glowing like the start screen. After choosing another look and reloading, that look is still chosen.
- [ ] **Harmonic Gravity and Improv Field, with a real voice**: play a chord on the band (Gmaj7), sing the chord notes, then a half-step above one. The note should move out and turn red, and fall back in when you sing a chord note. Does the sentence match what you hear?
- [ ] **Voice & Guitar, with two inputs**: set a voice input and a guitar input. The voice swarm should follow your singing and the guitar swarm your playing; play a clash and see them push apart. Then try one input: the sung or played line is the voice.
- [ ] **Constellation**: sing a held note slightly flat, in tune, then slightly sharp. Stars should land left, centre and right. Compare with the tuner.
- [ ] **Rhythm Flow**: with the band running, play on the beat, then rush, then drag. Do the ripples fall where you would say the notes were?
- [ ] **Session Painting**: play for a minute and press Save picture. Does the PNG open and look like the screen?
- [ ] **Lightning comfort**: Mood Colour on a dominant chord with Light comfort on Calm (no lightning), Standard and Full. Never more than three flashes a second.
- [ ] **On a phone**: the look name, the focus line and the New session buttons do not overlap.

## 13 · The Audience view and the video take (2.11)

Checked with a fake camera, a fake microphone and simulated notes. These need real ones.

- [ ] **The video take, with a real guitar**: connect the interface, arm the Guitar lane, ⏺ Record the stage, play for a while, stop. The video is saved and a Guitar lane appears in the arrangement, lining up with the playhead where you started. Play it back with the video's sound off: does it sit where you played? Undo removes it.
- [ ] **The whole song, from the top**: the lane starts at the first beat, not the count-in, and lines up with the band.
- [ ] **No input connected**: only the video is saved, and the menu says how to add the input.
- [ ] **Audience view, with a real camera**: Monitor ▸ Widgets ▸ Audience ▸ Camera on, then *Me in front*. Is it the side the audience sees (text the right way round), and are you cut out cleanly?
- [ ] **A phone**: the widget fits the Monitor.

## 14 · Welcome Back, the progress journal and the hexagon field (2.12)

Checked with invented history and simulated chords. These need real use over real days.

- [ ] **A real return**: play for a few days, close the app, open it a week later (and, if you can, after a month). Does the first page feel like yours: the song, the layout, *Working on*, the latest recording? Is the wording kind after a gap?
- [ ] **Sessions and minutes are honest**: open the app and leave it alone for ten minutes; nothing should count. Play for two minutes; one session should.
- [ ] **A chord learned**: with a real guitar, play and hold a chord cleanly five times. Does it appear under *Chords you have learned*, and does a chord you only strummed past not?
- [ ] **A chord change, with headphones**: play along to a song with a G → C change a few times. Does *Progress* match how it felt, after five tries? Then try with speakers and no headphones: note whether the band is counted as you.
- [ ] **Ideas and finished songs**: a recorded take, a hum and a Capture each add an idea. Mark a song finished, then take it back.
- [ ] **The journal survives**: close and reopen the browser; Download my journal; Erase my journal (songs and recordings must stay).
- [ ] **White and dark-green hexagons**: start screen in Light and Dark; Hex Resonance on a real projector or TV in both; is the text readable on the white field?
- [ ] **Edge tabs**: on a laptop and a large monitor, are the tabs easy to find and never in the way? Do collapsing the sidebars, the arrangement and the panels feel natural with a mouse and with a trackpad? On a tablet there should be none.
- [ ] **Light or dark, from Appearance**: flip several times; do the screens, the visuals and the start page all follow at once?
- [ ] **Hexagon colours**: try each swatch and your own three on the start screen and on a projector or TV; is anything hard to read? Do the tabs named for each panel (I/O, Monitor…) read well down the edge, and does a collapsed sidebar list its panels clearly?
- [ ] **Behind you**: with your own camera and room light, set Camera look to *Me in front (green screen)* and try each of the six backdrops while you play. Do they sit well behind you, do any distract from the playing, and does anything feel too fast or too bright (try Calm)?
- [ ] **A phone**: Welcome Back fits (the labels stack above their values), and My progress is reachable from More.

## What to send back

For each failed line: the line, what you saw, the device, browser and version, and — if you can — the browser’s console text (right-click ▸ Inspect ▸ Console). Screenshots help. Nothing in the app collects or sends this for you.
