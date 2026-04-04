interface PageHeaderProps {
  eyebrow: string;
  title: string;
  description: string;
}

export function PageHeader({ eyebrow, title, description }: PageHeaderProps) {
  return (
    <div className="mb-8 space-y-2 sm:mb-10">
      <p className="text-xs uppercase tracking-[0.28em] text-neutral-500">{eyebrow}</p>
      <h1 className="max-w-4xl text-4xl font-semibold tracking-tight text-white sm:text-5xl">{title}</h1>
      <p className="max-w-3xl text-base leading-7 text-neutral-400 sm:text-lg">{description}</p>
    </div>
  );
}
