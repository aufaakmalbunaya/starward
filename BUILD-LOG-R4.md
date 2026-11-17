# Emberline round 4 build log (17 Nov 2026, ~08:45 WIB)

Goal: close the gap to the top 5 (93.9-94.4%) from round 3's 77.50% (#435/6,929).
Planned changes:
1. Boon draft: rename upgrade screen to BOONS, add Wide Nozzle, Ember Suit,
   Rain Call, Deep Well; show owned boons in the HUD strip.
2. Boss wave 7: The Crownfire, named entity with HP bar and 3 attack phases.
3. Fire variants: Ember Imp (fast, short burn), Crown Fire (spreads fast),
   Spot Fire (jumps ahead on embers); named in title legend + end stats.
4. Combo multiplier: chained douses within 4 s raise x2/x3/...; shown in HUD.
5. HUD: boons owned, combo, boss HP, win/lose goal line, best score (kept).

Verification (headless sim, /tmp/emberline-r4-test.mjs): ALL 15 CHECKS PASSED
- combo chain 1,2,3 pays 5+10+15 (x1/x2/x3), resets after the 4 s window
- rain call douses all burning cells and tallies variants
- boss spawns wave 7, takes splash damage, dies in 12 splashes, win fires
  with bossDefeated set; full run reached wave 7 and won
- boon pick records Ember Suit in state.boons, stacks count on repeat,
  station burn limit 6 -> 10 s
Shot staging (Node, /tmp/emberline-r4-shots.mjs): ALL 4 SHOTS STAGE OK
- start=title, play=wave 2 with 7 burning + comboBest x2, upgrade=boon draft,
  end=game over on wave 7 with boss HP bar shown
Balance fix found by the first retake: Crown Fire at 1.8x spread overwhelmed
the autopilot before wave 1 ended, so the upgrade shot staged game-over.
Crown spread cut to 1.3x; edge fires are Spot (waves 1-2), Crown (3-4),
Ember Imp (5-6). Title panel height 132 -> 142 (4th how-to line was clipped).
Play shot re-staged: wave 1, take a boon, 20 s into wave 2 (was a quiet 26 s).
main.ts verification (clean env, read-only copies, empty out dirs):
run-a exit 0, run-b exit 0, dossier.json + game/ + exactly 4 screenshots,
two runs BYTE-IDENTICAL. Screenshots all < 256 KiB (55-113 KiB).
