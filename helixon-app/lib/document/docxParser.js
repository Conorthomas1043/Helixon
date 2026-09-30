import mammoth from "mammoth";

// Takes the file's bytes (fileLoader.js), not a path. This used to pass the
// Buffer as mammoth's `path` option, which Node rejects - so every .docx CV
// failed to read and the analysis ended in a generic 500.
export default async function parseDOCX(buffer){

    if(!buffer || !buffer.length){
        throw new Error("No DOCX buffer supplied");
    }

    const result = await mammoth.extractRawText({ buffer });

    return result.value;

}
