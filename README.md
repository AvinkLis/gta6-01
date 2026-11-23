# Grand Theft: Block City

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/AvinkLis/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/AvinkLis/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01)

My entry for the make.fun **gta6-01** "Make GTA 6" bounty: a top-down
open-world crime game that runs entirely in the browser. The whole thing
is hand-rolled canvas JavaScript with zero dependencies — open the page
and the city is just there, no build step, no network calls.

## What you do in Block City

Every run starts in a city the game builds for itself from a seed: a
grid of streets lined with roughly a hundred solid buildings, cars
parked along the kerbs, traffic rolling through the intersections, and
pedestrians minding their own business on the pavements.

You begin on foot. Stroll or sprint between the blocks, then slide into
any car you fancy and drive it — cars accelerate, brake, and crumple
against buildings and each other with simple collision physics. Cause
trouble and your wanted level climbs star by star, from a clean 0 up to
5; the higher it gets, the harder the police AI hunts you down. Let a
cop pin you and the run ends BUSTED; total your ride with you in it and
it ends WASTED.

Work is available, too. A chain of three timed missions strings the city
together: drop off a package across town, wreck a rival's car, then
break line of sight and stay gone until your stars cool off. They pay
$500, $750, and $1,000 in turn. Finish the chain and the leash comes off
— free roam, your city, your rules. The HUD keeps score the whole time:
cash in your pocket, stars over your head, health, a minimap, and a
marker pointing at whatever the current job wants from you. Title,
pause, BUSTED, and WASTED screens are all in.

## Running it

Hand the entry in (copies the game into the output folder and writes
the dossier a judge reads, plus a small manifest of what's inside):

```bash
node main.ts
```

Play it locally instead:

```bash
node serve.ts
```

then open http://localhost:8080 in a desktop browser.

Controls: **WASD** (or the arrow keys) to walk and drive, **E** to get
into a car, **F** to get back out.

## License

MIT — see [LICENSE](LICENSE).
