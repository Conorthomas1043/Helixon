export default function cleanJson(text = "") {

  if (!text || typeof text !== "string") {
    return "";
  }


  let cleaned = text.trim();


  // Extract JSON from markdown code blocks
  const blocks = [
    ...cleaned.matchAll(
      /```(?:json)?\s*([\s\S]*?)```/gi
    )
  ];


  if (blocks.length > 0) {

    cleaned = blocks
      .at(-1)[1]
      .trim();

  }


  // Remove any text before/after JSON object
  const first = cleaned.indexOf("{");
  const last = cleaned.lastIndexOf("}");


  if (
    first !== -1 &&
    last !== -1 &&
    last > first
  ) {

    cleaned = cleaned.slice(
      first,
      last + 1
    );

  }


  return cleaned.trim();

}