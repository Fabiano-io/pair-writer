interface DocumentPaneProps {
  title: string;
}

export function DocumentPane({ title }: DocumentPaneProps) {
  return (
    <main className="flex flex-1 flex-col overflow-y-auto">
      <article className="mx-auto w-full max-w-3xl px-12 py-10">
        {/* Document header */}
        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-zinc-100">
            {title}
          </h1>
          <p className="mt-2 text-sm text-zinc-500">
            Draft · Last edited just now
          </p>
        </header>

        {/* Rendered content blocks */}
        <section className="space-y-6 text-[15px] leading-relaxed text-zinc-300">
          <h2 className="text-xl font-semibold text-zinc-200">Overview</h2>
          <p>
            Pair Writer is a desktop writing environment designed for structured
            thinking and AI-assisted content creation. It combines a focused
            document editor with contextual AI chat that lives alongside each
            document.
          </p>
          <p>
            The core experience prioritizes rendered content over raw markup,
            delivering an editorial feel that keeps writers immersed in their
            ideas rather than formatting syntax.
          </p>

          <h2 className="text-xl font-semibold text-zinc-200">
            Core Principles
          </h2>
          <ul className="space-y-2 pl-5">
            <li className="flex items-start gap-2">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border border-zinc-700 text-xs text-emerald-400">
                ✓
              </span>
              <span>Document-first experience with contextual AI</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border border-zinc-700 text-xs text-emerald-400">
                ✓
              </span>
              <span>Chat belongs to the document, not to the application</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border border-zinc-700" />
              <span>Support for typography presets and visual themes</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border border-zinc-700" />
              <span>Resizable panels with layout persistence</span>
            </li>
          </ul>

          <h2 className="text-xl font-semibold text-zinc-200">
            Target Audience
          </h2>
          <p>
            Writers, product thinkers, and knowledge workers who need a
            structured yet flexible environment to develop long-form content
            with AI collaboration. The tool bridges the gap between minimal
            markdown editors and heavyweight document platforms.
          </p>

          <blockquote className="border-l-2 border-zinc-700 pl-4 italic text-zinc-400">
            "The best writing tool is the one that disappears, letting your
            thinking take center stage."
          </blockquote>
        </section>
      </article>
    </main>
  );
}
