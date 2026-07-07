// Unlike EC2/S3, IAM's Query API honors the default Accept header and returns JSON
// directly — no XML node needed for this branch.
const body = JSON.parse($input.first().json.data);
const users = ((body.ListUsersResponse || {}).ListUsersResult || {}).Users || [];
return users.map(u => ({ json: { name: u.UserName } }));
