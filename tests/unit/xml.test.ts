import { describe, expect, it } from 'vitest';
import {
  createEmptyConversationXML,
  createErrorXML,
  escapeXML,
  formatContent,
  formatMessage,
  formatToolResult,
  toXML,
} from '../../src/lib/xml';
import type { ConversationEntry } from '../../src/types';

describe('XML Utilities', () => {
  describe('escapeXML', () => {
    it('should escape basic XML characters', () => {
      const input =
        'Text with <tags>, "quotes", \'apostrophes\', & ampersands > than signs';
      const result = escapeXML(input);

      expect(result).toBe(
        'Text with &lt;tags&gt;, &quot;quotes&quot;, &apos;apostrophes&apos;, &amp; ampersands &gt; than signs'
      );
    });

    it('should handle empty string', () => {
      const result = escapeXML('');
      expect(result).toBe('');
    });

    it('should handle string without special characters', () => {
      const result = escapeXML('Normal text without special characters');
      expect(result).toBe('Normal text without special characters');
    });

    it('should handle multiple occurrences of same character', () => {
      const result = escapeXML('<<<>>>');
      expect(result).toBe('&lt;&lt;&lt;&gt;&gt;&gt;');
    });
  });

  describe('formatContent', () => {
    it('should format string content', () => {
      const result = formatContent('Simple string content');
      expect(result).toBe('Simple string content');
    });

    it('should escape special characters in string content', () => {
      const result = formatContent('Content with <tags> & "quotes"');
      expect(result).toBe('Content with &lt;tags&gt; &amp; &quot;quotes&quot;');
    });

    it('should format array content with text items', () => {
      const content = [
        { type: 'text', text: 'First text item' },
        { type: 'text', text: 'Second text item' },
      ];

      const result = formatContent(content);
      expect(result).toBe('First text item\nSecond text item');
    });

    it('should format array content with tool_use items', () => {
      const content = [
        {
          type: 'tool_use',
          name: 'read_file',
          id: 'tool_123',
          input: { path: 'test.txt' },
        },
      ];

      const result = formatContent(content);
      expect(result).toContain('<tool_use name="read_file" id="tool_123">');
      expect(result).toContain('{"path":"test.txt"}');
      expect(result).toContain('</tool_use>');
    });

    it('should format array content with tool_result items', () => {
      const content = [
        {
          type: 'tool_result',
          tool_use_id: 'tool_123',
          content: { success: true },
        },
      ];

      const result = formatContent(content);
      expect(result).toContain('<tool_result id="tool_123">');
      expect(result).toContain('{"success":true}');
      expect(result).toContain('</tool_result>');
    });

    it('should handle mixed array content', () => {
      const content = [
        { type: 'text', text: 'Here is the result:' },
        {
          type: 'tool_use',
          name: 'calculate',
          id: 'tool_456',
          input: { expression: '2+2' },
        },
        'Plain string in array',
      ];

      const result = formatContent(content);
      expect(result).toContain('Here is the result:');
      expect(result).toContain('<tool_use name="calculate"');
      expect(result).toContain('Plain string in array');
    });

    it('should filter out empty content items', () => {
      const content = [
        { type: 'text', text: 'Valid content' },
        { type: 'unknown_type' },
        '',
        { type: 'text', text: 'More valid content' },
      ];

      const result = formatContent(content);
      const lines = result.split('\n');

      expect(lines).toHaveLength(2);
      expect(lines[0]).toBe('Valid content');
      expect(lines[1]).toBe('More valid content');
    });

    it('should handle object content', () => {
      const content = { text: 'Object with text property' };
      const result = formatContent(content);
      expect(result).toBe('Object with text property');
    });

    it('should handle object content with type and content', () => {
      const content = { type: 'text', content: 'Nested content property' };
      const result = formatContent(content);
      expect(result).toBe('Nested content property');
    });

    it('should stringify unknown object content', () => {
      const content = { unknown: 'property', nested: { data: 'value' } };
      const result = formatContent(content);
      expect(result).toContain('"unknown":"property"');
      expect(result).toContain('"nested":{"data":"value"}');
    });
  });

  describe('formatToolResult', () => {
    it('should format tool result', () => {
      const toolResult = { success: true, data: 'result data' };
      const result = formatToolResult(toolResult);

      expect(result).toContain('<tool_result>');
      expect(result).toContain('{"success":true,"data":"result data"}');
      expect(result).toContain('</tool_result>');
    });

    it('should handle null tool result', () => {
      const result = formatToolResult(null);
      expect(result).toBe('');
    });

    it('should handle undefined tool result', () => {
      const result = formatToolResult(undefined);
      expect(result).toBe('');
    });

    it('should escape special characters in tool result', () => {
      const toolResult = { message: 'Result with <tags> & "quotes"' };
      const result = formatToolResult(toolResult);

      // JSON inside XML should maintain JSON escaping, not XML escaping
      expect(result).toContain(
        '{"message":"Result with <tags> & \\"quotes\\""}'
      );
    });
  });

  describe('formatMessage', () => {
    const baseEntry: ConversationEntry = {
      parentUuid: 'parent-123',
      uuid: 'msg-123',
      timestamp: '2024-01-01T10:00:00Z',
      type: 'user',
      message: {
        role: 'user',
        content: 'Hello world',
      },
    };

    it('should format basic message', () => {
      const result = formatMessage(baseEntry);

      expect(result).toContain(
        '<message uuid="msg-123" timestamp="2024-01-01T10:00:00Z">'
      );
      expect(result).toContain('<role>user</role>');
      expect(result).toContain('<type>user</type>');
      expect(result).toContain('<content>Hello world</content>');
      expect(result).toContain('</message>');
    });

    it('should escape special characters in message fields', () => {
      const entryWithSpecialChars: ConversationEntry = {
        ...baseEntry,
        uuid: 'msg<123>',
        timestamp: '2024-01-01T10:00:00Z',
        message: {
          role: 'user',
          content: 'Message with <tags> & "quotes"',
        },
      };

      const result = formatMessage(entryWithSpecialChars);

      expect(result).toContain('uuid="msg&lt;123&gt;"');
      expect(result).toContain(
        '<content>Message with &lt;tags&gt; &amp; &quot;quotes&quot;</content>'
      );
    });

    it('should include tool result when present', () => {
      const entryWithToolResult: ConversationEntry = {
        ...baseEntry,
        toolUseResult: { success: true, output: 'Tool output' },
      };

      const result = formatMessage(entryWithToolResult);

      expect(result).toContain('<tool_result>');
      expect(result).toContain('"success":true');
      expect(result).toContain('"output":"Tool output"');
    });

    it('should handle array content in message', () => {
      const entryWithArrayContent: ConversationEntry = {
        ...baseEntry,
        message: {
          role: 'assistant',
          content: [
            { type: 'text', text: 'I will help you with that.' },
            {
              type: 'tool_use',
              name: 'read_file',
              id: 'tool_1',
              input: { path: 'file.txt' },
            },
          ],
        },
      };

      const result = formatMessage(entryWithArrayContent);

      expect(result).toContain('I will help you with that.');
      expect(result).toContain('<tool_use name="read_file"');
    });
  });

  describe('toXML', () => {
    const sampleEntries: ConversationEntry[] = [
      {
        parentUuid: null,
        uuid: 'msg-1',
        timestamp: '2024-01-01T10:00:00Z',
        type: 'user',
        message: { role: 'user', content: 'First message' },
      },
      {
        parentUuid: 'msg-1',
        uuid: 'msg-2',
        timestamp: '2024-01-01T10:01:00Z',
        type: 'assistant',
        message: { role: 'assistant', content: 'Second message' },
      },
    ];

    it('should generate valid XML structure', () => {
      const result = toXML(sampleEntries);

      expect(result).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(result).toContain('<conversation>');
      expect(result).toContain('<metadata>');
      expect(result).toContain('<messages>');
      expect(result).toContain('</messages>');
      expect(result).toContain('</conversation>');
    });

    it('should include message count in metadata', () => {
      const result = toXML(sampleEntries);

      expect(result).toContain('<message_count>2</message_count>');
    });

    it('should include first and last message times', () => {
      const result = toXML(sampleEntries);

      expect(result).toContain(
        '<first_message_time>2024-01-01T10:00:00Z</first_message_time>'
      );
      expect(result).toContain(
        '<last_message_time>2024-01-01T10:01:00Z</last_message_time>'
      );
    });

    it('should include session ID when provided', () => {
      const result = toXML(sampleEntries, { sessionId: 'session-123' });

      expect(result).toContain('<session_id>session-123</session_id>');
    });

    it('should include project path when provided', () => {
      const result = toXML(sampleEntries, { projectPath: '/path/to/project' });

      expect(result).toContain('<project_path>/path/to/project</project_path>');
    });

    it('should include all metadata when provided', () => {
      const result = toXML(sampleEntries, {
        sessionId: 'session-456',
        projectPath: '/custom/path',
      });

      expect(result).toContain('<session_id>session-456</session_id>');
      expect(result).toContain('<project_path>/custom/path</project_path>');
    });

    it('should handle empty entries array', () => {
      const result = toXML([]);

      expect(result).toContain('<message_count>0</message_count>');
      expect(result).not.toContain('<first_message_time>');
      expect(result).not.toContain('<last_message_time>');
    });

    it('should handle single entry', () => {
      const singleEntry = [sampleEntries[0]!];
      const result = toXML(singleEntry);

      expect(result).toContain('<message_count>1</message_count>');
      expect(result).toContain(
        '<first_message_time>2024-01-01T10:00:00Z</first_message_time>'
      );
      expect(result).toContain(
        '<last_message_time>2024-01-01T10:00:00Z</last_message_time>'
      );
    });

    it('should escape metadata values', () => {
      const result = toXML(sampleEntries, {
        sessionId: 'session<123>',
        projectPath: '/path/with "quotes" & <brackets>',
      });

      expect(result).toContain('<session_id>session&lt;123&gt;</session_id>');
      expect(result).toContain(
        '<project_path>/path/with &quot;quotes&quot; &amp; &lt;brackets&gt;</project_path>'
      );
    });
  });

  describe('createErrorXML', () => {
    it('should create error XML with message', () => {
      const result = createErrorXML('Something went wrong');

      expect(result).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(result).toContain('<error>');
      expect(result).toContain('<message>Something went wrong</message>');
      expect(result).toContain('</error>');
    });

    it('should escape special characters in error message', () => {
      const result = createErrorXML('Error with <tags> & "quotes"');

      expect(result).toContain(
        '<message>Error with &lt;tags&gt; &amp; &quot;quotes&quot;</message>'
      );
    });

    it('should handle empty error message', () => {
      const result = createErrorXML('');

      expect(result).toContain('<message></message>');
    });
  });

  describe('createEmptyConversationXML', () => {
    it('should create empty conversation XML', () => {
      const result = createEmptyConversationXML();

      expect(result).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(result).toContain('<conversation>');
      expect(result).toContain('<metadata>');
      expect(result).toContain('<message_count>0</message_count>');
      expect(result).toContain('<messages></messages>');
      expect(result).toContain('</conversation>');
    });

    it('should include reason when provided', () => {
      const result = createEmptyConversationXML('No conversations found');

      expect(result).toContain('<note>No conversations found</note>');
    });

    it('should escape special characters in reason', () => {
      const result = createEmptyConversationXML(
        'Reason with <tags> & "quotes"'
      );

      expect(result).toContain(
        '<note>Reason with &lt;tags&gt; &amp; &quot;quotes&quot;</note>'
      );
    });

    it('should not include note when reason is empty', () => {
      const result = createEmptyConversationXML('');

      expect(result).not.toContain('<note>');
    });
  });
});
