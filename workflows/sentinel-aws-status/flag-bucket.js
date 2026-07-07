// Regex against the raw response text rather than a dedicated XML node: this call errors
// for buckets with no public-access-block config or in a different region, and an errored
// item won't have a parseable body — simplest to treat "no recognizable config" as unverified
// rather than build a second XML-node error path.
//
// Code node default mode ("run once for all items") receives every incoming item at once —
// map over them explicitly rather than relying on per-item execution semantics.
const items = $input.all();
const names = $('Extract Bucket Names').all().map(i => i.json.name);
return items.map((item, idx) => {
  const name = names[idx];
  const raw = item.json.data;
  let status = 'unverified';
  if (typeof raw === 'string' && raw.includes('<PublicAccessBlockConfiguration')) {
    const flags = ['BlockPublicAcls', 'IgnorePublicAcls', 'BlockPublicPolicy', 'RestrictPublicBuckets'].map(tag => {
      const m = new RegExp(`<${tag}>(true|false)</${tag}>`).exec(raw);
      return m ? m[1] === 'true' : false;
    });
    status = flags.every(Boolean) ? 'blocked' : 'exposed';
  }
  return { json: { name, status } };
});
