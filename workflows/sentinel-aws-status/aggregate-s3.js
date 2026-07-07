const buckets = $input.all().map(i => i.json);
const s3_summary = {
  checked_at: new Date().toISOString(),
  total: buckets.length,
  buckets,
};
return [{ json: { s3_summary } }];
