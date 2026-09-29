const baseJokes=[
'واحد قال لخويه: عندي سالفة طويلة… قاله: ارسلها واتساب لا تتعبنا 😂',
'واحد راح للدكتور وقاله: كل ما أشرب شاهي عيني توجعني. قاله الدكتور: شِل الملعقة من الكوب يا بطل 😂',
'قلت للربع بنام بدري… جلست معهم لين الفجر عشان أتأكد إنهم ناموا 😭',
'واحد سأل خويه: وش أسرع شيء؟ قاله: الراتب، يجي ويروح قبل لا تقول السلام عليكم 😂',
'دخلت المطبخ أدور شيء آكله… الثلاجة قالت: تراك قبل شوي جيتني لا تحرجني 😂',
'قالوا له ليه ما ترد بسرعة؟ قال: أعطي الرسالة فرصة تفكر وش تبي مني 😂',
'واحد اشترى ساعة ذكية… صارت أذكى منه وقالت له نام بدري 😭'
];
const storyBits={
'مغامرة':['في ليلة هادئة وصل إشعار غريب إلى هاتفه: لا تفتح الباب إذا سمعت ثلاث دقات.','بدافع الفضول نزل إلى آخر الممر، وهناك وجد مفتاحًا عليه اسم ملاذ.','فتح الباب فوجد خريطة تقوده إلى مكان لم يره أحد من قبل.'],
'غموض':['كان الشارع فاضيًا، لكن ساعة المحل توقفت عند نفس الدقيقة منذ سنوات.','وجد في جيبه ورقة لم يكتبها، وفيها موعد الليلة التالية.','عندما وصل الموعد، اكتشف أن صاحب الرسالة يعرف عنه كل شيء.'],
'رعب خفيف':['انطفأت الأنوار لحظة واحدة، وعندما عادت كان الكرسي قد تحرك وحده.','ضحك وقال أكيد أحد يمزح، ثم سمع نفس الضحكة من الغرفة الفاضية.','فتح الباب فوجد قطة صغيرة تنظر له وكأنها صاحبة المكان 😂.'],
'كوميديا':['قرر أن يبدأ يومه بنشاط، فضبط خمس منبهات.','النتيجة؟ قام بعد السادس وهو يسأل نفسه ليه الحياة صعبة.','قرر ينام بدري من بكرة… وكانت هذه أول كذبة في القصة 😂.'],
'خيال':['وجد بابًا صغيرًا خلف مكتبة قديمة، وعليه نقش يضيء إذا اقترب.','دخل فوجد مدينة معلقة فوق السحاب، وكل بيت فيها يحفظ ذكرى شخص.','اختار بيتًا واحدًا، وعندما فتحه وجد ذكرى لم يعشها بعد.']
};
function registerEngagementRoutes(app,{db,save,id,now,auth}){
 if(!Array.isArray(db.jokes))db.jokes=[];
 if(!Array.isArray(db.jokeReactions))db.jokeReactions=[];
 if(!Array.isArray(db.stories))db.stories=[];
 if(!db.jokes.length){baseJokes.forEach((text,i)=>db.jokes.push({id:'seed-joke-'+i,text,author:'ملاذ AI',likes:0,dislikes:0,createdAt:now()}));save();}
 app.get('/api/jokes',(req,res)=>res.json({items:db.jokes.slice(0,100)}));
 app.post('/api/jokes',auth,(req,res)=>{const text=String(req.body.text||'').trim();if(text.length<5||text.length>500)return res.status(400).json({error:'النكتة بين 5 و500 حرف'});const j={id:id(),text,author:req.user.username,likes:0,dislikes:0,createdAt:now()};db.jokes.unshift(j);save();res.status(201).json(j)});
 app.post('/api/jokes/:id/react',auth,(req,res)=>{const j=db.jokes.find(x=>x.id===req.params.id);if(!j)return res.status(404).json({error:'النكتة غير موجودة'});const type=req.body.type==='dislike'?'dislike':'like';const old=db.jokeReactions.find(x=>x.jokeId===j.id&&x.userId===req.user.id);if(old){j[old.type==='like'?'likes':'dislikes']=Math.max(0,(j[old.type==='like'?'likes':'dislikes']||0)-1);old.type=type;}else db.jokeReactions.push({jokeId:j.id,userId:req.user.id,type});j[type==='like'?'likes':'dislikes']=(j[type==='like'?'likes':'dislikes']||0)+1;save();res.json(j)});
 app.post('/api/jokes/generate',auth,(req,res)=>{const text=baseJokes[Math.floor(Math.random()*baseJokes.length)];const j={id:id(),text,author:'مولّد ملاذ الذكي',likes:0,dislikes:0,createdAt:now()};db.jokes.unshift(j);db.jokes=db.jokes.slice(0,300);save();res.status(201).json(j)});
 app.post('/api/stories/generate',(req,res)=>{const genre=storyBits[req.body.genre] ? req.body.genre:'مغامرة';const n=req.body.length==='طويلة'?5:req.body.length==='متوسطة'?4:3;const bits=storyBits[genre];const parts=[];for(let i=0;i<n;i++)parts.push(bits[i%bits.length]);const story={id:id(),genre,text:parts.join(' '),createdAt:now()};db.stories.unshift(story);db.stories=db.stories.slice(0,100);save();res.status(201).json(story)});
}
export { registerEngagementRoutes };
