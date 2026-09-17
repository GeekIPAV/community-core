const GATEWAY = "https://connector-gateway.lovable.dev/google_mail/gmail/v1";

function gmailHeaders() {
  return {
    Authorization: `Bearer ${process.env.LOVABLE_API_KEY}`,
    "X-Connection-Api-Key": process.env.GOOGLE_MAIL_API_KEY!,
    "Content-Type": "application/json",
  };
}

function toBase64Url(s: string) {
  return btoa(unescape(encodeURIComponent(s)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function encodeHeader(value: string) {
  // RFC 2047 para acentos nos cabeçalhos
  // eslint-disable-next-line no-control-regex
  if (/^[\x00-\x7F]*$/.test(value)) return value;
  return `=?UTF-8?B?${btoa(unescape(encodeURIComponent(value)))}?=`;
}

export type EnviarFolhaArgs = {
  para: string[];
  assunto: string;
  corpoHtml: string;
  ficheiroNome: string;
  ficheiroBase64: string; // base64 puro (sem data: prefix)
};

export async function enviarFolhaPorEmail(args: EnviarFolhaArgs) {
  const boundary = `meeru_${Math.random().toString(36).slice(2)}`;
  const raw = [
    `To: ${args.para.join(", ")}`,
    `Subject: ${encodeHeader(args.assunto)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: 7bit",
    "",
    args.corpoHtml,
    "",
    `--${boundary}`,
    `Content-Type: application/pdf; name="${args.ficheiroNome}"`,
    "Content-Transfer-Encoding: base64",
    `Content-Disposition: attachment; filename="${args.ficheiroNome}"`,
    "",
    args.ficheiroBase64.replace(/(.{76})/g, "$1\n"),
    "",
    `--${boundary}--`,
  ].join("\r\n");

  const res = await fetch(`${GATEWAY}/users/me/messages/send`, {
    method: "POST",
    headers: gmailHeaders(),
    body: JSON.stringify({ raw: toBase64Url(raw) }),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Falha ao enviar email (${res.status}): ${txt.slice(0, 300)}`);
  }
  return (await res.json()) as { id?: string };
}
