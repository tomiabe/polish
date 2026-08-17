// ProfileCard.jsx: user profile card
import "./profile.css";

export function ProfileCard({ user, onDelete, onMessage, compact = false }) {
  return (
    <article className="card">
      <img src={user.avatar} alt={user.name} />
      <div className="card-body">
        <h2>{user.name}</h2>
        <p className="bio">{user.bio}</p>
        {!compact && (
          <div className="stats">
            <span className="stat">{user.posts} posts</span>
            <span className="stat">{user.followers} followers</span>
          </div>
        )}
        <div className="actions">
          <button className="btn primary" onClick={() => onMessage(user.id)}>
            Message
          </button>
          {!compact && (
            <button
              className="btn danger"
              onClick={() => {
                if (window.confirm(`Delete ${user.name}?`)) onDelete(user.id);
              }}
            >
              Delete
            </button>
          )}
          <button className="icon-btn" aria-label="More actions">
            <span className="icon">more</span>
          </button>
        </div>
      </div>
    </article>
  );
}
