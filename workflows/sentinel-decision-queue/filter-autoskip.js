return $input.all().filter(i => i.json.auto_skip).map(i => ({ json: i.json }));
