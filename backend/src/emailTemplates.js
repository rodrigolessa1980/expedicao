export function confirmationEmailTemplate({ nome, confirmUrl }) {
  return `
  <div style="font-family: Arial, sans-serif; color: #0f172a;">
    <h2 style="margin-bottom: 8px;">Confirme sua conta</h2>
    <p>Ola, ${nome}.</p>
    <p>Recebemos seu cadastro na plataforma de expedicao.</p>
    <p style="margin: 20px 0;">
      <a href="${confirmUrl}" style="background:#2563eb;color:white;padding:10px 16px;border-radius:8px;text-decoration:none;">
        Confirmar conta
      </a>
    </p>
    <p>Se o botao nao funcionar, use este link:</p>
    <p><a href="${confirmUrl}">${confirmUrl}</a></p>
  </div>
  `;
}

export function forgotPasswordEmailTemplate({ nome, resetUrl }) {
  return `
  <div style="font-family: Arial, sans-serif; color: #0f172a;">
    <h2 style="margin-bottom: 8px;">Redefinicao de senha</h2>
    <p>Ola, ${nome}.</p>
    <p>Recebemos uma solicitacao para redefinir sua senha.</p>
    <p style="margin: 20px 0;">
      <a href="${resetUrl}" style="background:#dc2626;color:white;padding:10px 16px;border-radius:8px;text-decoration:none;">
        Redefinir senha
      </a>
    </p>
    <p>Se nao foi voce, ignore este e-mail.</p>
    <p>Link alternativo:</p>
    <p><a href="${resetUrl}">${resetUrl}</a></p>
  </div>
  `;
}
