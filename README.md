# My Project

A static HTML/CSS site that is built, tested and deployed to GitHub Pages by GitHub Actions.

## Layout

```
site/                     Your HTML, CSS and assets (edit these)
scripts/build.mjs         Copies site/ to dist/ and adds .nojekyll
scripts/test.mjs          Checks HTML basics and that every local link resolves
.github/workflows/deploy.yml   CI/CD pipeline
```

## Local use

Requires Node 20+. There are no dependencies to install.

```sh
npm run build   # site/ -> dist/
npm test        # validate dist/
npm run serve   # preview dist/ in the browser
```

## How deployment works

| Event               | Build + test | Deploy |
| ------------------- | :----------: | :----: |
| Pull request        |      yes     |   no   |
| Push to `main`      |      yes     |   yes  |
| Manual run (Actions tab) |  yes    |   yes  |

If the tests fail, nothing is deployed.

## One-time GitHub setup

1. Push this repository to GitHub.
2. Go to **Settings -> Pages**.
3. Under **Build and deployment -> Source**, choose **GitHub Actions**.
4. Push to `main` (or run the workflow from the **Actions** tab).

The site will be live at `https://<user>.github.io/<repo>/`. All links in the site are relative, so it works under that sub-path without changes.
