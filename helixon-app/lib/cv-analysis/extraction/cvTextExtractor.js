import loadFile from "@/lib/document/fileLoader";

import parsePdf from "@/lib/document/pdfParser";

import parseDocx from "@/lib/document/docxParser";

import { debug, error } from "../utils/logger.js";



export default async function extractCvText(file){


    if(!file){

        throw new Error(
            "No CV file provided"
        );

    }



    const buffer =
        await loadFile(file);



    const type =
        file.type || "";



    const name =
        file.name?.toLowerCase() || "";



    // The filename itself is often the candidate's name (e.g.
    // "Jane_Doe_CV.pdf") - log the extension/type only, never the name,
    // to keep candidate PII out of application logs.
    debug(
        "[CV extractor] type:",
        type || name.split(".").pop() || "unknown"
    );




    if(
        type === "application/pdf"
        ||
        name.endsWith(".pdf")
    ){


        try {


            const text =
                await parsePdf(buffer);



            if(
                !text ||
                !text.trim()
            ){

                throw new Error(
                    "Empty PDF text"
                );

            }



            return text.trim();


        }
        catch(err){


            error(
                "[CV extractor] PDF error:",
                err.message
            );


            throw new Error(
                "Unable to extract text from PDF"
            );


        }


    }






    if(
        type ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

        ||

        name.endsWith(".docx")
    ){


        const text =
            await parseDocx(buffer);



        if(
            !text ||
            !text.trim()
        ){

            throw new Error(
                "DOCX contained no readable text"
            );

        }



        return text.trim();


    }







    if(
        type === "application/msword"
        ||
        name.endsWith(".doc")
    ){


        throw new Error(
            "DOC files are not supported. Convert to PDF or DOCX."
        );


    }






    throw new Error(
        "Unsupported CV format"
    );


}
