const items = $input.all();
const names = $('Extract User Names').all().map(i => i.json.name);
const cutoff = Date.now() - 180 * 24 * 3600 * 1000;
return items.map((item, idx) => {
  const name = names[idx];
  let keyCount = 0, stale = false;
  try {
    const body = JSON.parse(item.json.data);
    const keys = ((body.ListAccessKeysResponse || {}).ListAccessKeysResult || {}).AccessKeyMetadata || [];
    keyCount = keys.length;
    stale = keys.some(k => (Number(k.CreateDate) * 1000) < cutoff);
  } catch (e) {}
  return { json: { name, key_count: keyCount, stale_key: stale } };
});
