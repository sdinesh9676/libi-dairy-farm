
const express = require("express");
const cors = require("cors");
require("dotenv").config();

const { supabase } = require("./supabase");
const { customerSchema } = require("./validators/customerValidator");

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Libi Dairy Farm backend is running",
  });
});

// Get individual customer details, delivery history and payments
app.get("/api/customers/:id/details", async (req, res) => {
  const customerId = Number(req.params.id);

  if (!Number.isSafeInteger(customerId) || customerId <= 0) {
    return res.status(400).json({
      success: false,
      message: "Invalid customer ID.",
    });
  }

  try {
    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .select(
        "id, customer_code, name, phone, delivery_time, quantity_litres, frequency, is_active, created_at"
      )
      .eq("id", customerId)
      .maybeSingle();

    if (customerError) throw customerError;

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found.",
      });
    }

    const { data: deliveries, error: deliveriesError } = await supabase
      .from("milk_deliveries")
      .select("*")
      .eq("customer_id", customerId)
      .order("delivery_date", { ascending: false });

    if (deliveriesError) throw deliveriesError;

    const { data: payments, error: paymentsError } = await supabase
      .from("customer_payments")
      .select("*")
      .eq("customer_id", customerId)
      .order("payment_date", { ascending: false });

    if (paymentsError) throw paymentsError;

    const { data: settings, error: settingsError } = await supabase
      .from("dairy_settings")
      .select("milk_price_per_litre")
      .eq("id", 1)
      .single();

    if (settingsError) throw settingsError;

    const totalCharges = (deliveries || [])
      .filter((item) => item.status === "Delivered")
      .reduce(
        (total, item) =>
          total +
          Number(item.quantity_litres) * Number(item.price_per_litre),
        0
      );

    const totalPaid = (payments || []).reduce(
      (total, payment) => total + Number(payment.amount),
      0
    );

    return res.json({
      success: true,
      customer,
      deliveries: deliveries || [],
      payments: payments || [],
      currentPricePerLitre: Number(settings.milk_price_per_litre),
      totalCharges: Number(totalCharges.toFixed(2)),
      totalPaid: Number(totalPaid.toFixed(2)),
      balanceDue: Number((totalCharges - totalPaid).toFixed(2)),
    });
  } catch (error) {
    console.error("Customer details failed:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to load customer details.",
    });
  }
});

// Add a customer
app.post("/api/customers", async (req, res) => {
  const result = customerSchema.safeParse({
    ...req.body,
    quantity_litres:
      typeof req.body.quantity_litres === "string"
        ? Number(req.body.quantity_litres)
        : req.body.quantity_litres,
  });

  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: "Please check the customer details.",
      errors: result.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      })),
    });
  }

  try {
    const customer = result.data;

    const prefix =
      customer.delivery_time === "Morning"
        ? "KUST_M"
        : customer.delivery_time === "Evening"
          ? "KUST_E"
          : "KUST_B";

    const { data: sequenceData, error: sequenceError } = await supabase.rpc(
      "next_customer_number"
    );

    if (sequenceError) {
      console.error("Customer ID generation failed:", sequenceError.message);

      return res.status(500).json({
        success: false,
        message: "Unable to generate customer ID. Please try again.",
      });
    }

    const customerCode = `${prefix}_${String(sequenceData).padStart(6, "0")}`;

    const { data, error } = await supabase
      .from("customers")
      .insert({
        customer_code: customerCode,
        name: customer.name,
        phone: customer.phone,
        delivery_time: customer.delivery_time,
        quantity_litres: customer.quantity_litres,
        frequency: customer.frequency,
      })
      .select(
        "id, customer_code, name, phone, delivery_time, quantity_litres, frequency, is_active, created_at"
      )
      .single();

    if (error) {
      console.error("Customer save failed:", error.message);

      if (error.code === "23505") {
        return res.status(409).json({
          success: false,
          message: "This mobile number or customer ID is already registered.",
        });
      }

      return res.status(500).json({
        success: false,
        message: "Unable to save the customer. Please try again.",
      });
    }

    return res.status(201).json({
      success: true,
      message: "Customer saved successfully.",
      customer: data,
    });
  } catch (error) {
    console.error("Customer save error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Something went wrong while saving the customer.",
    });
  }
});

// Get all customers, including active/inactive status
app.get("/api/customers", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("customers")
      .select(
        "id, customer_code, name, phone, delivery_time, quantity_litres, frequency, is_active, created_at"
      )
      .order("id", { ascending: false });

    if (error) throw error;

    return res.status(200).json({
      success: true,
      customers: data,
    });
  } catch (error) {
    console.error("Fetch customers failed:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to load customers.",
    });
  }
});

// Activate or deactivate a customer
app.patch("/api/customers/:id/status", async (req, res) => {
  const customerId = Number(req.params.id);
  const { is_active } = req.body;

  if (
    !Number.isSafeInteger(customerId) ||
    customerId <= 0 ||
    typeof is_active !== "boolean"
  ) {
    return res.status(400).json({
      success: false,
      message: "Invalid customer ID or status.",
    });
  }

  try {
    const { data, error } = await supabase
      .from("customers")
      .update({ is_active })
      .eq("id", customerId)
      .select("id, name, is_active")
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      return res.status(404).json({
        success: false,
        message: "Customer not found.",
      });
    }

    return res.json({
      success: true,
      message: is_active
        ? "Customer reactivated successfully."
        : "Customer deactivated successfully.",
      customer: data,
    });
  } catch (error) {
    console.error("Update customer status failed:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to update customer status.",
    });
  }
});

// Get the current milk price
app.get("/api/dairy-settings", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("dairy_settings")
      .select("milk_price_per_litre")
      .eq("id", 1)
      .single();

    if (error) throw error;

    return res.json({
      success: true,
      milk_price_per_litre: Number(data.milk_price_per_litre),
    });
  } catch (error) {
    console.error("Load dairy settings failed:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to load the milk price.",
    });
  }
});

// Save a milk delivery
app.post("/api/deliveries", async (req, res) => {
  const { customer_id, delivery_date, session, quantity_litres, status } =
    req.body;

  const customerId = Number(customer_id);
  const quantity = Number(quantity_litres);
  const allowedSessions = ["Morning", "Evening"];
  const allowedStatuses = ["Delivered", "Skipped", "Not delivered"];

  if (
    !Number.isSafeInteger(customerId) ||
    customerId <= 0 ||
    !delivery_date ||
    !allowedSessions.includes(session) ||
    !Number.isFinite(quantity) ||
    quantity <= 0 ||
    quantity > 100 ||
    !allowedStatuses.includes(status)
  ) {
    return res.status(400).json({
      success: false,
      message: "Please check all delivery details.",
    });
  }

  try {
    // Check that the customer exists and is active
    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .select("id, is_active")
      .eq("id", customerId)
      .maybeSingle();

    if (customerError) throw customerError;

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found.",
      });
    }

    if (customer.is_active === false) {
      return res.status(400).json({
        success: false,
        message: "This customer is inactive. Reactivate them before recording deliveries.",
      });
    }

    const { data: settings, error: settingsError } = await supabase
      .from("dairy_settings")
      .select("milk_price_per_litre")
      .eq("id", 1)
      .single();

    if (settingsError) throw settingsError;

    const { data, error } = await supabase
      .from("milk_deliveries")
      .insert({
        customer_id: customerId,
        delivery_date,
        session,
        quantity_litres: quantity,
        price_per_litre: settings.milk_price_per_litre,
        status,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return res.status(409).json({
          success: false,
          message:
            "A delivery is already recorded for this customer, date, and session.",
        });
      }

      throw error;
    }

    return res.status(201).json({
      success: true,
      message: "Milk delivery saved successfully.",
      delivery: data,
    });
  } catch (error) {
    console.error("Save delivery failed:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to save the milk delivery.",
    });
  }
});

// Get all milk delivery records for the delivery history table
app.get("/api/deliveries", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("milk_deliveries")
      .select(`
        id,
        customer_id,
        delivery_date,
        session,
        quantity_litres,
        price_per_litre,
        status,
        customers (
          customer_code,
          name,
          phone
        )
      `)
      .order("delivery_date", { ascending: false })
      .order("session", { ascending: true });

    if (error) throw error;

    return res.json({
      success: true,
      deliveries: data,
    });
  } catch (error) {
    console.error("Load deliveries failed:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to load delivery records.",
    });
  }
});

// Test Supabase database connection
app.get("/api/test-supabase", async (req, res) => {
  try {
    const { error } = await supabase
      .from("customers")
      .select("id")
      .limit(1);

    if (error) throw error;

    return res.json({
      success: true,
      message: "Supabase database connection is working.",
    });
  } catch (error) {
    console.error("Supabase test failed:", error.message);

    return res.status(500).json({
      success: false,
      message:
        "Database query failed. Check the customers table and permissions.",
    });
  }
});

// Handle unknown API routes: keep AFTER every API route
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "The requested page or API endpoint was not found.",
  });
});

// Central error handler
app.use((err, req, res, next) => {
  console.error("Backend error:", err.message);

  res.status(err.status || 500).json({
    success: false,
    message: "Something went wrong. Please try again later.",
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Libi Dairy Farm backend running on port ${PORT}`);
});
