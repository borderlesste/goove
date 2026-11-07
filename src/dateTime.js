export function formatPromoActiveAt(selectedAt){
 const date=new Date(selectedAt);
 if(!selectedAt||Number.isNaN(date.getTime()))throw new Error('The reservation is missing a valid selection time. Please contact Goove.');
 return new Intl.DateTimeFormat('en-US',{year:'numeric',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZone:'America/New_York',timeZoneName:'short'}).format(date);
}
