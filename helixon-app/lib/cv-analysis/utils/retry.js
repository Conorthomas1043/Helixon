export function sleep(ms){

return new Promise(r=>setTimeout(r,ms));

}

export function backoff(attempt){

return Math.random()*1000*Math.pow(2,attempt);

}

export function retryable(status){

return status===429||(status>=500&&status<600);

}