import { useState, useEffect, useRef } from 'react';

let mermaidPromise = null;

function loadMermaid() {
  if (!mermaidPromise) {
    mermaidPromise = import('mermaid').then(({ default: mermaid }) => {
      mermaid.initialize({ startOnLoad: false, theme: 'neutral', securityLevel: 'loose' });
      return mermaid;
    });
  }
  return mermaidPromise;
}

let idCounter = 0;

export default function MermaidDiagram({ code }) {
  const [svg, setSvg] = useState('');
  const [error, setError] = useState(false);
  const idRef = useRef(`mmd-${++idCounter}`);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mermaid = await loadMermaid();
        const { svg } = await mermaid.render(idRef.current, code.trim());
        if (!cancelled) {
          setSvg(svg);
          setError(false);
        }
      } catch (e) {
        if (!cancelled) {
          setError(true);
          setSvg('');
        }
      }
    })();
    return () => { cancelled = true; };
  }, [code]);

  if (error) {
    return (
      <pre className="text-xs text-gray-500 bg-gray-50 rounded-lg p-3 overflow-x-auto my-2">
        <code>{code}</code>
      </pre>
    );
  }

  if (!svg) return null;

  return (
    <div
      className="my-3 flex justify-center overflow-x-auto"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}