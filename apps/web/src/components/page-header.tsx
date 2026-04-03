interface PageHeaderProps {
  eyebrow: string;
  title: string;
  description: string;
}

export function PageHeader({ eyebrow, title, description }: PageHeaderProps) {
  return (
    <div className="mb-8 space-y-3">
      <p className="text-sm uppercase tracking-[0.25em] text-cyan-300">{eyebrow}</p>
      <h1 className="text-4xl font-semibold tracking-tight text-white">{title}</h1>
      <p className="max-w-2xl text-base leading-7 text-slate-300">{description}</p>
    </div>
  );
}
