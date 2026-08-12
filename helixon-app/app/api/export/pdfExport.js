import PDFDocument from "pdfkit";

import fs from "fs";

export default function exportPDF(

result,

output

){

return new Promise(resolve=>{

const doc=

new PDFDocument();

doc.pipe(

fs.createWriteStream(output)

);

doc.fontSize(24)

.text("CV Analysis");

doc.moveDown();

doc.fontSize(18)

.text(

`Overall Score: ${result.overall}`

);

doc.text(

`Recommendation: ${result.recommendation}`

);

doc.end();

doc.on(

"finish",

resolve

);

});

}