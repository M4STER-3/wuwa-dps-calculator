import { describe, expect, it } from "vitest";
import { chisa, chisaActions, chisaPreset } from "./chisa";
import { resolveActionTalentLevel } from "@/domain/talent-engine";
import { calculateActionOutcomes } from "@/domain/action-outcome-engine";
import { applyMotionValueModifiers } from "@/domain/motion-value-engine";
import { calculateActionDamage, calculateDefenseMultiplier } from "@/domain/damage-engine";
import { emptyCombatState, processEvent, type CombatEvent } from "@/domain/state-engine";
import { loadPersonalEffects, simulatePersonalCombat } from "@/domain/personal-combat-simulation";
import { createBuildFromPreset } from "@/domain/character-box";
import { calculateActionLab, DEFAULT_LAB_TARGET, resolvePersonalLoadout } from "@/domain/personal-dps-lab";
import type { FinalStats } from "@/domain/models";
import type { TemporalTimeline } from "@/domain/temporal-engine";

const byId = (id:string) => chisaActions.find(action=>action.id===id)!;
const stats: FinalStats = {...chisaPreset.finalStats,attack:1000,healingBonus:0};

describe("Chisa verified sparse Game Data",()=>{
  it("preserves exact Lv90 internal stats and catalog identity",()=>{
    expect(chisa).toMatchObject({id:"chisa",rarity:5,element:"havoc",weaponType:"broadblade",baseStats:[{hp:10775,attack:437.5,defense:1136.65,displayDefense:1137,critRate:5,critDamage:150,energyRegen:100}]});
    expect(chisa.minorFortes).toEqual(["Crit Rate +8%","ATK +12%"]);
  });

  it("selects Basic Lv1/Lv10 exactly and rejects missing/disputed levels",()=>{
    expect(resolveActionTalentLevel(byId("chisa-basic-1"),1)).toMatchObject({status:"supported",action:{multipliers:[{percent:8.4,hits:2}]}});
    expect(resolveActionTalentLevel(byId("chisa-basic-1"),10)).toMatchObject({status:"supported",action:{multipliers:[{percent:16.71,hits:2}]}});
    expect(resolveActionTalentLevel(byId("chisa-basic-1"),6).status).toBe("unsupported");
    expect(resolveActionTalentLevel(byId("chisa-heavy"),1).status).toBe("unsupported");
  });

  it.each([
    ["chisa-eye-of-unraveling",1,18],["chisa-eye-of-unraveling",6,26.2],["chisa-eye-of-unraveling",10,35.79],
    ["chisa-sawring-blitz-1",1,5.78],["chisa-sawring-blitz-1",6,8.41],["chisa-sawring-blitz-1",10,11.49],
    ["chisa-moment-of-nihility",1,480],["chisa-moment-of-nihility",6,698.45],["chisa-moment-of-nihility",10,954.29],
    ["chisa-intro",1,48],["chisa-intro",6,69.85],["chisa-intro",10,95.43],
  ])("resolves %s Lv%s exact MV",(id,level,mv)=>expect(resolveActionTalentLevel(byId(id as string),level as number)).toMatchObject({status:"supported",action:{multipliers:[{percent:mv}]}}));

  it("preserves classifications and exact Lv10 hit groups",()=>{
    expect(byId("chisa-death-snip")).toMatchObject({talent:"basicAttack",damageType:"resonanceLiberation",multipliers:[{percent:29.81,hits:1},{percent:14.91,hits:1},{percent:104.34,hits:1}]});
    expect(byId("chisa-heavy").damageType).toBe("heavyAttack");
    expect(byId("chisa-sawring-blitz-2")).toMatchObject({damageType:"resonanceLiberation",multipliers:[{percent:10.64,hits:8}]});
    expect(byId("chisa-intro").damageType).toBe("introSkill");
  });

  it("calculates healing and shield as non-damage outcomes",()=>{
    const death=calculateActionOutcomes(byId("chisa-death-snip").outcomes,10,stats);
    const liberation=calculateActionOutcomes(byId("chisa-moment-of-nihility").outcomes,10,stats);
    const shield=calculateActionOutcomes(byId("chisa-sawring-eradication").outcomes,10,stats);
    expect(death.outcomes).toEqual([expect.objectContaining({kind:"healing",amount:1644})]);
    expect(liberation.outcomes).toEqual([expect.objectContaining({kind:"healing",amount:3836})]);
    expect(shield.outcomes).toEqual([expect.objectContaining({kind:"shield",amount:5480,durationSeconds:30})]);
    expect(calculateActionOutcomes(byId("chisa-death-snip").outcomes,10,{...stats,healingBonus:20}).outcomes[0].amount).toBeCloseTo(1972.8);
  });

  it("distributes Eradication Ring additive MV 20/80 and applies MV-layer multiplier",()=>{
    const base=byId("chisa-sawring-eradication").multipliers;
    const ring=applyMotionValueModifiers(base,[{mode:"additive-percent",value:259,groupDistribution:[{groupIndex:0,weight:.2},{groupIndex:1,weight:.8}]}]);
    expect(ring.status).toBe("supported");
    if(ring.status==="supported") { expect(ring.groups[0].percent).toBeCloseTo(103.34); expect(ring.groups[1].percent).toBeCloseTo(413.33); expect(ring.groups.reduce((s,g)=>s+g.percent*g.hits,0)).toBeCloseTo(516.67); }
    const woven=applyMotionValueModifiers(base,[{mode:"relative-additive",value:120}]);expect(woven.status).toBe("supported");if(woven.status==="supported"){expect(woven.groups[0].percent).toBeCloseTo(113.388);expect(woven.groups[1].percent).toBeCloseTo(453.486);}
    const stacked=applyMotionValueModifiers(base,[{mode:"relative-additive",value:120},{mode:"relative-additive",value:120}]);if(stacked.status==="supported")expect(stacked.groups[0].percent).toBeCloseTo(51.54*3.4);
  });

  it("keeps DEF Reduction and DEF Ignore as independent formula terms",()=>{
    const baseline=calculateDefenseMultiplier(90,90,0,0).multiplier;
    const bane=calculateDefenseMultiplier(90,90,.06,0).multiplier;
    const both=calculateDefenseMultiplier(90,90,.06,.18).multiplier;
    expect(baseline).toBeLessThan(bane); expect(bane).toBeLessThan(both);
    const action=byId("chisa-basic-1");
    const damages=[{}, {defenseReduction:.06}, {defenseReduction:.06,defenseIgnore:.18}].map(modifiers=>calculateActionDamage({action,finalStats:stats,attackerLevel:90,scalingAttribute:"attack",element:"havoc",target:DEFAULT_LAB_TARGET,modifiers}));
    expect(damages.every(result=>result.status==="supported")).toBe(true);
    expect(damages.map(result=>result.status==="supported"?result.total.nonCrit:0)).toEqual([...damages.map(result=>result.status==="supported"?result.total.nonCrit:0)].sort((a,b)=>a-b));
  });
  it("gates verified personal Sequence rules without granting them at S0",()=>{
    const s0=loadPersonalEffects(chisa,0).definitions.find(definition=>definition.id==="chisa-sequence-personal");
    const s2=loadPersonalEffects(chisa,2).definitions.find(definition=>definition.id==="chisa-sequence-personal");
    const s5=loadPersonalEffects(chisa,5).definitions.find(definition=>definition.id==="chisa-sequence-personal");
    expect(s0).toBeUndefined();
    expect(s2?.rules.map(rule=>rule.id)).toEqual(["chisa-s2-res-ignore"]);
    expect(s5?.rules.map(rule=>rule.id)).toEqual(["chisa-s2-res-ignore","chisa-s3-chainsaw-mv","chisa-s5-liberation"]);
  });
});

describe("Chisa target-local Snare/Bane ICD",()=>{
  const panel=chisaPreset.finalStats;
  const event=(id:string,timestamp:number,kind:CombatEvent["kind"],targetId:string,extra:Partial<CombatEvent>={}):CombatEvent=>({id,timestamp,kind,ownerId:"chisa",actorId:"chisa",targetId,...extra});
  const run=(sequence:number)=>{
    const definitions=loadPersonalEffects(chisa,sequence).definitions;
    let state=emptyCombatState({chisa:{resources:{},namedStates:[]}},["a","b"]);
    const process=(e:CombatEvent)=>{const result=processEvent(state,e,definitions,{panelStats:panel,element:"havoc"});state=result.state;return result;};
    return{process,get state(){return state;}};
  };
  it("isolates targets, enforces 2s ICD, and attributes external-triggered Bane to Chisa",()=>{
    const r=run(0);
    r.process(event("snare",0,"action-hit","a",{actionId:"chisa-eye-of-unraveling"}));
    r.process(event("ally-1",.1,"damage-dealt","a",{ownerId:"ally",actorId:"ally",external:true}));
    expect(r.state.targets.a.statuses["havoc-bane"]).toMatchObject({stacks:1,sourceOwnerId:"chisa"});
    r.process(event("ally-2",1,"damage-dealt","a",{ownerId:"ally",actorId:"ally",external:true}));
    expect(r.state.targets.a.statuses["havoc-bane"].stacks).toBe(1);
    r.process(event("ally-3",2.1,"damage-dealt","a",{ownerId:"ally",actorId:"ally",external:true}));
    expect(r.state.targets.a.statuses["havoc-bane"].stacks).toBe(2);
    expect(r.state.targets.b.statuses["unseen-snare"]).toBeUndefined();
  });
  it("uses the exact S4 one-second target ICD and caps Bane at three",()=>{
    const r=run(4);r.process(event("snare",0,"action-hit","a",{actionId:"chisa-eye-retraction"}));
    for(const [i,time] of [0.1,1.1,2.1,3.1].entries())r.process(event(`d${i}`,time,"damage-dealt","a"));
    expect(r.state.targets.a.statuses["havoc-bane"].stacks).toBe(3);
  });
});

describe("Chisa Character Box and Personal Action Lab",()=>{
  it("resolves through the generic catalog with exact base-stat basis",()=>{
    const build=createBuildFromPreset(chisaPreset,{id:"chisa-test",now:"2026-08-16"});
    const loadout=resolvePersonalLoadout(build);
    expect(loadout.resonator?.id).toBe("chisa");
    expect(loadout.baseStatBasis).toEqual({attack:937.5,hp:10775,defense:1136.65});
    expect(loadout.supported).toBe(true);
  });
  it("uses selected sparse talent data and exposes sustain outcomes",()=>{
    const build=createBuildFromPreset(chisaPreset,{id:"chisa-test",now:"2026-08-16"});build.skillLevels.resonanceLiberation=6;
    const loadout=resolvePersonalLoadout(build);
    const result=calculateActionLab({loadout,actionId:"chisa-moment-of-nihility",stats:{...build.finalStats,attack:1000},target:DEFAULT_LAB_TARGET})!;
    expect(result.action).toMatchObject({level:6,multipliers:[{percent:698.45,hits:1}]});
    expect(result.outcomes).toEqual([expect.objectContaining({kind:"healing",amount:3178})]);
  });
  it("atomically pays the verified Liberation energy cost and flags unstructured gains",()=>{
    const build=createBuildFromPreset(chisaPreset,{id:"chisa-test",now:"2026-08-16"});
    const timeline:TemporalTimeline={rotationId:"chisa-cost",name:"cost",policy:"no-quickswap",entries:[{index:0,stepId:"lib",label:"Liberation",actionId:"chisa-moment-of-nihility",rotationStepIndex:0,startTimeSeconds:0,endTimeSeconds:1,baseDurationSeconds:1,effectiveDurationSeconds:1,source:"packet",confidence:"measured",recoverySeconds:null,cancelTimingSeconds:null,hitTimingsSeconds:null,notes:[]}],rawDurationSeconds:1,measuredDurationSeconds:1,estimatedDurationSeconds:0,targetDurationSeconds:null,targetConfidence:null,targetSource:null,calibrationFactor:null,finalDurationSeconds:1,confidence:"measured",diagnostics:[]};
    const initial=emptyCombatState({chisa:{hp:10775,maxHp:10775,onField:true,namedStates:[],resources:{"resonance-energy":{current:125,max:125},"ring-of-chainsaw":{current:0,max:100},concerto:{current:0,max:100}}}},["target"]);
    const result=simulatePersonalCombat({resonator:chisa,build,timeline,target:{...DEFAULT_LAB_TARGET,id:"target"},initialState:initial});
    expect(result.finalState.actors.chisa.resources["resonance-energy"].current).toBe(0);
    expect(result.stateTransitions).toContainEqual(expect.objectContaining({kind:"action-resource-consume",detail:"resonance-energy:125->0"}));
    expect(result.diagnostics.some(diagnostic=>diagnostic.code==="unstructured-action-resource-change")).toBe(true);
  });
  it("applies target-local Bane DEF Reduction to owned damage without counting the ally hit",()=>{
    const build=createBuildFromPreset(chisaPreset,{id:"chisa-test",now:"2026-08-16"});
    const timeline:TemporalTimeline={rotationId:"bane",name:"bane",policy:"no-quickswap",entries:[{index:0,stepId:"basic",label:"Basic",actionId:"chisa-basic-1",rotationStepIndex:0,startTimeSeconds:1,endTimeSeconds:2,baseDurationSeconds:1,effectiveDurationSeconds:1,source:"packet",confidence:"measured",recoverySeconds:null,cancelTimingSeconds:null,hitTimingsSeconds:null,notes:[]}],rawDurationSeconds:2,measuredDurationSeconds:2,estimatedDurationSeconds:0,targetDurationSeconds:null,targetConfidence:null,targetSource:null,calibrationFactor:null,finalDurationSeconds:2,confidence:"measured",diagnostics:[]};
    const externalEvents:CombatEvent[]=[{id:"snare",timestamp:0,kind:"action-hit",ownerId:"chisa",actorId:"chisa",targetId:"target",actionId:"chisa-eye-of-unraveling",external:true},{id:"ally",timestamp:.1,kind:"damage-dealt",ownerId:"ally",actorId:"ally",targetId:"target",external:true}];
    const result=simulatePersonalCombat({resonator:chisa,build,timeline,target:{...DEFAULT_LAB_TARGET,id:"target"},externalEvents});
    expect(result.audits).toHaveLength(1);
    expect(result.audits[0].damage.status==="supported"&&result.audits[0].damage.defenseReduction).toBe(.02);
    expect(result.perSource.ally).toBeUndefined();
  });
  it("returns unsupported for unavailable Basic Lv6 rather than interpolating",()=>{
    const build=createBuildFromPreset(chisaPreset,{id:"chisa-test",now:"2026-08-16"});build.skillLevels.basicAttack=6;
    const result=calculateActionLab({loadout:resolvePersonalLoadout(build),actionId:"chisa-basic-1",stats:build.finalStats,target:DEFAULT_LAB_TARGET})!;
    expect(result.damage).toMatchObject({status:"unsupported",reason:"missing-exact-talent-data"});
  });
});
