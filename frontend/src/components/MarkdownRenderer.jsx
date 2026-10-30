import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/**
 * Validate URL to prevent unsafe javascript: or data: URIs
 */
function getSafeHref(href) {
  if (!href) return '#';
  const trimmed = href.trim();
  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith('http://') ||
    lower.startsWith('https://') ||
    lower.startsWith('mailto:') ||
    lower.startsWith('#')
  ) {
    return trimmed;
  }
  return '#';
}

/**
 * Enhanced CodeBlock component with copy functionality, language pill,
 * and syntax formatting.
 */
export function CodeBlock({ code, language }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.warn('Failed to copy code to clipboard', err);
    }
  };

  const displayLang = (language || 'code').replace(/^language-/, '').toLowerCase();

  return (
    <div className="my-3 rounded-xl overflow-hidden border border-[#282D38] bg-[#0B0D12] text-xs shadow-lg group">
      {/* Code Header Bar */}
      <div className="flex items-center justify-between px-3.5 py-1.5 bg-[#10131A] border-b border-[#282D38] text-slate-400 select-none">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-purple-500/80 inline-block"></span>
          <span className="font-mono text-[11px] uppercase tracking-wider text-purple-300 font-semibold">
            {displayLang}
          </span>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          title="Copy code to clipboard"
          className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400 hover:text-white px-2.5 py-1 rounded-lg bg-[#151923] hover:bg-[#1E2330] border border-[#282D38] transition-all cursor-pointer"
        >
          {copied ? (
            <>
              <svg className="w-3.5 h-3.5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span className="text-emerald-400 font-medium">Copied!</span>
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5 text-slate-400 group-hover:text-purple-300 transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              <span>Copy code</span>
            </>
          )}
        </button>
      </div>

      {/* Code Content */}
      <pre className="p-4 overflow-x-auto font-mono text-[12.5px] leading-relaxed text-slate-200 selection:bg-purple-800 selection:text-white">
        <code>{code}</code>
      </pre>
    </div>
  );
}

/**
 * Secure Markdown Renderer powered by ReactMarkdown & RemarkGFM.
 * Strictly prevents raw HTML execution while providing full styling for:
 * - Headings, bold/italic, lists, blockquotes
 * - Safe external links (target="_blank" rel="noopener noreferrer")
 * - GFM dark-themed tables with alternating row shading
 * - Code blocks with individual copy buttons
 * - Inline code tags
 */
export function MarkdownRenderer({ content, isStreaming = false }) {
  if (!content) return null;

  return (
    <div className="markdown-content text-sm leading-relaxed text-[#F3F4F6] break-words space-y-2">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Code block and inline code override
          code({ node, inline, className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '');
            const rawText = String(children).replace(/\n$/, '');

            if (!inline && (match || rawText.includes('\n'))) {
              return (
                <CodeBlock
                  code={rawText}
                  language={match ? match[1] : ''}
                />
              );
            }

            return (
              <code
                className="font-mono text-xs px-1.5 py-0.5 rounded bg-[#10131A] text-purple-300 border border-[#282D38] font-medium"
                {...props}
              >
                {children}
              </code>
            );
          },

          // Safe Links
          a({ node, href, children, ...props }) {
            const safeHref = getSafeHref(href);
            return (
              <a
                href={safeHref}
                target="_blank"
                rel="noopener noreferrer"
                className="text-purple-400 hover:text-purple-300 underline underline-offset-2 transition-colors inline-flex items-center gap-0.5"
                {...props}
              >
                <span>{children}</span>
                <svg className="w-3 h-3 inline-block opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
              </a>
            );
          },

          // GFM Tables
          table({ node, children, ...props }) {
            return (
              <div className="my-3 overflow-x-auto rounded-xl border border-[#282D38] bg-[#0B0D12]">
                <table className="min-w-full divide-y divide-[#282D38] text-xs text-left" {...props}>
                  {children}
                </table>
              </div>
            );
          },
          thead({ node, children, ...props }) {
            return <thead className="bg-[#10131A] text-purple-300 uppercase tracking-wider text-[11px] font-semibold" {...props}>{children}</thead>;
          },
          tbody({ node, children, ...props }) {
            return <tbody className="divide-y divide-[#282D38]/50" {...props}>{children}</tbody>;
          },
          tr({ node, children, ...props }) {
            return <tr className="hover:bg-[#151923]/60 transition-colors" {...props}>{children}</tr>;
          },
          th({ node, children, ...props }) {
            return <th className="px-3.5 py-2.5 font-semibold text-purple-300 border-b border-[#282D38]" {...props}>{children}</th>;
          },
          td({ node, children, ...props }) {
            return <td className="px-3.5 py-2.5 text-slate-300" {...props}>{children}</td>;
          },

          // Headings
          h1({ node, children, ...props }) {
            return <h1 className="text-lg font-bold text-white mt-4 mb-2 pb-1 border-b border-[#282D38]" {...props}>{children}</h1>;
          },
          h2({ node, children, ...props }) {
            return <h2 className="text-base font-bold text-white mt-3.5 mb-1.5" {...props}>{children}</h2>;
          },
          h3({ node, children, ...props }) {
            return <h3 className="text-sm font-semibold text-purple-300 mt-2.5 mb-1" {...props}>{children}</h3>;
          },
          h4({ node, children, ...props }) {
            return <h4 className="text-xs font-semibold text-slate-300 mt-2 mb-1 uppercase tracking-wider" {...props}>{children}</h4>;
          },

          // Lists
          ul({ node, children, ...props }) {
            return <ul className="list-disc pl-5 my-2 space-y-1 text-slate-200" {...props}>{children}</ul>;
          },
          ol({ node, children, ...props }) {
            return <ol className="list-decimal pl-5 my-2 space-y-1 text-slate-200" {...props}>{children}</ol>;
          },
          li({ node, children, ...props }) {
            return <li className="leading-relaxed" {...props}>{children}</li>;
          },

          // Blockquote
          blockquote({ node, children, ...props }) {
            return (
              <blockquote className="border-l-2 border-purple-500/80 bg-[#10131A]/60 px-3.5 py-2 my-2 rounded-r-lg text-slate-300 italic" {...props}>
                {children}
              </blockquote>
            );
          },

          // Paragraph
          p({ node, children, ...props }) {
            return <p className="leading-relaxed mb-2 last:mb-0" {...props}>{children}</p>;
          },

          // Horizontal rule
          hr({ node, ...props }) {
            return <hr className="my-4 border-[#282D38]" {...props} />;
          },
        }}
      >
        {content}
      </ReactMarkdown>

      {/* Real-time Streaming Cursor Indicator */}
      {isStreaming && (
        <span className="inline-block w-2 h-4 ml-1 translate-y-0.5 bg-gradient-to-t from-purple-500 to-indigo-400 rounded-sm animate-pulse" />
      )}
    </div>
  );
}

