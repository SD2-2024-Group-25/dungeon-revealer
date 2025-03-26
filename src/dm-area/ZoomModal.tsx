// ZoomModal.tsx
import React from "react";

interface ZoomModalProps {
  show: boolean;
  onClose: () => void;
  onSessionSelect: () => void;
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

const sessionModalStyle: React.CSSProperties = {
  ...modalStyle,
  height: "auto",
  overflowY: "auto",
};

const sessionItemStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "8px 0",
};

const smallButtonStyle: React.CSSProperties = {
  marginLeft: "5px",
  padding: "5px 10px",
  cursor: "pointer",
};

export const ZoomModal: React.FC<ZoomModalProps> = ({
  show,
  onClose,
  onSessionSelect,
}) => {
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
        // Fetch Zoom sessions from your existing endpoint
        const sessionsResponse = await fetch("/api/list-zoom-sessions");
        if (sessionsResponse.ok) {
          const data = await sessionsResponse.json();
          setZoomSessions(data.files); // `files` is the array in your API
          setShowSessionModal(true); // Show the modal
        } else {
          console.error("Failed to fetch Zoom sessions");
        }
      } else {
        console.error("Failed Zoom Loaded");
      }
    } catch (err) {
      console.error("Error Zoom Load:", err);
    }

    //onClose(); // Closes the input modal
  };

  const [zoomSessions, setZoomSessions] = React.useState<any[]>([]);
  const [showSessionModal, setShowSessionModal] = React.useState(false);

  if (!show) return null;

  const handleClick = async (session: string) => {
    try {
      const response = await fetch(`/api/zoom-session-select/${session}`);
      if (!response.ok) {
        throw new Error("Failed to zoom select folder");
      }
    } catch (error) {
      console.error("Error downloading folder:", error);
      alert("Failed to zoom select folder. Please try again.");
    }
  };

  return (
    <>
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
      {/* Zoom Sessions Modal */}
      {showSessionModal && (
        <div style={modalOverlayStyle}>
          <div style={sessionModalStyle}>
            <h2>Zoom Sessions</h2>
            <ul>
              {zoomSessions.length > 0 ? (
                zoomSessions.map((session) => {
                  const displayName = session.split("_Tabletop")[0]; // Gets just the datetime prefix
                  return (
                    <button
                      key={session}
                      style={{
                        ...sessionItemStyle,
                        display: "block",
                        width: "100%",
                        marginBottom: "8px",
                        padding: "10px",
                        textAlign: "center",
                        cursor: "pointer",
                      }}
                      onClick={() => {
                        handleClick(session);
                        onSessionSelect();
                      }}
                    >
                      {displayName}
                    </button>
                  );
                })
              ) : (
                <p>No sessions found.</p>
              )}
            </ul>
            <button
              onClick={() => setShowSessionModal(false)}
              style={closeButtonStyle}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
};
