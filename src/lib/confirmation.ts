export type ConfirmationOptions={title:string;description:string;confirmLabel?:string;cancelLabel?:string;tone?:"danger"|"default"};
type Pending=ConfirmationOptions&{id:number;resolve:(confirmed:boolean)=>void};
let pending:Pending|null=null;let nextId=0;
const listeners=new Set<()=>void>();
export function getConfirmation(){return pending;}
export function subscribeConfirmation(listener:()=>void){listeners.add(listener);return()=>{listeners.delete(listener);};}
export function settleConfirmation(confirmed:boolean){const current=pending;if(!current)return;pending=null;listeners.forEach(listener=>listener());current.resolve(confirmed);}
export function confirmAction(options:ConfirmationOptions):Promise<boolean>{
  if(pending)return Promise.resolve(false);
  return new Promise(resolve=>{pending={...options,id:++nextId,resolve};listeners.forEach(listener=>listener());});
}
