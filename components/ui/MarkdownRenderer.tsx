"use client"; // <-- This is the most important line

import { mdEditorConfig } from '@/lib/markdown-config';
import ReactMarkdown from 'react-markdown'; 


// This component takes the markdown content as a prop
export default function MarkdownRenderer({ content }: { content: string }) {

  return (
    <div className="w-full">
        <ReactMarkdown
      rehypePlugins={mdEditorConfig.previewOptions.rehypePlugins}
    >
      {content}
    </ReactMarkdown>
  
    </div>
  );
}

/*
import MDEditor from '@uiw/react-md-editor';

  <MDEditor.Markdown
      source={content}
      // Re-use the exact same security config to render the content safely
      rehypePlugins={mdEditorConfig.previewOptions.rehypePlugins}     
      style={{ padding: '2rem',  }}
     
    />
*/