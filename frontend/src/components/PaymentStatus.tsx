import React from "react";

interface PaymentStatusProps {
  status: "success" | "cancelled" | "error";
  planName: string;
  onGoBack: () => void;
}

function PaymentStatus({ status, planName, onGoBack }: PaymentStatusProps) {
  const isSuccess = status === "success";
  const isCancelled = status === "cancelled";

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        {/* Status Icon */}
        <div
          style={{
            ...styles.iconContainer,
            backgroundColor: isSuccess ? "#e8f5e9" : isCancelled ? "#fff3e0" : "#ffebee",
          }}
        >
          <span style={styles.icon}>
            {isSuccess ? "✓" : isCancelled ? "✕" : "!"}
          </span>
        </div>

        {/* Status Title */}
        <h1
          style={{
            ...styles.title,
            color: isSuccess ? "#2e7d32" : isCancelled ? "#ef6c00" : "#c62828",
          }}
        >
          {isSuccess
            ? "Payment Successful!"
            : isCancelled
            ? "Payment Cancelled"
            : "Payment Failed"}
        </h1>

        {/* Status Message */}
        <p style={styles.message}>
          {isSuccess
            ? `Thank you for purchasing the ${planName}! Your access has been activated.`
            : isCancelled
            ? `You cancelled the checkout for ${planName}. No payment was made.`
            : `Something went wrong while processing your payment for ${planName}.`}
        </p>

        {/* Important Notice for Success */}
        {isSuccess && (
          <div style={styles.notice}>
            <p style={styles.noticeText}>
              <strong>Note:</strong> This success page is just for user experience.
              The actual subscription is activated via webhook on the backend.
            </p>
          </div>
        )}

        {/* Action Button */}
        <button style={styles.button} onClick={onGoBack}>
          {isSuccess ? "Continue Shopping" : "Try Again"}
        </button>
      </div>
    </div>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    minHeight: "60vh",
    padding: "2rem",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: "12px",
    boxShadow: "0 4px 20px rgba(0, 0, 0, 0.1)",
    padding: "3rem",
    textAlign: "center",
    maxWidth: "450px",
    width: "100%",
  },
  iconContainer: {
    width: "80px",
    height: "80px",
    borderRadius: "50%",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    margin: "0 auto 1.5rem",
  },
  icon: {
    fontSize: "40px",
    fontWeight: "bold",
  },
  title: {
    fontSize: "1.75rem",
    marginBottom: "1rem",
    fontWeight: 600,
  },
  message: {
    color: "#666",
    fontSize: "1rem",
    lineHeight: 1.6,
    marginBottom: "1.5rem",
  },
  notice: {
    backgroundColor: "#f5f5f5",
    borderRadius: "8px",
    padding: "1rem",
    marginBottom: "1.5rem",
  },
  noticeText: {
    color: "#666",
    fontSize: "0.875rem",
    margin: 0,
  },
  button: {
    backgroundColor: "#1976d2",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    padding: "12px 32px",
    fontSize: "1rem",
    fontWeight: 500,
    cursor: "pointer",
    transition: "background-color 0.2s",
  },
};

export default PaymentStatus;
