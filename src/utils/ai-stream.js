export async function readAiStream(response, onText) {
  if (!response.body || !response.headers.get('content-type')?.includes('text/event-stream')) {
    throw new Error('服务商未返回流式响应');
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let data = [];
  let dataLength = 0;
  let done = false;
  let finished = false;
  let finishReason = '';
  const toolCalls = new Map();
  let outputItems = [];

  function dispatch() {
    if (!data.length) {
      return;
    }
    const payload = data.join('\n');
    data = [];
    dataLength = 0;
    if (payload === '[DONE]') {
      done = true;
      return;
    }
    let chunk;
    try {
      chunk = JSON.parse(payload);
    } catch {
      throw new Error('服务商返回了无效的流式数据');
    }
    if (chunk.error) {
      const description = typeof chunk.error?.message === 'string' ? chunk.error.message : '';
      throw new Error(description ? `流式回复失败：${description}` : '服务商返回流式错误');
    }
    if (chunk.type === 'response.output_text.delta' && typeof chunk.delta === 'string') {
      onText(chunk.delta);
    }
    if (chunk.type === 'response.failed' || chunk.type === 'response.incomplete') {
      const detail = chunk.response?.error?.message;
      throw new Error(typeof detail === 'string' ? detail : '流式回复未完成');
    }
    if (chunk.type === 'response.completed') {
      if (!Array.isArray(chunk.response?.output)) {
        throw new Error('服务商返回的响应格式无效');
      }
      outputItems = chunk.response.output;
      if (outputItems.filter((item) => item.type === 'function_call').length > 4) {
        throw new Error('工具调用数量过多');
      }
      for (const [index, item] of outputItems
        .filter((item) => item.type === 'function_call')
        .entries()) {
        if (
          typeof item.call_id !== 'string' ||
          item.call_id.length > 256 ||
          typeof item.name !== 'string' ||
          item.name.length > 128 ||
          typeof item.arguments !== 'string' ||
          item.arguments.length > 8192
        ) {
          throw new Error('工具调用数据无效');
        }
        toolCalls.set(index, {
          id: item.call_id,
          type: 'function',
          function: {
            name: item.name,
            arguments: item.arguments
          }
        });
      }
      finishReason = toolCalls.size ? 'tool_calls' : 'stop';
      finished = true;
      done = true;
    }
  }

  function processLines(final = false) {
    let index;
    while ((index = buffer.indexOf('\n')) !== -1) {
      let line = buffer.slice(0, index);
      buffer = buffer.slice(index + 1);
      if (line.endsWith('\r')) {
        line = line.slice(0, -1);
      }
      if (!line) {
        dispatch();
      } else if (line.startsWith('data:')) {
        const value = line.slice(5).replace(/^ /, '');
        dataLength += value.length;
        if (dataLength > 1048576) {
          throw new Error('流式响应数据过大');
        }
        data.push(value);
      }
      if (done) {
        return;
      }
    }
    if (buffer.length > 1048576) {
      throw new Error('流式响应数据过大');
    }
    if (final) {
      if (buffer.startsWith('data:')) {
        data.push(buffer.slice(5).replace(/^ /, '').replace(/\r$/, ''));
      }
      buffer = '';
      dispatch();
    }
  }
  try {
    while (!done) {
      const result = await reader.read();
      if (result.done) {
        buffer += decoder.decode();
        processLines(true);
        break;
      }
      buffer += decoder.decode(result.value, {
        stream: true
      });
      processLines();
    }
    if (!finished) {
      throw new Error('流式回复中断');
    }
    return {
      finishReason,
      toolCalls: [...toolCalls.entries()].sort((a, b) => a[0] - b[0]).map((item) => item[1]),
      outputItems
    };
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
