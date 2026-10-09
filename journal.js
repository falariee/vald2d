import {JOURNAL_KEY,MAX_IMAGES,SESSION_TAGS,isValidDate,isSafeJournalImage,validatePost,sortPosts,migrateLegacyPhotos,journalStats} from './journal-model.js';

const icon=name=>`<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;
const safeImage=isSafeJournalImage;
const dateLabel=date=>new Date(date+'T12:00:00').toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric',year:'numeric'});

export function mountDailyJournal(container,{esc,toast,localDate,legacyPhotos=[]}){
  if(!container)throw new Error('The daily journal container is missing.');
  let state={version:1,posts:[],legacyMigrated:false};
  let loadError='';
  try{
    const raw=localStorage.getItem(JOURNAL_KEY);
    if(raw){
      const saved=JSON.parse(raw);
      if(Array.isArray(saved))state={...state,posts:saved};
      else if(saved&&Array.isArray(saved.posts))state={...state,...saved};
      else throw new Error('Saved daily log format is not supported.');
    }
  }catch{
    loadError='Unable to read the saved daily log. Your browser data was kept. Reload the page before trying to save a post.';
  }

  container.innerHTML=`<div class="journal-layout"><div class="journal-main"><section class="card journal-compose-prompt"><div class="avatar journal-avatar">Y</div><button class="journal-compose-trigger" data-journal-create><b>How did today feel?</b><span>A photo, a few words, a moment for you.</span></button><button class="primary" id="journal-new-post">${icon('plus')}New post</button></section><p class="journal-notice" id="journal-notice" role="alert" hidden></p><div class="journal-feed-heading"><h3>Your daily log</h3><span id="journal-feed-label">All your days</span></div><div id="journal-feed" class="journal-feed"></div></div><aside class="journal-rail"><section class="card journal-stats-card"><span class="eyebrow">ONE DAY AT A TIME</span><h3>Your little milestones</h3><div id="journal-stats" class="journal-stats"></div></section><section class="card journal-calendar-card"><div class="journal-calendar-heading"><button type="button" class="journal-month-button" id="journal-month-prev" aria-label="Previous month">‹</button><h3 id="journal-month-title"></h3><button type="button" class="journal-month-button" id="journal-month-next" aria-label="Next month">›</button></div><p class="note">A little dot for every day you logged.</p><div id="journal-calendar" class="journal-calendar-grid"></div><label class="journal-filter-label">Go to a day<input id="journal-date-filter" type="date" max="${localDate()}"></label><label class="journal-filter-label">Show<select id="journal-tag-filter"><option value="All">Every kind of day</option>${SESSION_TAGS.map(tag=>`<option value="${esc(tag)}">${esc(tag)}</option>`).join('')}</select></label><button class="text-button" id="journal-clear-filter" hidden>Show all days</button></section><p class="note journal-private-note">A personal daily log, saved in this browser.</p></aside></div>`;
  const dialog=document.createElement('dialog');
  dialog.id='journal-dialog';
  dialog.className='journal-dialog';
  dialog.setAttribute('aria-labelledby','journal-dialog-title');
  dialog.innerHTML=`<form id="journal-form"><div class="section-head journal-dialog-heading"><div><span class="eyebrow">A MOMENT WORTH KEEPING</span><h3 id="journal-dialog-title">New daily log</h3></div><button type="button" class="close" id="journal-close" aria-label="Close daily log">×</button></div><div class="form-row"><label>Day<input id="journal-date" name="date" type="date" max="${localDate()}" required></label><label>Kind of day<select id="journal-tag" name="sessionTag">${SESSION_TAGS.map(tag=>`<option value="${esc(tag)}">${esc(tag)}</option>`).join('')}</select></label></div><label>What would you like to remember?<textarea id="journal-caption" name="caption" maxlength="2000" placeholder="The run that cleared your head. A stronger set. How you felt today."></textarea></label><div class="journal-caption-count"><span id="journal-caption-count">0</span> / 2000</div><label class="journal-upload" for="journal-images">${icon('photo')}<b>Add your photos</b><span>Up to ${MAX_IMAGES} photos · JPG, PNG, WebP or GIF</span></label><input id="journal-images" type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple hidden><div id="journal-previews" class="journal-previews"></div><p class="note" id="journal-upload-status" role="status">Photos are optional. A few words can be a daily log too.</p><p id="journal-error" class="journal-error" role="alert" hidden></p><div class="journal-dialog-actions"><button class="secondary" type="button" id="journal-cancel">Cancel</button><button class="primary" id="journal-save" type="submit">Save post ${icon('arrow')}</button></div></form>`;
  document.body.append(dialog);
  const $=selector=>container.querySelector(selector);
  const form=dialog.querySelector('#journal-form');
  const filesInput=dialog.querySelector('#journal-images');
  const uploadButton=dialog.querySelector('.journal-upload');
  uploadButton.setAttribute('role','button');
  uploadButton.setAttribute('aria-controls','journal-images');
  uploadButton.tabIndex=0;
  const previews=dialog.querySelector('#journal-previews');
  const uploadStatus=dialog.querySelector('#journal-upload-status');
  const saveButton=dialog.querySelector('#journal-save');
  let selectedDate='',selectedTag='All',month=localDate().slice(0,7);
  let draft=null,epoch=0,busy=false;
  const positions=new Map();

  function showError(message){
    const target=dialog.open?dialog.querySelector('#journal-error'):$('#journal-notice');
    target.textContent=message;
    target.hidden=!message;
  }
  function persist(next){
    if(loadError){showError(loadError);toast(loadError);return false;}
    try{
      localStorage.setItem(JOURNAL_KEY,JSON.stringify(next));
      return true;
    }catch{
      const message='Browser storage is full or unavailable. Remove some photos from this post or an older post, then try again. Your saved posts were kept.';
      showError(message);toast(message);return false;
    }
  }
  function announce(){window.dispatchEvent(new CustomEvent('stride-journal-changed'));}
  function commit(posts,message){
    const next={...state,version:1,posts,legacyMigrated:true};
    if(!persist(next))return false;
    state=next;
    showError('');
    render();
    announce();
    if(message)toast(message);
    return true;
  }

  if(!loadError&&!state.legacyMigrated){
    if(legacyPhotos.length){
      const next={...state,posts:migrateLegacyPhotos(state.posts,legacyPhotos,{today:localDate(),now:new Date().toISOString()}),legacyMigrated:true};
      if(persist(next)){state=next;announce();}
    }else state.legacyMigrated=true;
  }
  if(loadError)showError(loadError);

  function carouselMarkup(post){
    const images=(post.images||[]).filter(safeImage);
    if(!images.length)return '';
    const position=Math.min(positions.get(post.id)||0,images.length-1);
    positions.set(post.id,position);
    return `<div class="journal-carousel" tabindex="0" role="region" aria-roledescription="carousel" aria-label="Photos from ${esc(dateLabel(post.date))}"><img class="journal-post-image" src="${esc(images[position])}" alt="Photo ${position+1} of ${images.length} from ${esc(dateLabel(post.date))}" loading="lazy">${images.length>1?`<span class="journal-photo-position" aria-live="polite">${position+1} / ${images.length}</span><div class="journal-carousel-controls"><button type="button" class="journal-carousel-prev" data-carousel="prev" aria-label="Previous photo" ${position===0?'disabled':''}>${icon('arrow')}</button><button type="button" class="journal-carousel-next" data-carousel="next" aria-label="Next photo" ${position===images.length-1?'disabled':''}>${icon('arrow')}</button></div><div class="journal-carousel-dots">${images.map((_,index)=>`<button type="button" class="${index===position?'active':''}" data-carousel-index="${index}" aria-label="Show photo ${index+1}" ${index===position?'aria-current="true"':''}></button>`).join('')}</div>`:''}</div>`;
  }
  function postMarkup(post){
    const caption=String(post.caption??'');
    const tag=SESSION_TAGS.includes(post.sessionTag)?post.sessionTag:'Everyday';
    return `<article class="journal-post${post.images?.length?'':' journal-post-text'}" data-post-id="${esc(post.id)}"><div class="journal-post-header"><div class="avatar journal-avatar">Y</div><div class="journal-author"><b>You</b><time datetime="${esc(post.date)}">${esc(dateLabel(post.date))}</time></div><div class="journal-post-menu"><button type="button" class="journal-post-action" data-journal-edit="${esc(post.id)}" aria-label="Edit post from ${esc(dateLabel(post.date))}">Edit</button><button type="button" class="journal-post-action journal-delete" data-journal-delete="${esc(post.id)}" aria-label="Delete post from ${esc(dateLabel(post.date))}">Delete</button></div></div>${carouselMarkup(post)}<div class="journal-post-content"><span class="journal-tag journal-tag-${tag.toLowerCase()}">${esc(tag)}</span>${caption?`<p class="journal-caption">${esc(caption).replace(/\n/g,'<br>')}</p>`:''}<span class="journal-post-date">${esc(post.date===localDate()?'Today’s little moment':'A day worth remembering')}</span></div></article>`;
  }
  function renderCalendar(){
    const first=new Date(month+'-01T12:00:00');
    const days=new Date(first.getFullYear(),first.getMonth()+1,0).getDate();
    const offset=(first.getDay()+6)%7;
    const counts=new Map();
    for(const post of state.posts)counts.set(post.date,(counts.get(post.date)||0)+1);
    $('#journal-month-title').textContent=first.toLocaleDateString(undefined,{month:'long',year:'numeric'});
    $('#journal-month-next').disabled=month>=localDate().slice(0,7);
    $('#journal-calendar').innerHTML=['M','T','W','T','F','S','S'].map(day=>`<span class="journal-calendar-weekday" aria-hidden="true">${day}</span>`).join('')+Array.from({length:offset},()=>'<span class="journal-calendar-blank"></span>').join('')+Array.from({length:days},(_,i)=>{
      const day=month+'-'+String(i+1).padStart(2,'0');
      const count=counts.get(day)||0;
      return `<button type="button" class="journal-calendar-day${count?' has-post':''}${day===selectedDate?' selected':''}${day===localDate()?' is-today':''}" data-journal-day="${day}" aria-label="${esc(dateLabel(day))}${count?`: ${count} post${count===1?'':'s'}`:': no posts'}" aria-pressed="${day===selectedDate}" ${day>localDate()?'disabled':''}><span>${i+1}</span>${count?'<i aria-hidden="true"></i>':''}</button>`;
    }).join('');
    container.querySelectorAll('[data-journal-day]').forEach(button=>button.onclick=()=>{selectedDate=selectedDate===button.dataset.journalDay?'':button.dataset.journalDay;render();});
  }
  function render(){
    const stats=journalStats(state.posts,localDate());
    $('#journal-stats').innerHTML=[['Days logged',stats.postedDays],['Day streak',stats.currentStreak],['This week',stats.thisWeek]].map(([label,value])=>`<div class="journal-stat"><strong>${value}</strong><span>${label}</span></div>`).join('');
    const posts=sortPosts(state.posts).filter(post=>(!selectedDate||post.date===selectedDate)&&(selectedTag==='All'||post.sessionTag===selectedTag));
    $('#journal-feed-label').textContent=selectedDate?dateLabel(selectedDate):selectedTag==='All'?'All your days':`${selectedTag} days`;
    $('#journal-date-filter').value=selectedDate;
    $('#journal-tag-filter').value=selectedTag;
    $('#journal-clear-filter').hidden=!selectedDate&&selectedTag==='All';
    $('#journal-feed').innerHTML=posts.length?posts.map(postMarkup).join(''):`<div class="card empty journal-empty"><div class="empty-icon">${icon('photo')}</div><div class="empty-copy"><h4>${state.posts.length?'A little space for this day':'Your everyday, worth remembering'}</h4><p>${state.posts.length?'No posts match this view. Add a daily log or explore another day.':'A gym photo, a run, a few thoughts. Start your daily log and watch the moments add up.'}</p></div><button class="primary" data-journal-create>${icon('plus')}Add a daily log</button></div>`;
    container.querySelectorAll('[data-journal-create]').forEach(button=>button.onclick=()=>openComposer());
    container.querySelectorAll('[data-journal-edit]').forEach(button=>button.onclick=()=>openComposer(button.dataset.journalEdit));
    container.querySelectorAll('[data-journal-delete]').forEach(button=>button.onclick=()=>{
      if(confirm('Delete this daily log post?'))commit(state.posts.filter(post=>post.id!==button.dataset.journalDelete),'Daily log deleted');
    });
    container.querySelectorAll('.journal-post').forEach(article=>{
      const id=article.dataset.postId;
      const post=state.posts.find(item=>item.id===id);
      const carousel=article.querySelector('.journal-carousel');
      if(!carousel)return;
      const images=(post.images||[]).filter(safeImage);
      function move(index){
        const next=Math.max(0,Math.min(index,images.length-1));
        positions.set(id,next);
        carousel.querySelector('img').src=images[next];
        carousel.querySelector('img').alt=`Photo ${next+1} of ${images.length} from ${dateLabel(post.date)}`;
        const label=carousel.querySelector('.journal-photo-position');
        if(label)label.textContent=`${next+1} / ${images.length}`;
        const previous=carousel.querySelector('[data-carousel="prev"]'),following=carousel.querySelector('[data-carousel="next"]');
        if(previous)previous.disabled=next===0;
        if(following)following.disabled=next===images.length-1;
        carousel.querySelectorAll('[data-carousel-index]').forEach(button=>{const active=Number(button.dataset.carouselIndex)===next;button.classList.toggle('active',active);if(active)button.setAttribute('aria-current','true');else button.removeAttribute('aria-current');});
      }
      carousel.querySelectorAll('[data-carousel]').forEach(button=>button.onclick=()=>move((positions.get(id)||0)+(button.dataset.carousel==='next'?1:-1)));
      carousel.querySelectorAll('[data-carousel-index]').forEach(button=>button.onclick=()=>move(Number(button.dataset.carouselIndex)));
      carousel.onkeydown=event=>{if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();move((positions.get(id)||0)+(event.key==='ArrowRight'?1:-1));}};
    });
    renderCalendar();
  }

  function renderPreviews(){
    previews.innerHTML=draft.images.map((image,index)=>`<div class="journal-preview"><img src="${esc(image)}" alt="Selected photo ${index+1}"><button type="button" data-remove-image="${index}" aria-label="Remove photo ${index+1}">×</button></div>`).join('');
    previews.querySelectorAll('[data-remove-image]').forEach(button=>button.onclick=()=>{draft.images=draft.images.filter((_,index)=>index!==Number(button.dataset.removeImage));renderPreviews();});
    uploadStatus.textContent=busy?'Preparing your photos…':draft.images.length?`${draft.images.length} of ${MAX_IMAGES} photos added. You can remove any before saving.`:'Photos are optional. A few words can be a daily log too.';
    filesInput.disabled=busy||draft.images.length>=MAX_IMAGES;
    uploadButton.classList.toggle('disabled',filesInput.disabled);
    uploadButton.setAttribute('aria-disabled',String(filesInput.disabled));
    uploadButton.tabIndex=filesInput.disabled?-1:0;
    saveButton.disabled=busy;
  }
  function openComposer(id){
    const existing=id?state.posts.find(post=>post.id===id):null;
    epoch++;
    busy=false;
    draft={id:existing?.id||null,createdAt:existing?.createdAt||null,images:(existing?.images||[]).filter(safeImage).slice()};
    form.reset();
    form.elements.date.value=existing?.date||selectedDate||localDate();
    form.elements.date.max=localDate();
    form.elements.sessionTag.value=existing?.sessionTag||'Everyday';
    form.elements.caption.value=existing?.caption||'';
    dialog.querySelector('#journal-caption-count').textContent=form.elements.caption.value.length;
    dialog.querySelector('#journal-dialog-title').textContent=existing?'Edit daily log':'New daily log';
    saveButton.innerHTML=(existing?'Save changes ':'Save post ')+icon('arrow');
    showError('');
    dialog.querySelector('#journal-error').hidden=true;
    renderPreviews();
    if(!dialog.open)dialog.showModal();
    form.elements.caption.focus();
  }
  $('#journal-new-post').onclick=()=>openComposer();
  $('#journal-date-filter').onchange=event=>{
    const value=event.target.value;
    if(value&&!isValidDate(value,localDate())){showError('Choose a valid day on or before today.');event.target.value=selectedDate;return;}
    selectedDate=value;if(value)month=value.slice(0,7);render();
  };
  $('#journal-tag-filter').onchange=event=>{selectedTag=event.target.value;render();};
  $('#journal-clear-filter').onclick=()=>{selectedDate='';selectedTag='All';render();};
  function shiftMonth(amount){const current=new Date(month+'-01T12:00:00');current.setMonth(current.getMonth()+amount);month=`${current.getFullYear()}-${String(current.getMonth()+1).padStart(2,'0')}`;renderCalendar();}
  $('#journal-month-prev').onclick=()=>shiftMonth(-1);
  $('#journal-month-next').onclick=()=>shiftMonth(1);
  dialog.querySelector('#journal-close').onclick=()=>dialog.close();
  dialog.querySelector('#journal-cancel').onclick=()=>dialog.close();
  dialog.addEventListener('close',()=>{epoch++;busy=false;draft=null;filesInput.value='';previews.innerHTML='';});
  form.elements.caption.oninput=()=>{dialog.querySelector('#journal-caption-count').textContent=form.elements.caption.value.length;};
  uploadButton.onkeydown=event=>{if((event.key==='Enter'||event.key===' ')&&!filesInput.disabled){event.preventDefault();filesInput.click();}};
  filesInput.onchange=async()=>{
    const files=Array.from(filesInput.files||[]);
    if(!files.length||busy||!draft)return;
    const operation=epoch;
    if(files.length+draft.images.length>MAX_IMAGES){showError(`Choose up to ${MAX_IMAGES} photos per post. Remove a photo to make room.`);filesInput.value='';return;}
    busy=true;showError('');renderPreviews();
    const images=[];
    try{
      for(const file of files){
        if(!/^image\/(?:jpeg|png|webp|gif)$/.test(file.type))throw new Error('Choose a JPG, PNG, WebP or GIF image.');
        if(file.size>20*1024*1024)throw new Error('Choose photos smaller than 20 MB each.');
        const bitmap=await createImageBitmap(file);
        try{
          if(operation!==epoch||!dialog.open)return;
          if(!bitmap.width||!bitmap.height)throw new Error('This photo could not be read. Choose another image.');
          const scale=Math.min(1,1200/Math.max(bitmap.width,bitmap.height));
          const canvas=document.createElement('canvas');
          canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
          const context=canvas.getContext('2d');
          if(!context)throw new Error('Photo resizing is unavailable in this browser.');
          context.fillStyle='#ffffff';context.fillRect(0,0,canvas.width,canvas.height);
          context.drawImage(bitmap,0,0,canvas.width,canvas.height);
          images.push(canvas.toDataURL('image/jpeg',.78));
        }finally{bitmap.close();}
      }
      if(operation===epoch&&draft)draft.images=[...draft.images,...images];
    }catch(error){if(operation===epoch)showError(error.message||'Unable to read this photo. Try another image.');}
    finally{if(operation===epoch&&draft){busy=false;filesInput.value='';renderPreviews();}}
  };
  form.onsubmit=event=>{
    event.preventDefault();
    if(!draft||busy)return;
    const now=new Date().toISOString();
    const post={id:draft.id||crypto.randomUUID(),date:form.elements.date.value,caption:form.elements.caption.value,sessionTag:form.elements.sessionTag.value,images:draft.images.slice(),createdAt:draft.createdAt||now,updatedAt:now};
    const error=validatePost(post,localDate());
    if(error){showError(error);return;}
    const existing=draft.id;
    const posts=existing?state.posts.map(item=>item.id===existing?post:item):[...state.posts,post];
    if(commit(posts,existing?'Daily log updated':'Your day is in the books'))dialog.close();
  };
  render();
  return {openComposer,render,getPosts:()=>state.posts.slice()};
}
