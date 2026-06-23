// When the board is cleared (no pending queued items), post the next batch.
const pending = Number($input.first().json.pending || 0);
if (pending > 0) return [{ json: { pending } }];
try {
  await this.helpers.httpRequest({ method: 'GET', url: 'https://flow.gohm.tech/webhook/sentinel-postqueue', timeout: 30000 });
} catch (e) { /* ignore */ }
return [{ json: { refilled: true } }];
