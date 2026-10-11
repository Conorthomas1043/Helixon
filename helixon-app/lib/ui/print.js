// Prints one part of the page - a screening report, a comparison - on its
// own, so "Save as PDF" in the print dialog gives a clean document to send
// a client. Everything else is hidden by the .printing-section rules in
// app/globals.css while the dialog is open.
export function printSection(elementOrId) {
  const el = typeof elementOrId === "string" ? document.getElementById(elementOrId) : elementOrId;
  if (!el) {
    window.print();
    return;
  }
  const body = document.body;
  el.classList.add("print-target");
  body.classList.add("printing-section");
  const done = () => {
    el.classList.remove("print-target");
    body.classList.remove("printing-section");
    window.removeEventListener("afterprint", done);
  };
  window.addEventListener("afterprint", done);
  window.print();
  // Some browsers never fire afterprint; print() blocks until the dialog
  // closes in the rest, so tidying up here is safe either way.
  setTimeout(done, 0);
}
