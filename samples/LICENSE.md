# Sample track licences

**No sample tracks are shipped.** The shelf is empty on purpose.

For every audio file you add to this folder, add one line here before you build. `npm run audit` (which also runs at the end of `npm run verify:site`) fails if an audio file in `samples/` is not named below, and the register in `docs/LICENSING.md` must still say the shelf holds only what is listed.

One line per file, in this form:

```
- `File_Name.m4a`: title, who made it, the licence (with a link to its text), where it came from, and any credit it requires.
```

Only add music you made, or music whose licence lets anyone download and play it from a public website. "Free to listen to" is not the same as "free to redistribute". If you are not sure, leave it out.
