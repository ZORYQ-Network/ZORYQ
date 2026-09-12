# ZORYQ Play — Rush City production execution

## Quality target

Rush City is being rebuilt as a game-engine product, not a React Native mini-game. The existing wallet mini-game remains only as legacy reference until the engine vertical slice is integrated and passes the quality gate.

## Vertical slice definition

The first production slice must prove these pillars together:

1. **Movement feel** — lane change, jump, slide, wall-run and high-speed readability.
2. **Camera feel** — stable follow, speed FOV, impact response and no motion sickness.
3. **Living route** — recycled procedural segments, multiple patterns, risk/reward ZQ lines and difficulty growth.
4. **World identity** — Neo Downtown, dark architecture with cyan/violet/magenta light language, readable silhouettes.
5. **Chase loop** — mistakes increase chase pressure; clean parkour and collection recover pressure.
6. **ZQ loop** — in-game ZQ collection only, isolated from wallet funds.
7. **Performance** — pooling/segment recycling and bounded world generation for mobile.
8. **Wallet boundary** — return a game session result only; no key/seed access.

## Production art replacement list

The generated engineering scene deliberately proves code first. Before commercial release, replace engineering geometry with final assets:

- hero: final modeled/rigged runner, 25+ traversal/combat animation clips
- 3 environment kits for Neo Downtown
- final ZQ coin mesh + pickup VFX
- 12 obstacle families with telegraph animations
- chase drone character and VFX
- speed trails, landing dust, wall-run sparks, near-miss effect
- authored music layers + parkour SFX + haptics
- final HUD, missions, results and progression screens

## Quality gate

Do not label the game “AAA”, “finished” or “Subway Surfers-level” until a device build demonstrates: stable 60 FPS on target mid-range Android hardware, final art in the slice, final animation/VFX/audio, crash-free play sessions, onboarding, progression and playtest retention data.

## Next code milestones

- native Android Unity-as-a-Library host (`ZoryqGameBridge`)
- server-authoritative run/reward validation
- object pooling instead of runtime Instantiate/Destroy for all obstacles/collectibles
- animation state machine and root-motion traversal hooks
- chase drone AI
- mission system and persistent profile
- Addressables content delivery
- device performance presets LOW/MEDIUM/HIGH/ULTRA
