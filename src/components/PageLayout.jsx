// PageLayout — the shell wrapping every authenticated screen.
//
// Renders sidebar + header + main content region. Actions slot lives
// in the header's right cluster (mirrors Navigator's PageLayout).
//
// Props:
//   title           — string, rendered in the header
//   actions         — optional React node (buttons etc.) shown on the right
//   contentClassName — extra classes on the content wrapper (rarely used)
//   children

import Navigation from './Navigation.jsx';

export default function PageLayout({ title, actions, contentClassName = '', children }) {
  return (
    <div className="app-shell">
      <aside className="app-shell__sidebar">
        <Navigation />
      </aside>
      <div className="app-shell__main">
        <header className="app-shell__header">
          <h1 className="app-shell__title">{title}</h1>
          {actions && <div className="app-shell__actions">{actions}</div>}
        </header>
        <main className={`app-shell__content ${contentClassName}`.trim()}>
          {children}
        </main>
      </div>
    </div>
  );
}
