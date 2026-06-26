// Keep only agent deliveries (MR opened) that have NO story points yet.
return $input.all().filter(i => i.json.field === 'agent_mr' && (i.json.points == null || i.json.points === ''));
