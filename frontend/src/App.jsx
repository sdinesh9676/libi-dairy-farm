import { useEffect, useState } from "react";
import "./App.css";
import { supabase } from "./supabaseClient";
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
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function checkSession() {
      const { data, error } = await supabase.auth.getSession();

      if (mounted) {
        if (error) {
          console.error("Session check failed:", error.message);
        }

        setSession(data?.session ?? null);
        setAuthLoading(false);
      }
    }

    checkSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setAuthLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  function navigateTo(page) {
    setActivePage(page);
    setMobileMenuOpen(false);
  }
  function handleLogin(newSession) {
    setSession(newSession);
  }

  async function handleLogout() {
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error("Logout failed:", error.message);
    }
  }

  async function loadCustomers() {
    setListLoading(true);

    try {
      const { data, error } = await supabase
        .from("customers")
        .select(
          "id, customer_code, name, phone, delivery_time, quantity_litres, frequency, is_active, created_at",
        )
        .order("id", { ascending: false });

      if (error) {
        throw error;
      }

      setCustomers(data || []);
      setError("");
    } catch (err) {
      console.error("Load customers error:", err);
      setError(err.message || "Unable to load customers.");
    } finally {
      setListLoading(false);
    }
  }

  useEffect(() => {
    if (session) {
      loadCustomers();
    }
  }, [session]);

  async function loadMilkPrice() {
    try {
      const { data, error } = await supabase
        .from("dairy_settings")
        .select("milk_price_per_litre")
        .eq("id", 1)
        .single();

      if (error) {
        throw error;
      }

      setMilkPrice(Number(data.milk_price_per_litre));
      setDeliveryError("");
    } catch (err) {
      console.error("Load milk price error:", err);
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
      if (!deliveryCustomerId) {
        throw new Error("Please select a customer.");
      }

      if (!deliveryDate) {
        throw new Error("Please select a delivery date.");
      }

      if (!["Morning", "Evening"].includes(deliverySession)) {
        throw new Error("Please select a valid delivery session.");
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

      // Check whether the customer exists and is active
      const { data: customer, error: customerError } = await supabase
        .from("customers")
        .select("id, is_active")
        .eq("id", Number(deliveryCustomerId))
        .single();

      if (customerError) {
        throw customerError;
      }

      if (!customer.is_active) {
        throw new Error("This customer is inactive.");
      }

      // Get the current milk price
      const { data: settings, error: settingsError } = await supabase
        .from("dairy_settings")
        .select("milk_price_per_litre")
        .eq("id", 1)
        .single();

      if (settingsError) {
        throw settingsError;
      }

      const price = Number(settings.milk_price_per_litre);

      if (!Number.isFinite(price) || price <= 0) {
        throw new Error("Invalid milk price. Please check dairy settings.");
      }

      // Save delivery
      const { data: delivery, error: deliveryError } = await supabase
        .from("milk_deliveries")
        .insert({
          customer_id: Number(deliveryCustomerId),
          delivery_date: deliveryDate,
          session: deliverySession,
          quantity_litres: quantity,
          price_per_litre: price,
          status: deliveryStatus,
        })
        .select()
        .single();

      if (deliveryError) {
        if (deliveryError.code === "23505") {
          throw new Error(
            "A delivery already exists for this customer, date and session.",
          );
        }

        throw deliveryError;
      }

      const charge =
        delivery.status === "Delivered"
          ? Number(delivery.quantity_litres) * Number(delivery.price_per_litre)
          : 0;

      setDeliveryMessage(`Delivery saved! Charge: ₹${charge.toFixed(2)}`);
      setDeliveryQuantity("1");
    } catch (err) {
      console.error("Save delivery error:", err);
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
      // Basic form validation
      if (!name.trim()) {
        throw new Error("Please enter the customer's name.");
      }

      if (!/^[6-9]\d{9}$/.test(phone.trim())) {
        throw new Error("Please enter a valid 10-digit Indian mobile number.");
      }

      if (!deliveryTime) {
        throw new Error("Please select a delivery time.");
      }

      const quantity = Number(quantityLitres);

      if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 100) {
        throw new Error(
          "Milk quantity must be greater than 0 and at most 100 litres.",
        );
      }

      if (!["Daily", "Day by day"].includes(frequency)) {
        throw new Error("Please select a valid delivery frequency.");
      }

      // Generate customer ID
      const { data: sequenceNumber, error: sequenceError } = await supabase.rpc(
        "next_customer_number",
      );

      if (sequenceError) {
        throw sequenceError;
      }

      const prefix =
        deliveryTime === "Morning"
          ? "KUST_M"
          : deliveryTime === "Evening"
            ? "KUST_E"
            : "KUST_B";

      const customerCode = `${prefix}_${String(sequenceNumber).padStart(6, "0")}`;

      // Save customer directly to Supabase
      const { data, error } = await supabase
        .from("customers")
        .insert({
          customer_code: customerCode,
          name: name.trim(),
          phone: phone.trim(),
          delivery_time: deliveryTime,
          quantity_litres: quantity,
          frequency: frequency,
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      setMessage(
        `${data.name} has been added successfully. Customer ID: ${data.customer_code}`,
      );

      setName("");
      setPhone("");
      setDeliveryTime("");
      setQuantityLitres("1");
      setFrequency("Daily");

      await loadCustomers();
    } catch (err) {
      console.error("Add customer error:", err);
      setError(
        err.code === "23505"
          ? "This mobile number or customer ID is already registered."
          : err.message || "Unable to save customer.",
      );
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

  if (authLoading) {
    return <div>Checking login...</div>;
  }

  if (!session) {
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
            onClick={handleLogout}
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
