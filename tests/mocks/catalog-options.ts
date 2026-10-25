export const catalogOptions = {
  categories: ["Batter","Curry","Chutney","Desserts","Grocery","Diary","Podi","Packaging"].map(name => ({id:name,name,is_active:true,ever_used:false})),
  units: ["Bucket","Tray","Piece","Can","Box","Bottle","Bag","Packet"].map(name => ({id:name,name,is_active:true,ever_used:false})),
};
export const archivedCatalogOption = {id:"archived-option",name:"Frozen Goods",is_active:false,ever_used:true};
