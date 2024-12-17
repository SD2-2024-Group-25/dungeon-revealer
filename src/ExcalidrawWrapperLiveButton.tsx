import React, { useState, useEffect } from "react";
import { Excalidraw, LiveCollaborationTrigger } from "@excalidraw/excalidraw";
import styled from "@emotion/styled/macro";
import { Socket } from "socket.io-client"; // Import Socket type
const Wrapper = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 300;
`;

const CloseButton = styled.button`
  position: absolute;
  top: 16px;
  right: 16px;
  background: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
`;

interface ExcalidrawWrapperProps {
  onClose: () => void;
  isCollaborating: boolean;
  setIsCollaborating: React.Dispatch<React.SetStateAction<boolean>>;
  socket: Socket; // Add the socket prop
}

const ExcalidrawWrapper: React.FC<ExcalidrawWrapperProps> = ({
  onClose,
  isCollaborating,
  setIsCollaborating,
  socket, // Destructure the socket prop
}) => {
  const [excalidrawAPI, setExcalidrawAPI] = useState<any>(null);

  useEffect(() => {
    if (excalidrawAPI) {
      console.log("Excalidraw API is ready:", excalidrawAPI);
    }
  }, [excalidrawAPI]);

  return (
    <Wrapper>
      <div style={{ height: "500px", width: "100%" }}>
        <Excalidraw
          excalidrawAPI={(api) => setExcalidrawAPI(api)}
          isCollaborating={isCollaborating}
          renderTopRightUI={() => (
            <LiveCollaborationTrigger
              isCollaborating={isCollaborating}
              onSelect={() => {
                socket.emit("join-room", "room-id-example"); // Emit join-room event
                setIsCollaborating(true); // Start collaboration
                console.log("Live collaboration triggered.");
              }}
            />
          )}
        />
      </div>
      <CloseButton onClick={onClose}>Close</CloseButton>
    </Wrapper>
  );
};

export default ExcalidrawWrapper;
