"use client";

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="no-print"
      style={{
        background: "var(--tag-yellow)",
        color: "#211f1d",
        border: "none",
        borderRadius: 4,
        padding: "10px 18px",
        fontWeight: 600,
        fontSize: 14,
        cursor: "pointer",
      }}
    >
      Print
    </button>
  );
}
