import { getDb } from "@/lib/db";

export default async function AdminPage() {
  const db = getDb();
  const users = await db.query("select * from users order by role, name");

  return (
    <div>
      <h1 style={{ fontSize: 22, marginBottom: 4 }}>Admin</h1>
      <p style={{ color: "var(--ink-dim)", marginTop: 0, marginBottom: 20 }}>
        User roster. Roles are trust-based right now — they drive which nav items make sense for someone,
        not hard permission checks. Tighten this later if that stops being enough.
      </p>
      <table className="board-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Role</th>
            <th>Active</th>
          </tr>
        </thead>
        <tbody>
          {users.rows.map((u) => (
            <tr key={u.id}>
              <td>{u.name}</td>
              <td>{u.email}</td>
              <td>
                <span className="status-pill">{u.role}</span>
              </td>
              <td>{u.active ? "Yes" : "No"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
