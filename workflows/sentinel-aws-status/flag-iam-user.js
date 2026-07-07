// GetLoginProfile 404s (NoSuchEntity) for every user without console access — that's the
// expected, common case (most of these are service accounts), not a failure to react to.
const loginItems = $input.all();
const staleItems = $('Compute Key Staleness').all();
const mfaItems = $('List MFA Devices').all();

return loginItems.map((item, idx) => {
  const name = staleItems[idx].json.name;
  const stale_key = staleItems[idx].json.stale_key;
  let mfaCount = 0;
  try {
    const body = JSON.parse(mfaItems[idx].json.data);
    mfaCount = (((body.ListMFADevicesResponse || {}).ListMFADevicesResult || {}).MFADevices || []).length;
  } catch (e) {}
  const consoleAccess = !item.json.error;
  const flags = [];
  if (consoleAccess && mfaCount === 0) flags.push('no_mfa');
  if (stale_key) flags.push('stale_key');
  return { json: { user_name: name, console_access: consoleAccess, mfa_enabled: mfaCount > 0, flags } };
});
