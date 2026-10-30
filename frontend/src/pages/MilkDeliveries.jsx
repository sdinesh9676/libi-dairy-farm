import { useEffect, useState } from "react";
import { supabase } from "../supabaseClient";

function getToday() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function MilkDeliveries({ customers = [], milkPrice, setMilkPrice }) {
  const [deliveries, setDeliveries] = useState([]);
  const [deliveryCustomerId, setDeliveryCustomerId] = useState("");
  const [deliveryDate, setDeliveryDate] = useState(getToday());
  const [deliverySession, setDeliverySession] = useState("Morning");
  const [deliveryQuantity, setDeliveryQuantity] = useState("1");
  const [deliveryStatus, setDeliveryStatus] = useState("Delivered");

  const [deliveryLoading, setDeliveryLoading] = useState(false);
  const [listLoading, setListLoading] = useState(true);
  const [deliveryMessage, setDeliveryMessage] = useState("");
  const [deliveryError, setDeliveryError] = useState("");
  const [listError, setListError] = useState("");

  async function loadMilkPrice() {
    try {
      const { data, error } = await supabase
        .from("dairy_settings")
        .select("milk_price_per_litre")
        .eq("id", 1)
        .single();

      if (error) throw error;

      setMilkPrice(Number(data.milk_price_per_litre));
    } catch (error) {
      console.error("Load milk price failed:", error);
      setDeliveryError(error.message || "Unable to load milk price.");
    }
  }

  async function loadMilkPrice() {
    try {
      const response = await fetch(`${API_URL}/dairy-settings`);
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to load milk price.");
      }

      setMilkPrice(data.milk_price_per_litre);
    } catch (error) {
      console.error("Load milk price failed:", error);
    }
  }

  useEffect(() => {
    loadDeliveries();
    loadMilkPrice();
  }, []);

  async function saveDelivery(event) {
    event.preventDefault();
    setDeliveryMessage("");
    setDeliveryError("");
    setDeliveryLoading(true);

    try {
      if (!deliveryCustomerId) {
        throw new Error("Please select a customer.");
      }

      if (!deliveryDate) {
        throw new Error("Please select a delivery date.");
      }

      if (!["Morning", "Evening"].includes(deliverySession)) {
        throw new Error("Please select a valid session.");
      }

      if (!["Delivered", "Skipped", "Not delivered"].includes(deliveryStatus)) {
        throw new Error("Please select a valid delivery status.");
      }

      const quantity = Number(deliveryQuantity);

      if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 100) {
        throw new Error(
          "Quantity must be greater than 0 and at most 100 litres.",
        );
      }

      const { data: customer, error: customerError } = await supabase
        .from("customers")
        .select("id, is_active")
        .eq("id", Number(deliveryCustomerId))
        .single();

      if (customerError) throw customerError;

      if (!customer.is_active) {
        throw new Error("This customer is inactive.");
      }

      const { data: settings, error: settingsError } = await supabase
        .from("dairy_settings")
        .select("milk_price_per_litre")
        .eq("id", 1)
        .single();

      if (settingsError) throw settingsError;

      const price = Number(settings.milk_price_per_litre);

      if (!Number.isFinite(price) || price <= 0) {
        throw new Error("Please check the milk price in dairy settings.");
      }

      const { error: insertError } = await supabase
        .from("milk_deliveries")
        .insert({
          customer_id: Number(deliveryCustomerId),
          delivery_date: deliveryDate,
          session: deliverySession,
          quantity_litres: quantity,
          price_per_litre: price,
          status: deliveryStatus,
        });

      if (insertError) {
        if (insertError.code === "23505") {
          throw new Error(
            "A delivery already exists for this customer, date and session.",
          );
        }

        throw insertError;
      }

      const charge = deliveryStatus === "Delivered" ? quantity * price : 0;

      setDeliveryMessage(
        `Delivery saved successfully! Charge: ₹${charge.toFixed(2)}`,
      );

      setDeliveryQuantity("1");

      await loadDeliveries();
    } catch (error) {
      console.error("Save delivery failed:", error);
      setDeliveryError(error.message || "Unable to save delivery.");
    } finally {
      setDeliveryLoading(false);
    }
  }

  const deliveredRecords = deliveries.filter(
    (delivery) => delivery.status === "Delivered",
  );

  const totalLitres = deliveredRecords.reduce(
    (total, delivery) => total + Number(delivery.quantity_litres || 0),
    0,
  );

  const totalCharges = deliveredRecords.reduce(
    (total, delivery) =>
      total +
      Number(delivery.quantity_litres || 0) *
        Number(delivery.price_per_litre || 0),
    0,
  );

  return (
    <div className="page-container">
      <section className="welcome-row">
        <div>
          <h2 className="welcome-title">Milk deliveries 🥛</h2>
          <p className="welcome-text">
            Record and view customers' morning and evening deliveries.
          </p>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h3 className="panel-title">Record a delivery</h3>
            <p className="panel-description">
              Current milk price: ₹{Number(milkPrice || 0).toFixed(2)} per litre
            </p>
          </div>
        </div>

        <form className="customer-form" onSubmit={saveDelivery}>
          <div className="field">
            <label htmlFor="delivery-customer">Customer</label>
            <select
              id="delivery-customer"
              value={deliveryCustomerId}
              onChange={(event) => setDeliveryCustomerId(event.target.value)}
              required
            >
              <option value="">Select customer</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.customer_code || "ID pending"} — {customer.name}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="delivery-date">Delivery date</label>
            <input
              id="delivery-date"
              type="date"
              value={deliveryDate}
              onChange={(event) => setDeliveryDate(event.target.value)}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="delivery-session">Session</label>
            <select
              id="delivery-session"
              value={deliverySession}
              onChange={(event) => setDeliverySession(event.target.value)}
              required
            >
              <option value="Morning">Morning</option>
              <option value="Evening">Evening</option>
            </select>
          </div>

          <div className="field">
            <label htmlFor="delivery-quantity">Quantity (litres)</label>
            <input
              id="delivery-quantity"
              type="number"
              min="0.1"
              max="100"
              step="0.1"
              value={deliveryQuantity}
              onChange={(event) => setDeliveryQuantity(event.target.value)}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="delivery-status">Delivery status</label>
            <select
              id="delivery-status"
              value={deliveryStatus}
              onChange={(event) => setDeliveryStatus(event.target.value)}
              required
            >
              <option value="Delivered">Delivered</option>
              <option value="Skipped">Skipped</option>
              <option value="Not delivered">Not delivered</option>
            </select>
          </div>

          <div className="field">
            <label>Calculated charge</label>
            <p>
              ₹
              {(deliveryStatus === "Delivered"
                ? Number(deliveryQuantity || 0) * Number(milkPrice || 0)
                : 0
              ).toFixed(2)}
            </p>
          </div>

          <button
            className="primary-button"
            type="submit"
            disabled={deliveryLoading || customers.length === 0}
          >
            {deliveryLoading ? "Saving..." : "Save delivery →"}
          </button>
        </form>

        {customers.length === 0 && (
          <p className="message">
            No customers available. Add a customer before recording a delivery.
          </p>
        )}

        {deliveryMessage && (
          <div className="message success">{deliveryMessage}</div>
        )}

        {deliveryError && <div className="message error">{deliveryError}</div>}
      </section>

      <section className="overview-stats">
        <div className="overview-stat-card">
          <div className="overview-stat-label">Delivery records</div>
          <div className="overview-stat-value">{deliveries.length}</div>
          <div className="overview-stat-note">All recorded deliveries</div>
        </div>

        <div className="overview-stat-card">
          <div className="overview-stat-label">Delivered milk</div>
          <div className="overview-stat-value">{totalLitres.toFixed(1)} L</div>
          <div className="overview-stat-note">Delivered records only</div>
        </div>

        <div className="overview-stat-card">
          <div className="overview-stat-label">Delivery charges</div>
          <div className="overview-stat-value">₹{totalCharges.toFixed(2)}</div>
          <div className="overview-stat-note">Charges for delivered milk</div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <div>
            <h3 className="panel-title">Delivery history</h3>
            <p className="panel-description">
              Saved morning and evening delivery records.
            </p>
          </div>

          <button
            className="primary-button"
            type="button"
            onClick={loadDeliveries}
            disabled={listLoading}
          >
            {listLoading ? "Loading..." : "Refresh list"}
          </button>
        </div>

        {listError && <div className="message error">{listError}</div>}

        <div className="overview-table-wrapper">
          <table className="overview-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Customer ID</th>
                <th>Customer</th>
                <th>Phone</th>
                <th>Session</th>
                <th>Litres</th>
                <th>Status</th>
                <th>Price/Litre</th>
                <th>Charge</th>
              </tr>
            </thead>

            <tbody>
              {listLoading ? (
                <tr>
                  <td colSpan="9" className="overview-empty">
                    Loading delivery records...
                  </td>
                </tr>
              ) : deliveries.length === 0 ? (
                <tr>
                  <td colSpan="9" className="overview-empty">
                    No delivery records found.
                  </td>
                </tr>
              ) : (
                deliveries.map((delivery) => (
                  <tr key={delivery.id}>
                    <td>{delivery.delivery_date}</td>
                    <td>{delivery.customers?.customer_code || "ID pending"}</td>
                    <td>{delivery.customers?.name || "Unknown customer"}</td>
                    <td>{delivery.customers?.phone || "—"}</td>
                    <td>{delivery.session}</td>
                    <td>{Number(delivery.quantity_litres).toFixed(1)} L</td>
                    <td>{delivery.status}</td>
                    <td>₹{Number(delivery.price_per_litre).toFixed(2)}</td>
                    <td>
                      ₹
                      {(delivery.status === "Delivered"
                        ? Number(delivery.quantity_litres) *
                          Number(delivery.price_per_litre)
                        : 0
                      ).toFixed(2)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default MilkDeliveries;
