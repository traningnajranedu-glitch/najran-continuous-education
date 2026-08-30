import { NextResponse } from "next/server";

const REPO=process.env.GITHUB_REPOSITORY||"traningnajranedu-glitch/najran-continuous-education";
const PATH="data/najran-knowledge.json";
const TOKEN=process.env.GITHUB_TOKEN;
const PASSWORD=process.env.KNOWLEDGE_ADMIN_PASSWORD;

function auth(request){
 const supplied=request.headers.get("x-admin-password")||"";
 return !!PASSWORD && supplied===PASSWORD;
}
function splitRepo(){const [owner,repo]=REPO.split("/");return {owner,repo};}
async function githubGet(){
 const {owner,repo}=splitRepo();
 if(!TOKEN) throw new Error("GITHUB_TOKEN غير مُعد");
 const r=await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${PATH}?ref=main`,{headers:{Authorization:`Bearer ${TOKEN}`,Accept:"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28"},cache:"no-store"});
 if(!r.ok) throw new Error("تعذر قراءة قاعدة المعرفة");
 const d=await r.json();
 const text=Buffer.from(d.content,"base64").toString("utf8");
 return {items:JSON.parse(text),sha:d.sha};
}
async function githubPut(items,sha,message){
 const {owner,repo}=splitRepo();
 const r=await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${PATH}`,{method:"PUT",headers:{Authorization:`Bearer ${TOKEN}`,Accept:"application/vnd.github+json","Content-Type":"application/json","X-GitHub-Api-Version":"2022-11-28"},body:JSON.stringify({message,content:Buffer.from(JSON.stringify(items,null,2)+"\n").toString("base64"),sha,branch:"main"})});
 if(!r.ok){const t=await r.text();throw new Error(`تعذر حفظ قاعدة المعرفة: ${t.slice(0,300)}`)}
 return githubGet();
}

export async function GET(request){
 try{if(!auth(request))return NextResponse.json({error:"غير مصرح"},{status:401});const d=await githubGet();return NextResponse.json({items:d.items});}
 catch(e){return NextResponse.json({error:e.message||"تعذر التحميل"},{status:500});}
}
export async function POST(request){
 try{if(!auth(request))return NextResponse.json({error:"غير مصرح"},{status:401});const body=await request.json();if(!body.id||!body.title||!body.content||!body.sourceUrl)return NextResponse.json({error:"الحقول الأساسية مطلوبة"},{status:400});const d=await githubGet();if(d.items.some(x=>x.id===body.id))return NextResponse.json({error:"المعرف موجود مسبقًا"},{status:409});const item={...body,keywords:Array.isArray(body.keywords)?body.keywords:[],active:body.active!==false,verifiedAt:body.verifiedAt||new Date().toISOString().slice(0,10)};const out=await githubPut([...d.items,item],d.sha,`Add knowledge: ${item.id}`);return NextResponse.json({items:out.items});}
 catch(e){return NextResponse.json({error:e.message||"تعذر الحفظ"},{status:500});}
}
export async function PUT(request){
 try{if(!auth(request))return NextResponse.json({error:"غير مصرح"},{status:401});const body=await request.json();if(!body.id)return NextResponse.json({error:"المعرف مطلوب"},{status:400});const d=await githubGet();const index=d.items.findIndex(x=>x.id===body.id);if(index<0)return NextResponse.json({error:"السجل غير موجود"},{status:404});const item={...d.items[index],...body,keywords:Array.isArray(body.keywords)?body.keywords:[],active:body.active!==false,verifiedAt:body.verifiedAt||d.items[index].verifiedAt||new Date().toISOString().slice(0,10)};const items=[...d.items];items[index]=item;const out=await githubPut(items,d.sha,`Update knowledge: ${item.id}`);return NextResponse.json({items:out.items});}
 catch(e){return NextResponse.json({error:e.message||"تعذر الحفظ"},{status:500});}
}
export async function DELETE(request){
 try{if(!auth(request))return NextResponse.json({error:"غير مصرح"},{status:401});const id=new URL(request.url).searchParams.get("id");if(!id)return NextResponse.json({error:"المعرف مطلوب"},{status:400});const d=await githubGet();const items=d.items.filter(x=>x.id!==id);if(items.length===d.items.length)return NextResponse.json({error:"السجل غير موجود"},{status:404});const out=await githubPut(items,d.sha,`Delete knowledge: ${id}`);return NextResponse.json({items:out.items});}
 catch(e){return NextResponse.json({error:e.message||"تعذر الحذف"},{status:500});}
}
