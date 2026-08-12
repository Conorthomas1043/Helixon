export default async function loadFile(file){


    if(!file){

        throw new Error(
            "No file supplied"
        );

    }



    const arrayBuffer =
        await file.arrayBuffer();



    return Buffer.from(
        arrayBuffer
    );


}