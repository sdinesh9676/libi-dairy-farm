import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";

function money(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);
}

function formatDate(value) {
  if (!value) return "—";

  const [year, month, day] = String(value).slice(0, 10).split("-");
  return new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
  ).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function getMonthRange(month) {
  const [year, monthNumber] = month.split("-").map(Number);

  return {
    startDate: `${month}-01`,
    endDate: `${month}-${String(
      new Date(year, monthNumber, 0).getDate(),
    ).padStart(2, "0")}`,
    year,
    monthNumber,
  };
}

function isDelivered(record) {
  return record?.status === "Delivered";
}

function getSessionStatus(record) {
  if (!record) return "Not recorded";

  if (isDelivered(record)) {
    return `Delivered · ${Number(record.quantity_litres).toFixed(2)} L`;
  }

  return record.status || "Not recorded";
}

function getRecordAmount(record) {
  if (!isDelivered(record)) return 0;

  return (
    Number(record.quantity_litres || 0) * Number(record.price_per_litre || 0)
  );
}

export default function BillingPayments() {
  const [customers, setCustomers] = useState([]);
  const [customerId, setCustomerId] = useState("");
  const [month, setMonth] = useState(currentMonth());
  const [customerDetails, setCustomerDetails] = useState(null);
  const [loadingCustomers, setLoadingCustomers] = useState(true);
  const [loadingBill, setLoadingBill] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadCustomers() {
      try {
        setLoadingCustomers(true);
        setError("");

        const { data, error } = await supabase
          .from("customers")
          .select("id, customer_code, name, phone, is_active")
          .order("name", { ascending: true });

        if (error) throw error;

        if (!cancelled) {
          setCustomers(data || []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Unable to load customers.");
        }
      } finally {
        if (!cancelled) {
          setLoadingCustomers(false);
        }
      }
    }

    loadCustomers();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!customerId) {
      setCustomerDetails(null);
      setLoadingBill(false);
      return;
    }

    let cancelled = false;

    async function loadCustomerBill() {
      try {
        setLoadingBill(true);
        setError("");
        setCustomerDetails(null);

        const [deliveryResult, paymentResult] = await Promise.all([
          supabase
            .from("milk_deliveries")
            .select(
              "id, delivery_date, session, quantity_litres, price_per_litre, status",
            )
            .eq("customer_id", Number(customerId))
            .order("delivery_date", { ascending: true }),

          supabase
            .from("customer_payments")
            .select("id, payment_date, amount, notes")
            .eq("customer_id", Number(customerId))
            .order("payment_date", { ascending: true }),
        ]);

        if (deliveryResult.error) throw deliveryResult.error;
        if (paymentResult.error) throw paymentResult.error;

        if (!cancelled) {
          setCustomerDetails({
            deliveries: deliveryResult.data || [],
            payments: paymentResult.data || [],
          });
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Load customer bill error:", err);
          setError(err.message || "Unable to load customer bill.");
        }
      } finally {
        if (!cancelled) {
          setLoadingBill(false);
        }
      }
    }

    loadCustomerBill();

    return () => {
      cancelled = true;
    };
  }, [customerId]);

  const selectedCustomer = customers.find(
    (customer) => String(customer.id) === String(customerId),
  );

  const bill = useMemo(() => {
    if (!customerDetails || !month) return null;

    const { startDate, endDate, year, monthNumber } = getMonthRange(month);

    const allDeliveries = Array.isArray(customerDetails.deliveries)
      ? customerDetails.deliveries
      : [];

    const allPayments = Array.isArray(customerDetails.payments)
      ? customerDetails.payments
      : [];

    const deliveriesBeforeMonth = allDeliveries.filter(
      (delivery) => String(delivery.delivery_date).slice(0, 10) < startDate,
    );

    const deliveriesThisMonth = allDeliveries.filter((delivery) => {
      const date = String(delivery.delivery_date).slice(0, 10);
      return date >= startDate && date <= endDate;
    });

    const paymentsBeforeMonth = allPayments.filter(
      (payment) => String(payment.payment_date).slice(0, 10) < startDate,
    );

    const paymentsThisMonthRecords = allPayments.filter((payment) => {
      const date = String(payment.payment_date).slice(0, 10);
      return date >= startDate && date <= endDate;
    });

    const previousCharges = deliveriesBeforeMonth.reduce(
      (total, delivery) => total + getRecordAmount(delivery),
      0,
    );

    const previousPayments = paymentsBeforeMonth.reduce(
      (total, payment) => total + Number(payment.amount || 0),
      0,
    );

    const previousBalance = previousCharges - previousPayments;

    const deliveredRecords = deliveriesThisMonth.filter(isDelivered);

    const totalLitres = deliveredRecords.reduce(
      (total, delivery) => total + Number(delivery.quantity_litres || 0),
      0,
    );

    const totalCharges = deliveriesThisMonth.reduce(
      (total, delivery) => total + getRecordAmount(delivery),
      0,
    );

    const paymentsThisMonth = paymentsThisMonthRecords.reduce(
      (total, payment) => total + Number(payment.amount || 0),
      0,
    );

    const totalDue = previousBalance + totalCharges - paymentsThisMonth;

    // Create one row for every calendar day, even if no record exists.
    const dailyRows = [];
    const daysInMonth = new Date(year, monthNumber, 0).getDate();

    for (let day = 1; day <= daysInMonth; day++) {
      const date = `${month}-${String(day).padStart(2, "0")}`;

      const morning = deliveriesThisMonth.find(
        (delivery) =>
          String(delivery.delivery_date).slice(0, 10) === date &&
          delivery.session === "Morning",
      );

      const evening = deliveriesThisMonth.find(
        (delivery) =>
          String(delivery.delivery_date).slice(0, 10) === date &&
          delivery.session === "Evening",
      );

      const dailyLitres =
        (isDelivered(morning) ? Number(morning.quantity_litres || 0) : 0) +
        (isDelivered(evening) ? Number(evening.quantity_litres || 0) : 0);

      const dailyAmount = getRecordAmount(morning) + getRecordAmount(evening);

      dailyRows.push({
        date,
        morning,
        evening,
        morningStatus: getSessionStatus(morning),
        eveningStatus: getSessionStatus(evening),
        dailyLitres,
        dailyAmount,
      });
    }

    return {
      startDate,
      endDate,
      deliveries: deliveriesThisMonth,
      deliveredRecords,
      totalLitres,
      totalCharges,
      payments: paymentsThisMonthRecords,
      paymentsThisMonth,
      previousBalance,
      totalDue,
      dailyRows,
    };
  }, [customerDetails, month]);

  function sendWhatsAppBill() {
    if (!selectedCustomer || !bill) return;

    let phone = String(selectedCustomer.phone || "").replace(/\D/g, "");

    if (phone.length === 10) {
      phone = `91${phone}`;
    } else if (phone.startsWith("0") && phone.length === 11) {
      phone = `91${phone.slice(1)}`;
    }

    if (phone.length < 11 || phone.length > 15) {
      setError("The customer's saved phone number is invalid.");
      return;
    }

    const dailyDetails = bill.dailyRows.map(
      (row) =>
        `${formatDate(row.date)} | Morning: ${row.morningStatus} | Evening: ${
          row.eveningStatus
        } | Total: ${row.dailyLitres.toFixed(2)} L | ${money(row.dailyAmount)}`,
    );

    const message = [
      "🥛 *LIBI DAIRY FARM — MILK BILL*",
      "",
      `Customer: ${selectedCustomer.name}`,
      `Customer ID: ${selectedCustomer.customer_code || selectedCustomer.id}`,
      `Billing period: ${formatDate(bill.startDate)} to ${formatDate(bill.endDate)}`,
      "",
      "*DAILY DELIVERY DETAILS*",
      ...dailyDetails,
      "",
      `Total delivered: ${bill.totalLitres.toFixed(2)} litres`,
      `Milk charges this month: ${money(bill.totalCharges)}`,
      `Previous balance: ${money(bill.previousBalance)}`,
      `Payments this month: ${money(bill.paymentsThisMonth)}`,
      `*TOTAL AMOUNT DUE: ${money(bill.totalDue)}*`,
      "",
      "Note: 'Not recorded' means no delivery record was saved for that session. It does not confirm that milk was not delivered.",
      "",
      "Thank you for choosing Libi Dairy Farm!",
    ].join("\n");

    const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;

    window.open(whatsappUrl, "_blank", "noopener,noreferrer");
  }

  function printBill() {
    window.print();
  }

  return (
    <div className="billing-page">
      <style>{`
        .billing-page {
          color: #20352b;
          padding: 24px;
          font-family: inherit;
        }
        .billing-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          flex-wrap: wrap;
          margin-bottom: 24px;
        }
        .billing-header h1 { margin: 0 0 6px; font-size: 26px; }
        .billing-header p { margin: 0; color: #68786f; }
        .billing-panel {
          background: #fff;
          border: 1px solid #e0e9e2;
          border-radius: 14px;
          padding: 20px;
          margin-bottom: 20px;
        }
        .billing-filters {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 16px;
        }
        .billing-field label {
          display: block;
          font-size: 13px;
          font-weight: 600;
          margin-bottom: 8px;
        }
        .billing-field select, .billing-field input {
          width: 100%;
          box-sizing: border-box;
          padding: 12px;
          border: 1px solid #d5dfd8;
          border-radius: 8px;
          background: #fff;
          color: #20352b;
          font: inherit;
        }
        .billing-stats {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
          margin-bottom: 20px;
        }
        .billing-stat {
          padding: 18px;
          border-radius: 12px;
          background: #fff;
          border: 1px solid #e0e9e2;
          min-width: 0;
        }
        .billing-stat span { color: #68786f; font-size: 13px; display: block; }
        .billing-stat strong {
          display: block;
          font-size: 20px;
          margin-top: 8px;
          overflow-wrap: anywhere;
        }
        .billing-table-wrap { overflow-x: auto; }
        .billing-table { width: 100%; border-collapse: collapse; min-width: 650px; }
        .billing-table th, .billing-table td {
          padding: 12px;
          border-bottom: 1px solid #e9efeb;
          text-align: left;
          font-size: 13px;
          vertical-align: top;
        }
        .billing-table th { background: #f5f8f5; color: #52645a; }
        .billing-actions { display: flex; flex-wrap: wrap; gap: 10px; }
        .billing-button {
          border: 0;
          border-radius: 8px;
          padding: 12px 16px;
          font: inherit;
          font-weight: 600;
          cursor: pointer;
        }
        .billing-button:disabled { opacity: .5; cursor: not-allowed; }
        .billing-primary { background: #207647; color: white; }
        .billing-secondary { background: #eaf2ec; color: #205c3a; }
        .billing-error { color: #b42318; margin: 12px 0; }
        .billing-summary {
          max-width: 420px;
          margin: 20px 0 0 auto;
        }
        .billing-summary-row {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          padding: 9px 0;
          border-bottom: 1px solid #e9efeb;
        }
        .billing-total { font-size: 18px; font-weight: 700; }
        .billing-muted { color: #68786f; }
        .billing-status-note {
          background: #f5f8f5;
          padding: 10px 12px;
          border-radius: 8px;
          color: #52645a;
          font-size: 12px;
          margin-bottom: 14px;
        }
        @media (max-width: 760px) {
          .billing-page { padding: 14px; }
          .billing-filters { grid-template-columns: 1fr; }
          .billing-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        @media print {
          body * { visibility: hidden !important; }
          .billing-print-area, .billing-print-area * { visibility: visible !important; }
          .billing-print-area {
            position: absolute;
            inset: 0;
            width: 100%;
            padding: 12px;
            background: white;
          }
          .billing-no-print { display: none !important; }
          .billing-table { min-width: 0; }
          .billing-table th, .billing-table td { font-size: 10px; padding: 6px; }
          .billing-panel { break-inside: avoid; }
        }
      `}</style>

      <div className="billing-header billing-no-print">
        <div>
          <h1>Billing & Payments</h1>
          <p>Select a customer to view their monthly milk bill.</p>
        </div>
      </div>

      <div className="billing-panel billing-no-print">
        <div className="billing-filters">
          <div className="billing-field">
            <label htmlFor="billing-customer">Select customer</label>
            <select
              id="billing-customer"
              value={customerId}
              onChange={(event) => setCustomerId(event.target.value)}
              disabled={loadingCustomers}
            >
              <option value="">
                {loadingCustomers
                  ? "Loading customers..."
                  : "Choose a customer"}
              </option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name} — {customer.phone}
                  {customer.is_active === false ? " (Inactive)" : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="billing-field">
            <label htmlFor="billing-month">Billing month</label>

            <input
              id="billing-month"
              type="month"
              value={month}
              onChange={(event) => {
                setMonth(event.target.value);
                setError("");
              }}
            />
          </div>
        </div>

        {error && <p className="billing-error">{error}</p>}
      </div>

      {loadingBill && (
        <div className="billing-panel">Loading milk records...</div>
      )}

      {!loadingCustomers && customers.length === 0 && (
        <div className="billing-panel">
          No customers found. Add customers before creating bills.
        </div>
      )}

      {!customerId && !loadingCustomers && customers.length > 0 && (
        <div className="billing-panel">
          Select a customer to see their daily milk delivery records and bill.
        </div>
      )}

      {selectedCustomer && customerDetails && bill && !loadingBill && (
        <div className="billing-print-area">
          <div className="billing-panel">
            <h2 style={{ marginTop: 0, color: "#20352b" }}>Libi Dairy Farm</h2>
            <p className="billing-muted">Monthly Milk Bill</p>
            <p>
              <strong>Customer:</strong> {selectedCustomer.name}
            </p>
            <p>
              <strong>Customer ID:</strong>{" "}
              {selectedCustomer.customer_code || selectedCustomer.id}
            </p>
            <p>
              <strong>Phone:</strong> {selectedCustomer.phone}
            </p>
            <p>
              <strong>Period:</strong> {formatDate(bill.startDate)} –{" "}
              {formatDate(bill.endDate)}
            </p>
          </div>

          <div className="billing-stats">
            <div className="billing-stat">
              <span>Delivery sessions</span>
              <strong>{bill.deliveredRecords.length}</strong>
            </div>
            <div className="billing-stat">
              <span>Total litres delivered</span>
              <strong>{bill.totalLitres.toFixed(2)} L</strong>
            </div>
            <div className="billing-stat">
              <span>Milk charges</span>
              <strong>{money(bill.totalCharges)}</strong>
            </div>
            <div className="billing-stat">
              <span>Amount due</span>
              <strong>{money(bill.totalDue)}</strong>
            </div>
          </div>

          <div className="billing-panel">
            <h3 style={{ marginTop: 0 }}>Daily Milk Records</h3>

            <p className="billing-status-note">
              Every day of the selected month is shown. "Not recorded" means
              there is no saved record for that session; it does not prove that
              milk was not delivered. Only records marked "Delivered" are
              charged.
            </p>

            <div className="billing-table-wrap">
              <table className="billing-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Morning</th>
                    <th>Evening</th>
                    <th>Daily Litres</th>
                    <th>Daily Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {bill.dailyRows.map((row) => (
                    <tr key={row.date}>
                      <td>{formatDate(row.date)}</td>
                      <td>{row.morningStatus}</td>
                      <td>{row.eveningStatus}</td>
                      <td>{row.dailyLitres.toFixed(2)} L</td>
                      <td>{money(row.dailyAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="billing-summary">
              <div className="billing-summary-row">
                <span>Milk charges this month</span>
                <strong>{money(bill.totalCharges)}</strong>
              </div>
              <div className="billing-summary-row">
                <span>Previous balance</span>
                <strong>{money(bill.previousBalance)}</strong>
              </div>
              <div className="billing-summary-row">
                <span>Payments this month</span>
                <strong>- {money(bill.paymentsThisMonth)}</strong>
              </div>
              <div className="billing-summary-row billing-total">
                <span>Final amount due</span>
                <strong>{money(bill.totalDue)}</strong>
              </div>
            </div>
          </div>

          <div className="billing-panel">
            <h3 style={{ marginTop: 0 }}>Payments This Month</h3>

            {bill.payments.length === 0 ? (
              <p className="billing-muted">No payments recorded this month.</p>
            ) : (
              <div className="billing-table-wrap">
                <table className="billing-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Amount</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bill.payments.map((payment) => (
                      <tr key={payment.id}>
                        <td>{formatDate(payment.payment_date)}</td>
                        <td>{money(payment.amount)}</td>
                        <td>{payment.notes || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="billing-actions billing-no-print">
            <button
              className="billing-button billing-primary"
              onClick={sendWhatsAppBill}
              disabled={!selectedCustomer.phone}
            >
              Send WhatsApp Bill
            </button>

            <button
              className="billing-button billing-secondary"
              onClick={printBill}
            >
              Print / Save PDF
            </button>
          </div>

          <p
            className="billing-muted billing-no-print"
            style={{ fontSize: 12 }}
          >
            WhatsApp opens with a prepared message. Review it and press Send in
            WhatsApp to deliver the bill.
          </p>
        </div>
      )}
    </div>
  );
}
