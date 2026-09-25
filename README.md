# LifeRPG

Questlog: a parchment quest log for everyday life. Quests on an Eisenhower board, campaigns, a Glossary of people and things worth remembering, and a Tavern to spend the gold you earn.

**Live:** https://lucasvanwijk.github.io/LifeRPG/ (open it on your phone and use Install app, or Share → Add to Home Screen on iPhone).

The web app lives in [`app/`](app/). See [`app/README.md`](app/README.md) for setup.

```sh
cd app
npm install
npm run dev
```

## Deployment

Every push to `main` runs [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml): it installs, runs the tests, builds `app/` and publishes it to GitHub Pages. It can also be started by hand from the Actions tab.

One-time setup: in the repository's **Settings → Pages**, set **Source** to **GitHub Actions**.
