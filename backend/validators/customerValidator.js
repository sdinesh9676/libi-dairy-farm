const { z } = require("zod");

const customerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Please enter the customer's name.")
    .max(100, "Customer name must be 100 characters or fewer."),

  phone: z
    .string()
    .trim()
    .regex(
      /^[6-9]\d{9}$/,
      "Please enter a valid 10-digit Indian mobile number.",
    ),

  delivery_time: z.enum(["Morning", "Evening", "Both"], {
    error: "Please select a delivery time.",
  }),

  quantity_litres: z
    .number()
    .positive("Milk quantity must be greater than zero.")
    .max(100, "Milk quantity cannot exceed 100 litres per delivery."),

  frequency: z.enum(["Daily", "Day by day"], {
    error: "Please select a delivery frequency.",
  }),

  delivery_days: z
    .array(
      z.enum([
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
        "Sunday",
      ]),
    )
    .optional(),
});

module.exports = { customerSchema };
