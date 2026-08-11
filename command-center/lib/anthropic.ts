type ClaudeRequest = {
  system: string;
  user: string;
  maxTokens?: number;
};

export class ClaudeConfigurationError extends Error {}
export class ClaudeRequestError extends Error {}

export async function callClaude({ system, user, maxTokens = 900 }: ClaudeRequest): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new ClaudeConfigurationError('ANTHROPIC_API_KEY is not configured');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  });

  if (!response.ok) {
    throw new ClaudeRequestError(`Claude request failed with status ${response.status}`);
  }
  const payload = (await response.json()) as { content?: Array<{ type?: string; text?: string }> };
  const text = payload.content?.find((part) => part.type === 'text')?.text?.trim();
  if (!text) throw new ClaudeRequestError('Claude returned no text');
  return text;
}
