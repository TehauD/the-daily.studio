# The Daily (vendored)

This folder is a copy of the built page from https://github.com/TehauD/daily (MIT), source commit `f4b9fa1`.
It is served at https://the-daily.studio/journal/. Do not edit `index.html` by hand; refresh it with:

```
node scripts/sync-journal.mjs ../daily/public/index.html <commit>
```

The only change is a Content-Security-Policy meta tag (the live Azure copy sends the same policy as an HTTP header).
The Daily keeps its data in this browser under keys starting `daily`; the studio uses `fw.`. They never read each other's data.
