"use client";

interface TypstSnippetProps {
  svg: string;
  className?: string;
  ariaHidden?: boolean;
}

export function TypstSnippet({ svg, className, ariaHidden = false }: TypstSnippetProps) {
  return (
    <div
      className={className ? `typst-snippet ${className}` : "typst-snippet"}
      aria-hidden={ariaHidden}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
