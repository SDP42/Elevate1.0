// Separate partner credentials; website login credentials are never changed.
// The shared password is supplied only through a private server environment.
export function partnerAccess(teamCode, env = process.env) {
  const match = /^ELEV(\d{2})$/.exec(teamCode || '');
  const number = match ? Number(match[1]) : 0;
  if (number < 1 || number > 32 || !env.PARTNER_ACCESS_PASSWORD) return null;
  return {
    label: env.PARTNER_ACCESS_LABEL || 'Wi-Fi access',
    username: `Elevate${number}`,
    password: env.PARTNER_ACCESS_PASSWORD,
    url: /^https:\/\//.test(env.PARTNER_ACCESS_URL || '') ? env.PARTNER_ACCESS_URL : null,
  };
}
