import rehypeSanitize from 'rehype-sanitize';
import { PluggableList } from 'unified';
import type { Schema } from 'hast-util-sanitize';

export const secureSchema : Schema = {
  // Allow only the following HTML tags. All other tags will be stripped.
  tagNames: [
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'p', 'br', 'hr',
    'strong', 'b', 'em', 'i', 'u', 's', 'del', 'code', 'pre',
    'blockquote',
    'ul', 'ol', 'li',
    'a',
    'img',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
  ],

  // Allow only the following attributes on the specified tags.
  attributes: {
    // Allow 'href', 'title', and 'target' on <a> tags.
    a: ['href', 'title', 'target'],
    // Allow 'src', 'alt', 'title', 'width', and 'height' on <img> tags.
    img: ['src', 'alt', 'title', 'width', 'height'],
    // Allow 'className' on all allowed tags for styling purposes (e.g., code highlighting).
    '*': ['className'], 
  },

  // Specify which protocols are allowed for URL-based attributes.
  // This is CRITICAL for preventing `javascript:` URLs.
  protocols: {
    href: ['http', 'https', 'mailto'],
    src: ['http', 'https'],
  },



  // Remove any HTML comments.
  strip: ['comment'],
};

interface MDEditorConfig {
  previewOptions: {
    rehypePlugins: PluggableList;    
  };
}

export const mdEditorConfig: MDEditorConfig = {
  previewOptions: {
    rehypePlugins: [[rehypeSanitize, secureSchema]],
  },
};