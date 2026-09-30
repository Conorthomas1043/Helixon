import loadFile from "@/lib/document/fileLoader";

import parsePdf from "@/lib/document/pdfParser";

import parseDocx from "@/lib/document/docxParser";

import { detectDocumentFormat } from "@/lib/document/fileSignature";

import { debug, error } from "../utils/logger.js";


// Stored in candidates.cv_text and shown on the raw-CV compare view. The
// prompts read far less than this (MAX_CV_CHARS in prompts/), so it only
// bounds what one upload can write into the database.
export const MAX_EXTRACTED_CHARS = 200_000;

// Error messages callers can show the recruiter as-is (app/api/run maps
// these to a 422 instead of a generic 500).
export const CV_READ_ERRORS = {
    pdf: "Unable to extract text from PDF",
    docx: "Unable to extract text from DOCX",
    doc: "DOC files are not supported. Convert to PDF or DOCX.",
    unsupported: "Unsupported CV format",
};

function finish(text, emptyMessage){

    if(!text || !text.trim()){
        throw new Error(emptyMessage);
    }

    return text.trim().slice(0, MAX_EXTRACTED_CHARS);

}


export default async function extractCvText(file){


    if(!file){

        throw new Error(
            "No CV file provided"
        );

    }


    const buffer =
        await loadFile(file);


    const name =
        file.name?.toLowerCase() || "";


    // Parsed by what the bytes are, not by the name or MIME type the
    // browser sent - those are labels the client chose.
    const format =
        detectDocumentFormat(buffer);


    // The filename itself is often the candidate's name (e.g.
    // "Jane_Doe_CV.pdf") - log the detected format only, never the name,
    // to keep candidate PII out of application logs.
    debug(
        "[CV extractor] format:",
        format || "unknown"
    );


    if(format === "pdf"){

        try {

            return finish(await parsePdf(buffer), "Empty PDF text");

        }
        catch(err){

            error(
                "[CV extractor] PDF error:",
                err.message
            );

            throw new Error(CV_READ_ERRORS.pdf);

        }

    }


    if(format === "docx"){

        try {

            return finish(await parseDocx(buffer), "Empty DOCX text");

        }
        catch(err){

            error(
                "[CV extractor] DOCX error:",
                err.message
            );

            throw new Error(CV_READ_ERRORS.docx);

        }

    }


    if(
        file.type === "application/msword"
        ||
        name.endsWith(".doc")
    ){

        throw new Error(CV_READ_ERRORS.doc);

    }


    throw new Error(CV_READ_ERRORS.unsupported);


}
