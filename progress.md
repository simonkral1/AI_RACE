Original prompt: "Let's try to make a plan for building a kind of video game... The players can play against AIs or other humans. It's going to be about getting to AGI first but also making it safe."

- 2026-02-05: Initialized web UI mock with interactive board, faction selection overlay, player orders, and tech tree.
- 2026-02-05: Replaced DOM node board with canvas renderer, added hit-testing, active order row targeting, and render_game_to_text/advanceTime hooks.
- TODO: Add board interactions (node click sets target/order) and POV intel system.
- TODO: Add event deck + modal choices.
- TODO: Add proper canvas renderer + render_game_to_text + advanceTime for automated Playwright testing.
