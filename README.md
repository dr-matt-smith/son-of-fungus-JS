# son-of-fungus-JS

(c) Matt Smith 2026

Vite project -

NOTES
- files in `/public` get added into the build in `/dist`
  - audio
  - images 
  - etc.

## 0. don't forget to install Node packages

```bash
npm install
```


## 1. run dev version

```bash
npm run dev
```

## 2. build dist(ribution) version in `dist`

```bash
npm run build 
```

and preview the build with:
```bash
 npm run preview
```

## 3. build for PythonAnywhere publish

PythonAnywhere serves this project from a sub-path
(e.g. `https://<user>.pythonanywhere.com/media/public/son-of-fungus`)
and the URL has no trailing slash, so relative `./assets/...` references
in the default build resolve against the parent path and 404.

Use the dedicated PA build, which sets Vite `base` to the absolute
sub-path so the emitted `index.html` references
`/media/public/son-of-fungus/assets/...`:

```bash
npm run build:pa
```

Then upload the contents of `dist/` to PythonAnywhere.

If the publish path ever changes (different host, different sub-folder,
or served from the site root), edit the `--base=...` value in the
`build:pa` script in `package.json`. To revert to a single build for
all hosts, delete the `build:pa` script and use `npm run build` (which
emits relative `./` paths, fine for site-root hosting or any host that
serves the project with a trailing slash on the URL).

### How runtime asset URLs (audio / images / examples) resolve

The PA build also injects a `<base href="…">` tag at startup (in
`src/js/main.js`) using Vite's `import.meta.env.BASE_URL`. This is
what makes runtime relative URLs — example JSON fetched by
`modals.js`, audio played by `engine.js`, portrait/stage images,
character sound effects — resolve against the published sub-path
even when the page URL has no trailing slash.

To revert this behaviour, remove the IIFE block at the top of
`src/js/main.js` (the one labelled "Inject `<base href>` from
Vite's BASE_URL"). The default `npm run build` is unaffected:
its `BASE_URL` is `./`, so the IIFE no-ops and `<base>` is not
inserted.



