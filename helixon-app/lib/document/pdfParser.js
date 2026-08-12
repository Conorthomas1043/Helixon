import { extractText, getDocumentProxy } from "unpdf";



/*
    Previously this used pdf-parse (which wraps pdfjs-dist and needs a
    separate pdf.worker.mjs file loaded at runtime). Turbopack's dev
    bundler cannot correctly resolve that worker file no matter how
    it's referenced, causing:
        "Setting up fake worker failed: Cannot find module '...pdf.worker.mjs'"

    unpdf ships a serverless build of PDF.js with the worker code
    inlined directly into the bundle -- there is no separate worker
    file to load, so this class of bug cannot occur.
*/

export default async function parsePDF(buffer){


    try {


        if(!buffer){

            throw new Error(
                "No PDF buffer supplied"
            );

        }



        const uint8Array =
            new Uint8Array(buffer);



        const pdf =
            await getDocumentProxy(
                uint8Array
            );



        const result =
            await extractText(
                pdf,
                { mergePages:true }
            );



        const text =
            result?.text?.trim();



        if(!text){

            throw new Error(
                "PDF contained no text"
            );

        }



        return text;



    }
    catch(error){


        console.error(
            "[pdfParser] failed:",
            error.message
        );


        throw new Error(
            "Unable to extract text from PDF"
        );


    }


}