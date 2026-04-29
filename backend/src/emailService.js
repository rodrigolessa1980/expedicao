const webhookUrl = process.env.EMAIL_WEBHOOK_URL || "https://dadosbi.monkeybranch.com.br/webhook/emailMessage";

export async function sendEmail({ to, subject, html }) {
  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ to, subject, html })
  });

  if (!response.ok) {
    throw new Error(`Falha ao enviar e-mail: ${response.status}`);
  }
}
