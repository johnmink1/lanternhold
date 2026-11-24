# Lanternhold

Lanternhold is a free idle dungeon crawler from Born 2 Game, LLC.

Play it at https://lanternhold.born2gamellc.com

## What's here

| Path | What it is |
|---|---|
| `lanternhold/` | The game (static site): `core.js` rules, `ui.js` UI + guide + patch notes, art, music, `stamp.py`. |
| `lanternhold-wiki/` | Builds the player wiki at `/wiki` from the game files. |
| `lanternhold-music/` | The music renderer. |
| `infra/` | AWS backend (CloudFormation stack `lanternhold`, Lambda sources, chat, Ember Ring). |
| `docs/HANDOFF.md` | Start here: how everything works, how to release, open asks. |
| `docs/lanternhold-promo/` | Promo handoff and assets. |

Pushing to `main` publishes the site through `.github/workflows/deploy.yml` (GitHub Pages).

The source moved here from `johnmink1/pricing-tools` on 24 Nov 2026, with its history.
