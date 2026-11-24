# Lanternhold

Read `docs/HANDOFF.md` first. It covers where the code lives, the release steps and house rules.

- Ship changes bundled: collect John's asks into one numbered release (see PATCH_NOTES in `lanternhold/ui.js`), test together, ship once with one summary. Only urgent fixes ship alone.
- Before each release run `python3 lanternhold/stamp.py`; check the wiki with `node lanternhold-wiki/build.js && rm -rf lanternhold-wiki/out`.
- Merging to `main` publishes the live site. AWS (infra/) changes deploy separately and need John's go.
