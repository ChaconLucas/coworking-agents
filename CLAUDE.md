# coworking-agents — rules for AI sessions

- **English everywhere:** code, comments, docs and commit messages. UI strings live in `public/js/i18n.js` `I18N` with `pt` and `en`; add both when you add one.
- **Front end:** `public/art.js` (pixel art, `window.Art`) then the classic scripts in `public/js/` loaded in order by `public/index.html` (`main.js` last). They share top-level names through the global scope, so a name may be declared in only one file, and anything used at load time must come from an earlier file.
- **Zero runtime dependencies.** Plain Node and browser APIs only.
- **Measured, never guessed:** every on-screen state must come from a measured signal (transcript, session registry, processes). When the disk can't tell, show "unknown" instead of picking one.
- **Run `npm test` before every commit.**
- **Visual changes:** after any visual/design change run `npm run screenshots` and commit the updated `docs/*.png`.
- **Security:**
  - bind to `127.0.0.1` only. The one exception is the opt-in `--phone` panel (`src/phone.js`): its own small server on the LAN address, with its own per-run token, an exact Host and Origin match, and only the few phone routes. Never widen it to the office routes;
  - keep the Host allowlist, the access-token cookie and the CSP in `src/server.js`;
  - never read credentials (`*.key`, `auth.json`, tokens);
  - escape everything rendered into HTML with `esc()`.
- **Commit early and push.** Small commits, pushed right away.
