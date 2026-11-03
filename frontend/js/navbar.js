function icon(name) {
  const paths = {
    grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    dumbbell: '<path d="M6 8v8M18 8v8M3 10v4M21 10v4M6 12h12"/>',
    camera: '<rect x="3" y="6" width="18" height="14" rx="2"/><path d="M8 6l2-3h4l2 3"/><circle cx="12" cy="13" r="4"/>',
    chart: '<path d="M4 19V5M4 19h16"/><path d="M7 15l3-4 3 2 5-7"/>',
    apple: '<path d="M12 7c-2-3-6-1-6 3 0 5 3 9 6 9s6-4 6-9c0-4-4-6-6-3z"/><path d="M12 7c0-3 2-4 4-4"/>',
    shield: '<path d="M12 3l7 3v5c0 4.5-2.8 8.2-7 10-4.2-1.8-7-5.5-7-10V6l7-3z"/><path d="M9 12l2 2 4-4"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3-6 8-6s8 2 8 6"/>',
    settings: '<path d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4z"/><path d="M19 13.2l1.3 1-.1 2-1.8 1-1.7-1.2-1.5.8-.3 2.1-1.9.9-1.4-1.4.2-2-1.5-.9-1.8 1.2-1.8-1 .1-2-1.2-1.5.7-1.9 1.9-.4.5-1.7-1.2-1.7 1-1.8 2 .1 1.3 1.3 1.8-.5.3-2.1 2-.7 1.4 1.4-.2 2 1.5.9 1.8-1.1 1.8 1-.1 2z"/>',
  };
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${paths[name] || ''}</svg>`;
}

function renderNavbar(activePage) {
  const root = document.querySelector('.page-root');
  if (!root) return;
  const shell = document.createElement('div'); shell.className = 'app-shell';
  const sidebar = document.createElement('aside'); sidebar.className = 'sidebar';
  const pages = [
    ['dashboard','dashboard.html','Dashboard','grid'],
    ['exercises','exercises.html','Entrenar','dumbbell'],
    ['exercise','exercises.html','Cámara','camera'],
    ['progress','progress.html','Progreso','chart'],
    ['meals','meals.html','Alimentación','apple'],
    ['security','security.html','Seguridad','shield'],
    ['privacy','privacy.html','Privacidad','shield'],
    ['risks','risks.html','Riesgos','shield'],
    ['profile','profile.html','Perfil','user'],
  ];
  sidebar.innerHTML = `
    <div class="sidebar-top"><a class="brand" href="dashboard.html"><span class="brand-mark">${icon('dumbbell')}</span><span><span class="brand-word">CYBERFIT</span><span class="brand-sub">SMART FITNESS / SECURE DATA</span></span></a><span class="sidebar-status">ONLINE</span></div>
    <nav>${pages.map(([key,href,label,ico]) => `<a href="${href}" class="${activePage===key ? 'active':''}">${icon(ico)}<span class="nav-label">${label}</span></a>`).join('')}</nav>
    <div class="sidebar-footer"><div class="profile-mini"><img id="navAvatar" src="" alt="Avatar"/><div><strong id="navName">Cargando…</strong><span id="navRole">USER</span></div></div><button class="sidebar-logout" id="navLogout">Cerrar sesión</button></div>
  `;
  const main = document.createElement('main'); main.className='main-content'; const inner=document.createElement('div'); inner.className='page-inner'; inner.appendChild(root); main.appendChild(inner); shell.appendChild(sidebar); shell.appendChild(main); document.body.appendChild(shell);
  loadNavUser();
  document.getElementById('navLogout').addEventListener('click', async()=>{try{await fetch('/api/auth/logout',{method:'POST'})}finally{location.href='login.html'}});
}

async function loadNavUser(){
  try{const r=await fetch('/api/auth/me'); if(!r.ok){location.href='login.html';return;} const u=await r.json(); const img=document.getElementById('navAvatar'); img.src=u.profileImage || `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="#0b1622"/><circle cx="40" cy="31" r="13" fill="#4defff"/><path d="M16 72c2-14 12-21 24-21s22 7 24 21" fill="none" stroke="#4defff" stroke-width="5"/></svg>')}`; document.getElementById('navName').textContent=u.name; document.getElementById('navRole').textContent=(u.role||'user').toUpperCase(); }catch(e){location.href='login.html'}
}
