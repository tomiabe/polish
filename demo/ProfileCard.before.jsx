// ProfileCard.jsx: user profile card
export function ProfileCard({ user, onDelete, onMessage }) {
  return (
    <div className="card" style={{ borderRadius: 12, background: "linear-gradient(135deg, #3B82F6, #8B5CF6)", transition: "all 200ms" }}>
      <img src={user.avatar} />
      <div className="card-body">
        <h2>{user.name}</h2>
        <p className="bio">{user.bio}</p>
        <div className="stats">
          <span className="stat">{user.posts} posts</span>
          <span className="stat">{user.followers} followers</span>
        </div>
        <div className="actions">
          <div className="btn primary" onClick={() => onMessage(user.id)}>
            Message
          </div>
          <div className="btn danger" onClick={() => onDelete(user.id)}>
            Delete
          </div>
          <button className="icon-btn">
            <span className="icon">more</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export function CompactProfileCard({ user, onMessage }) {
  return (
    <div className="card compact">
      <img src={user.avatar} />
      <div className="card-body">
        <h2>{user.name}</h2>
        <div className="actions">
          <div className="btn primary" onClick={() => onMessage(user.id)}>
            Message
          </div>
        </div>
      </div>
    </div>
  );
}
