import { useEffect, useState } from "react";
import "./App.css";
import Overview from "./pages/Overview";
import Customers from "./pages/Customers";
import MilkDeliveries from "./pages/MilkDeliveries";
import BillingPayments from "./pages/BillingPayments";
import Login from "./pages/Login";

function App() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [listLoading, setListLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [deliveryTime, setDeliveryTime] = useState("");
  const [quantityLitres, setQuantityLitres] = useState("1");
  const [frequency, setFrequency] = useState("Daily");
  const [activePage, setActivePage] = useState("Overview");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [deliveryCustomerId, setDeliveryCustomerId] = useState("");
  const [deliveryDate, setDeliveryDate] = useState(
    new Date().toLocaleDateString("en-CA"),
  );
  const [deliverySession, setDeliverySession] = useState("Morning");
  const [deliveryQuantity, setDeliveryQuantity] = useState("1");
  const [deliveryStatus, setDeliveryStatus] = useState("Delivered");
  const [milkPrice, setMilkPrice] = useState(53.3);
  const [deliveryMessage, setDeliveryMessage] = useState("");
  const [deliveryError, setDeliveryError] = useState("");
  const [deliveryLoading, setDeliveryLoading] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(
    localStorage.getItem("adminToken") === "logged-in",
  );

  function navigateTo(page) {
    setActivePage(page);
    setMobileMenuOpen(false);
  }
  function handleLogin() {
    localStorage.setItem("adminToken", "logged-in");
    setIsLoggedIn(true);
  }

  function handleLogout() {
    localStorage.removeItem("adminToken");
    setIsLoggedIn(false);
  }

  async function loadCustomers() {
    setListLoading(true);

    try {
      const response = await fetch("http://localhost:5000/api/customers");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to load customers.");
      }

      setCustomers(Array.isArray(data) ? data : data.customers || []);
      setError("");
    } catch (err) {
      setError(err.message || "Unable to load customers.");
    } finally {
      setListLoading(false);
    }
  }

  useEffect(() => {
    loadCustomers();
  }, []);

  async function loadMilkPrice() {
    try {
      const response = await fetch("http://localhost:5000/api/dairy-settings");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to load milk price.");
      }

      setMilkPrice(Number(data.milk_price_per_litre));
      setDeliveryError("");
    } catch (err) {
      setDeliveryError(err.message || "Unable to load milk price.");
    }
  }

  useEffect(() => {
    if (activePage === "Milk deliveries") {
      loadMilkPrice();
    }
  }, [activePage]);

  async function saveDelivery(event) {
    event.preventDefault();
    setDeliveryMessage("");
    setDeliveryError("");
    setDeliveryLoading(true);

    try {
      const response = await fetch("http://localhost:5000/api/deliveries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_id: deliveryCustomerId,
          delivery_date: deliveryDate,
          session: deliverySession,
          quantity_litres: Number(deliveryQuantity),
          status: deliveryStatus,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to save delivery.");
      }

      const charge =
        data.delivery.status === "Delivered"
          ? Number(data.delivery.quantity_litres) *
            Number(data.delivery.price_per_litre)
          : 0;

      setDeliveryMessage(`Delivery saved! Charge: ₹${charge.toFixed(2)}`);
      setDeliveryQuantity("1");
    } catch (err) {
      setDeliveryError(err.message || "Unable to save delivery.");
    } finally {
      setDeliveryLoading(false);
    }
  }

  async function addCustomer(event) {
    event.preventDefault();
    setMessage("");
    setError("");
    setLoading(true);

    try {
      const response = await fetch("http://localhost:5000/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          phone,
          delivery_time: deliveryTime,
          quantity_litres: Number(quantityLitres),
          frequency,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const validationErrors = data.errors
          ?.map((item) => item.message)
          .join(" ");

        throw new Error(
          validationErrors || data.message || "Unable to save customer.",
        );
      }

      setMessage(
        `${data.customer.name} has been added successfully. Customer ID: ${data.customer.customer_code}`,
      );

      setName("");
      setPhone("");
      setDeliveryTime("");
      setQuantityLitres("1");
      setFrequency("Daily");

      await loadCustomers();
    } catch (err) {
      setError(err.message || "Unable to save customer.");
    } finally {
      setLoading(false);
    }
  }

  const filteredCustomers = customers.filter((customer) =>
    `${customer.name} ${customer.phone}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );

  function renderPage() {
    switch (activePage) {
      case "Overview":
        return <Overview />;

      case "Customers":
        return (
          <Customers
            customers={customers}
            filteredCustomers={filteredCustomers}
            search={search}
            setSearch={setSearch}
            name={name}
            setName={setName}
            phone={phone}
            setPhone={setPhone}
            deliveryTime={deliveryTime}
            setDeliveryTime={setDeliveryTime}
            quantityLitres={quantityLitres}
            setQuantityLitres={setQuantityLitres}
            frequency={frequency}
            setFrequency={setFrequency}
            addCustomer={addCustomer}
            loading={loading}
            listLoading={listLoading}
            message={message}
            error={error}
            refreshCustomers={loadCustomers}
          />
        );

      case "Milk deliveries":
        return (
          <MilkDeliveries
            customers={customers}
            milkPrice={milkPrice}
            setMilkPrice={setMilkPrice}
          />
        );

      case "Billing & payments":
        return (
          <div className="page-container">
            <BillingPayments />
          </div>
        );

      case "Reports":
        return (
          <div className="page-container">
            <section className="welcome-row">
              <div>
                <h2 className="welcome-title">Reports 📊</h2>
                <p className="welcome-text">
                  Review daily deliveries, milk quantities and collections.
                </p>
              </div>
            </section>
            <section className="panel">
              <h3 className="panel-title">Farm reports</h3>
              <p className="panel-description">
                We will connect this page to actual delivery and payment records
                next.
              </p>
            </section>
          </div>
        );

      case "Settings":
        return (
          <div className="page-container">
            <section className="welcome-row">
              <div>
                <h2 className="welcome-title">Settings ⚙️</h2>
                <p className="welcome-text">
                  View the current dairy milk price.
                </p>
              </div>
            </section>
            <section className="panel">
              <h3 className="panel-title">Milk pricing</h3>
              <p className="panel-description">
                Current price: ₹{Number(milkPrice).toFixed(2)} per litre.
                Editing the price will be added after the settings API is
                connected.
              </p>
            </section>
          </div>
        );

      default:
        return <Overview />;
    }
  }

  function renderNavItem(page, icon, label) {
    return (
      <button
        type="button"
        key={page}
        className={`nav-item ${activePage === page ? "active" : ""}`}
        onClick={() => navigateTo(page)}
      >
        <span className="nav-icon">{icon}</span>
        {label}
      </button>
    );
  }

  if (!isLoggedIn) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="app-shell">
      {mobileMenuOpen && (
        <button
          type="button"
          className="mobile-sidebar-backdrop"
          aria-label="Close navigation menu"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <aside className={`sidebar ${mobileMenuOpen ? "mobile-open" : ""}`}>
        <div className="brand">
          <div className="brand-icon">♧</div>
          <div>
            <div className="brand-name">Libi Dairy</div>
            <div className="brand-subtitle">FARM MANAGEMENT</div>
          </div>
        </div>

        <div className="nav-label">WORKSPACE</div>

        {renderNavItem("Overview", "▦", "Overview")}
        {renderNavItem("Customers", "♙", "Customers")}
        {renderNavItem("Milk deliveries", "♧", "Milk deliveries")}
        {renderNavItem("Billing & payments", "₹", "Billing & payments")}

        <div className="nav-label management-label">MANAGEMENT</div>

        {renderNavItem("Reports", "▤", "Reports")}
        {renderNavItem("Settings", "⚙", "Settings")}

        <div className="sidebar-footer">
          <strong>🐄 Your dairy, organised.</strong>
          Manage customers and daily operations from one place.
          <button
            type="button"
            className="logout-button"
            onClick={() => {
              localStorage.removeItem("adminToken");
              window.location.href = "/";
            }}
          >
            ↪ Logout
          </button>
        </div>
      </aside>

      <div className="main-area">
        <header className="topbar">
          <div className="topbar-heading">
            <button
              type="button"
              className="mobile-menu-button"
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileMenuOpen}
              onClick={() => setMobileMenuOpen((open) => !open)}
            >
              {mobileMenuOpen ? "×" : "☰"}
            </button>
          </div>

          <div className="profile">
            <div className="profile-avatar">LD</div>
            <div>
              <div className="profile-name">Libi Dairy Farm</div>
              <div className="profile-role">Farm administrator</div>
            </div>
          </div>
        </header>

        <main className="content">{renderPage()}</main>
      </div>
    </div>
  );
}

export default App;
