// xml2js collapses a single child to a plain object but keeps multiple children as an
// array — normalize both shapes the same way.
const arr = x => Array.isArray(x) ? x : (x ? [x] : []);
const root = $input.first().json.DescribeInstancesResponse || {};
const reservations = arr(root.reservationSet && root.reservationSet.item);
const instances = [];
for (const res of reservations) {
  for (const ins of arr(res.instancesSet && res.instancesSet.item)) {
    const nameTag = arr(ins.tagSet && ins.tagSet.item).find(t => t && t.key === 'Name');
    instances.push({
      instance_id: ins.instanceId,
      name: nameTag ? nameTag.value : null,
      state: (ins.instanceState || {}).name,
      type: ins.instanceType,
      az: (ins.placement || {}).availabilityZone,
    });
  }
}
const ec2_summary = {
  checked_at: new Date().toISOString(),
  total: instances.length,
  running: instances.filter(i => i.state === 'running').length,
  instances,
};
return [{ json: { ec2_summary } }];
