export function dlpdf({out}){
  html2pdf()
    .set({
      margin:1
    })
    .from(out)
    .outputPdf('bloburl').then((result) => {
      const atag=document.createElement('a');
      atag.download=window.prompt('File name');
      atag.href=result;
      atag.click();
    });
}