export default function sanitise(text=""){

return text

.replace(/<\/?(system|assistant|human|instruction|prompt)[^>]*>/gi,"")

.replace(/\[\s*(SYS|INST|\/SYS|\/INST)\s*\]/gi,"")

.slice(0,18000);

}