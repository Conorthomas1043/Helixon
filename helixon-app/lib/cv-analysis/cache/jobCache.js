import {CACHE_SIZE} from "../config.js";

import {hashText} from "../utils/hashing.js";

const cache=new Map();

export function getCached(text){

const key=hashText(text);

const item=cache.get(key);

if(!item)return null;

if(item.text!==text)return null;

cache.delete(key);

cache.set(key,item);

return item.value;

}

export function setCached(text,value){

const key=hashText(text);

if(cache.size>=CACHE_SIZE){

const oldest=cache.keys().next().value;

cache.delete(oldest);

}

cache.set(key,{

text,

value

});

}