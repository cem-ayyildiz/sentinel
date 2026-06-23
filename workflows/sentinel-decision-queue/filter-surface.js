return $input.all().filter(i => !i.json.auto_skip).slice(0, 5).map(i => ({ json: i.json }));
