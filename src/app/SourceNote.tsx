import type { Source } from '../model/diagram';
import { S } from './strings';

export interface SourceNoteProps {
  sources: Source[];
}

function linkOf(s: Source): string | undefined {
  if (s.url) return s.url;
  if (s.doi) return `https://doi.org/${s.doi}`;
  if (s.arxiv) return `https://arxiv.org/abs/${s.arxiv}`;
  return undefined;
}

export function SourceNote({ sources }: SourceNoteProps) {
  if (sources.length === 0) return null;
  return (
    <section aria-labelledby="panel-source">
      <h2 id="panel-source">{S.panel.source}</h2>
      <ul className="sources">
        {sources.map((s, i) => {
          const href = linkOf(s);
          const meta = [s.venue, s.arxiv ? `arXiv:${s.arxiv}` : null, s.doi ? `doi:${s.doi}` : null].filter(Boolean).join('、');
          return (
            <li key={`${s.arxiv ?? s.doi ?? s.title}-${i}`}>
              <p className="sources__title">
                {s.authors}（{s.year}）{href ? <a href={href} target="_blank" rel="noreferrer">{s.title}</a> : s.title}
              </p>
              {meta && <p className="sources__meta">{meta}</p>}
              {s.note && (
                <details className="sources__more">
                  <summary>{S.panel.sourceNote}</summary>
                  <p className="sources__note">{s.note}</p>
                </details>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
