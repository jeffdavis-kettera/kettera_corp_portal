// ModuleRoleEditor — reusable widget shown on both Add User and User
// Detail. Renders one row per available module with a role dropdown:
//   No access | Basic User | Admin
//
// Model:
//   value is an object mapping moduleId → 'Admin' | 'BasicUser'.
//   A missing key means the user has no access to that module.
//   onChange receives the full replacement object.
//
// Props:
//   modules   — [{ id, code, name }, ...] the full list from GET /modules
//   value     — current assignments, e.g. { 1: 'Admin', 3: 'BasicUser' }
//   onChange  — (nextValue) => void
//   disabled  — locks the dropdowns while a save is in-flight

const NO_ACCESS = '';

export default function ModuleRoleEditor({ modules = [], value = {}, onChange, disabled = false }) {
  function setRoleForModule(moduleId, role) {
    const next = { ...value };
    if (role === NO_ACCESS) {
      delete next[moduleId];
    } else {
      next[moduleId] = role;
    }
    onChange(next);
  }

  if (modules.length === 0) {
    return (
      <div className="no-modules">
        No modules are configured. Add rows to <code>module</code> in the DB.
      </div>
    );
  }

  return (
    <div className="module-role-editor">
      <table className="data-table">
        <thead>
          <tr>
            <th>Module</th>
            <th style={{ width: '200px' }}>Role</th>
          </tr>
        </thead>
        <tbody>
          {modules.map((m) => {
            const currentRole = value[m.id] || NO_ACCESS;
            return (
              <tr key={m.id}>
                <td>{m.name}</td>
                <td>
                  <select
                    value={currentRole}
                    onChange={(e) => setRoleForModule(m.id, e.target.value)}
                    disabled={disabled}
                    aria-label={`Role for ${m.name}`}
                  >
                    <option value={NO_ACCESS}>No access</option>
                    <option value="BasicUser">Basic User</option>
                    <option value="Admin">Admin</option>
                  </select>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
