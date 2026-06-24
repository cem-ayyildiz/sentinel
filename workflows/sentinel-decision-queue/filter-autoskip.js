return $input.all().filter(i => i.json.auto_handle).map(i => ({ json: i.json }));
