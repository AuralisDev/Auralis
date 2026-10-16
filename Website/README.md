# Auralis Website

This folder contains the public static website and dashboard frontend. GitHub Pages deploys it through the repository-root workflow in `.github/workflows/pages.yml`.

## Configuration

Edit `config.js`:

- `siteUrl`: your public GitHub Pages URL (`https://auralis.github.io/Auralis-Discord-Bot/`).
- `apiBase`: the real HTTPS base URL of your running Node.js service, without a final slash. Example: `https://YOUR-SERVICE.onrender.com`.
- `clientId`: Discord Application ID.
- `discordInstall.integrationType`: `0` for Guild Install; Auralis' full bot invite should use `0`.
- `discordInstall.scopes`: `bot` and `applications.commands` for the server installation.
- `discordInstall.permissions`: the integer/bitmask used by the invite URL.

The invite URL is generated automatically. Never put `DISCORD_TOKEN`, `DISCORD_CLIENT_SECRET`, `SESSION_SECRET` or OAuth access tokens into this public file.

For the real dashboard login, the backend host should redirect successful logins to its own `/dashboard/` page. The dashboard is then on the same origin as its API and can use the secure session cookie as a first-party cookie. The GitHub Pages website remains the public front page.

## Build locally

```bash
node build.mjs
```

The static output is written to `dist/`. GitHub Pages serves this output. This folder cannot run the Discord bot or OAuth callback by itself.

## Public server-list sync

The GitHub Actions workflow uses the repository variable `AURALIS_API_BASE` before the website build. It downloads `GET /public/api/servers` and writes the response to `data/servers.json`. No Bot Token belongs in GitHub Actions.
