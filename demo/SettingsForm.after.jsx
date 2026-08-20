// SettingsForm.jsx: project settings form
import { useState } from "react";
import "./settings-form.css";

export function SettingsForm({ project, onSave }) {
  const [name, setName] = useState(project.name);
  const [desc, setDesc] = useState(project.description);
  const [visibility, setVisibility] = useState(project.visibility);
  const [tags, setTags] = useState(project.tags.join(", "));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  function validate() {
    const e = {};
    if (!name.trim()) e.name = "Project name is required.";
    if (name.trim().length > 64) e.name = "Name must be 64 characters or fewer.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        description: desc.trim(),
        visibility,
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="settings-form" onSubmit={handleSubmit} noValidate>
      <h2 className="settings-form__title">Project Settings</h2>

      <div className="settings-form__field">
        <label className="settings-form__label" htmlFor="project-name">
          Project name
        </label>
        <input
          id="project-name"
          className="settings-form__input"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter project name"
          required
          aria-describedby={errors.name ? "name-error" : undefined}
          aria-invalid={!!errors.name}
        />
        {errors.name && (
          <p className="settings-form__error" id="name-error" role="alert">
            {errors.name}
          </p>
        )}
      </div>

      <div className="settings-form__field">
        <label className="settings-form__label" htmlFor="project-desc">
          Description
          <span className="settings-form__hint"> (optional)</span>
        </label>
        <textarea
          id="project-desc"
          className="settings-form__input settings-form__textarea"
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          placeholder="What is this project about?"
          rows={3}
        />
      </div>

      <div className="settings-form__field">
        <label className="settings-form__label" htmlFor="project-visibility">
          Visibility
        </label>
        <select
          id="project-visibility"
          className="settings-form__input settings-form__select"
          value={visibility}
          onChange={(e) => setVisibility(e.target.value)}
        >
          <option value="private">Private</option>
          <option value="team">Team</option>
          <option value="public">Public</option>
        </select>
        <p className="settings-form__hint-text">
          {visibility === "private" && "Only you can see this project."}
          {visibility === "team" && "Anyone in your organization can view it."}
          {visibility === "public" && "Anyone on the internet can view it."}
        </p>
      </div>

      <div className="settings-form__field">
        <label className="settings-form__label" htmlFor="project-tags">
          Tags
        </label>
        <input
          id="project-tags"
          className="settings-form__input"
          type="text"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="Comma-separated tags"
        />
      </div>

      <div className="settings-form__actions">
        <button
          className="settings-form__btn settings-form__btn--primary"
          type="submit"
          disabled={saving}
        >
          {saving ? "Saving..." : "Save changes"}
        </button>
      </div>
    </form>
  );
}
