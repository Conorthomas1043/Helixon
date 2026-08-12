import mammoth from "mammoth";

export default async function parseDOCX(path){

const result=

await mammoth.extractRawText({

path

});

return result.value;

}