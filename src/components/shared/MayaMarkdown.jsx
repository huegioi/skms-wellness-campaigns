import React from 'react';
import ReactMarkdown from 'react-markdown';
import MermaidDiagram from '@/components/shared/MermaidDiagram';

const COMPONENTS = {
  pre: ({ children }) => {
    const child = React.Children.toArray(children)[0];
    const cls = child?.props?.className || '';
    if (cls.includes('language-mermaid')) {
      const code = String(child?.props?.children || '').replace(/\n$/, '');
      return <MermaidDiagram code={code} />;
    }
    return <pre className="bg-gray-100 rounded-lg p-3 text-xs overflow-x-auto my-2">{children}</pre>;
  },
  img: ({ src, alt }) => (
    <img src={src} alt={alt} className="max-w-full rounded-lg my-2 border border-gray-200" />
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto my-2">
      <table className="w-full text-xs border-collapse">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border border-gray-200 px-2 py-1 bg-gray-50 font-semibold text-left">{children}</th>
  ),
  td: ({ children }) => (
    <td className="border border-gray-200 px-2 py-1">{children}</td>
  ),
};

export default function MayaMarkdown({ children }) {
  return <ReactMarkdown components={COMPONENTS}>{children}</ReactMarkdown>;
}