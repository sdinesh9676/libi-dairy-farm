import { useState } from "react";

const API_URL = "http://localhost:5000/api";

function Customers({
  customers,
  filteredCustomers,
  search,
  setSearch,
  name,
  setName,
  phone,
  setPhone,
  deliveryTime,
  setDeliveryTime,
  quantityLitres,
  setQuantityLitres,
  frequency,
  setFrequency,
  addCustomer,
  loading,
  listLoading,
  message,
  error,
  refreshCustomers,
}) {
  const [statusLoadingId, setStatusLoadingId] = useState(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [statusError, setStatusError] = useState("");

  async function changeCustomerStatus(customer) {
    const currentlyActive = customer.is_active !== false;

    const action = currentlyActive ? "deactivate" : "reactivate";

    const confirmed = window.confirm(
      currentlyActive
        ? `Stop deliveries for ${customer.name}? Their previous delivery and payment history will be preserved.`
        : `Reactivate ${customer.name}?`,
    );

    if (!confirmed) return;

    setStatusLoadingId(customer.id);
    setStatusMessage("");
    setStatusError("");

    try {
      const response = await fetch(
        `${API_URL}/customers/${customer.id}/status`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            is_active: !currentlyActive,
          }),
        },
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Unable to update customer status.");
      }

      setStatusMessage(result.message || "Customer status updated.");

      if (refreshCustomers) {
        await refreshCustomers();
      }
    } catch (err) {
      setStatusError(err.message || "Something went wrong.");
    } finally {
      setStatusLoadingId(null);
    }
  }

  return (
    <div className="page-container">
      <section className="welcome-row">
        <div>
          <h2 className="welcome-title">Customers 👥</h2>
          <p className="welcome-text">
            Register customers and manage your customer directory.
          </p>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h3 className="panel-title">Add customer</h3>
            <p className="panel-description">
              Enter the customer's details below.
            </p>
          </div>
        </div>

        <form className="customer-form" onSubmit={addCustomer}>
          <div className="field">
            <label htmlFor="customer-name">Customer name</label>
            <input
              id="customer-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter full name"
              required
            />
          </div>

          <div className="field">
            <label htmlFor="customer-phone">Phone number</label>
            <input
              id="customer-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Enter phone number"
              required
            />
          </div>

          <div className="field">
            <label htmlFor="customer-delivery-time">Delivery session</label>
            <select
              id="customer-delivery-time"
              value={deliveryTime}
              onChange={(e) => setDeliveryTime(e.target.value)}
              required
            >
              <option value="">Select session</option>
              <option value="Morning">Morning</option>
              <option value="Evening">Evening</option>
              <option value="Both">Both</option>
            </select>
          </div>

          <div className="field">
            <label htmlFor="customer-quantity">Litres per delivery</label>
            <input
              id="customer-quantity"
              type="number"
              min="0.1"
              max="100"
              step="0.1"
              value={quantityLitres}
              onChange={(e) => setQuantityLitres(e.target.value)}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="customer-frequency">Frequency</label>
            <select
              id="customer-frequency"
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
            >
              <option value="Daily">Daily</option>
              <option value="Day by day">Day by day</option>
            </select>
          </div>

          <button className="primary-button" type="submit" disabled={loading}>
            {loading ? "Saving..." : "Add customer →"}
          </button>
        </form>

        {message && <div className="message success">{message}</div>}
        {error && <div className="message error">{error}</div>}
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h3 className="panel-title">Customer directory</h3>
            <p className="panel-description">
              {customers.length} registered customer(s)
            </p>
          </div>
        </div>

        {statusMessage && (
          <div className="message success">{statusMessage}</div>
        )}
        {statusError && <div className="message error">{statusError}</div>}

        <div className="field customer-search">
          <label htmlFor="customer-search">Search customers</label>
          <input
            id="customer-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or phone"
          />
        </div>

        {listLoading ? (
          <p>Loading customers...</p>
        ) : filteredCustomers.length === 0 ? (
          <p>No matching customers found.</p>
        ) : (
          <div className="overview-table-wrapper">
            <table className="overview-table">
              <thead>
                <tr>
                  <th>Customer ID</th>
                  <th>Name</th>
                  <th>Phone</th>
                  <th>Session</th>
                  <th>Litres</th>
                  <th>Frequency</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>Action</th>
                </tr>
              </thead>

              <tbody>
                {filteredCustomers.map((customer) => {
                  const isActive = customer.is_active !== false;
                  const isUpdating = statusLoadingId === customer.id;

                  return (
                    <tr key={customer.id}>
                      <td>{customer.customer_code || "ID pending"}</td>
                      <td>{customer.name}</td>
                      <td>{customer.phone}</td>
                      <td>{customer.delivery_time || "—"}</td>
                      <td>{customer.quantity_litres ?? "—"}</td>
                      <td>{customer.frequency || "—"}</td>

                      <td>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "4px 9px",
                            borderRadius: "20px",
                            fontSize: "12px",
                            fontWeight: 600,
                            background: isActive ? "#e5f7eb" : "#fce8e8",
                            color: isActive ? "#18743b" : "#b42318",
                          }}
                        >
                          {isActive ? "Active" : "Inactive"}
                        </span>
                      </td>

                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        <button
                          type="button"
                          onClick={() => changeCustomerStatus(customer)}
                          disabled={isUpdating}
                          style={{
                            padding: "7px 11px",
                            border: "1px solid",
                            borderColor: isActive ? "#dc6262" : "#29945b",
                            borderRadius: "7px",
                            background: isActive ? "#fff5f5" : "#effaf2",
                            color: isActive ? "#b42318" : "#18743b",
                            cursor: isUpdating ? "wait" : "pointer",
                            fontWeight: 600,
                          }}
                        >
                          {isUpdating
                            ? "Please wait..."
                            : isActive
                              ? "Deactivate"
                              : "Reactivate"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export default Customers;
