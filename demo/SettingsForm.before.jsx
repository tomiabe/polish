// SettingsForm.jsx: project settings form
import { useState } from "react";

export function SettingsForm({ project, onSave }) {
  const [name, setName] = useState(project.name);
  const [desc, setDesc] = useState(project.description);
  const [visibility, setVisibility] = useState(project.visibility);
  const [tags, setTags] = useState(project.tags.join(", "));

  return (
    <div className="form-container" style={{ padding: 16, background: "#f5f5f5", borderRadius: 8 }}>
      <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 16, color: "#111" }}>
        Project Settings
      </div>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 13, color: "#666", marginBottom: 4 }}>Project name</div>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter project name"
          style={{ width: "100%", padding: "8px 10px", border: "1px solid #ccc", borderRadius: 4 }}
        />
      </div>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 13, color: "#666", marginBottom: 4 }}>Description</div>
        <textarea
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          placeholder="What is this project about?"
          rows={3}
          style={{ width: "100%", padding: "8px 10px", border: "1px solid #ccc", borderRadius: 4, resize: "vertical" }}
        />
      </div>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 13, color: "#666", marginBottom: 4 }}>Visibility</div>
        <select
          value={visibility}
          onChange={(e) => setVisibility(e.target.value)}
          style={{ width: "100%", padding: "8px 10px", border: "1px solid #ccc", borderRadius: 4 }}
        >
          <option value="private">Private</option>
          <option value="team">Team</option>
          <option value="public">Public</option>
        </select>
      </div>
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 13, color: "#666", marginBottom: 4 }}>Tags</div>
        <input
          type="text"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="Comma-separated tags"
          style={{ width: "100%", padding: "8px 10px", border: "1px solid #ccc", borderRadius: 4 }}
        />
      </div>
      <div
        className="save-btn"
        onClick={() => onSave({ name, description: desc, visibility, tags: tags.split(",").map(t => t.trim()) })}
        style={{
          display: "inline-block", padding: "10px 24px", background: "#2563eb",
          color: "#fff", borderRadius: 6, fontWeight: 600, cursor: "pointer", marginTop: 8
        }}
      >
        Save changes
      </div>
    </div>
  );
}
