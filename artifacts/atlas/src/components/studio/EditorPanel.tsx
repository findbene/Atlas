import { lazy, Suspense } from "react";

const MonacoEditor = lazy(() => import("@monaco-editor/react"));

type Props = {
  language: "python" | "sql";
  value: string;
  onChange: (v: string) => void;
};

export function EditorPanel({ language, value, onChange }: Props) {
  return (
    <div className="h-full" data-testid="studio-editor">
      <Suspense
        fallback={
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            Loading editor...
          </div>
        }
      >
        <MonacoEditor
          height="100%"
          language={language}
          theme="vs-dark"
          value={value}
          onChange={v => onChange(v ?? "")}
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            lineNumbers: "on",
            scrollBeyondLastLine: false,
            automaticLayout: true,
            padding: { top: 12 },
            fontFamily: "Menlo, Monaco, 'Courier New', monospace",
          }}
        />
      </Suspense>
    </div>
  );
}
