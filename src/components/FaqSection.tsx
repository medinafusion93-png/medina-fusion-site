import { FAQ } from '../data/faq';
import { useReveal } from '../hooks/useReveal';

export default function FaqSection() {
  const reveal = useReveal<HTMLElement>();
  return (
    <section id="faq" ref={reveal.ref} aria-labelledby="faq-titre" className={`scroll-mt-20 ${reveal.className}`}>
      <h3 id="faq-titre" className="section-title mb-6 text-center">
        <span aria-hidden="true" className="mr-2">
          ❓
        </span>
        Questions fréquentes
      </h3>
      <div className="mx-auto max-w-3xl space-y-3">
        {FAQ.map((f) => (
          <details key={f.q} className="card group p-4 open:border-gold/50">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-semibold text-white [&::-webkit-details-marker]:hidden">
              {f.q}
              <span aria-hidden="true" className="text-gold transition group-open:rotate-45">
                +
              </span>
            </summary>
            <p className="mt-3 text-sm leading-relaxed text-neutral-300">{f.r}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
