from pathlib import Path

source = Path("index.html").read_text(encoding="utf-8")

checks = {
    "six established token IDs": all(
        f"id:'{token}'" in source
        for token in ("revenge", "footballLoser", "doublegoal", "selfretter", "freistoss", "football")
    ),
    "Football Token uses a global one-time owner transaction": "settings/footballTokenOwner" in source and "v===null?uidTarget:undefined" in source,
    "Galaxy Gift spawn chance is 0.001%": "Math.random()<0.00001" in source,
    "15 gifts per round": "Array.from({length:15}" in source,
    "maximum three box opens": "opened.length>=3" in source,
    "Ocean loot is persisted": "players/'+uid+'/oceanLoot/'+run" in source,
    "Zombie loot is persisted": "players/'+uid+'/zombieLoot/'+run" in source,
    "Zombie event has five serum choices": "for(let i=0;i<5;i++)" in source and "SERUM '+(i+1)" in source,
    "LaserTag uses Three.js": "three.module.js" in source and "renderLaserTag3D" in source,
    "all thirty-four standard events have bespoke mini-games": "async function renderThemedEventMiniGame" in source and all(f"{name}:{{mode:" in source for name in ("pirate","carnival","ninja","toy","crystal","wildwest","bakery","comic","safari","cyber","wizard","moon","arcade","samurai","stoneage","masquerade","science","luxury","rainbow","timemachine","multiverse","football","dinosaur","candy","castle","space","ghost","winter","egypt","superhero","racing","dragon","music","mystery")),
    "Shop balance is transaction-based": "players/'+uid+'/shopBalance" in source and "runTransaction" in source,
}

for label, passed in checks.items():
    print(("PASS" if passed else "FAIL") + " — " + label)

failed = [label for label, passed in checks.items() if not passed]
if failed:
    raise SystemExit("Static invariant checks failed: " + "; ".join(failed))
