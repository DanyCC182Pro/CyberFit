const $ = (id) => document.getElementById(id);
const fallbackAvatar = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect width="120" height="120" fill="#09121d"/><circle cx="60" cy="45" r="21" fill="#4defff"/><path d="M24 107c4-22 18-33 36-33s32 11 36 33" fill="none" stroke="#4defff" stroke-width="8"/></svg>')}`;
function fmtDate(v){return new Date(v).toLocaleDateString('es-CO',{day:'numeric',month:'long'});}
function fmtDuration(s){const m=Math.floor((s||0)/60);const sec=(s||0)%60;return `${m}m ${sec}s`;}
async function getJson(url){const r=await fetch(url);const d=await r.json();if(!r.ok)throw new Error(d.error||'Error');return d;}
(async()=>{
 try{
   const [user, summary] = await Promise.all([getJson('/api/auth/me'), getJson('/api/workouts/summary')]);
   $('dashPhoto').src=user.profileImage||fallbackAvatar; $('dashName').textContent=user.name; $('welcomeMsg').textContent=`Hola, ${user.name.split(' ')[0]}.`;
   $('userEmail').textContent=user.email; $('todayCopy').textContent=`Hoy es ${new Date().toLocaleDateString('es-CO',{weekday:'long',day:'numeric',month:'long'})}. Tu panel refleja únicamente actividad registrada en CyberFit.`;
   $('totalSessions').textContent=summary.totalSessions; $('sessions30').textContent=summary.sessions30; $('minutes30').textContent=summary.minutes30; $('activeDays30').textContent=summary.activeDays30;
   $('twoFactorStatus').textContent=user.twoFactorEnabled?'Activo':'No activo'; $('twoFactorStatus').className=`pill ${user.twoFactorEnabled?'green':''}`; $('authStatus').textContent=user.authMethods.google?'GOOGLE + LOCAL':'LOCAL';
   const workouts=summary.recent||[]; const list=$('recentList');
   list.innerHTML=workouts.length?workouts.map(w=>`<div class="list-item"><div class="list-left"><div class="list-icon">◉</div><div><div class="list-title">${w.routineName||'Sesión'}</div><div class="list-meta">${w.exerciseType||'Entrenamiento'} · ${fmtDate(w.startedAt)}</div></div></div><span class="pill green">${fmtDuration(w.durationSeconds)}</span></div>`).join(''):`<div class="empty"><strong>Tu historial está listo.</strong>Aún no tienes sesiones guardadas. Empieza con un ejercicio.</div>`;
   const now=new Date(); const monday=new Date(now); monday.setDate(now.getDate()-(now.getDay()+6)%7); monday.setHours(0,0,0,0); const weekly=(await getJson('/api/workouts?limit=50')).filter(w=>new Date(w.startedAt)>=monday);
   const minutes=Math.round(weekly.reduce((a,w)=>a+(w.durationSeconds||0),0)/60), sessions=weekly.length; const g=user.goals||{}; $('weeklySessions').textContent=`${sessions} / ${g.weeklySessions||4}`; $('weeklyMinutes').textContent=`${minutes} / ${g.weeklyMinutes||180} min`; const pct=Math.min(100,Math.round(sessions/(g.weeklySessions||4)*100)); $('sessionProgress').style.width=`${pct}%`; $('goalNote').textContent=`Meta de la semana: ${g.weeklySessions||4} sesiones y ${g.weeklyMinutes||180} minutos. Progreso por sesiones: ${pct}%.`;
 }catch(e){$('pageError').textContent='No se pudo cargar el dashboard. Revisa la sesión y la conexión con el backend.';$('pageError').classList.add('visible');}
})();
