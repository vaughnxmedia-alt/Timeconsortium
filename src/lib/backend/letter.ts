import { event, site } from "../../config/site";

const origin = "https://www.timelessconsortium.com";

export type Letter = {
  heading: string;
  paragraphs: string[];
  button?: { label: string; href: string };
  note?: string;
};

const serif = "'Cormorant Garamond', Palatino, 'Palatino Linotype', Georgia, serif";
const sans = "'Source Sans 3', 'Segoe UI', Helvetica, Arial, sans-serif";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function rich(value: string) {
  return escapeHtml(value).replace(/\n/g, "<br>");
}

export function renderLetter(letter: Letter) {
  const logo = `${origin}${site.logo.src}`;
  const preview = letter.paragraphs[0] || letter.heading;
  const button =
    letter.button && /^https?:\/\//i.test(letter.button.href)
      ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 0;">
          <tr>
            <td bgcolor="#270716" style="background:#270716;">
              <a href="${escapeHtml(letter.button.href)}" style="display:inline-block;padding:14px 22px;font-family:${sans};font-size:13px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:#f4ecdf;text-decoration:none;">${escapeHtml(letter.button.label)}</a>
            </td>
          </tr>
        </table>`
      : "";
  const paragraphs = letter.paragraphs
    .map(
      (paragraph) =>
        `<p style="margin:0 0 16px;font-family:${sans};font-size:17px;line-height:1.55;color:#241018;">${rich(paragraph)}</p>`,
    )
    .join("");
  const note = letter.note
    ? `<p style="margin:22px 0 0;font-family:${sans};font-size:14px;line-height:1.5;color:#4a3340;">${rich(letter.note)}</p>`
    : "";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escapeHtml(letter.heading)}</title>
</head>
<body style="margin:0;padding:0;background:#f3eadf;color:#241018;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#f3eadf;">${escapeHtml(preview)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f3eadf" style="background:#f3eadf;">
  <tr>
    <td align="center" style="padding:28px 16px;">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px;margin:0 auto;border:1px solid #270716;">
        <tr>
          <td bgcolor="#270716" align="center" style="background:#270716;padding:0;text-align:center;">
            <p style="margin:0;padding:16px 22px 0;text-align:right;font-family:${sans};font-size:11px;font-weight:600;letter-spacing:0.22em;text-transform:uppercase;color:rgba(255,255,255,0.38);">Discover</p>
            <div style="padding:10px 32px 32px;">
            <a href="${origin}/" style="text-decoration:none;">
              <img src="${logo}" width="220" height="66" alt="${escapeHtml(site.logo.alt)}" style="display:block;margin:0 auto;border:0;outline:none;text-decoration:none;height:auto;">
            </a>
            <div style="width:56px;height:1px;background:#c4a15a;line-height:1px;font-size:1px;margin:22px auto 0;">&nbsp;</div>
            <p style="margin:18px 0 0;font-family:${serif};font-size:42px;line-height:0.95;font-weight:500;color:#f4ecdf;">${escapeHtml(event.name)}</p>
            <p style="margin:16px 0 0;font-family:${sans};font-size:12px;letter-spacing:0.16em;text-transform:uppercase;color:#c4a15a;">${escapeHtml(event.dateLabel)}</p>
            <p style="margin:10px 0 0;font-family:${sans};font-size:15px;line-height:1.45;color:#f4ecdf;">${escapeHtml(event.venue)}<br>${escapeHtml(event.city)}</p>
            </div>
          </td>
        </tr>
        <tr>
          <td bgcolor="#f3eadf" style="background:#f3eadf;padding:32px 32px 8px;">
            <h1 style="margin:0 0 16px;font-family:${serif};font-size:32px;line-height:1.1;font-weight:500;color:#270716;">${escapeHtml(letter.heading)}</h1>
            ${paragraphs}
            ${button}
            ${note}
          </td>
        </tr>
        <tr>
          <td bgcolor="#f3eadf" style="background:#f3eadf;padding:8px 32px 0;">
            <div style="height:1px;background:#c4a15a;line-height:1px;font-size:1px;">&nbsp;</div>
          </td>
        </tr>
        <tr>
          <td bgcolor="#f3eadf" style="background:#f3eadf;padding:16px 32px 28px;font-family:${sans};font-size:13px;line-height:1.5;color:#4a3340;">
            ${escapeHtml(site.name)}<br>
            Presented with ${escapeHtml(site.partner)}
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;

  const text = [
    event.name,
    event.dateLabel,
    event.venue,
    event.city,
    "",
    letter.heading,
    "",
    ...letter.paragraphs.flatMap((paragraph) => [paragraph, ""]),
    letter.button ? `${letter.button.label}: ${letter.button.href}` : "",
    "",
    letter.note || "",
    "",
    site.name,
    `Presented with ${site.partner}`,
  ]
    .filter((line, index, lines) => line !== "" || lines[index - 1] !== "")
    .join("\n")
    .trim();

  return { html, text };
}
