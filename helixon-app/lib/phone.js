// Phone numbers as links: tel: to call (a phone, or a softphone on a
// computer), sms: to text, and wa.me to message on WhatsApp. WhatsApp
// needs the international form, so UK-style numbers (07..., 01..., 02...)
// are given +44.

export function toE164(raw, defaultCountry = "44") {
  let s = String(raw || "").trim();
  if (!s) return null;
  // "ext. 123" and anything after it isn't part of the number.
  s = s.split(/\s*(?:ext\.?|x|#)\s*\d+$/i)[0];
  const plus = s.startsWith("+") || s.startsWith("00");
  let digits = s.replace(/\D/g, "");
  if (s.startsWith("00")) digits = digits.slice(2);
  if (!plus) {
    // (0) after a country code: +44 (0)7700 900123.
    if (digits.startsWith("0")) digits = `${defaultCountry}${digits.slice(1)}`;
    else if (!digits.startsWith(defaultCountry)) return null;
  } else {
    digits = digits.replace(/^(\d{1,3})0(?=\d{9,10}$)/, "$1");
  }
  if (digits.length < 8 || digits.length > 15) return null;
  return `+${digits}`;
}

export function telHref(raw) {
  const n = toE164(raw);
  return n ? `tel:${n}` : `tel:${String(raw || "").replace(/[^\d+]/g, "")}`;
}

export function smsHref(raw, body = "") {
  const n = toE164(raw) || String(raw || "").replace(/[^\d+]/g, "");
  return `sms:${n}${body ? `?&body=${encodeURIComponent(body)}` : ""}`;
}

export function whatsappHref(raw, text = "") {
  const n = toE164(raw);
  if (!n) return null;
  return `https://wa.me/${n.slice(1)}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}
