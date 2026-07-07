const arr = x => Array.isArray(x) ? x : (x ? [x] : []);
const root = $input.first().json.ListAllMyBucketsResult || {};
const buckets = arr(root.Buckets && root.Buckets.Bucket);
return buckets.map(b => ({ json: { name: b.Name } }));
