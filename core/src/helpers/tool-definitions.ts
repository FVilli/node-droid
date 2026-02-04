export class ToolDefinitions {
  static list() {
    return [
      {
        type: 'function',
        function: {
          name: 'get_folder_content',
          description: 'List files and folders in a directory relative to the repo root.',
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
      {
        type: 'function',
        function: {
          name: 'search',
          description: 'Search for text inside files under a directory.',
          parameters: {
            type: 'object',
            properties: {
              query: { type: 'string' },
              path: { type: 'string' },
              caseSensitive: { type: 'boolean' },
              maxResults: { type: 'number' }
            },
            required: ['query']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'search_file',
          description: 'Search for file names that match a substring under a directory.',
          parameters: {
            type: 'object',
            properties: {
              query: { type: 'string' },
              path: { type: 'string' },
              caseSensitive: { type: 'boolean' },
              maxResults: { type: 'number' }
            },
            required: ['query']
          }
        }
      },
    ];
  }
}
