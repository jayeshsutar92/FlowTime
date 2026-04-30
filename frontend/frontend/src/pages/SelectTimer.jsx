import { Link } from "react-router-dom";

function SelectTimer() {
  return (
    <section className="screen">
      <div className="card action-card">
        <h1 className="screen-title">Choose your timer</h1>

        <div className="action-stack">
          <Link to="/timer" className="btn primary">
            Default
          </Link>
          <Link to="/custom" className="btn secondary">
            Custom
          </Link>
          <Link to="/dashboard" className="btn secondary">
            View Dashboard
          </Link>
        </div>
      </div>
    </section>
  );
}

export default SelectTimer;
