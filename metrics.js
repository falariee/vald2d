export function bmi(weight,height){return weight>0&&height>0?weight/(height/100)**2:null;}
export function weeklySummary(sessions,now=new Date()){
 const start=new Date(now);start.setHours(0,0,0,0);start.setDate(start.getDate()-((start.getDay()+6)%7));
 const end=new Date(start);end.setDate(end.getDate()+7);
 const current=sessions.filter(s=>{const d=new Date(s.date+'T12:00:00');return d>=start&&d<end;});
 return {count:current.length,minutes:current.reduce((n,s)=>n+Number(s.minutes),0),distance:current.filter(s=>s.type==='Run').reduce((n,s)=>n+Number(s.distance||0),0),gym:current.filter(s=>s.type==='Gym').length};
}
