export default function repair(text){

text=text.trim();

text=text.replace(

/,\s*}/g,

"}"

);

text=text.replace(

/,\s*]/g,

"]"

);

return text;

}