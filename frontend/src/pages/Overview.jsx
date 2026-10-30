
import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

function Overview() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadOverview() {
      try {
        setLoading(true);
        setError("");

        const { data, error } = await supabase
          .from("customers")
          .select(
            "id, customer_code, name, phone, delivery_time, created_at"
          )
          .order("created_at", { ascending: false });

        if (error) {
          throw error;
        }

        setCustomers(data || []);
      } catch (err) {
        console.error("Overview loading error:", err);
        setError(err.message || "Unable to load customers.");
      } finally {
        setLoading(false);
      }
    }

    loadOverview();
  }, []);

  const morningCustomers = customers.filter((customer) =>
    ["morning", "both"].includes(
      String(customer.delivery_time || "").toLowerCase()
    )
  ).length;

  const eveningCustomers = customers.filter((customer) =>
    ["evening", "both"].includes(
      String(customer.delivery_time || "").toLowerCase()
    )
  ).length;

  const recentCustomers = customers.slice(0, 5);

  return (
    <div className="page-container">
      <section className="welcome-row">
        <div>
          <h2 className="welcome-title">Overview 🥛</h2>
          <p className="welcome-text">
            Welcome to Libi Dairy Farm. Here is your customer overview.
          </p>
        </div>
      </section>

      {error && (
        <div className="message error" role="alert">
          {error}
        </div>
      )}

      <section className="stats-grid overview-stats">
        <article className="overview-stat-card">
          <span className="overview-stat-icon">👥</span>
          <p className="overview-stat-label">Total customers</p>
          <h3 className="overview-stat-value">
            {loading ? "..." : customers.length}
          </h3>
          <p className="overview-stat-note">Registered customers</p>
        </article>

        <article className="overview-stat-card">
          <span className="overview-stat-icon">🌅</span>
          <p className="overview-stat-label">Morning customers</p>
          <h3 className="overview-stat-value">
            {loading ? "..." : morningCustomers}
          </h3>
          <p className="overview-stat-note">Morning or both sessions</p>
        </article>

        <article className="overview-stat-card">
          <span className="overview-stat-icon">🌙</span>
          <p className="overview-stat-label">Evening customers</p>
          <h3 className="overview-stat-value">
            {loading ? "..." : eveningCustomers}
          </h3>
          <p className="overview-stat-note">Evening or both sessions</p>
        </article>

        <article className="overview-stat-card">
          <span className="overview-stat-icon">🥛</span>
          <p className="overview-stat-label">Customer records</p>
          <h3 className="overview-stat-value">
            {loading ? "..." : customers.length}
          </h3>
          <p className="overview-stat-note">Stored in your database</p>
        </article>
      </section>

      <section className="panel overview-recent-panel">
        <div className="panel-header">
          <div>
            <h3 className="panel-title">Recent customers</h3>
            <p className="panel-description">
              The five most recently registered customers.
            </p>
          </div>
        </div>

        {loading ? (
          <p className="overview-empty">Loading customers...</p>
        ) : error ? (
          <p className="overview-empty">
            Customer information is unavailable.
          </p>
        ) : customers.length === 0 ? (
          <p className="overview-empty">
            No customers registered yet. Add your first customer from the
            Customers page.
          </p>
        ) : (
          <div className="overview-table-wrapper">
            <table className="overview-table">
              <thead>
                <tr>
                  <th>Customer ID</th>
                  <th>Name</th>
                  <th>Phone</th>
                  <th>Delivery</th>
                </tr>
              </thead>
              <tbody>
                {recentCustomers.map((customer) => (
                  <tr key={customer.id}>
                    <td>{customer.customer_code || "ID pending"}</td>
                    <td>{customer.name}</td>
                    <td>{customer.phone}</td>
                    <td>{customer.delivery_time || "Not specified"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export default Overview;
