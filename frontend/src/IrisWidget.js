import { useState, useRef, useEffect, useCallback } from "react";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:8000/api";
const getToken = () => localStorage.getItem("helpdesk_token");
const authH = () => ({
  "Content-Type": "application/json",
  ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
});

/* ── helpers ─────────────────────────────────────────────────────────────── */
function parseResponse(text) {
  const t = (text || "").trim();
  if (t.startsWith("{")) { try { return { type: "structured", data: JSON.parse(t) }; } catch (e) {} }
  const m = t.match(/\{[\s\S]*\}/);
  if (m) { try { return { type: "structured", data: JSON.parse(m[0]) }; } catch (e) {} }
  return { type: "text", content: text };
}

function statusBadge(status) {
  const map = {
    delivered: { bg: "#DCFCE7", color: "#166534" },
    shipped:   { bg: "#DBEAFE", color: "#1E40AF" },
    pending:   { bg: "#FEF9C3", color: "#854D0E" },
    returned:  { bg: "#FEE2E2", color: "#991B1B" },
    cancelled: { bg: "#F3F4F6", color: "#374151" },
  };
  const s = map[status?.toLowerCase()] || { bg: "#F3F4F6", color: "#374151" };
  return (
    <span style={{ background: s.bg, color: s.color, borderRadius: 99, padding: "2px 8px", fontSize: 11, fontWeight: 600 }}>
      {status}
    </span>
  );
}

/* ── CARDS ───────────────────────────────────────────────────────────────── */

function WelcomeCard({ name, onQuickSend }) {
  return (
    <div style={{ fontSize: 13 }}>
      <div style={{ fontWeight: 700, fontSize: 15, color: "#1C0F2E", marginBottom: 6 }}>
        Hi {name}! 👋 I'm <span style={{ color: "#C44EBE" }}>Iris</span>, your shopping assistant.
      </div>
      <div style={{ color: "#4A5568", marginBottom: 10 }}>I can help you with:</div>
      {[
        { icon: "🛍️", label: "Find & compare products" },
        { icon: "🎫", label: "Coupons & live offers" },
        { icon: "↩️", label: "Returns with smart alternatives" },
        { icon: "📞", label: "Support & help desk" },
      ].map((a) => (
        <div key={a.label} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, fontSize: 13, color: "#4A5568" }}>
          <span>{a.icon}</span><span>{a.label}</span>
        </div>
      ))}
      <div style={{ fontStyle: "italic", color: "#C44EBE", fontSize: 12, marginTop: 8 }}>
        Just type what's on your mind — I'll figure it out!
      </div>
    </div>
  );
}

function OrderListCard({ data, onSelectOrder, title }) {
  return (
    <div style={{ fontSize: 13 }}>
      <div style={{ fontWeight: 700, color: "#1C0F2E", marginBottom: 10 }}>
        {title || "Which item would you like to return?"}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {(data.items || []).map((t, i) => (
          <div
            key={i}
            onClick={() => onSelectOrder && onSelectOrder(t)}
            style={{
              cursor: onSelectOrder ? "pointer" : "default",
              background: "#FFF9FE",
              border: "1px solid #F0DAFF",
              borderRadius: 10,
              padding: "10px 12px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div>
              <div style={{ fontWeight: 600, color: "#1C0F2E", fontSize: 13 }}>{t.name}</div>
              <div style={{ color: "#7A6A8F", fontSize: 12, marginTop: 2 }}>{t.price}</div>
              <div style={{ color: "#A28DB8", fontSize: 11, marginTop: 2 }}>{t.label}</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
              {statusBadge(t.status)}
              {onSelectOrder && (
                <span style={{ color: "#C44EBE", fontSize: 18, fontWeight: 300 }}>→</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TrackOrderCard({ data }) {
  const item = data.item;
  const steps = ["Order Placed", "Processing", "Shipped", "Out for Delivery", "Delivered"];
  const statusIdx = {
    pending: 0, processing: 1, shipped: 2, "out for delivery": 3, delivered: 4,
  };
  const current = statusIdx[item?.status?.toLowerCase()] ?? 0;

  return (
    <div style={{ fontSize: 13 }}>
      <div style={{ fontWeight: 700, color: "#1C0F2E", marginBottom: 10 }}>📦 Order Tracking</div>
      <div style={{ background: "#FFF9FE", border: "1px solid #F0DAFF", borderRadius: 10, padding: "10px 12px", marginBottom: 12 }}>
        <div style={{ fontWeight: 600 }}>{item?.name}</div>
        <div style={{ color: "#7A6A8F", fontSize: 12, marginTop: 2 }}>{item?.price}</div>
        <div style={{ marginTop: 6 }}>{statusBadge(item?.status)}</div>
        {item?.label && <div style={{ color: "#A28DB8", fontSize: 11, marginTop: 4 }}>{item.label}</div>}
        {item?.delivered_at && <div style={{ color: "#166534", fontSize: 11, marginTop: 2 }}>✓ Delivered on {item.delivered_at}</div>}
        {item?.eta && <div style={{ color: "#1E40AF", fontSize: 11, marginTop: 2 }}>⏱ Estimated: {item.eta}</div>}
      </div>
      {/* Progress bar */}
      <div style={{ position: "relative", marginTop: 6 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          {steps.map((step, i) => (
            <div key={i} style={{ textAlign: "center", flex: 1 }}>
              <div style={{
                width: 20, height: 20, borderRadius: "50%", margin: "0 auto 4px",
                background: i <= current ? "#C44EBE" : "#E9D5FF",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#fff", fontSize: 10, fontWeight: 700,
              }}>{i <= current ? "✓" : i + 1}</div>
              <div style={{ fontSize: 9, color: i <= current ? "#C44EBE" : "#A28DB8", fontWeight: i === current ? 700 : 400, lineHeight: 1.2 }}>
                {step}
              </div>
            </div>
          ))}
        </div>
        <div style={{ position: "absolute", top: 10, left: "10%", right: "10%", height: 2, background: "#E9D5FF", zIndex: 0 }}>
          <div style={{ height: "100%", background: "#C44EBE", width: `${(current / (steps.length - 1)) * 100}%`, transition: "width 0.4s" }} />
        </div>
      </div>
    </div>
  );
}

function CompareCard({ data }) {
  const items = data.items || [];
  if (!items.length) return <span style={{ whiteSpace: "pre-wrap", fontSize: 13 }}>{data.text || "No products to compare."}</span>;
  const allKeys = [...new Set(items.flatMap(p => Object.keys(p.specs || {})))];
  return (
    <div style={{ fontSize: 12 }}>
      <div style={{ fontWeight: 700, color: "#1C0F2E", marginBottom: 10, fontSize: 13 }}>🔍 Product Comparison</div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <td style={{ padding: "6px 8px", fontWeight: 600, color: "#7A6A8F", fontSize: 11 }}>Feature</td>
              {items.map((p, i) => (
                <td key={i} style={{ padding: "6px 8px", fontWeight: 700, color: "#1C0F2E", textAlign: "center", background: i === 0 ? "#FFF0FE" : "#F8F9FF", borderRadius: 6 }}>
                  {p.name}
                  {p.price && <div style={{ color: "#C44EBE", fontWeight: 600, fontSize: 11 }}>{p.price}</div>}
                </td>
              ))}
            </tr>
          </thead>
          <tbody>
            {allKeys.map((key, ri) => (
              <tr key={ri} style={{ background: ri % 2 === 0 ? "#FAFAFA" : "#fff" }}>
                <td style={{ padding: "5px 8px", color: "#4A5568", fontWeight: 500, textTransform: "capitalize" }}>{key}</td>
                {items.map((p, ci) => (
                  <td key={ci} style={{ padding: "5px 8px", textAlign: "center", color: "#1C0F2E" }}>
                    {p.specs?.[key] ?? "—"}
                  </td>
                ))}
              </tr>
            ))}
            {data.recommendation && (
              <tr>
                <td colSpan={items.length + 1} style={{ padding: "8px", background: "#FFF0FE", borderRadius: 8, color: "#C44EBE", fontWeight: 600, fontSize: 12 }}>
                  ✦ Recommendation: {data.recommendation}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function OrderConfirmCard({ data, onConfirm }) {
  return (
    <div style={{ fontSize: 13 }}>
      <div style={{ fontWeight: 700, color: "#1C0F2E", marginBottom: 10 }}>🛒 Confirm Your Order</div>
      <div style={{ background: "#FFF9FE", border: "1px solid #F0DAFF", borderRadius: 10, padding: "10px 12px", marginBottom: 12 }}>
        <div style={{ fontWeight: 600 }}>{data.product_name}</div>
        {data.brand && <div style={{ color: "#7A6A8F", fontSize: 12 }}>{data.brand}</div>}
        <div style={{ color: "#C44EBE", fontWeight: 700, marginTop: 4 }}>{data.price}</div>
        {data.qty && <div style={{ color: "#A28DB8", fontSize: 12 }}>Qty: {data.qty}</div>}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => onConfirm({ action: "confirm_order", ...data })}
          style={{ flex: 1, padding: "9px", background: "#C44EBE", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer" }}>
          ✓ Place Order
        </button>
        <button onClick={() => onConfirm("cancel_order")}
          style={{ flex: 1, padding: "9px", background: "#FFF", color: "#C44EBE", border: "1px solid #F0DAFF", borderRadius: 8, fontWeight: 600, cursor: "pointer" }}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function OrderSuccessCard({ data }) {
  return (
    <div style={{ background: "#F0FFF4", border: "1px solid #9AE6B4", borderRadius: 12, padding: 14, fontSize: 13 }}>
      <div style={{ fontWeight: 700, color: "#166534", marginBottom: 6 }}>✅ Order Placed!</div>
      <div style={{ color: "#166534" }}><b>{data.product_name}</b></div>
      <div style={{ color: "#22543D", fontSize: 12, marginTop: 4 }}>{data.message || "Your order has been confirmed."}</div>
      {data.order_id && <div style={{ color: "#276749", fontSize: 11, marginTop: 4 }}>Order ID: {data.order_id}</div>}
    </div>
  );
}

function OffersCard({ data }) {
  return (
    <div style={{ fontSize: 13 }}>
      <div style={{ fontWeight: 700, color: "#1C0F2E", marginBottom: 10 }}>🎁 Live Offers for You</div>
      {(data.offers || []).map((o, i) => (
        <div key={i} style={{ background: i % 2 === 0 ? "#FFF9FE" : "#F8F0FF", border: "1px solid #F0DAFF", borderRadius: 10, padding: "10px 12px", marginBottom: 8 }}>
          <div style={{ fontWeight: 600, color: "#C44EBE" }}>{o.title}</div>
          <div style={{ color: "#4A5568", fontSize: 12, marginTop: 3 }}>{o.description}</div>
          {o.code && <div style={{ marginTop: 6, background: "#FFF", border: "1px dashed #C44EBE", borderRadius: 6, padding: "4px 10px", display: "inline-block", color: "#C44EBE", fontWeight: 700, fontSize: 12 }}>CODE: {o.code}</div>}
          {o.expiry && <div style={{ color: "#A28DB8", fontSize: 11, marginTop: 4 }}>Expires: {o.expiry}</div>}
        </div>
      ))}
    </div>
  );
}

function SupportCard({ data, onQuickSend }) {
  const [hovered, setHovered] = useState(null);

  const optionActions = {
    "📦 Order issues":      "I'm having an issue with one of my orders, can you help me?",
    "💳 Payment & refunds":  "I have a question about a payment or refund, can you help me?",
    "📍 Delivery tracking":  "Track Order",
    "🔄 Exchange a product": "restart_return",
    "❓ Other queries":      "I have another question, can you help me?",
  };

  const handleClick = (option) => {
    const action = optionActions[option] || option;
    onQuickSend(action);
  };

  return (
    <div style={{ fontSize: 13 }}>
      <div style={{ fontWeight: 700, color: "#1C0F2E", marginBottom: 10 }}>📞 Support</div>
      <div style={{ color: "#4A5568", marginBottom: 10 }}>{data.message || "How can we help you today?"}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {(data.options || []).map((o, i) => (
          <button
            key={i}
            onClick={() => handleClick(o)}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
            style={{
              width: "100%", textAlign: "left", cursor: "pointer",
              background: hovered === i ? "#FFF0FE" : "#FFF9FE",
              border: `1px solid ${hovered === i ? "#C44EBE" : "#F0DAFF"}`,
              borderRadius: 8, padding: "8px 12px", fontSize: 12,
              color: hovered === i ? "#C44EBE" : "#4A5568",
              fontWeight: hovered === i ? 600 : 400,
              transform: hovered === i ? "translateX(2px)" : "translateX(0)",
              transition: "all 0.15s",
            }}>
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}

function ReturnRejectedCard({ data }) {
  return (
    <div style={{ background: "#FFF5F5", border: "1px solid #FEB2B2", borderRadius: 12, padding: 12, color: "#9B2C2C", fontSize: 13 }}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>Return Not Allowed</div>
      <div>{data.reason}</div>
    </div>
  );
}

function ReturnResolutionCard({ data }) {
  const recs = data.recommendations || [];
  return (
    <div style={{ fontSize: 13 }}>
      <div style={{ background: "#F0FFF4", border: "1px solid #9AE6B4", borderRadius: 12, padding: 12, color: "#22543D", marginBottom: recs.length > 0 ? 12 : 0 }}>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>✅ Return Approved</div>
        <div>Confidence: {Math.round((data.confidence || 0) * 100)}%</div>
        <div>Risk: {data.risk}</div>
        {data.explanation && <div style={{ marginTop: 6, fontStyle: "italic", fontSize: 12 }}>{data.explanation}</div>}
      </div>
      {recs.length > 0 && (
        <div>
          <div style={{ fontWeight: 700, color: "#1C0F2E", marginBottom: 8, fontSize: 12 }}>✦ Recommended for You</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {recs.map((rec, i) => (
              <div key={i} style={{ background: "#FFF9FE", border: "1px solid #F0DAFF", borderRadius: 9, padding: "9px 12px" }}>
                <div style={{ fontWeight: 600, color: "#1C0F2E", fontSize: 13 }}>{rec.name}</div>
                {rec.price && <div style={{ color: "#C44EBE", fontWeight: 700, fontSize: 12, marginTop: 2 }}>{rec.price}</div>}
                {rec.reason && <div style={{ color: "#7A6A8F", fontSize: 11, marginTop: 2 }}>{rec.reason}</div>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ReturnReasonCard({ onQuickSend }) {
  const reasons = ["Damaged Product", "Wrong Item", "Defective", "Changed Mind"];
  return (
    <div style={{ fontSize: 13 }}>
      <div style={{ fontWeight: 700, color: "#1C0F2E", marginBottom: 10 }}>What is the reason for your return?</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {reasons.map((r) => (
          <button key={r} onClick={() => onQuickSend({ action: "select_reason", reason: r })}
            style={{ padding: "9px 12px", borderRadius: 8, border: "1px solid #F0DAFF", background: "#FFF9FE", color: "#C44EBE", fontWeight: 600, cursor: "pointer", textAlign: "left", fontSize: 13 }}>
            {r}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── REASON REPEAT DETECTED CARD ─────────────────────────────────────────── */
function ReasonRepeatCard({ data, onQuickSend }) {
  const productName = data?.product_name;
  const options = [
    { label: "Try a different reason", sub: "Select a new return reason for this item", action: "restart_return", color: "#C44EBE", bg: "#FFF9FE", border: "1px solid #F0DAFF" },
    { label: "Check return status",    sub: "See where your existing return stands",   action: "Track Order",    color: "#1C0F2E", bg: "#F8F9FA", border: "1px solid #EEE" },
    { label: "Contact support",        sub: "Get help from a human agent",              action: "support",        color: "#1C0F2E", bg: "#F8F9FA", border: "1px solid #EEE" },
  ];
  return (
    <div style={{ fontSize: 13 }}>
      <div style={{ background: "#FFF5F5", border: "1px solid #FEB2B2", borderRadius: 10, padding: "12px 14px", marginBottom: 12 }}>
        <div style={{ fontWeight: 700, color: "#9B2C2C", marginBottom: 4 }}>⚠️ Return already submitted</div>
        <div style={{ color: "#C53030", fontSize: 12, lineHeight: 1.5 }}>
          A return with this reason was already raised{productName ? ` for ${productName}` : ""}. You can't submit the same reason twice for the same order.
        </div>
      </div>
      <div style={{ color: "#7A6A8F", fontSize: 12, marginBottom: 8 }}>What would you like to do?</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {options.map((opt) => (
          <button key={opt.action} onClick={() => onQuickSend(opt.action)}
            style={{ display: "flex", alignItems: "flex-start", gap: 10, width: "100%", background: opt.bg, border: opt.border, borderRadius: 9, padding: "10px 12px", cursor: "pointer", textAlign: "left" }}>
            <div>
              <div style={{ fontWeight: 600, color: opt.color, fontSize: 13 }}>{opt.label}</div>
              <div style={{ fontSize: 11, color: "#9B8AAA", marginTop: 2 }}>{opt.sub}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── NEW: DAMAGE LOCATION CARD (also used for Defective) ─────────────────── */
function DamageLocationCard({ onQuickSend, reason }) {
  const [location, setLocation] = useState("");
  const isDefective = reason === "Defective";
  const quickOptions = isDefective
    ? ["Doesn't power on", "Stops working intermittently", "Missing feature / function", "Buttons / Ports", "Other"]
    : ["Screen / Display", "Body / Casing", "Buttons / Ports", "Packaging", "Internal / Not visible"];

  return (
    <div style={{ fontSize: 13 }}>
      <div style={{ fontWeight: 700, color: "#1C0F2E", marginBottom: 6 }}>
        {isDefective ? "🔍 Tell us about the defect" : "🔍 Where is the damage?"}
      </div>
      <div style={{ color: "#7B6A8D", fontSize: 12, marginBottom: 10 }}>
        {isDefective
          ? "Select what's wrong or describe the issue in your own words below."
          : "Select a common area or describe it in your own words below."}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
        {quickOptions.map((opt) => (
          <button key={opt}
            onClick={() => setLocation(opt)}
            style={{
              padding: "5px 10px", borderRadius: 99,
              background: location === opt ? "#C44EBE" : "#FFF9FE",
              color: location === opt ? "#fff" : "#C44EBE",
              border: `1px solid ${location === opt ? "#C44EBE" : "#F0DAFF"}`,
              cursor: "pointer", fontSize: 12, fontWeight: 500, transition: "all 0.15s",
            }}>
            {opt}
          </button>
        ))}
      </div>
      <textarea
        value={location}
        onChange={(e) => setLocation(e.target.value)}
        placeholder={isDefective ? "Or describe the defect..." : "Or describe the damage location..."}
        style={{ width: "100%", height: 64, borderRadius: 8, border: "1px solid #F0DAFF", padding: 8, marginBottom: 8, fontSize: 13, resize: "none", boxSizing: "border-box", outline: "none" }}
      />
      <button
        disabled={!location.trim()}
        onClick={() => onQuickSend({ action: "damage_location_submitted", location: location.trim(), reason })}
        style={{ width: "100%", padding: 9, background: location.trim() ? "#C44EBE" : "#E9D5FF", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: location.trim() ? "pointer" : "default", fontSize: 13 }}>
        Next →
      </button>
    </div>
  );
}

/* ── PHOTO UPLOAD CARD (Damaged Product & Defective) ─────────────────────── */
function DamagedProductImageCard({ onQuickSend, damageLocation, reason }) {
  const [images, setImages] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);
  const isDefective = reason === "Defective";

  const processFiles = (files) => {
    const remaining = 3 - images.length;
    const toProcess = Array.from(files).slice(0, remaining);
    toProcess.forEach((file) => {
      if (!file.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        setImages((prev) => {
          if (prev.length >= 3) return prev;
          return [...prev, { name: file.name, dataUrl: e.target.result }];
        });
      };
      reader.readAsDataURL(file);
    });
  };

  const handleFileChange = (e) => processFiles(e.target.files);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    processFiles(e.dataTransfer.files);
  };

  const removeImage = (idx) => setImages((prev) => prev.filter((_, i) => i !== idx));

  const handleContinue = () => {
    onQuickSend({ action: "damage_images_attached", images, damageLocation, reason });
  };

  return (
    <div style={{ fontSize: 13 }}>
      {damageLocation && (
        <div style={{ background: "#FDF4FF", border: "1px solid #F0DAFF", borderRadius: 8, padding: "6px 10px", marginBottom: 10, fontSize: 12, color: "#7B6A8D" }}>
          {isDefective ? "📍 Issue:" : "📍 Damage location:"} <strong style={{ color: "#C44EBE" }}>{damageLocation}</strong>
        </div>
      )}
      <div style={{ fontWeight: 700, color: "#1C0F2E", marginBottom: 4 }}>
        {isDefective ? "📸 Upload photos showing the defect" : "📸 Upload photos of the damage"}
      </div>
      <div style={{ color: "#7B6A8D", fontSize: 12, marginBottom: 10 }}>
        Attach up to 3 clear photos. We'll verify they match your description.
      </div>
      <div
        onClick={() => images.length < 3 && fileInputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        style={{
          border: `2px dashed ${dragOver ? "#C44EBE" : "#E9D5FF"}`,
          borderRadius: 10, padding: "14px 10px", textAlign: "center",
          background: dragOver ? "#FDF4FF" : "#FAFAFE",
          cursor: images.length < 3 ? "pointer" : "default",
          marginBottom: 10, transition: "border-color 0.2s, background 0.2s",
        }}
      >
        {images.length < 3 ? (
          <>
            <div style={{ fontSize: 22, marginBottom: 4 }}>🖼️</div>
            <div style={{ color: "#C44EBE", fontWeight: 600 }}>Click or drag &amp; drop</div>
            <div style={{ color: "#9B8AAA", fontSize: 11, marginTop: 2 }}>JPG, PNG, WEBP — max 3 photos</div>
          </>
        ) : (
          <div style={{ color: "#9B8AAA", fontSize: 12 }}>Maximum 3 photos reached</div>
        )}
      </div>
      <input ref={fileInputRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={handleFileChange} />
      {images.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          {images.map((img, idx) => (
            <div key={idx} style={{ position: "relative", width: 72, height: 72 }}>
              <img src={img.dataUrl} alt={img.name} style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 8, border: "1px solid #F0DAFF" }} />
              <button onClick={() => removeImage(idx)}
                style={{ position: "absolute", top: -6, right: -6, width: 18, height: 18, borderRadius: "50%", background: "#C44EBE", color: "#fff", border: "none", cursor: "pointer", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}>
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
      <button
        onClick={handleContinue}
        disabled={images.length === 0}
        style={{ width: "100%", padding: 9, background: images.length > 0 ? "#C44EBE" : "#E9D5FF", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: images.length > 0 ? "pointer" : "default", fontSize: 13 }}>
        {isDefective ? "Verify Issue" : "Verify Damage"} ({images.length} photo{images.length !== 1 ? "s" : ""})
      </button>
    </div>
  );
}

/* ── NEW: VERIFIED RESOLUTION CARD (Damaged Product & Defective) ─────────── */
function DamageVerifiedCard({ data, onQuickSend }) {
  const recommendations = data.recommendations || [];
  const isDefective = data.reason === "Defective";
  return (
    <div style={{ fontSize: 13 }}>
      <div style={{ background: "#F0FFF4", border: "1px solid #9AE6B4", borderRadius: 10, padding: "10px 14px", marginBottom: 12 }}>
        <div style={{ fontWeight: 700, color: "#166534", marginBottom: 4 }}>{isDefective ? "✅ Defect Verified" : "✅ Damage Verified"}</div>
        <div style={{ color: "#22543D", fontSize: 12 }}>
          {data.explanation || (isDefective ? "The photos support the issue you described." : "The damage in your photos matches your description.")}
        </div>
      </div>
      <div style={{ color: "#1C0F2E", fontWeight: 600, marginBottom: 8 }}>How would you like to proceed?</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {/* Return only */}
        <button
          onClick={() => onQuickSend({ action: "damaged_return_only", session_id: data.session_id, damageLocation: data.damage_location, reason: data.reason })}
          style={{ padding: "10px 12px", borderRadius: 9, border: "1px solid #9AE6B4", background: "#F0FFF4", color: "#166534", fontWeight: 600, cursor: "pointer", textAlign: "left" }}>
          <div style={{ fontWeight: 700 }}>↩️ Return Only</div>
          <div style={{ fontSize: 11, color: "#4A9E6F", marginTop: 2 }}>Process a full refund for this item</div>
        </button>
        {/* Return + Recommendation */}
        <button
          onClick={() => onQuickSend({ action: "damaged_return_with_recommendation", session_id: data.session_id, damageLocation: data.damage_location, reason: data.reason, recommendations: data.recommendations })}
          style={{ padding: "10px 12px", borderRadius: 9, border: "1px solid #C44EBE", background: "#FFF9FE", color: "#C44EBE", fontWeight: 600, cursor: "pointer", textAlign: "left" }}>
          <div style={{ fontWeight: 700 }}>↩️ + ✦ Return &amp; Get Recommendations</div>
          <div style={{ fontSize: 11, color: "#9B5DAA", marginTop: 2 }}>Return this item and see alternatives based on your shopping history</div>
        </button>
      </div>
      {/* Show recommendations inline if already fetched */}
      {recommendations.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontWeight: 700, color: "#1C0F2E", marginBottom: 8, fontSize: 12 }}>✦ Recommended for You</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {recommendations.map((rec, i) => (
              <div key={i} style={{ background: "#FFF9FE", border: "1px solid #F0DAFF", borderRadius: 9, padding: "9px 12px" }}>
                <div style={{ fontWeight: 600, color: "#1C0F2E", fontSize: 13 }}>{rec.name}</div>
                {rec.price && <div style={{ color: "#C44EBE", fontWeight: 700, fontSize: 12, marginTop: 2 }}>{rec.price}</div>}
                {rec.reason && <div style={{ color: "#7A6A8F", fontSize: 11, marginTop: 2 }}>{rec.reason}</div>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── NEW: MISMATCH CARD (contact support) — Damaged Product & Defective ──── */
function DamageMismatchCard({ data, onQuickSend }) {
  const isDefective = data.reason === "Defective";
  return (
    <div style={{ fontSize: 13 }}>
      <div style={{ background: "#FFF5F5", border: "1px solid #FEB2B2", borderRadius: 10, padding: "12px 14px", marginBottom: 12 }}>
        <div style={{ fontWeight: 700, color: "#9B2C2C", marginBottom: 4 }}>⚠️ Description Doesn't Match Photos</div>
        <div style={{ color: "#C53030", fontSize: 12, lineHeight: 1.5 }}>
          {data.explanation || (isDefective
            ? "The issue you described doesn't seem to match the uploaded photos. Our system couldn't verify the claim automatically."
            : "The damage description you provided doesn't seem to match the uploaded photos. Our system couldn't verify the claim automatically.")}
        </div>
      </div>
      <div style={{ color: "#4A5568", fontSize: 12, marginBottom: 10 }}>
        Please contact our support team who can manually review your case.
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <button
          onClick={() => onQuickSend("support")}
          style={{ padding: "10px 12px", borderRadius: 9, border: "1px solid #F0DAFF", background: "#FFF9FE", color: "#C44EBE", fontWeight: 700, cursor: "pointer", textAlign: "left" }}>
          📞 Contact Support
        </button>
        <button
          onClick={() => onQuickSend({ action: "retry_damage_claim", reason: data.reason })}
          style={{ padding: "10px 12px", borderRadius: 9, border: "1px solid #EEE", background: "#F8F9FA", color: "#4A5568", fontWeight: 600, cursor: "pointer", textAlign: "left" }}>
          🔄 Try Again with Different Photos
        </button>
      </div>
    </div>
  );
}

/* ── DETAIL REASON CARD ──────────────────────────────────────────────────── */
function DetailReasonCard({ onQuickSend, attachedImages = [] }) {
  const [detail, setDetail] = useState("");
  return (
    <div style={{ fontSize: 13 }}>
      <div style={{ fontWeight: 700, color: "#1C0F2E", marginBottom: 10 }}>Please explain the issue in detail:</div>
      {attachedImages.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#FDF4FF", border: "1px solid #F0DAFF", borderRadius: 8, padding: "6px 10px", marginBottom: 8 }}>
          <span style={{ fontSize: 15 }}>📎</span>
          <span style={{ color: "#7B6A8D", fontSize: 12 }}>
            {attachedImages.length} photo{attachedImages.length !== 1 ? "s" : ""} attached
          </span>
          <div style={{ display: "flex", gap: 4, marginLeft: "auto" }}>
            {attachedImages.map((img, i) => (
              <img key={i} src={img.dataUrl} alt="" style={{ width: 28, height: 28, objectFit: "cover", borderRadius: 4, border: "1px solid #F0DAFF" }} />
            ))}
          </div>
        </div>
      )}
      <textarea value={detail} onChange={(e) => setDetail(e.target.value)}
        style={{ width: "100%", height: 80, borderRadius: 8, border: "1px solid #F0DAFF", padding: 8, marginBottom: 8, fontSize: 13, resize: "none", boxSizing: "border-box" }} />
      <button disabled={!detail.trim()} onClick={() => onQuickSend({ action: "submit_detailed_reason", detail, images: attachedImages })}
        style={{ width: "100%", padding: 9, background: detail.trim() ? "#C44EBE" : "#E9D5FF", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: detail.trim() ? "pointer" : "default", fontSize: 13 }}>
        Submit Details
      </button>
    </div>
  );
}

/* ── WRONG ITEM: ask what they wanted ───────────────────────────────────── */
function WrongItemAskWantedCard({ data, onQuickSend }) {
  const [wanted, setWanted] = useState("");
  return (
    <div style={{ fontSize: 13 }}>
      <div style={{ fontWeight: 700, color: "#1C0F2E", marginBottom: 6 }}>🔄 Wrong Item Received</div>
      <div style={{ color: "#7B6A8D", fontSize: 12, marginBottom: 10 }}>
        What product were you actually looking for when you placed this order?
      </div>
      <textarea
        value={wanted}
        onChange={(e) => setWanted(e.target.value)}
        placeholder="e.g. Sony WH-1000XM4 in black..."
        style={{ width: "100%", height: 72, borderRadius: 8, border: "1px solid #F0DAFF", padding: 8, marginBottom: 8, fontSize: 13, resize: "none", boxSizing: "border-box", outline: "none" }}
      />
      <button
        disabled={!wanted.trim()}
        onClick={() => onQuickSend({ action: "wrong_item_wanted_submitted", wanted: wanted.trim(), session_id: data.session_id })}
        style={{ width: "100%", padding: 9, background: wanted.trim() ? "#C44EBE" : "#E9D5FF", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: wanted.trim() ? "pointer" : "default", fontSize: 13 }}>
        Check My History →
      </button>
    </div>
  );
}

/* ── WRONG ITEM: history MATCHES (legit wrong item) ─────────────────────── */
function WrongItemHistoryMatchCard({ data, onQuickSend }) {
  const recs = data.recommendations || [];
  return (
    <div style={{ fontSize: 13 }}>
      <div style={{ background: "#F0FFF4", border: "1px solid #9AE6B4", borderRadius: 10, padding: "10px 14px", marginBottom: 12 }}>
        <div style={{ fontWeight: 700, color: "#166534", marginBottom: 4 }}>✅ Confirmed — Wrong Item</div>
        <div style={{ color: "#22543D", fontSize: 12 }}>
          Your search history shows you were looking for <strong>{data.wanted_product}</strong> before this order. This is a valid wrong-item return.
        </div>
      </div>

      <div style={{ color: "#1C0F2E", fontWeight: 600, marginBottom: 8 }}>How would you like to proceed?</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
        <button
          onClick={() => onQuickSend({ action: "wrong_item_confirm_return", session_id: data.session_id, wanted_product: data.wanted_product })}
          style={{ padding: "10px 12px", borderRadius: 9, border: "1px solid #9AE6B4", background: "#F0FFF4", color: "#166534", fontWeight: 600, cursor: "pointer", textAlign: "left" }}>
          <div style={{ fontWeight: 700 }}>↩️ Return Only</div>
          <div style={{ fontSize: 11, color: "#4A9E6F", marginTop: 2 }}>Process a full refund for this item</div>
        </button>
        <button
          onClick={() => onQuickSend({ action: "wrong_item_confirm_return", session_id: data.session_id, wanted_product: data.wanted_product })}
          style={{ padding: "10px 12px", borderRadius: 9, border: "1px solid #C44EBE", background: "#FFF9FE", color: "#C44EBE", fontWeight: 600, cursor: "pointer", textAlign: "left" }}>
          <div style={{ fontWeight: 700 }}>↩️ + 🛍️ Return &amp; Buy the Right One</div>
          <div style={{ fontSize: 11, color: "#9B5DAA", marginTop: 2 }}>Return this and pick the correct product below</div>
        </button>
      </div>

      {recs.length > 0 && (
        <>
          <div style={{ fontWeight: 700, color: "#1C0F2E", marginBottom: 8, fontSize: 12 }}>✦ Recommended on Amazon.in</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {recs.map((rec, i) => (
              <a key={i} href={rec.url} target="_blank" rel="noreferrer"
                style={{ textDecoration: "none", background: "#FFF9FE", border: "1px solid #F0DAFF", borderRadius: 9, padding: "9px 12px", display: "block" }}>
                <div style={{ fontWeight: 600, color: "#1C0F2E", fontSize: 13 }}>{rec.name}</div>
                {rec.price && <div style={{ color: "#C44EBE", fontWeight: 700, fontSize: 12, marginTop: 2 }}>{rec.price}</div>}
                {rec.rating && <div style={{ color: "#F59E0B", fontSize: 11, marginTop: 2 }}>★ {rec.rating}</div>}
                <div style={{ color: "#9B8AAA", fontSize: 11, marginTop: 2 }}>View on Amazon.in →</div>
              </a>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ── WRONG ITEM: history DOES NOT match (they searched & ordered this) ───── */
function WrongItemNoMatchCard({ data, onQuickSend }) {
  const recs  = data.recommendations || [];
  const specs = data.specs           || [];   // [{label, ordered, alternatives:[]}]

  return (
    <div style={{ fontSize: 13 }}>
      <div style={{ background: "#FFF5F5", border: "1px solid #FEB2B2", borderRadius: 10, padding: "12px 14px", marginBottom: 12 }}>
        <div style={{ fontWeight: 700, color: "#9B2C2C", marginBottom: 4 }}>⚠️ Our Records Say You Searched for This</div>
        <div style={{ color: "#C53030", fontSize: 12, lineHeight: 1.5 }}>
          Your browsing history shows you searched for <strong>{data.ordered_product}</strong> and ordered it intentionally. This may not qualify as a wrong-item return.
        </div>
      </div>

      <div style={{ color: "#4A5568", fontSize: 12, marginBottom: 12 }}>
        However, here are some similar alternatives you might prefer instead:
      </div>

      {/* Comparison table */}
      {recs.length > 0 && (
        <>
          <div style={{ fontWeight: 700, color: "#1C0F2E", marginBottom: 8, fontSize: 12 }}>📊 Comparison with Similar Products</div>
          <div style={{ overflowX: "auto", marginBottom: 14 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
              <thead>
                <tr style={{ background: "#FFF0FE" }}>
                  <td style={{ padding: "6px 8px", fontWeight: 700, color: "#7A6A8F", borderBottom: "2px solid #F0DAFF" }}>Feature</td>
                  <td style={{ padding: "6px 8px", fontWeight: 700, color: "#C44EBE", borderBottom: "2px solid #F0DAFF", textAlign: "center" }}>
                    {data.ordered_product} <div style={{ fontSize: 9, fontWeight: 500, color: "#9B5DAA" }}>Your order</div>
                  </td>
                  {recs.map((r, i) => (
                    <td key={i} style={{ padding: "6px 8px", fontWeight: 700, color: "#1C0F2E", borderBottom: "2px solid #F0DAFF", textAlign: "center" }}>{r.name}</td>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* Price row */}
                <tr style={{ background: "#FAFAFA" }}>
                  <td style={{ padding: "5px 8px", color: "#4A5568", fontWeight: 600 }}>Price</td>
                  <td style={{ padding: "5px 8px", textAlign: "center", color: "#C44EBE", fontWeight: 700 }}>{data.ordered_price || "—"}</td>
                  {recs.map((r, i) => (
                    <td key={i} style={{ padding: "5px 8px", textAlign: "center", color: "#166534", fontWeight: 600 }}>{r.price || "—"}</td>
                  ))}
                </tr>
                {/* Rating row */}
                <tr style={{ background: "#fff" }}>
                  <td style={{ padding: "5px 8px", color: "#4A5568", fontWeight: 600 }}>Rating</td>
                  <td style={{ padding: "5px 8px", textAlign: "center" }}>{data.ordered_rating || "—"}</td>
                  {recs.map((r, i) => (
                    <td key={i} style={{ padding: "5px 8px", textAlign: "center", color: "#F59E0B" }}>★ {r.rating || "—"}</td>
                  ))}
                </tr>
                {/* Dynamic spec rows */}
                {specs.map((row, ri) => (
                  <tr key={ri} style={{ background: ri % 2 === 0 ? "#FAFAFA" : "#fff" }}>
                    <td style={{ padding: "5px 8px", color: "#4A5568", fontWeight: 600 }}>{row.label}</td>
                    <td style={{ padding: "5px 8px", textAlign: "center" }}>{row.ordered}</td>
                    {(row.alternatives || []).map((v, i) => (
                      <td key={i} style={{ padding: "5px 8px", textAlign: "center" }}>{v}</td>
                    ))}
                  </tr>
                ))}
                {/* Amazon link row */}
                <tr style={{ background: "#FFF9FE" }}>
                  <td style={{ padding: "5px 8px", color: "#4A5568", fontWeight: 600 }}>Buy</td>
                  <td style={{ padding: "5px 8px", textAlign: "center", color: "#9B8AAA" }}>Current order</td>
                  {recs.map((r, i) => (
                    <td key={i} style={{ padding: "5px 8px", textAlign: "center" }}>
                      <a href={r.url} target="_blank" rel="noreferrer"
                        style={{ color: "#C44EBE", fontWeight: 700, fontSize: 11, textDecoration: "none" }}>
                        Amazon.in →
                      </a>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          <button
            onClick={() => onQuickSend("support")}
            style={{ width: "100%", padding: 9, borderRadius: 8, border: "1px solid #F0DAFF", background: "#FFF9FE", color: "#C44EBE", fontWeight: 600, cursor: "pointer", fontSize: 13 }}>
            Still need help? Contact Support
          </button>
        </>
      )}
    </div>
  );
}

/* ── CHANGED MIND: history-based recs + ask what they'd want instead ─────── */
function ChangedMindRecommendationsCard({ data, onQuickSend }) {
  const [wanted, setWanted] = useState("");
  const recs = data.recommendations || [];

  return (
    <div style={{ fontSize: 13 }}>
      <div style={{ fontWeight: 700, color: "#1C0F2E", marginBottom: 6 }}>🤔 Changed Your Mind?</div>
      <div style={{ color: "#7B6A8D", fontSize: 12, marginBottom: 10 }}>
        No worries! Based on your shopping history, here's what you might like:
      </div>

      {recs.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
          {recs.map((rec, i) => (
            <div key={i} style={{ background: "#FFF9FE", border: "1px solid #F0DAFF", borderRadius: 9, padding: "9px 12px" }}>
              <div style={{ fontWeight: 600, color: "#1C0F2E", fontSize: 13 }}>{rec.name}</div>
              {rec.price && <div style={{ color: "#C44EBE", fontWeight: 700, fontSize: 12, marginTop: 2 }}>{rec.price}</div>}
              {rec.reason && <div style={{ color: "#7A6A8F", fontSize: 11, marginTop: 2 }}>{rec.reason}</div>}
            </div>
          ))}
        </div>
      ) : (
        <div style={{ color: "#9B8AAA", fontSize: 12, marginBottom: 14 }}>
          We don't have any history-based suggestions for you right now.
        </div>
      )}

      <div style={{ color: "#1C0F2E", fontWeight: 600, marginBottom: 6 }}>What would you like instead?</div>
      <textarea
        value={wanted}
        onChange={(e) => setWanted(e.target.value)}
        placeholder="e.g. Sony WH-1000XM4 in black..."
        style={{ width: "100%", height: 72, borderRadius: 8, border: "1px solid #F0DAFF", padding: 8, marginBottom: 8, fontSize: 13, resize: "none", boxSizing: "border-box", outline: "none" }}
      />
      <button
        disabled={!wanted.trim()}
        onClick={() => onQuickSend({ action: "changed_mind_wanted_submitted", wanted: wanted.trim(), session_id: data.session_id })}
        style={{ width: "100%", padding: 9, background: wanted.trim() ? "#C44EBE" : "#E9D5FF", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: wanted.trim() ? "pointer" : "default", fontSize: 13 }}>
        Show Me Options →
      </button>
    </div>
  );
}

/* ── CHANGED MIND: recommendations + comparison table for the wanted item ── */
function ChangedMindComparisonCard({ data, onQuickSend }) {
  const recs  = data.recommendations || [];
  const specs = data.specs           || [];   // [{label, ordered, alternatives:[]}]

  return (
    <div style={{ fontSize: 13 }}>
      <div style={{ background: "#F0FFF4", border: "1px solid #9AE6B4", borderRadius: 10, padding: "10px 14px", marginBottom: 12 }}>
        <div style={{ fontWeight: 700, color: "#166534", marginBottom: 4 }}>✦ Here's what we found for "{data.wanted_product}"</div>
        <div style={{ color: "#22543D", fontSize: 12 }}>
          Take a look at these options and how they compare before confirming your return.
        </div>
      </div>

      {recs.length > 0 && (
        <>
          <div style={{ fontWeight: 700, color: "#1C0F2E", marginBottom: 8, fontSize: 12 }}>✦ Recommended for You</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
            {recs.map((rec, i) => (
              <a key={i} href={rec.url} target="_blank" rel="noreferrer"
                style={{ textDecoration: "none", background: "#FFF9FE", border: "1px solid #F0DAFF", borderRadius: 9, padding: "9px 12px", display: "block" }}>
                <div style={{ fontWeight: 600, color: "#1C0F2E", fontSize: 13 }}>{rec.name}</div>
                {rec.price && <div style={{ color: "#C44EBE", fontWeight: 700, fontSize: 12, marginTop: 2 }}>{rec.price}</div>}
                {rec.rating && <div style={{ color: "#F59E0B", fontSize: 11, marginTop: 2 }}>★ {rec.rating}</div>}
                <div style={{ color: "#9B8AAA", fontSize: 11, marginTop: 2 }}>View on Amazon.in →</div>
              </a>
            ))}
          </div>

          {/* Comparison table */}
          <div style={{ fontWeight: 700, color: "#1C0F2E", marginBottom: 8, fontSize: 12 }}>📊 Comparison with "{data.wanted_product}"</div>
          <div style={{ overflowX: "auto", marginBottom: 14 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
              <thead>
                <tr style={{ background: "#FFF0FE" }}>
                  <td style={{ padding: "6px 8px", fontWeight: 700, color: "#7A6A8F", borderBottom: "2px solid #F0DAFF" }}>Feature</td>
                  <td style={{ padding: "6px 8px", fontWeight: 700, color: "#C44EBE", borderBottom: "2px solid #F0DAFF", textAlign: "center" }}>
                    {data.wanted_product} <div style={{ fontSize: 9, fontWeight: 500, color: "#9B5DAA" }}>What you want</div>
                  </td>
                  {recs.map((r, i) => (
                    <td key={i} style={{ padding: "6px 8px", fontWeight: 700, color: "#1C0F2E", borderBottom: "2px solid #F0DAFF", textAlign: "center" }}>{r.name}</td>
                  ))}
                </tr>
              </thead>
              <tbody>
                {/* Price row */}
                <tr style={{ background: "#FAFAFA" }}>
                  <td style={{ padding: "5px 8px", color: "#4A5568", fontWeight: 600 }}>Price</td>
                  <td style={{ padding: "5px 8px", textAlign: "center", color: "#C44EBE", fontWeight: 700 }}>{data.wanted_price || "—"}</td>
                  {recs.map((r, i) => (
                    <td key={i} style={{ padding: "5px 8px", textAlign: "center", color: "#166534", fontWeight: 600 }}>{r.price || "—"}</td>
                  ))}
                </tr>
                {/* Rating row */}
                <tr style={{ background: "#fff" }}>
                  <td style={{ padding: "5px 8px", color: "#4A5568", fontWeight: 600 }}>Rating</td>
                  <td style={{ padding: "5px 8px", textAlign: "center" }}>{data.wanted_rating || "—"}</td>
                  {recs.map((r, i) => (
                    <td key={i} style={{ padding: "5px 8px", textAlign: "center", color: "#F59E0B" }}>★ {r.rating || "—"}</td>
                  ))}
                </tr>
                {/* Dynamic spec rows */}
                {specs.map((row, ri) => (
                  <tr key={ri} style={{ background: ri % 2 === 0 ? "#FAFAFA" : "#fff" }}>
                    <td style={{ padding: "5px 8px", color: "#4A5568", fontWeight: 600 }}>{row.label}</td>
                    <td style={{ padding: "5px 8px", textAlign: "center" }}>{row.ordered}</td>
                    {(row.alternatives || []).map((v, i) => (
                      <td key={i} style={{ padding: "5px 8px", textAlign: "center" }}>{v}</td>
                    ))}
                  </tr>
                ))}
                {/* Amazon link row */}
                <tr style={{ background: "#FFF9FE" }}>
                  <td style={{ padding: "5px 8px", color: "#4A5568", fontWeight: 600 }}>Buy</td>
                  <td style={{ padding: "5px 8px", textAlign: "center", color: "#9B8AAA" }}>—</td>
                  {recs.map((r, i) => (
                    <td key={i} style={{ padding: "5px 8px", textAlign: "center" }}>
                      <a href={r.url} target="_blank" rel="noreferrer"
                        style={{ color: "#C44EBE", fontWeight: 700, fontSize: 11, textDecoration: "none" }}>
                        Amazon.in →
                      </a>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}

      <div style={{ color: "#1C0F2E", fontWeight: 600, marginBottom: 8 }}>Ready to proceed with the return?</div>
      <button
        onClick={() => onQuickSend({ action: "changed_mind_confirm_return", session_id: data.session_id, wanted_product: data.wanted_product })}
        style={{ width: "100%", padding: 9, borderRadius: 8, border: "1px solid #9AE6B4", background: "#F0FFF4", color: "#166534", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
        ↩️ Confirm Return
      </button>
    </div>
  );
}

/* ── MESSAGE BUBBLE ──────────────────────────────────────────────────────── */
function MessageBubble({ msg, onQuickSend }) {
  if (msg.role === "user") {
    return (
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 10 }}>
        <div style={{ maxWidth: "78%", background: "linear-gradient(135deg,#D966D0,#C44EBE)", color: "#fff", borderRadius: "18px 18px 4px 18px", padding: "10px 14px", fontSize: 13, lineHeight: 1.5 }}>
          {msg.content}
        </div>
      </div>
    );
  }

  const p = parseResponse(msg.content);
  const d = p.data;

  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "flex-start" }}>
      <div style={{ width: 28, height: 28, borderRadius: "50%", background: "linear-gradient(135deg,#D966D0,#C44EBE)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 13, flexShrink: 0, marginTop: 2 }}>
        ✦
      </div>
      <div style={{ maxWidth: "84%" }}>
        <div style={{ background: "#fff", borderRadius: "4px 18px 18px 18px", border: "1px solid #F2EBFF", padding: "12px 14px", fontSize: 13, lineHeight: 1.55, boxShadow: "0 1px 4px rgba(196,78,190,0.06)" }}>
          {p.type === "structured" ? (
            d?.type === "welcome_card"              ? <WelcomeCard name={d.name} onQuickSend={onQuickSend} /> :
            d?.type === "order_list"               ? <OrderListCard data={d} onSelectOrder={(item) => onQuickSend({ action: "select_product", product: item })} /> :
            d?.type === "track_result"             ? <TrackOrderCard data={d} /> :
            d?.type === "compare_result"           ? <CompareCard data={d} /> :
            d?.type === "order_confirm"            ? <OrderConfirmCard data={d} onConfirm={onQuickSend} /> :
            d?.type === "order_success"            ? <OrderSuccessCard data={d} /> :
            d?.type === "offers_list"              ? <OffersCard data={d} /> :
            d?.type === "support_card"             ? <SupportCard data={d} onQuickSend={onQuickSend} /> :
            d?.type === "return_rejected"          ? <ReturnRejectedCard data={d} /> :
            d?.type === "return_resolution"        ? <ReturnResolutionCard data={d} /> :
            d?.type === "return_reason_required"   ? <ReturnReasonCard onQuickSend={onQuickSend} /> :
            d?.type === "damage_location_required" ? <DamageLocationCard onQuickSend={onQuickSend} reason={d.reason} /> :
            d?.type === "damage_image_required"    ? <DamagedProductImageCard onQuickSend={onQuickSend} damageLocation={d.damageLocation} reason={d.reason} /> :
            d?.type === "damage_verified"          ? <DamageVerifiedCard data={d} onQuickSend={onQuickSend} /> :
            d?.type === "damage_mismatch"          ? <DamageMismatchCard data={d} onQuickSend={onQuickSend} /> :
            d?.type === "detail_reason_required"   ? <DetailReasonCard onQuickSend={onQuickSend} attachedImages={d.attachedImages || []} /> :
            d?.type === "order_track_select"       ? <OrderListCard data={d} title="Which order would you like to track?" onSelectOrder={(item) => onQuickSend({ action: "track_order", item })} /> :
            d?.type === "reason_repeat_detected"   ? <ReasonRepeatCard data={d} onQuickSend={onQuickSend} /> :
            d?.type === "wrong_item_ask_wanted"    ? <WrongItemAskWantedCard data={d} onQuickSend={onQuickSend} /> :
            d?.type === "wrong_item_history_match" ? <WrongItemHistoryMatchCard data={d} onQuickSend={onQuickSend} /> :
            d?.type === "wrong_item_no_match"      ? <WrongItemNoMatchCard data={d} onQuickSend={onQuickSend} /> :
            d?.type === "changed_mind_recommendations" ? <ChangedMindRecommendationsCard data={d} onQuickSend={onQuickSend} /> :
            d?.type === "changed_mind_comparison"      ? <ChangedMindComparisonCard data={d} onQuickSend={onQuickSend} /> :
            <span style={{ whiteSpace: "pre-wrap" }}>{JSON.stringify(d, null, 2)}</span>
          ) : (
            <span style={{ whiteSpace: "pre-wrap" }}>{p.content}</span>
          )}
        </div>

        {/* Quick action chips after welcome card */}
        {p.type === "structured" && d?.type === "welcome_card" && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
            {["Return", "Track Order", "Vouchers", "Offers", "Coupon Help", "Support"].map((item) => (
              <button key={item} onClick={() => onQuickSend(item)}
                style={{ border: "1px solid #EAD6FF", background: "#fff", color: "#C44EBE", borderRadius: 999, padding: "5px 12px", cursor: "pointer", fontSize: 12, fontWeight: 500, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
                {item}
              </button>
            ))}
          </div>
        )}

        {/* Quick chips after track result */}
        {p.type === "structured" && d?.type === "track_result" && (
          <div style={{ marginTop: 8 }}>
            <button onClick={() => onQuickSend("Track Order")}
              style={{ border: "1px solid #EAD6FF", background: "#fff", color: "#C44EBE", borderRadius: 999, padding: "5px 12px", cursor: "pointer", fontSize: 12, fontWeight: 500 }}>
              Track another
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── TYPING INDICATOR ────────────────────────────────────────────────────── */
function TypingIndicator() {
  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "flex-start" }}>
      <div style={{ width: 28, height: 28, borderRadius: "50%", background: "linear-gradient(135deg,#D966D0,#C44EBE)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 13, flexShrink: 0 }}>✦</div>
      <div style={{ background: "#fff", borderRadius: "4px 18px 18px 18px", border: "1px solid #F2EBFF", padding: "12px 16px", display: "flex", gap: 5, alignItems: "center" }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: "#C44EBE", opacity: 0.7, animation: `irisTyping 1.2s ${i * 0.2}s infinite` }} />
        ))}
      </div>
    </div>
  );
}

/* ── MAIN WIDGET ─────────────────────────────────────────────────────────── */
export default function IrisWidget({ user }) {
  const [open, setOpen]                       = useState(false);
  const [messages, setMessages]               = useState([{ role: "assistant", content: JSON.stringify({ type: "welcome_card", name: user?.full_name?.split(" ")[0] || "there" }) }]);
  const [sessionId, setSessionId]             = useState(null);
  const [returnSession, setReturnSession]     = useState(null);
  const [selectedReason, setSelectedReason]   = useState(null);
  const [damageLocation, setDamageLocation]   = useState(null);  // NEW
  const [input, setInput]                     = useState("");
  const [typing, setTyping]                   = useState(false);
  const endRef   = useRef(null);
  const inputRef = useRef(null);

  // Update welcome card name when user logs in
  useEffect(() => {
    if (user?.full_name) {
      setMessages([{ role: "assistant", content: JSON.stringify({ type: "welcome_card", name: user.full_name.split(" ")[0] }) }]);
    }
  }, [user?.full_name]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, typing]);

  const pushMsg = (role, content) => setMessages((prev) => [...prev, { role, content }]);

  const handleSend = useCallback(async (payload) => {

    // ── plain string (typed message or quick-chip click) ──────────────────
    if (typeof payload === "string") {
      const q = payload.trim();
      if (!q) return;
      pushMsg("user", q);
      setInput("");
      setTyping(true);

      try {
        const lower = q.toLowerCase();

        // ── RETURN shortcut ───────────────────────────────────────────────
        if (lower === "return") {
          const res = await fetch(`${API_BASE}/orders`, { headers: authH() });
          const data = await res.json();
          const returnable = data.filter(o => o.status !== "returned" && o.status !== "cancelled");
          if (!returnable.length) {
            pushMsg("assistant", "You don't have any eligible orders to return right now.");
            setTyping(false); return;
          }
          pushMsg("assistant", JSON.stringify({ type: "order_list", items: returnable }));
          setTyping(false); return;
        }

        // ── RESTART RETURN (from ReasonRepeatCard) ────────────────────────
        if (lower === "restart_return") {
          const res = await fetch(`${API_BASE}/orders`, { headers: authH() });
          const data = await res.json();
          const returnable = data.filter(o => o.status !== "returned" && o.status !== "cancelled");
          if (!returnable.length) {
            pushMsg("assistant", "You don't have any eligible orders to return right now.");
            setTyping(false); return;
          }
          pushMsg("assistant", JSON.stringify({ type: "order_list", items: returnable }));
          setTyping(false); return;
        }

        // ── TRACK ORDER shortcut ──────────────────────────────────────────
        if (lower === "track order" || lower === "track") {
          const res = await fetch(`${API_BASE}/orders`, { headers: authH() });
          const data = await res.json();
          const trackable = data.filter(o => o.status !== "returned" && o.status !== "cancelled");
          if (!trackable.length) {
            pushMsg("assistant", "You don't have any active orders to track right now.");
            setTyping(false); return;
          }
          pushMsg("assistant", JSON.stringify({ type: "order_track_select", items: trackable }));
          setTyping(false); return;
        }

        // ── OFFERS / VOUCHERS ─────────────────────────────────────────────
        if (lower === "offers" || lower === "vouchers" || lower === "coupon help") {
          const res = await fetch(`${API_BASE}/chat/send`, {
            method: "POST", headers: authH(),
            body: JSON.stringify({ query: `Show me current offers, vouchers and coupons available. Format response as JSON: {"type":"offers_list","offers":[{"title":"...","description":"...","code":"...","expiry":"..."}]}`, session_id: sessionId }),
          });
          const data = await res.json();
          setSessionId(data.session_id);
          pushMsg("assistant", data.message?.content || JSON.stringify({ type: "offers_list", offers: [{ title: "Welcome Offer", description: "10% off on your next order", code: "IRIS10", expiry: "30 June 2026" }, { title: "Electronics Deal", description: "Flat ₹500 off on electronics above ₹5000", code: "ELEC500", expiry: "15 June 2026" }] }));
          setTyping(false); return;
        }

        // ── SUPPORT ───────────────────────────────────────────────────────
        if (lower === "support") {
          pushMsg("assistant", JSON.stringify({
            type: "support_card",
            message: "Our support team is here to help. Choose a topic or describe your issue below.",
            options: ["📦 Order issues", "💳 Payment & refunds", "📍 Delivery tracking", "🔄 Exchange a product", "❓ Other queries"],
          }));
          setTyping(false); return;
        }

        // ── All other queries → AI ────────────────────────────────────────
        const res = await fetch(`${API_BASE}/chat/send`, {
          method: "POST", headers: authH(),
          body: JSON.stringify({ query: q, session_id: sessionId }),
        });
        const data = await res.json();
        setSessionId(data.session_id);
        pushMsg("assistant", data.message?.content || "I'm here to help! Could you please clarify your request?");

      } catch (err) {
        pushMsg("assistant", "Something went wrong. Please try again.");
      } finally {
        setTyping(false);
      }
      return;
    }

    // ── TRACK: select order ───────────────────────────────────────────────
    if (payload?.action === "track_order") {
      const item = payload.item;
      pushMsg("user", item.name);
      setTyping(true);
      try {
        const extra = item.status === "delivered"
          ? { delivered_at: item.label?.replace("ordered ", "Delivered ") }
          : item.status === "shipped"
          ? { eta: "2-3 business days" }
          : {};
        pushMsg("assistant", JSON.stringify({
          type: "track_result",
          item: { name: item.name, price: item.price, status: item.status, label: item.label, ...extra },
        }));
      } finally { setTyping(false); }
      return;
    }

    // ── ORDER: confirm ────────────────────────────────────────────────────
    if (payload?.action === "confirm_order") {
      pushMsg("user", `Confirm order: ${payload.product_name}`);
      setTyping(true);
      try {
        const res = await fetch(`${API_BASE}/orders/confirm`, {
          method: "POST", headers: authH(),
          body: JSON.stringify({
            product_name: payload.product_name,
            price: payload.price,
            brand: payload.brand || "",
            quantity: payload.qty || 1,
          }),
        });
        const data = await res.json();
        pushMsg("assistant", JSON.stringify({ type: "order_success", ...data }));
      } catch {
        pushMsg("assistant", "Order could not be placed. Please try again.");
      } finally { setTyping(false); }
      return;
    }

    if (payload === "cancel_order") {
      pushMsg("assistant", "Order cancelled. Is there anything else I can help you with?");
      return;
    }

    // ── RETURN: select product ────────────────────────────────────────────
    if (payload?.action === "select_product") {
      if (!payload.product?.order_id) { pushMsg("assistant", "Couldn't find that order. Please try again."); return; }
      pushMsg("user", payload.product.name);
      setTyping(true);
      try {
        const res = await fetch(`${API_BASE}/returns/start`, {
          method: "POST", headers: authH(),
          body: JSON.stringify({ order_id: payload.product.order_id }),
        });
        const data = await res.json();
        // If rejected due to not delivered, show friendly message and stop
        if (data.type === "return_rejected") {
          pushMsg("assistant", JSON.stringify({
            ...data,
            reason: data.reason === "Order not delivered yet"
              ? `${payload.product.name} hasn't been delivered yet — returns are only available after delivery.`
              : data.reason,
          }));
          setTyping(false); return;
        }
        setReturnSession(data.session_id);
        pushMsg("assistant", JSON.stringify(data));
      } finally { setTyping(false); }
      return;
    }

    // ── RETURN: select reason ─────────────────────────────────────────────
    if (payload?.action === "select_reason") {
      setSelectedReason(payload.reason);
      pushMsg("user", payload.reason);

      // Damaged Product & Defective → same photo-verification flow
      if (["Damaged Product", "Defective"].includes(payload.reason)) {
        pushMsg("assistant", JSON.stringify({ type: "damage_location_required", reason: payload.reason }));
        return;
      }

      // Wrong Item → ask what they actually wanted
      if (payload.reason === "Wrong Item") {
        pushMsg("assistant", JSON.stringify({
          type: "wrong_item_ask_wanted",
          session_id: returnSession,
          ordered_product: payload.ordered_product || "",
        }));
        return;
      }

      // Changed Mind → show history-based recs, then ask what they'd want instead
      if (payload.reason === "Changed Mind") {
        setTyping(true);
        try {
          const res = await fetch(`${API_BASE}/returns/changed-mind-recommendations`, {
            method: "POST", headers: authH(),
            body: JSON.stringify({ session_id: returnSession }),
          });
          const data = await res.json();
          pushMsg("assistant", JSON.stringify(data));
        } catch {
          pushMsg("assistant", JSON.stringify({ type: "changed_mind_recommendations", session_id: returnSession, recommendations: [] }));
        } finally { setTyping(false); }
        return;
      }

      pushMsg("assistant", JSON.stringify({ type: "detail_reason_required", attachedImages: [] }));
      return;
    }

    // ── WRONG ITEM: user submitted what they wanted ───────────────────────
    if (payload?.action === "wrong_item_wanted_submitted") {
      pushMsg("user", `I wanted: ${payload.wanted}`);
      setTyping(true);
      try {
        const res = await fetch(`${API_BASE}/returns/wrong-item-check`, {
          method: "POST", headers: authH(),
          body: JSON.stringify({
            session_id: returnSession,
            wanted_product: payload.wanted,
          }),
        });
        const data = await res.json();
        pushMsg("assistant", JSON.stringify(data));
      } catch {
        pushMsg("assistant", "Something went wrong. Please try again.");
      } finally { setTyping(false); }
      return;
    }

    // ── WRONG ITEM: confirm return only ──────────────────────────────────
    if (payload?.action === "wrong_item_confirm_return") {
      pushMsg("user", "Confirm return");
      setTyping(true);
      try {
        const res = await fetch(`${API_BASE}/returns/reason`, {
          method: "POST", headers: authH(),
          body: JSON.stringify({
            session_id: payload.session_id || returnSession,
            reason: "Wrong Item",
            detailed_reason: `Customer wanted: ${payload.wanted_product}. Confirmed return.`,
          }),
        });
        const data = await res.json();
        setReturnSession(null); setSelectedReason(null);
        pushMsg("assistant", JSON.stringify(data));
      } catch {
        pushMsg("assistant", "Couldn't process the return. Please try again.");
      } finally { setTyping(false); }
      return;
    }

    // ── CHANGED MIND: user submitted what they'd want instead ─────────────
    if (payload?.action === "changed_mind_wanted_submitted") {
      pushMsg("user", `I'd like instead: ${payload.wanted}`);
      setTyping(true);
      try {
        const res = await fetch(`${API_BASE}/returns/changed-mind-check`, {
          method: "POST", headers: authH(),
          body: JSON.stringify({
            session_id: payload.session_id || returnSession,
            wanted_product: payload.wanted,
          }),
        });
        const data = await res.json();
        pushMsg("assistant", JSON.stringify(data));
      } catch {
        pushMsg("assistant", "Something went wrong. Please try again.");
      } finally { setTyping(false); }
      return;
    }

    // ── CHANGED MIND: confirm return ──────────────────────────────────────
    if (payload?.action === "changed_mind_confirm_return") {
      pushMsg("user", "Confirm return");
      setTyping(true);
      try {
        const res = await fetch(`${API_BASE}/returns/reason`, {
          method: "POST", headers: authH(),
          body: JSON.stringify({
            session_id: payload.session_id || returnSession,
            reason: "Changed Mind",
            detailed_reason: `Customer would prefer instead: ${payload.wanted_product}. Confirmed return.`,
          }),
        });
        const data = await res.json();
        setReturnSession(null); setSelectedReason(null);
        pushMsg("assistant", JSON.stringify(data));
      } catch {
        pushMsg("assistant", "Couldn't process the return. Please try again.");
      } finally { setTyping(false); }
      return;
    }

    // ── NEW: DAMAGE/DEFECT LOCATION submitted → ask for image upload ──────
    if (payload?.action === "damage_location_submitted") {
      setDamageLocation(payload.location);
      const reason = payload.reason || selectedReason;
      pushMsg("user", reason === "Defective" ? `Issue: ${payload.location}` : `Damage location: ${payload.location}`);
      pushMsg("assistant", JSON.stringify({
        type: "damage_image_required",
        damageLocation: payload.location,
        reason,
      }));
      return;
    }

    // ── NEW: RETRY claim → restart location step ─────────────────────────
    if (payload?.action === "retry_damage_claim") {
      pushMsg("user", "Retry with different photos");
      setDamageLocation(null);
      pushMsg("assistant", JSON.stringify({ type: "damage_location_required", reason: payload.reason || selectedReason }));
      return;
    }

    // ── NEW: DAMAGE IMAGES attached → verify via Ollama backend ──────────
    if (payload?.action === "damage_images_attached") {
      const photoCount = payload.images?.length || 0;
      pushMsg("user", `📎 ${photoCount} photo${photoCount !== 1 ? "s" : ""} uploaded for verification`);

      // Guard: no session means the order wasn't eligible (e.g. not delivered yet)
      if (!returnSession) {
        pushMsg("assistant", JSON.stringify({
          type: "return_rejected",
          reason: "No active return session found. Please select a delivered order to start a return.",
        }));
        setDamageLocation(null);
        setSelectedReason(null);
        return;
      }

      setTyping(true);
      try {
        const res = await fetch(`${API_BASE}/returns/verify-damage`, {
          method: "POST",
          headers: authH(),
          body: JSON.stringify({
            session_id: returnSession,
            damage_location: payload.damageLocation,
            images: (payload.images || []).map(img => img.dataUrl), // base64 data URLs
          }),
        });
        const data = await res.json();
        // data.type should be "damage_verified" or "damage_mismatch"
        data.reason = payload.reason || selectedReason;
        pushMsg("assistant", JSON.stringify(data));
      } catch {
        pushMsg("assistant", "Couldn't verify the damage right now. Please contact support.");
      } finally { setTyping(false); }
      return;
    }

    // ── NEW: VERIFIED RETURN ONLY (Damaged Product or Defective) ─────────
    if (payload?.action === "damaged_return_only") {
      pushMsg("user", "Return only");
      setTyping(true);
      const sid = payload.session_id || returnSession;
      const loc = payload.damageLocation || damageLocation;
      const reason = payload.reason || selectedReason || "Damaged Product";
      const reasonLabel = reason === "Defective" ? "Issue" : "Damage location";
      const successText = reason === "Defective"
        ? "Your return for the defective product has been submitted successfully."
        : "Your return for the damaged product has been submitted successfully.";
      setReturnSession(null);
      setSelectedReason(null);
      setDamageLocation(null);
      try {
        const res = await fetch(`${API_BASE}/returns/reason`, {
          method: "POST", headers: authH(),
          body: JSON.stringify({
            session_id: sid,
            reason: reason,
            detailed_reason: `${reasonLabel}: ${loc}. Return only requested.`,
          }),
        });
        const data = await res.json();
        // If backend still fires repeat (edge case), treat it as approved
        if (data.type === "reason_repeat_detected") {
          pushMsg("assistant", JSON.stringify({
            type: "return_resolution",
            approved: true,
            confidence: 1,
            risk: "low",
            explanation: successText,
          }));
        } else {
          pushMsg("assistant", JSON.stringify(data));
        }
      } catch {
        pushMsg("assistant", "Couldn't process the return. Please try again.");
      } finally { setTyping(false); }
      return;
    }

    // ── NEW: VERIFIED RETURN + RECOMMENDATIONS (Damaged Product or Defective) ─
    if (payload?.action === "damaged_return_with_recommendation") {
      pushMsg("user", "Return and get recommendations");
      setTyping(true);
      const sid = payload.session_id || returnSession;
      const loc = payload.damageLocation || damageLocation;
      const reason = payload.reason || selectedReason || "Damaged Product";
      const reasonLabel = reason === "Defective" ? "Issue" : "Damage location";
      const successText = reason === "Defective"
        ? "Your return for the defective product has been submitted successfully."
        : "Your return for the damaged product has been submitted successfully.";
      setReturnSession(null);
      setSelectedReason(null);
      setDamageLocation(null);
      try {
        const res = await fetch(`${API_BASE}/returns/reason`, {
          method: "POST", headers: authH(),
          body: JSON.stringify({
            session_id: sid,
            reason: reason,
            detailed_reason: `${reasonLabel}: ${loc}. Return with recommendations requested.`,
            include_recommendations: true,
          }),
        });
        const data = await res.json();
        // If backend still fires repeat (edge case), treat as approved + show recs from payload
        if (data.type === "reason_repeat_detected") {
          pushMsg("assistant", JSON.stringify({
            type: "return_resolution",
            approved: true,
            confidence: 1,
            risk: "low",
            explanation: successText,
            recommendations: payload.recommendations || [],
          }));
        } else {
          // Merge recommendations from verify-damage step if backend didn't include any
          if (!data.recommendations?.length && payload.recommendations?.length) {
            data.recommendations = payload.recommendations;
          }
          pushMsg("assistant", JSON.stringify(data));
        }
      } catch {
        pushMsg("assistant", "Couldn't process the return. Please try again.");
      } finally { setTyping(false); }
      return;
    }

    // ── RETURN: images attached (non-damaged flow) ────────────────────────
    if (payload?.action === "images_attached") {
      const photoCount = payload.images?.length || 0;
      pushMsg("user", photoCount > 0 ? `📎 ${photoCount} photo${photoCount !== 1 ? "s" : ""} attached` : "No photos attached — skipped");
      pushMsg("assistant", JSON.stringify({ type: "detail_reason_required", attachedImages: payload.images || [] }));
      return;
    }

    // ── RETURN: submit detail ─────────────────────────────────────────────
    if (payload?.action === "submit_detailed_reason") {
      pushMsg("user", payload.detail);
      setTyping(true);
      try {
        const imageCount = payload.images?.length || 0;
        const detailWithPhotos = imageCount > 0
          ? `${payload.detail} [${imageCount} photo${imageCount !== 1 ? "s" : ""} attached by customer]`
          : payload.detail;
        const res = await fetch(`${API_BASE}/returns/reason`, {
          method: "POST", headers: authH(),
          body: JSON.stringify({ session_id: returnSession, reason: selectedReason, detailed_reason: detailWithPhotos }),
        });
        const data = await res.json();
        if (["return_resolution", "return_rejected", "reason_repeat_detected"].includes(data.type)) {
          setReturnSession(null);
          setSelectedReason(null);
        }
        pushMsg("assistant", JSON.stringify(data));
      } finally { setTyping(false); }
      return;
    }

  }, [input, sessionId, returnSession, selectedReason, damageLocation]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (input.trim()) handleSend(input.trim());
    }
  };

  return (
    <>
      {/* ── Floating pink button ─────────────────────────────────────── */}
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          position: "fixed", bottom: 28, right: 28, zIndex: 9999,
          width: 56, height: 56, borderRadius: "50%",
          background: open ? "#fff" : "linear-gradient(135deg,#D966D0,#C44EBE)",
          border: open ? "2px solid #C44EBE" : "none",
          cursor: "pointer", color: open ? "#C44EBE" : "#fff",
          fontSize: open ? 22 : 24, fontWeight: 700,
          boxShadow: "0 4px 20px rgba(196,78,190,0.4)",
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "all 0.2s",
        }}
      >
        {open ? "✕" : "✦"}
      </button>

      {/* ── Chat panel ──────────────────────────────────────────────────── */}
      {open && (
        <div style={{
          position: "fixed", bottom: 96, right: 28, zIndex: 9998,
          width: 390, borderRadius: 24,
          background: "#FAFAFE",
          boxShadow: "0 16px 56px rgba(196,78,190,0.18), 0 4px 16px rgba(0,0,0,0.08)",
          display: "flex", flexDirection: "column", overflow: "hidden",
          height: 580,
          animation: "irisSlideIn 0.22s cubic-bezier(0.34,1.56,0.64,1)",
        }}>

          {/* Header */}
          <div style={{
            background: "linear-gradient(135deg,#D966D0 0%,#C44EBE 100%)",
            padding: "14px 18px",
            display: "flex", alignItems: "center", gap: 12,
          }}>
            <div style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, color: "#fff", fontWeight: 700 }}>✦</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 16, color: "#fff" }}>Iris</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.85)", display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#4ADE80", display: "inline-block" }} />
                Online · Always ready to help
              </div>
            </div>
            <button onClick={() => setOpen(false)} style={{ background: "rgba(255,255,255,0.2)", border: "none", borderRadius: "50%", width: 30, height: 30, color: "#fff", cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: "16px 14px 8px" }}>
            {messages.map((msg, i) => (
              <MessageBubble key={i} msg={msg} onQuickSend={handleSend} />
            ))}
            {typing && <TypingIndicator />}
            <div ref={endRef} />
          </div>

          {/* Input */}
          <div style={{ padding: "10px 14px 14px", borderTop: "1px solid #F2EBFF", background: "#fff" }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", background: "#F8F0FF", borderRadius: 14, padding: "4px 4px 4px 14px", border: "1.5px solid #EAD6FF" }}>
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your message..."
                style={{ flex: 1, border: "none", background: "none", outline: "none", fontSize: 13, color: "#1C0F2E", padding: "6px 0" }}
              />
              <button
                onClick={() => { if (input.trim()) handleSend(input.trim()); }}
                disabled={!input.trim()}
                style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: input.trim() ? "linear-gradient(135deg,#D966D0,#C44EBE)" : "#E9D5FF",
                  border: "none", cursor: input.trim() ? "pointer" : "default",
                  color: "#fff", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0, transition: "background 0.2s",
                }}
              >
                ➤
              </button>
            </div>
            <div style={{ textAlign: "center", fontSize: 11, color: "#C0AED1", marginTop: 8 }}>
              Powered by <span style={{ color: "#C44EBE", fontWeight: 600 }}>Iris AI</span>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes irisSlideIn {
          from { opacity: 0; transform: translateY(20px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0)    scale(1);    }
        }
        @keyframes irisTyping {
          0%, 60%, 100% { transform: translateY(0);    opacity: 0.5; }
          30%            { transform: translateY(-5px); opacity: 1;   }
        }
      `}</style>
    </>
  );
}