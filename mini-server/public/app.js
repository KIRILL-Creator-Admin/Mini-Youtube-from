const PAGES=["home","upload"];
function showPage(name){
  PAGES.forEach(p=>{
    const el=document.getElementById("page-"+p);
    if(el) el.classList.toggle("hidden",p!==name);
  });
  document.querySelectorAll(".nav button").forEach(b=>{
    b.disabled=(b.dataset.page===name);
  });
}
document.addEventListener("DOMContentLoaded",()=>{
  document.querySelectorAll(".nav button").forEach(b=>{
    b.addEventListener("click",()=>showPage(b.dataset.page));
  });
  showPage("home");
  fetchVideos();
});

let videos=[]; let page=1;
const grid=document.getElementById("grid");
const homeStatus=document.getElementById("homeStatus");
const prevBtn=document.getElementById("prevPage");
const nextBtn=document.getElementById("nextPage");
const pageInfo=document.getElementById("pageInfo");

const modal=document.getElementById("modal");
const modalTitle=document.getElementById("modalTitle");
const player=document.getElementById("player");
const playerStatus=document.getElementById("playerStatus");
const closeModal=document.getElementById("closeModal");
closeModal.addEventListener("click",()=>{
  modal.style.display="none";
  player.removeAttribute("src"); player.load();
});

function formatSize(bytes){
  if(bytes<1024) return bytes+" B";
  if(bytes<1024*1024) return (bytes/1024).toFixed(1)+" KB";
  if(bytes<1024*1024*1024) return (bytes/1024/1024).toFixed(1)+" MB";
  return (bytes/1024/1024/1024).toFixed(1)+" GB";
}
function formatDate(ms){ return new Date(ms).toLocaleString(); }

async function fetchVideos(){
  homeStatus.textContent="Загрузка...";
  try{
    const res=await fetch("/videos?ts="+Date.now(),{cache:"no-store"});
    if(!res.ok) throw new Error("Ошибка "+res.status);
    videos=await res.json(); page=1; renderHome();
    homeStatus.textContent=videos.length?"":"Нет видео. Загрузите файл.";
  }catch(err){ homeStatus.textContent="Ошибка: "+err.message; }
}

function renderHome(){
  const pageSize=8;
  const totalPages=Math.max(1,Math.ceil(videos.length/pageSize));
  page=Math.min(page,totalPages);
  const start=(page-1)*pageSize;
  const slice=videos.slice(start,start+pageSize);
  grid.innerHTML="";
  slice.forEach(v=>{
    const card=document.createElement("article"); card.className="card";

    const thumb=document.createElement("div"); thumb.className="thumb"; thumb.textContent="Видео";

    const body=document.createElement("div"); body.className="cardBody";
    const title=document.createElement("div"); title.className="cardTitle"; title.textContent=v.filename;
    const meta=document.createElement("div"); meta.className="cardMeta"; meta.innerHTML=`<span>${formatSize(v.size)}</span><span>${formatDate(v.mtime)}</span>`;

    const actions=document.createElement("div"); actions.className="cardActions";
    const playBtn=document.createElement("button"); playBtn.className="btn btnAccent"; playBtn.textContent="Смотреть"; playBtn.addEventListener("click",()=>openModal(v));
    const delBtn=document.createElement("button"); delBtn.className="btn btnDanger"; delBtn.textContent="Удалить"; delBtn.addEventListener("click",()=>deleteVideo(v));

    actions.appendChild(playBtn);
    actions.appendChild(delBtn);

    body.appendChild(title);
    body.appendChild(meta);
    body.appendChild(actions);

    card.appendChild(thumb);
    card.appendChild(body);
    grid.appendChild(card);
  });
  prevBtn.disabled=page<=1; nextBtn.disabled=page>=totalPages;
  pageInfo.textContent=`Страница ${page} / ${totalPages}`;
}

// Пагинация
prevBtn.addEventListener("click",()=>{ page=Math.max(1,page-1); renderHome(); });
nextBtn.addEventListener("click",()=>{
  const totalPages=Math.max(1,Math.ceil(videos.length/8));
  page=Math.min(totalPages,page+1);
  renderHome();
});

// Upload
const uploadForm=document.getElementById("uploadForm");
const uploadStatus=document.getElementById("uploadStatus");
uploadForm.addEventListener("submit",async e=>{
  e.preventDefault();
  uploadStatus.textContent="Загрузка...";
  const formData=new FormData(uploadForm);
  try{
    const res=await fetch("/upload",{method:"POST",body:formData});
    const data=await res.json();
    if(!res.ok||data.error) throw new Error(data.error||`Статус ${res.status}`);
    uploadStatus.textContent="Готово ✓";
    uploadForm.reset();
    await fetchVideos();
    showPage("home");
  }catch(err){
    uploadStatus.textContent="Ошибка: "+err.message;
  }
});

// Модальное окно просмотра
function openModal(v){
  modalTitle.textContent=v.filename;
  player.src=v.url+"?ts="+Date.now();
  player.load();
  playerStatus.textContent="";
  modal.style.display="flex";
}
player.addEventListener("error",()=>{
  playerStatus.textContent="Ошибка воспроизведения. Проверь MIME и Range.";
});

// Удаление
async function deleteVideo(v){
  if(!confirm(`Удалить ${v.filename}?`)) return;
  try{
    const res=await fetch("/videos/"+encodeURIComponent(v.filename),{method:"DELETE"});
    const data=await res.json();
    if(!res.ok||!data.ok) throw new Error(data.error||`Статус ${res.status}`);
    await fetchVideos();
  }catch(err){
    alert("Ошибка: "+err.message);
  }
}