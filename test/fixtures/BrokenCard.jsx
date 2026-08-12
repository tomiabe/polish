export function Scoreboard({ users }) {
  return (
    <div>
      <h1>Leaderboard</h1>
      {users.map((u) => (
        <div key={u.id} onClick={() => deleteUser(u.id)}>
          <span>{u.name}</span>
          <span>{u.score}</span>
        </div>
      ))}
      <button color="blue">Refresh</button>
      <button color="blue">Refresh</button>
    </div>
  );
}
