import { parseTeamRotationDraft, type TeamRotationDraft } from "@/domain/team-rotation-builder";
export const TEAM_ROTATION_STORAGE_KEY="wuwa-team-rotation:v1";
export function loadTeamRotationDraft():TeamRotationDraft|undefined{return typeof window==="undefined"?undefined:parseTeamRotationDraft(window.localStorage.getItem(TEAM_ROTATION_STORAGE_KEY));}
export function saveTeamRotationDraft(draft:TeamRotationDraft):void{if(typeof window!=="undefined")window.localStorage.setItem(TEAM_ROTATION_STORAGE_KEY,JSON.stringify(draft));}
