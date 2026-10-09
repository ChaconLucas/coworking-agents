# coworking-agents — rules for AI sessions

- **English everywhere:** code, comments, docs and commit messages. UI strings live in `public/app.js` `I18N` with `pt` and `en`; add both when you add one.
- **Zero runtime dependencies.** Plain Node and browser APIs only.
- **Measured, never guessed:** every on-screen state must come from a measured signal (transcript, session registry, processes). When the disk can't tell, show "unknown" instead of picking one.
- **Run `npm test` before every commit.**
- **Visual changes:** after any visual/design change run `npm run screenshots` and commit the updated `docs/*.png`.
- **Security:**
  - bind to `127.0.0.1` only;
  - keep the Host allowlist, the access-token cookie and the CSP in `src/server.js`;
  - never read credentials (`*.key`, `auth.json`, tokens);
  - escape everything rendered into HTML with `esc()`.
- **Commit early and push.** Small commits, pushed right away.
