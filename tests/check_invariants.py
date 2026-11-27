from pathlib import Path

source = Path("index.html").read_text(encoding="utf-8")

checks = {
    "six established token IDs": all(
        f"id:'{token}'" in source
        for token in ("revenge", "footballLoser", "doublegoal", "selfretter", "freistoss", "football")
    ),
    "confirmed token odds remain unchanged": all(value in source for value in ("id:'revenge',name:'Revenge Token',emoji:'🔥',chance:.00025", "id:'doublegoal',name:'Double Goal Token',emoji:'⚽',chance:.0005", "id:'selfretter',name:'Selbst-Retter-Token',emoji:'🧤',chance:.001", "id:'freistoss',name:'Freistoß-Token',emoji:'🟥',chance:.0015", "id:'football',name:'Football Token',emoji:'🏆',chance:.002")),
    "random gift selection respects its filtered prize pool": "function weightedPrize(mult=1,sourceList=activePrizeList())" in source and "return weightedPrize(1,list)" in source,
    "Football Token uses a global one-time owner transaction": "settings/footballTokenOwner" in source and "v===null?uidTarget:undefined" in source,
    "Galaxy Gift spawn chance is 0.001% only during Galaxy Event": "eventState.active==='galaxy'&&Math.random()<0.00001" in source and "if(forceGalaxy||" not in source,
    "15 gifts per round": "Array.from({length:15}" in source,
    "maximum three box opens": "opened.length>=3" in source,
    "Ocean event challenge panel is reachable": "available=['pirate'" in source and "'ocean','zombie'" in source,
    "Ocean loot is persisted": "players/'+uid+'/oceanLoot/'+run" in source,
    "Zombie loot is persisted": "players/'+uid+'/zombieLoot/'+run" in source,
    "Zombie event has five serum choices": "for(let i=0;i<5;i++)" in source and "SERUM '+(i+1)" in source,
    "LaserTag uses Three.js": "three.module.js" in source and "renderLaserTag3D" in source,
    "all thirty-four standard events have bespoke mini-games": "async function renderThemedEventMiniGame" in source and all(f"{name}:{{mode:" in source for name in ("pirate","carnival","ninja","toy","crystal","wildwest","bakery","comic","safari","cyber","wizard","moon","arcade","samurai","stoneage","masquerade","science","luxury","rainbow","timemachine","multiverse","football","dinosaur","candy","castle","space","ghost","winter","egypt","superhero","racing","dragon","music","mystery")),
    "event challenge random outcomes persist per player and event run": "eventChallengeData/'+type+'/'+run" in source and "const challengeSecret=secretTx.snapshot.val()" in source and "const safe=Number(challengeSecret.mapSafe)" in source and "const keeper=Number(challengeSecret.keeper)" in source,
    "gift box claims persist across refreshes": "lastRoundId:roundId" in source and "boxClaims/'+roundId" in source and "count>=3" in source and "claimed[String(i)]" in source and "await saveRound();" in source and "if(!claim.committed)return" in source,
    "Comeback Gift uses saved per-player Admin Abuse participation": "players/'+uid+'/adminAbuseParticipation/'+abuseState.adminAbuseRunId" in source and "p.adminAbuseParticipation?.[runId]" in source and "Object.entries(allPlayers).filter" in source,
    "Comeback Gift requires a saved Admin Abuse run, not current online status": "if(!settings.adminAbuseRunId)return msg('cbAdminMsg'" in source and "p.adminAbuseParticipation?.[runId]" in source,
    "random recipient is limited to main-admin Admin Abuse": "scope==='random'" in source and "settings.adminAbuseActive!==true" in source and "role!=='admin'||!isOwner" in source and "id!==uid" in source,
    "Skibidi unlock occurs only when stopping the event": "const skibidiDone=eventState.active==='skibidi'" in source and "if(NEW_EVENT_TYPES.includes(type))" not in source,
    "Power Hours follow the confirmed schedule and use max rather than multiplication": "o.weekday==='Sat'||(m>=900&&m<1020)" in source and "Math.max(settings.luckEnabled" in source,
    "main-admin global luck is capped at 5x": 'id="adminLuck" type="number" min="1" max="5"' in source and "if(v>5)return msg('adminMsg'" in source,
    "Admin Abuse tips are main-admin-only and priority-sorted": "role==='admin'&&settings.adminAbuseActive===true" in source and "level:'DRINGEND'" in source and "level:'EMPFEHLUNG'" in source and "level:'OPTIONAL'" in source and "tips.sort((a,b)=>a.rank-b.rank)" in source,
    "Main-admin luck requires whole-number values": "!Number.isInteger(v)" in source,
    "shop purchases use the same merged catalog shown to players": "const item=currentShopCatalog().find(x=>x.id===id)" in source,
    "Shop balance is transaction-based": "players/'+uid+'/shopBalance" in source and "runTransaction" in source,
}

for label, passed in checks.items():
    print(("PASS" if passed else "FAIL") + " — " + label)

failed = [label for label, passed in checks.items() if not passed]
if failed:
    raise SystemExit("Static invariant checks failed: " + "; ".join(failed))
