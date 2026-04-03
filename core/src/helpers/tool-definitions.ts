export class ToolDefinitions {
  static list() {
    return [
      {
        type: 'function',
        function: {
          name: 'list_files',
          description: 'List files and folders in a directory relative to the repo root. Prefer this over get_folder_content.',
          parameters: {
            type: 'object',
            properties: { path: { type: 'string' } }
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'get_folder_content',
          description: 'Legacy alias for listing files and folders in a directory relative to the repo root.',
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
          name: 'read_file_range',
          description: 'Read a specific line range from a text file in the repo.',
          parameters: {
            type: 'object',
            properties: {
              path: { type: 'string' },
              startLine: { type: 'number' },
              endLine: { type: 'number' }
            },
            required: ['path', 'startLine', 'endLine']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'create_file',
          description: 'Create a new text file in the repo. Fails if the file already exists.',
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
          name: 'replace_in_file',
          description: 'Replace existing text in a file. Prefer this over save_file for targeted edits.',
          parameters: {
            type: 'object',
            properties: {
              path: { type: 'string' },
              search: { type: 'string' },
              replace: { type: 'string' },
              all: { type: 'boolean' }
            },
            required: ['path', 'search', 'replace']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'insert_in_file',
          description: 'Insert text before or after an anchor string in a file.',
          parameters: {
            type: 'object',
            properties: {
              path: { type: 'string' },
              content: { type: 'string' },
              after: { type: 'string' },
              before: { type: 'string' }
            },
            required: ['path', 'content']
          }
        }
      },
      {
        type: 'function',
        function: {
          name: 'save_file',
          description: 'Save or create a text file in the repo. Use only when a targeted tool is not suitable.',
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
