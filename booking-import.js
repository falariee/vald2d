import {parseBookingEmails,bookingEventId,singaporeDateTime,parseSingaporeDateTime} from './booking-parser.js';

export function mountBookingImport(container,{esc,toast,onSave}){
 const panel=document.createElement('section');
 panel.className='card booking-email-card booking-import-card';
 panel.innerHTML=`<span class="eyebrow">FROM YOUR INBOX TO YOUR NEXT SESSION</span><h3>Import a booking email</h3><p>Have a Gmail confirmation instead of a calendar invite? Paste its text or scan a screenshot, then check the booking before saving.</p><form id="booking-email-form"><label>Booking confirmation text<textarea id="booking-email-text" rows="5" maxlength="10000" placeholder="Paste the booking name, start time, and end time here."></textarea></label><div class="booking-email-controls calendar-form-actions"><button id="booking-extract" class="primary" type="submit">Find my booking</button><label class="text-button upload">Scan a screenshot<input id="booking-email-photo" type="file" accept="image/png,image/jpeg,image/webp" hidden></label><button class="text-button" type="button" id="booking-add-manual">Enter booking details</button></div></form><p class="note">Processed on your device. Only the reviewed booking name, location, and times are saved. Email text, photos, contact details, and entry links are discarded.</p><p class="note">This imports one email at a time; it does not connect to your Gmail inbox or sync future emails.</p><p id="booking-import-status" role="status" aria-live="polite"></p><div id="booking-review"></div>`;
 container.prepend(panel);
 const $=selector=>panel.querySelector(selector);
 const textInput=$('#booking-email-text'),photoInput=$('#booking-email-photo'),extract=$('#booking-extract'),status=$('#booking-import-status'),review=$('#booking-review');
 const uploadLabel=photoInput.closest('label');
 uploadLabel.tabIndex=0;uploadLabel.setAttribute('role','button');
 uploadLabel.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();if(!busy)photoInput.click();}};
 let busy=false,worker=null,destroyed=false;

 function setBusy(value){
  busy=value;extract.disabled=value;photoInput.disabled=value;textInput.disabled=value;$('#booking-add-manual').disabled=value;
  uploadLabel.setAttribute('aria-disabled',String(value));uploadLabel.tabIndex=value?-1:0;
 }
 function clearSource(){textInput.value='';photoInput.value='';}
 function showReview(candidates){
  review.innerHTML=`<div class="scan-review-head"><h4>${candidates.length?`${candidates.length} booking${candidates.length===1?'':'s'} found`:'Add the booking details'}</h4><p>Review every field. Missing dates stay blank until you enter them.</p></div><form id="booking-review-form"><div id="booking-review-rows"></div><p class="note booking-timezone-note">All times below are Singapore time (UTC+08:00). Past bookings can be saved for your records; reminders only apply to upcoming bookings.</p><div class="email-review-actions"><button id="booking-save" class="primary" type="submit">Save reviewed bookings</button><button id="booking-cancel" class="text-button" type="button">Cancel</button></div></form>`;
  const rows=$('#booking-review-rows');
  for(const [index,candidate] of (candidates.length?candidates:[{}]).entries()){
   const row=document.createElement('fieldset');row.className='booking-review-row import-row';
   row.innerHTML=`<legend>Booking ${index+1}</legend><div class="section-head"><span class="badge">${esc(candidate.bookingType||'REVIEW DETAILS')}</span><button class="delete" type="button" aria-label="Remove booking ${index+1}">Remove ×</button></div><label>Booking name<input name="title" maxlength="120" value="${esc(candidate.title||'')}" placeholder="For example, Ark Grit @ Hougang 422" required></label><label>Location<input name="location" maxlength="120" value="${esc(candidate.location||'')}" placeholder="For example, Hougang Blk 422"></label><div class="form-row"><label>Start · Singapore time<input name="start" type="datetime-local" step="1" value="${esc(singaporeDateTime(candidate.start))}" required></label><label>End · Singapore time<input name="end" type="datetime-local" step="1" value="${esc(singaporeDateTime(candidate.end))}" required></label></div>${candidate.issues?.length?`<p class="note booking-review-warning">${candidate.issues.map(esc).join(' ')}</p>`:''}`;
   row.dataset.bookingType=candidate.bookingType||'';
   row.querySelector('.delete').onclick=()=>row.remove();rows.append(row);
  }
  $('#booking-cancel').onclick=()=>{review.innerHTML='';clearSource();status.textContent='Import cancelled. No booking was saved.';};
  $('#booking-review-form').onsubmit=async event=>{
   event.preventDefault();const events=[];
   for(const row of rows.children){
    const get=name=>row.querySelector(`[name="${name}"]`).value.trim();
    const title=get('title'),location=get('location'),start=parseSingaporeDateTime(get('start')),end=parseSingaporeDateTime(get('end'));
    if(!title){toast('Enter a name for each booking.');row.querySelector('[name="title"]').focus();return;}
    if(!start||!end){toast('Enter valid start and end dates and times in Singapore time.');return;}
    const duration=Date.parse(end)-Date.parse(start);
    if(duration<=0){toast('Each booking must end after it starts.');return;}
    if(duration>48*3600000){toast('Check the booking times: a booking cannot exceed 48 hours.');return;}
    const saved={title,location,start,end,allDay:false,bookingType:row.dataset.bookingType,source:'email'};
    events.push({id:bookingEventId(saved),...saved});
   }
   if(!events.length){toast('Add a booking before saving.');return;}
   clearSource();
   const button=$('#booking-save');button.disabled=true;
   try{
    const accepted=await onSave(events);
    if(accepted===false){button.disabled=false;return;}
    review.innerHTML='';status.textContent=`${events.length} reviewed booking${events.length===1?'':'s'} saved. Import the next confirmation when it arrives.`;
    toast('Booking saved.');
   }catch{
    status.textContent='Unable to save these bookings. Your reviewed details are still here; please try again.';button.disabled=false;
   }
  };
 }

 $('#booking-email-form').onsubmit=event=>{
  event.preventDefault();if(busy)return;
  const text=textInput.value.trim();
  if(!text){toast('Paste your booking confirmation, or choose a screenshot.');textInput.focus();return;}
  if(text.length>10000){toast('Paste a booking email shorter than 10,000 characters.');return;}
  const candidates=parseBookingEmails(text);clearSource();
  status.textContent=candidates.length?`${candidates.length} possible booking${candidates.length===1?'':'s'} detected. Check the details below.`:'No booking confidently detected. Enter its details below, or try a clearer confirmation.';
  showReview(candidates);
 };
 $('#booking-add-manual').onclick=()=>{if(busy)return;clearSource();status.textContent='Enter the details from your confirmation. No date or time has been guessed.';showReview([]);};
 photoInput.onchange=async()=>{
  const file=photoInput.files?.[0];if(!file||busy)return;
  setBusy(true);review.innerHTML='';
  try{
   if(!/^image\/(png|jpeg|webp)$/i.test(file.type))throw Error('Choose a PNG, JPEG, or WebP screenshot.');
   if(file.size>20*1024*1024)throw Error('Choose a screenshot under 20 MB.');
   if(!window.Tesseract?.createWorker)throw Error('Text recognition is unavailable. Paste your booking email text instead.');
   status.textContent='Loading text recognition…';
   worker??=await window.Tesseract.createWorker('eng',1,{workerPath:'/ocr/worker.min.js',corePath:'/ocr/core',langPath:'/ocr/lang',gzip:false,logger:progress=>{if(!destroyed&&progress.status==='recognizing text')status.textContent=`Reading your booking… ${Math.round(progress.progress*100)}%`;}});
   const result=await worker.recognize(file);
   if(destroyed)return;
   const candidates=parseBookingEmails(result.data.text);result.data.text='';clearSource();
   status.textContent=candidates.length?`${candidates.length} possible booking${candidates.length===1?'':'s'} detected. Review the dates and times carefully.`:'No booking confidently detected. Enter its details below, or try a clearer screenshot.';
   showReview(candidates);
  }catch(error){
   if(!destroyed){status.textContent=error.message||'Unable to read this screenshot. Paste the confirmation text or enter its details.';toast('Booking screenshot could not be read.');}
  }finally{clearSource();if(!destroyed)setBusy(false);}
 };
 return {focus:()=>textInput.focus(),destroy:async()=>{destroyed=true;clearSource();if(worker)await worker.terminate();}};
}
