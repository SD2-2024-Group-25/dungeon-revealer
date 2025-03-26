// ZoomModal.tsx
import React from "react";

interface ZoomModalProps {
  show: boolean;
  onClose: () => void;
}

const modalOverlayStyle: React.CSSProperties = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: "rgba(0,0,0,0.5)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
};

const modalStyle: React.CSSProperties = {
  background: "white",
  padding: "20px",
  borderRadius: "8px",
  textAlign: "center",
  width: "500px",
};

const buttonStyle: React.CSSProperties = {
  margin: "5px 0",
  padding: "10px 15px",
  width: "100%",
  textAlign: "center",
  cursor: "pointer",
};

const closeButtonStyle: React.CSSProperties = {
  marginTop: "20px",
  padding: "10px 15px",
  cursor: "pointer",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px",
  marginTop: "8px",
  border: "1px solid #ccc",
  borderRadius: "4px",
};

export const ZoomModal: React.FC<ZoomModalProps> = ({ show, onClose }) => {
  const [zoomData, setZoomData] = React.useState({
    accountId: "",
    clientId: "",
    clientSecret: "",
    monthFrom: "",
    monthTo: "",
    year: "",
    userFilter: "",
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setZoomData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async () => {
    console.log("Zoom Info Submitted:", zoomData);

    try {
      const response = await fetch("/api/load-zoom", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(zoomData),
      });

      if (response.ok) {
        console.log("Zoom Loaded");
        onClose();
      } else {
        console.error("Failed Zoom Loaded");
      }
    } catch (err) {
      console.error("Error Zoom Load:", err);
    }

    onClose();
  };

  if (!show) return null;

  return (
    <div style={modalOverlayStyle}>
      <div style={modalStyle}>
        <h2>Zoom Credentials</h2>
        <input
          style={inputStyle}
          name="accountId"
          placeholder="Account ID"
          value={zoomData.accountId}
          onChange={handleInputChange}
        />
        <input
          style={inputStyle}
          name="clientId"
          placeholder="Client ID"
          value={zoomData.clientId}
          onChange={handleInputChange}
        />
        <input
          style={inputStyle}
          name="clientSecret"
          placeholder="Client Secret"
          value={zoomData.clientSecret}
          onChange={handleInputChange}
        />
        <input
          style={inputStyle}
          name="monthFrom"
          placeholder="Month From"
          value={zoomData.monthFrom}
          onChange={handleInputChange}
        />
        <input
          style={inputStyle}
          name="monthTo"
          placeholder="Month To"
          value={zoomData.monthTo}
          onChange={handleInputChange}
        />
        <input
          style={inputStyle}
          name="year"
          placeholder="Year"
          value={zoomData.year}
          onChange={handleInputChange}
        />
        <input
          style={inputStyle}
          name="userFilter"
          placeholder="User Email"
          value={zoomData.userFilter}
          onChange={handleInputChange}
        />

        <button onClick={handleSubmit} style={buttonStyle}>
          Submit
        </button>
        <button onClick={onClose} style={closeButtonStyle}>
          Cancel
        </button>
      </div>
    </div>
  );
};
