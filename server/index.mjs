import cors from "cors";
import express from "express";
import { z } from "zod";

const app = express();
app.use(cors({ origin: "http://127.0.0.1:3000" }));
app.use(express.json());

const state = {
  salesperson: { id: "sp-001", name: "Anil Jaina", region: "North Region", checkedInAt: null },
  visits: [
    { id: "v-001", customer: "Shreeji Polymers Pvt. Ltd.", location: "Bawana, Delhi", time: "9:30 AM", product: "Cleaners & Degreasers", purpose: "Visit completed", status: "completed" },
    { id: "v-002", customer: "Apex Fasteners", location: "Noida, Uttar Pradesh", time: "11:30 AM", product: "Zinc Flake Coatings", purpose: "Follow-up visit", status: "in_progress" },
    { id: "v-003", customer: "Nova Auto Components", location: "Faridabad, Haryana", time: "2:00 PM", product: "Nano Coatings", purpose: "Product discussion", status: "planned" },
    { id: "v-004", customer: "Shakti Metal Finishers", location: "Gurugram, Haryana", time: "4:30 PM", product: "Metal Pretreatment", purpose: "New requirement", status: "planned" }
  ],
  followUps: [
    { id: "f-001", title: "Send Zinc Flake quotation", customer: "Apex Fasteners", dueLabel: "Due today", priority: "high", completed: false },
    { id: "f-002", title: "Confirm Nano Coatings trial", customer: "Nova Auto Components", dueLabel: "Due today", priority: "today", completed: false },
    { id: "f-003", title: "Share technical datasheet", customer: "Orbit Surface Solutions", dueLabel: "2 days overdue", priority: "overdue", completed: false }
  ],
  performance: { actual: 1.84, target: 2.4, currencyLabel: "Cr" },
  summary: { expectedOrderValue: 850000, followUpsCreated: 2, productsDiscussed: 3 }
};

const completeVisitSchema = z.object({
  product: z.string().min(1), outcome: z.string().min(1), expectedOrderValue: z.number().min(0),
  expectedOrderDate: z.string().optional(), nextFollowUp: z.string().min(1), notes: z.string().optional()
});

app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
app.get("/api/salespeople/:id/my-day", (req, res) => req.params.id === state.salesperson.id ? res.json(state) : res.status(404).json({ error: "Salesperson not found" }));
app.post("/api/salespeople/:id/check-in", (req, res) => { if (req.params.id !== state.salesperson.id) return res.status(404).json({ error: "Salesperson not found" }); state.salesperson.checkedInAt ??= new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit" }).format(new Date()); return res.json(state); });
app.post("/api/visits/:id/complete", (req, res) => { const parsed = completeVisitSchema.safeParse(req.body); if (!parsed.success) return res.status(400).json({ error: "Please complete the required visit fields" }); const visit = state.visits.find((item) => item.id === req.params.id); if (!visit) return res.status(404).json({ error: "Visit not found" }); visit.status = "completed"; visit.product = parsed.data.product; visit.purpose = parsed.data.outcome; state.summary.expectedOrderValue += parsed.data.expectedOrderValue; state.summary.followUpsCreated += 1; return res.json(state); });
app.patch("/api/follow-ups/:id/toggle", (req, res) => { const item = state.followUps.find((followUp) => followUp.id === req.params.id); if (!item) return res.status(404).json({ error: "Follow-up not found" }); item.completed = !item.completed; return res.json(state); });

app.listen(4000, "127.0.0.1", () => console.log("PSSPL API running at http://127.0.0.1:4000"));
