# Grand Theft: Block City

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/AvinkLis/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/AvinkLis/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

A 2D top-down open-world crime game in pure canvas — no dependencies.
Entry for the [make.fun gta6-01 "Make GTA 6" competition](https://make.fun/bounty/gta6-01).

## The game

A procedurally generated city (seeded): a road grid, ~100 collidable
buildings, parked and moving traffic. Walk or sprint on foot, hop into
any car (E/F) and drive with collision physics. Pedestrians wander the
streets; commit crimes and the wanted level climbs from 0 to 5 stars as
police AI gives chase — get caught and it's BUSTED, wreck and it's
WASTED. A three-mission chain (timed): deliver a package, destroy a
rival's car, then escape until your wanted level clears — paying
$500 / $750 / $1,000 — after which the city is yours in free roam.
HUD shows cash, wanted stars and health, with a minimap and target
markers; title, pause, BUSTED and WASTED screens included.

## Run it

```bash
node main.ts   # writes the submission dossier to $MAKEFUN_OUTPUT_DIR
node serve.ts  # serves the playable game locally
```

Open the served page and play: WASD/arrows to move, E/F to enter and
exit cars. Screenshot contract: `?shot=start|play|end&seed=N`.

## License

MIT — see [LICENSE](LICENSE).
