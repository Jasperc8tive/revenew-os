export interface LlmMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LlmGenerateInput {
  messages: LlmMessage[];
}

export interface LlmAdapter {
  generate(input: LlmGenerateInput): Promise<string>;
}

class OpenAiAdapter implements LlmAdapter {
  async generate(input: LlmGenerateInput): Promise<string> {
    const apiKey = process.env.OPENAI_API_KEY;
    const model = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';

    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is not configured.');
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.3,
        messages: input.messages,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`OpenAI request failed (${response.status}): ${text}`);
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    return payload.choices?.[0]?.message?.content?.trim() || 'No response generated.';
  }
}

class AnthropicAdapter implements LlmAdapter {
  async generate(input: LlmGenerateInput): Promise<string> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    const model = process.env.ANTHROPIC_MODEL ?? 'claude-3-5-sonnet-20241022';

    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY is not configured.');
    }

    const system = input.messages
      .filter((message) => message.role === 'system')
      .map((message) => message.content)
      .join('\n\n');

    const messages = input.messages
      .filter((message) => message.role !== 'system')
      .map((message) => ({
        role: message.role,
        content: message.content,
      }));

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: 800,
        temperature: 0.3,
        system,
        messages,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Anthropic request failed (${response.status}): ${text}`);
    }

    const payload = (await response.json()) as {
      content?: Array<{ type?: string; text?: string }>;
    };

    const text = payload.content
      ?.filter((block) => block.type === 'text')
      .map((block) => block.text ?? '')
      .join('\n')
      .trim();

    return text || 'No response generated.';
  }
}

class LocalFallbackAdapter implements LlmAdapter {
  async generate(input: LlmGenerateInput): Promise<string> {
    const latestUser = [...input.messages].reverse().find((entry) => entry.role === 'user');
    return [
      'AI provider is not configured yet, so this is a local fallback response.',
      latestUser ? `Your last prompt was: "${latestUser.content.slice(0, 180)}"` : '',
      'Set COPILOT_PROVIDER=openai or anthropic with matching API keys to enable live AI responses.',
    ]
      .filter((line) => line.length > 0)
      .join('\n\n');
  }
}

export function createLlmAdapter(): LlmAdapter {
  const provider = (process.env.COPILOT_PROVIDER ?? '').toLowerCase();

  if (provider === 'openai') {
    return new OpenAiAdapter();
  }

  if (provider === 'anthropic') {
    return new AnthropicAdapter();
  }

  return new LocalFallbackAdapter();
}
