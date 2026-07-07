const users = $input.all().map(i => i.json);
const iam_summary = {
  checked_at: new Date().toISOString(),
  total_users: users.length,
  users,
};
return [{ json: { iam_summary } }];
