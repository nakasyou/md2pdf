await markdown.ready;
const edit=document.getElementById('edit');
const result=document.getElementById('result');
const out=document.getElementById('out');

import {dlpdf} from './btns.js';
document.getElementById('dlpdf').addEventListener('click',e=>{
  dlpdf({edit:edit,result:result,out:out});
});
document.getElementById('open').addEventListener('click',e=>{
  const open = document.createElement("input");
  open.type = "file";
  open.accept = "text/*";
  open.click();
});
const font=document.getElementById('font');
font.addEventListener('change',e=>{
  out.style.fontFamily=font.value;
})
if(!sessionStorage.getItem('last')){
  sessionStorage.setItem('last','# Write here:D');
}else{
  edit.value=sessionStorage.getItem('last');
}

setInterval(e=>{
  const html=markdown.parse(edit.value);
  out.innerHTML=html;
  sessionStorage.setItem('last',edit.value);
},10);
