const embeddings=new Map();

export function getEmbedding(key){

return embeddings.get(key);

}

export function setEmbedding(key,value){

embeddings.set(key,value);

}