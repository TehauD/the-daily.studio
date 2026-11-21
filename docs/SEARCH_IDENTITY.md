# Search and identity: Tehau

How the site says who made it, what to do after a deploy, and the words for the profiles outside this repository. Nothing here is a ranking promise: structured data and good links help search engines understand the connection; they do not decide what Google shows.

## What the site says (2.78)

- **Name.** Tehau is the public name and the brand ("Make things that matter."). Tehau DeBarthe is the alternate name, which joins the full name to the same person. The licence and © lines keep the full legal name.
- **One Person.** `https://the-daily.studio/#tehau`, with `name`, `alternateName`, `image` (`https://github.com/TehauD.png`), `url` (the About page), `description`, `jobTitle`, `brand`, and `sameAs` (GitHub, LinkedIn, Instagram, the journal). The identical node is in the homepage and About page JSON-LD (`personNode()` in `scripts/seo-pages.mjs`), so there is one entity, not two. The studio (`WebApplication`) and the site (`WebSite`) name Tehau as author and publisher. The other guide pages name Tehau as author.
- **About page.** `/guide/about/` (URL unchanged): `ProfilePage`, H1 "Tehau", the subtitle, the relationship to the-daily.studio, the origin story kept, links to GitHub, LinkedIn, Instagram and the journal, `og:type` profile, a round portrait served from this domain (`icons/tehau.jpg`, the same picture as the GitHub avatar, 32 kB).
- **Homepage.** Title "the-daily.studio — Free Guitar & Voice Studio by Tehau", a crawlable "Made by Tehau." line near the footer linking to the About page, `<meta name="author">` and `<link rel="author">`.
- **The picture.** The JSON-LD `image` is the GitHub URL as requested. If you would rather not depend on GitHub for it, set `PERSON.image` to `PERSON.photoUrl` in `scripts/seo-pages.mjs` (same picture, your own domain).
- `scripts/verify-site.mjs` fails the release if any of this drifts (one Person, the right `@id`, names, `sameAs`, titles, canonical URLs, the picture, the links).

## Bing Webmaster Tools

The first page carries `<meta name="msvalidate.01" content="CB179DEC…">` (the value is `SITE.bingVerify` in `scripts/seo-pages.mjs`; `verify-site` checks it is in the built page). After you deploy, press **Verify** in Bing Webmaster Tools, then submit `https://the-daily.studio/sitemap.xml`.

## After you deploy: Google Search Console

1. Add a **Domain property** for `the-daily.studio` (DNS TXT record in Cloudflare). It covers `journal.the-daily.studio` too.
2. **Sitemaps** ▸ submit `https://the-daily.studio/sitemap.xml`. Status should read "Success" with 15 pages.
3. **URL Inspection**: inspect each, check "URL is on Google" or "Page is indexable", then **Request indexing**:
   - `https://the-daily.studio/`
   - `https://the-daily.studio/guide/about/`
   - `https://the-daily.studio/guide/`
4. **Rich Results Test** (https://search.google.com/test/rich-results): test the live URLs `https://the-daily.studio/guide/about/` (look for "Profile page") and `https://the-daily.studio/`. **Schema Markup Validator** (https://validator.schema.org/): the same two URLs; expect no errors.
5. Confirm the live files: `https://the-daily.studio/icons/tehau.jpg` returns 200 (it is 404 until this is deployed), `https://the-daily.studio/robots.txt` has the Sitemap line, and `https://the-daily.studio/backstage/` still answers `X-Robots-Tag: noindex`.
6. For `journal.the-daily.studio`: it is a separate site with its own sitemap. If it has none, add one in its repository (TehauD/daily) and submit it under the same Domain property.
7. Re-inspect after a week; indexing and name searches take days to weeks, and nobody can promise a position.

## Profiles outside this repository (copy to paste)

Nothing external was changed. These are ready to paste.

**GitHub profile README** (repository `TehauD/TehauD`, file `README.md`):

```markdown
# Tehau

**Musician, software engineer & independent creator.** Make things that matter.

- 🎸 [the-daily.studio](https://the-daily.studio/): a free guitar and voice studio in your browser. Open source.
- 📓 [The Daily](https://journal.the-daily.studio/): my developer journal.
- ✍ [About me](https://the-daily.studio/guide/about/)
- 💼 [LinkedIn](https://www.linkedin.com/in/tehau/) · 📷 [Instagram](https://www.instagram.com/tehaud/)

Also known as Tehau DeBarthe.
```

In the GitHub **profile settings**: Name `Tehau`, Bio `Musician, software engineer & independent creator. Make things that matter.`, Website `https://the-daily.studio/`, Social accounts: add LinkedIn and Instagram. On the **the-daily.studio repository**: set the About website to `https://the-daily.studio/`, and topics such as `guitar`, `music`, `web-audio`, `open-source`.

**LinkedIn** (keep your name as it is on your documents; add Tehau where LinkedIn allows):
- Name: first `Tehau`, last `DeBarthe`. Custom URL stays `linkedin.com/in/tehau`.
- Headline: `Musician · Software Engineer · Independent Creator | Building the-daily.studio`
- Contact info ▸ Website: `https://the-daily.studio/` (label: Other / "the-daily.studio").
- Featured: add the link `https://the-daily.studio/` and the link `https://the-daily.studio/guide/about/`, with the short description below.
- About: *"I'm Tehau, a musician, software engineer and independent creator. My mom put a guitar in my hands when I was five, and I've been making things ever since. I built the-daily.studio, a free, private, open-source guitar and voice studio that runs in your browser, because making music shouldn't depend on expensive gear or complicated software. Make things that matter."*

**Instagram** (`@tehaud`): Name field `Tehau`; bio `Musician · Software engineer · Independent creator` / `Make things that matter.` / `🎸 the-daily.studio`; link `https://the-daily.studio/`. Post or pin one photo or reel of the studio in use, with `the-daily.studio` in the caption.

**The journal** (`journal.the-daily.studio`, a separate repository): add the same Person to its `<head>` so both sites agree:

```html
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Person","@id":"https://the-daily.studio/#tehau","name":"Tehau","alternateName":"Tehau DeBarthe","url":"https://the-daily.studio/guide/about/"}</script>
<link rel="author" href="https://the-daily.studio/guide/about/">
```

## Next steps, in order

1. Deploy, then do the Search Console steps above. Everything else builds on Google having seen the About page.
2. Make the three profiles say the same thing (name, tagline, link to the studio). Links in both directions are the strongest signal you control.
3. Write for the journal, under the name Tehau, with a link to the About page. The best candidates are things only you can write: why a creative tool should work with no account; how the studio is built with the browser's own audio and no frameworks; the story of the guitar at five. Authentic essays beat search-shaped articles.
4. Let other people link to it: the open-source repository's README (done), a "Show HN" or r/WeAreTheMusicMakers post when you want one, and any music or maker directories you belong to.
5. "Tehau" on its own is also a Tahitian given name and a place name, so expect it to take longer than "Tehau DeBarthe" or "Tehau musician". Using the same words everywhere (Tehau · musician · software engineer · the-daily.studio) is what teaches search engines which Tehau this is.
6. Later: when there is music or another product to point to, give each its own page and add it to the Person (`knowsAbout`, or `owns`/`creator` on the work).
