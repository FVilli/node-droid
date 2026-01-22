export class ToolDefinitions {
  static list() {
    return [
      {
        type: 'function',
        function: {
          name: 'list_files',
          description: 'List files in a directory relative to the repo root.',
          parameters: {
            type: 'object',
            properties: { path: { type: 'string' } }
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'read_file',
          description: 'Read a text file from the repo.',
          parameters: {
            type: 'object',
            properties: { path: { type: 'string' } },
            required: ['path']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'save_file',
          description: 'Save or Create a text file to the repo.',
          parameters: {
            type: 'object',
            properties: {
              path: { type: 'string' },
              content: { type: 'string' }
            },
            required: ['path', 'content']
          }
        }
      },
    ];
  }
}
