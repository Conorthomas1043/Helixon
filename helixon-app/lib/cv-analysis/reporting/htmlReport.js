export default function html(result){

return `

<html>

<head>

<title>CV Report</title>

</head>

<body>

<h1>${result.recommendation}</h1>

<h2>${result.overall}% Match</h2>

<h3>Strengths</h3>

<ul>

${result.strengths.map(

s=>`<li>${s}</li>`

).join("")}

</ul>

<h3>Missing Skills</h3>

<ul>

${result.missing.map(

s=>`<li>${s}</li>`

).join("")}

</ul>

</body>

</html>

`;

}