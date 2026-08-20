import type { SnapshotPolicy, StatusDefinition } from "./effect-models";
import type { CombatEvent } from "./state-engine";

/**
 * Same-timestamp ordering is part of the deterministic combat contract.
 * An action that ends exactly when the next action begins must commit its
 * after-action resources/state first; otherwise a no-quickswap sequence can
 * incorrectly reject the next action even though the prior action generated
 * the required resource at its completion boundary.
 */
const priority: Readonly<Record<string, number>> = {
  "effect-expired": 0,
  "state-exit": 1,
  "resource-consumed": 2,
  "action-end": 3,
  "rotation-step-start": 4,
  "action-start": 5,
  "action-hit": 6,
  "damage-dealt": 7,
  "effect-activated": 8,
};
export function compareCombatEvents(a:CombatEvent,b:CombatEvent):number{return a.timestamp-b.timestamp||(priority[a.kind]??50)-(priority[b.kind]??50)||a.id.localeCompare(b.id);}
export interface EventQueueLimits {maxProcessedEvents:number;maxChainDepth:number;maxZeroTimeRecursion:number;}
export interface QueueDiagnostic {code:"event-limit-reached"|"chain-depth-reached"|"zero-time-cycle"|"invalid-event"|"duplicate-event-id";message:string;eventId?:string;}
export interface QueueResult {processed:readonly CombatEvent[];diagnostics:readonly QueueDiagnostic[];partial:boolean;}
export class CombatEventQueue {
 private queue:CombatEvent[]=[];private ids=new Set<string>();private zeroTimeChains=new Map<string,number>();readonly diagnostics:QueueDiagnostic[]=[];
 private readonly limits:EventQueueLimits;
 constructor(limits:Partial<EventQueueLimits>={}){this.limits={maxProcessedEvents:10000,maxChainDepth:32,maxZeroTimeRecursion:32,...limits};}
 enqueue(event:CombatEvent):boolean {if(!Number.isFinite(event.timestamp)||event.timestamp<0){this.diagnostics.push({code:"invalid-event",message:"Timestamp must be finite and non-negative.",eventId:event.id});return false;}if(this.ids.has(event.id)){this.diagnostics.push({code:"duplicate-event-id",message:"Event ids must identify distinct occurrences.",eventId:event.id});return false;}if((event.depth??0)>this.limits.maxChainDepth){this.diagnostics.push({code:"chain-depth-reached",message:"Maximum derived-event chain depth reached.",eventId:event.id});return false;}if(event.originEventId&&event.timestamp===(event.payload?.triggerTimestamp as number|undefined)){const key=`${event.ownerId}|${event.targetId}|${event.kind}|${event.actionId??""}`;const count=(this.zeroTimeChains.get(key)??0)+1;this.zeroTimeChains.set(key,count);if(count>this.limits.maxZeroTimeRecursion){this.diagnostics.push({code:"zero-time-cycle",message:"Maximum zero-time recursive emissions reached.",eventId:event.id});return false;}}this.ids.add(event.id);this.queue.push({...event});this.queue.sort(compareCombatEvents);return true;}
 drain(handler:(event:CombatEvent)=>readonly CombatEvent[]):QueueResult {const processed:CombatEvent[]=[];while(this.queue.length&&processed.length<this.limits.maxProcessedEvents){const event=this.queue.shift()!;processed.push(event);for(const next of handler(event))this.enqueue(next);}if(this.queue.length)this.diagnostics.push({code:"event-limit-reached",message:`Stopped after ${this.limits.maxProcessedEvents} events.`});return{processed,diagnostics:this.diagnostics,partial:this.diagnostics.length>0};}
}
export function schedulePeriodicStatus(status:StatusDefinition,applied:CombatEvent):{events:CombatEvent[];diagnostics:QueueDiagnostic[]}{const events:CombatEvent[]=[],diagnostics:QueueDiagnostic[]=[];if(!status.periodic)return{events,diagnostics};const{intervalSeconds,maxTicks,emittedAction}=status.periodic;if(!Number.isFinite(intervalSeconds)||intervalSeconds<=0||!Number.isInteger(maxTicks)||maxTicks<0){diagnostics.push({code:"invalid-event",message:"Periodic cadence is invalid.",eventId:applied.id});return{events,diagnostics};}for(let i=1;i<=maxTicks;i++)events.push({...applied,id:`${applied.id}:tick:${i}`,timestamp:applied.timestamp+intervalSeconds*i,kind:"action-hit",actionId:emittedAction.actionId,actorId:emittedAction.actorId??applied.ownerId,external:false,originEventId:applied.id,depth:(applied.depth??0)+1,occurrence:`${applied.id}:tick:${i}`,payload:{...emittedAction,statusId:status.id,tick:i,consumeStacks:status.periodic.consumeStacks,triggerTimestamp:applied.timestamp}});return{events,diagnostics};}
export function validateSnapshot(policy:SnapshotPolicy):QueueDiagnostic|undefined{return policy.stats==="unknown"||policy.stacks==="unknown"?{code:"invalid-event",message:"snapshot-policy-required"}:undefined;}
