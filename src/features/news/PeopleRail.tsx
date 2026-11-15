import type { Person } from "../../types";

interface Props {
  people: Person[];
  onOpen: (person: Person) => void;
}

export function PeopleRail({ people, onOpen }: Props) {
  if (!people.length) return null;

  return (
    <section className="section">
      <header className="section-head">
        <div>
          <h2 className="section-title">今日人物</h2>
          <p className="section-sub">从热榜报道中提取 · 左右滑动查看</p>
        </div>
        <span className="section-index">{people.length} 位</span>
      </header>
      <div className="people-rail">
        {people.map((person) => (
          <button
            key={person.id}
            type="button"
            className="person-card"
            onClick={() => onOpen(person)}
          >
            <span
              className="person-avatar"
              style={{
                background: `linear-gradient(150deg, ${person.accent}, ${person.accent}b3)`,
              }}
              aria-hidden="true"
            >
              {person.initial}
            </span>
            <span className="person-name">{person.name}</span>
            <span className="person-role">{person.role}</span>
            <span className="person-bio">{person.bio}</span>
            <span className="person-meta">{person.mentions} 条相关报道</span>
          </button>
        ))}
      </div>
    </section>
  );
}
