import { Task } from '../types';

type LLMClient = { chat(messages: any[], profile?: any, tools?: any[]): Promise<any> };
type ToolRegistry = { getTools(): any[]; execute(call: { name: string; arguments: Record<string, any> }): Promise<any> };
type Logger = { taskLLMCall(task: Task, payload: { messages: any[]; response: any; durationMs: number }): void; taskToolCall(task: Task, payload: { name: string; args: any; result: any; durationMs: number }): void; warn(msg: string): void };
type LLMProfileResolver = { resolve(ctx: any): any };
type RepoContextProvider = { get(): any };

export class LLMRunner {
  static async runLoop(
    task: Task,
    messages: any[],
    deps: {
      llm: LLMClient;
      tools: ToolRegistry;
      logger: Logger;
      llmProfileResolver: LLMProfileResolver;
      repoContext: RepoContextProvider;
      maxToolCalls: number;
    }
  ): Promise<boolean> {
    const profile = deps.llmProfileResolver.resolve(deps.repoContext.get());
    const tools = deps.tools.getTools();
    let toolCallsCount = 0;

    while (toolCallsCount <= deps.maxToolCalls) {
      const promptSnapshot = messages.map(m => ({ ...m }));
      const llmStart = Date.now();
      const response = await deps.llm.chat(messages, profile, tools);
      const llmDuration = Date.now() - llmStart;
      console.log('- [messages] ---------------------------------------------------------------------------------');
      console.log(messages);
      console.log('- [response] ---------------------------------------------------------------------------------');
      console.log(response);
      console.log('- <end> --------------------------------------------------------------------------------------');
      const message = response?.choices?.[0]?.message;

      if (!message) {
        task.result = 'No response from LLM';
        return false;
      }

      deps.logger.taskLLMCall(task, {
        messages: promptSnapshot,
        response: { role: message.role, content: message.content, tool_calls: message.tool_calls },
        durationMs: llmDuration
      });

      messages.push({
        role: message.role || 'assistant',
        content: message.content || null,
        tool_calls: message.tool_calls || undefined
      });

      const toolCalls = message.tool_calls || [];
      if (!toolCalls.length) {
        task.result = message.content || '';
        return true;
      }

      for (const call of toolCalls) {
        toolCallsCount++;
        if (toolCallsCount > deps.maxToolCalls) {
          task.result = 'Max tool calls reached';
          return false;
        }

        const name = call.function?.name;
        if (!name) {
          task.result = 'Tool call without name';
          return false;
        }

        let args: Record<string, any> = {};
        try {
          args = call.function?.arguments ? JSON.parse(call.function.arguments) : {};
        } catch {
          args = {};
        }

        const toolStart = Date.now();
        const result = await deps.tools.execute({ name, arguments: args });
        const toolDuration = Date.now() - toolStart;
        deps.logger.taskToolCall(task, { name, args, result, durationMs: toolDuration });

        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify(result)
        });
      }
    }

    task.result = 'Max tool calls reached';
    return false;
  }

  static warnRetry(logger: Logger, task: Task): void {
    logger.warn(`Notifying LLM about failure for [${task.title}]`);
  }
}
