const GAMES={
  baloot:['بلوت','🃏',4],
  uno:['أونو','🌈',4],
  jakaro:['جاكارو','🎯',4],
  monopoly:['مونوبولي','💰',4],
  ludo:['لودو','🎲',4],
  maqosar:['مقوصر','👑',4]
};
const UNO_COLORS=['أحمر','أصفر','أخضر','أزرق'];
const MONO_PROPS=['الرياض','جدة','الدمام','مكة','المدينة','أبها','الخبر','تبوك','الطائف','القصيم','حائل','جازان','نجران','الباحة','ينبع','الجبيل'];
const BALoot_SUITS=['♠','♥','♦','♣'];
const BALoot_RANKS=['7','8','9','10','J','Q','K','A'];

function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function baseState(game){
  return {turn:0,dice:null,lastAction:'الجلسة جاهزة',hands:{},pieces:{},cash:{},positions:{},properties:{},current:null,unoColor:null,deck:[],scores:{},tricks:{},winner:null,round:1};
}
function setup(s){
  const st=baseState(s.game);
  s.players.forEach(p=>{
    st.scores[p.id]=0;
    if(s.game==='ludo'||s.game==='jakaro')st.pieces[p.id]=[0,0,0,0];
    if(s.game==='monopoly'){st.cash[p.id]=1500;st.positions[p.id]=0}
    if(s.game==='maqosar')st.positions[p.id]=0;
    if(s.game==='uno'||s.game==='baloot')st.hands[p.id]=[];
  });
  if(s.game==='uno'){
    const deck=[];
    UNO_COLORS.forEach(c=>{
      deck.push({c,n:'0'});
      for(let n=1;n<=9;n++){deck.push({c,n:String(n)},{c,n:String(n)})}
      for(let k=0;k<2;k++)deck.push({c,n:'+2'},{c,n:'skip'},{c,n:'reverse'});
    });
    for(let k=0;k<4;k++)deck.push({c:'wild',n:'wild'},{c:'wild',n:'+4'});
    st.deck=shuffle(deck);
    s.players.forEach(p=>st.hands[p.id]=st.deck.splice(0,7));
    let top=st.deck.shift();
    while(top?.n==='+4'||top?.n==='wild') { st.deck.push(top); top=st.deck.shift(); }
    st.current=top; st.unoColor=top.c;
  }else if(s.game==='baloot'){
    st.deck=shuffle(BALoot_SUITS.flatMap(c=>BALoot_RANKS.map(n=>({c,n}))));
    s.players.forEach(p=>st.hands[p.id]=st.deck.splice(0,8));
    st.current=null; st.tricks={cards:[],lead:null};
  }else if(s.game==='monopoly'){
    st.positions={};st.cash={};st.properties={};
    s.players.forEach(p=>{st.positions[p.id]=0;st.cash[p.id]=1500});
  }
  s.state=st;
}
function advance(s,n=1){
  s.state.turn=(s.state.turn+n)%s.players.length;
}
function finishIfWon(s){
  const st=s.state;
  if(s.game==='uno'){
    const p=s.players.find(x=>(st.hands[x.id]||[]).length===0);
    if(p)st.winner=p.id;
  }else if(s.game==='ludo'||s.game==='jakaro'){
    const p=s.players.find(x=>(st.pieces[x.id]||[]).every(v=>v>=40));
    if(p)st.winner=p.id;
  }else if(s.game==='monopoly'){
    const alive=s.players.filter(x=>(st.cash[x.id]||0)>0);
    if(alive.length===1&&s.players.length>1)st.winner=alive[0].id;
  }else if(s.game==='maqosar'){
    const p=s.players.find(x=>(st.positions[x.id]||0)>=20);
    if(p)st.winner=p.id;
  }
  if(st.winner){s.status='finished';st.lastAction='🏆 فاز '+(s.players.find(x=>x.id===st.winner)?.username||'اللاعب')+'!';}
}
function drawUno(s,p){
  const st=s.state;
  if(!st.deck.length){
    const top=st.current;
    const all=Object.values(st.hands).flat();
    st.deck=shuffle(all);
    Object.keys(st.hands).forEach(id=>st.hands[id]=[]);
    st.current=top;
  }
  if(st.deck.length)st.hands[p.id].push(st.deck.pop());
}
function playUno(s,p,index){
  const st=s.state,hand=st.hands[p.id]||[],card=hand[index];
  if(!card)throw Error('الكرت غير موجود');
  const top=st.current;
  const valid=card.c==='wild'||card.c===st.unoColor||card.n===top?.n;
  if(!valid)throw Error('الكرت لا يطابق اللون أو الرقم');
  hand.splice(index,1);st.current=card;
  if(card.c==='wild')st.unoColor=UNO_COLORS[Math.floor(Math.random()*UNO_COLORS.length)];else st.unoColor=card.c;
  let skip=0;
  if(card.n==='skip')skip=1;
  if(card.n==='reverse'&&s.players.length>2){s.players.reverse();st.turn=s.players.findIndex(x=>x.id===p.id);}
  if(card.n==='+2'){for(let i=0;i<2;i++)drawUno(s,s.players[(st.turn+1)%s.players.length]);}
  if(card.n==='+4'){for(let i=0;i<4;i++)drawUno(s,s.players[(st.turn+1)%s.players.length]);skip=1;}
  advance(s,1+skip);
  st.lastAction=p.username+' لعب '+card.n+(card.c==='wild'?' — اللون: '+st.unoColor:'');
  finishIfWon(s);
}
function act(s,p,raw){
  const a=String(raw||''),st=s.state;
  if(s.status!=='playing')throw Error('الجلسة ليست قيد اللعب');
  if(a==='draw'&&s.game==='uno'){drawUno(s,p);st.lastAction=p.username+' سحب كرتاً';advance(s);return finishIfWon(s);}
  if(s.game==='uno'&&a.startsWith('play:'))return playUno(s,p,Number(a.split(':')[1]));
  if(a==='roll'){
    const d=Math.floor(Math.random()*6)+1;st.dice=d;
    if(s.game==='ludo'||s.game==='jakaro'){
      if(d===6)st.lastAction=p.username+' رمى 6 — لديه حركة إضافية';
      else st.lastAction=p.username+' رمى '+d;
    }else if(s.game==='monopoly'){
      st.positions[p.id]=(st.positions[p.id]+d)%40;
      if(st.positions[p.id]<d)st.cash[p.id]+=200;
      const pos=st.positions[p.id],owner=st.properties[pos];
      if(owner&&owner!==p.id){const rent=50+(pos%5)*25;st.cash[p.id]-=rent;st.cash[owner]=(st.cash[owner]||0)+rent;}
      st.lastAction=p.username+' تحرك '+d+' خانات';
      advance(s);
    }else if(s.game==='maqosar'){
      st.positions[p.id]=Math.min(20,(st.positions[p.id]||0)+d);
      st.lastAction=p.username+' تقدم '+d+' خطوات';
      if(st.positions[p.id]>=20)st.winner=p.id;else advance(s);
      finishIfWon(s);
    }else if(s.game==='baloot'){
      st.lastAction=p.username+' رمى النرد '+d+' — دور اللعب التالي';
      advance(s);
    }else advance(s);
    return;
  }
  if((s.game==='ludo'||s.game==='jakaro')&&a.startsWith('piece:')){
    const i=Number(a.split(':')[1]),d=st.dice;
    if(!Number.isInteger(i)||i<0||i>3||!d)throw Error('ارمِ النرد أولاً');
    st.pieces[p.id][i]=Math.min(40,st.pieces[p.id][i]+d);
    st.lastAction=p.username+' حرّك القطعة '+(i+1)+' '+d+' خطوات';
    st.dice=null;
    if(d!==6)advance(s);
    finishIfWon(s);return;
  }
  if(s.game==='baloot'&&a.startsWith('card:')){
    const i=Number(a.split(':')[1]),h=st.hands[p.id]||[];
    if(!h[i])throw Error('الكرت غير موجود');
    const c=h.splice(i,1)[0];
    if(!st.tricks.cards)st.tricks.cards=[];
    st.tricks.cards.push({playerId:p.id,card:c});
    st.tricks.lead=st.tricks.lead||c.c;
    st.lastAction=p.username+' لعب '+c.c+c.n;
    if(st.tricks.cards.length>=Math.min(4,s.players.length)){
      const winner=st.tricks.cards.find(x=>x.card.c===st.tricks.lead)||st.tricks.cards[0];
      st.scores[winner.playerId]=(st.scores[winner.playerId]||0)+1;
      st.tricks.cards=[];st.tricks.lead=null;st.lastAction+=' — نقطة لـ '+(s.players.find(x=>x.id===winner.playerId)?.username||'اللاعب');
    }
    advance(s);return;
  }
  if(s.game==='monopoly'&&a==='buy'){
    const pos=st.positions[p.id],price=100+(pos%5)*50;
    if(st.properties[pos])throw Error('الملكية مأخوذة');
    if(st.cash[p.id]<price)throw Error('رصيدك لا يكفي');
    st.cash[p.id]-=price;st.properties[pos]=p.id;st.lastAction=p.username+' اشترى '+MONO_PROPS[pos%MONO_PROPS.length]+' بـ '+price;advance(s);return;
  }
  throw Error('الحركة غير متاحة لهذه اللعبة');
}
export function registerGameRoutes(app,{db,save,id,now,auth}){
  if(!Array.isArray(db.gameSessions))db.gameSessions=[];
  const get=x=>db.gameSessions.find(s=>s.id===x);
  const view=(s,uid)=>({
    id:s.id,code:s.code,game:s.game,name:s.name,hostId:s.hostId,maxPlayers:s.maxPlayers,status:s.status,
    players:s.players.map(p=>({...p,isMe:p.id===uid})),
    spectators:s.spectators.map(p=>({...p,isMe:p.id===uid})),
    state:s.state,chat:s.chat.slice(-50),createdAt:s.createdAt
  });
  const catalog=()=>Object.entries(GAMES).map(([id,g])=>({id,name:g[0],icon:g[1],minPlayers:2,maxPlayers:g[2]}));
  app.get('/api/games',(q,r)=>r.json(catalog()));
  app.get('/api/games/catalog',(q,r)=>r.json(catalog()));
  app.get('/api/game-sessions/:id',(q,r)=>{const s=get(q.params.id);if(!s)return r.status(404).json({error:'الجلسة غير موجودة'});r.json(view(s,q.user?.id))});
  app.get('/api/game-sessions',(q,r)=>r.json({items:db.gameSessions.filter(s=>s.status!=='finished').filter(s=>!q.query.game||s.game===q.query.game).slice(0,100).map(s=>view(s,q.user?.id))}));
  app.post('/api/game-sessions',auth,(q,r)=>{
    const g=GAMES[q.body.game];if(!g)return r.status(400).json({error:'اللعبة غير مدعومة'});
    const m=Math.max(2,Math.min(g[2],Number(q.body.maxPlayers)||g[2]));
    const u={id:q.user.id,username:q.user.username,avatar:q.user.avatar||'/server-avatar.svg'};
    const s={id:id(),code:Math.random().toString(36).slice(2,8).toUpperCase(),game:q.body.game,name:String(q.body.name||g[0]+' — جلسة جديدة').slice(0,80),hostId:u.id,maxPlayers:m,status:'lobby',players:[{...u,ready:true}],spectators:[],state:baseState(q.body.game),chat:[],createdAt:now()};
    db.gameSessions.unshift(s);db.gameSessions=db.gameSessions.slice(0,300);save();r.status(201).json(view(s,u.id));
  });
  app.post('/api/game-sessions/:id/join',auth,(q,r)=>{
    const s=get(q.params.id);if(!s)return r.status(404).json({error:'الجلسة غير موجودة'});
    const u={id:q.user.id,username:q.user.username,avatar:q.user.avatar||'/server-avatar.svg'};
    if(!s.players.some(p=>p.id===u.id)&&!s.spectators.some(p=>p.id===u.id)){
      if(q.body.spectator||s.status!=='lobby'||s.players.length>=s.maxPlayers)s.spectators.push(u);else s.players.push({...u,ready:true});
      save();
    }
    r.json(view(s,u.id));
  });
  app.post('/api/game-sessions/:id/start',auth,(q,r)=>{
    const s=get(q.params.id);if(!s)return r.status(404).json({error:'الجلسة غير موجودة'});
    if(s.hostId!==q.user.id)return r.status(403).json({error:'المضيف فقط يبدأ'});
    if(s.players.length<2)return r.status(400).json({error:'لازم لاعبين على الأقل'});
    if(s.status==='playing')return r.json(view(s,q.user.id));
    s.status='playing';setup(s);s.state.lastAction='بدأت '+GAMES[s.game][0]+' — دور '+s.players[0].username;save();r.json(view(s,q.user.id));
  });
  app.post('/api/game-sessions/:id/leave',auth,(q,r)=>{
    const s=get(q.params.id);if(!s)return r.status(404).json({error:'الجلسة غير موجودة'});
    s.players=s.players.filter(p=>p.id!==q.user.id);s.spectators=s.spectators.filter(p=>p.id!==q.user.id);
    if(!s.players.length)s.status='finished';else if(s.hostId===q.user.id)s.hostId=s.players[0].id;
    if(s.status==='playing'&&s.state.turn>=s.players.length)s.state.turn=0;
    save();r.json({ok:true});
  });
  app.post('/api/game-sessions/:id/action',auth,(q,r)=>{
    const s=get(q.params.id);if(!s||s.status!=='playing')return r.status(400).json({error:'الجلسة ليست قيد اللعب'});
    const p=s.players[s.state.turn];
    if(!p||p.id!==q.user.id)return r.status(400).json({error:'ليس دورك الآن'});
    try{act(s,p,q.body.action);save();r.json(view(s,q.user.id));}catch(e){r.status(400).json({error:e.message})}
  });
  app.post('/api/game-sessions/:id/chat',auth,(q,r)=>{
    const s=get(q.params.id),t=String(q.body.text||'').trim().slice(0,300);
    if(!s||!t)return r.status(400).json({error:'رسالة غير صالحة'});
    s.chat.push({id:id(),user:q.user.username,text:t,at:now()});s.chat=s.chat.slice(-100);save();r.json({ok:true});
  });
}
