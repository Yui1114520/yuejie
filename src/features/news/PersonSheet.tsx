import { useEffect, useRef } from "react";
import { CloseIcon, FlameIcon } from "../../components/Icons";
import type { Person } from "../../types";

interface Props {
  person: Person;
  onClose: () => void;
  onOpenArticle: (articleId: string) => void;
}

export function PersonSheet({ person, onClose, onOpenArticle }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <article
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={person.name}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sheet-grab" aria-hidden="true" />
        <button ref={closeRef} type="button" className="sheet-close" onClick={onClose} aria-label="关闭">
          <CloseIcon width={18} height={18} />
        </button>

        <div className="sheet-scroll">
          <div
            className="person-hero"
            style={{
              background: `linear-gradient(155deg, ${person.accent} 0%, ${person.accent}b3 55%, #1a1410 100%)`,
            }}
          >
            <span className="person-avatar-lg" aria-hidden="true">
              {person.initial}
            </span>
            <h2 className="person-sheet-name">{person.name}</h2>
            <p className="person-sheet-en">{person.nameEn}</p>
            <span className="person-role-pill">{person.role}</span>
          </div>

          <div className="sheet-body">
            <p className="person-bio-full">{person.bio}</p>

            <section className="sheet-related">
              <h3>相关报道</h3>
              <ul>
                {person.articles.map((article) => (
                  <li key={article.id}>
                    <button
                      type="button"
                      className="related-button"
                      onClick={() => onOpenArticle(article.id)}
                    >
                      <span className="related-title">{article.title}</span>
                      <span className="related-heat">
                        <FlameIcon width={11} height={11} />
                        {article.heat}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>

            <p className="person-foot">
              人物简介来自本地资料库 · 仅收录热榜高频政治人物，未匹配人物不会展示
            </p>
          </div>
        </div>
      </article>
    </div>
  );
}
