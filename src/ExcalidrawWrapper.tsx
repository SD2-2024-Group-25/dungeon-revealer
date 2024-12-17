import React from "react";
import { Excalidraw } from "@excalidraw/excalidraw";
import styled from "@emotion/styled/macro";

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

const ExcalidrawWrapper: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  return (
    <Wrapper>
      <div style={{ height: "500px", width: "100%" }}>
        <Excalidraw />
      </div>
      <CloseButton onClick={onClose}>Close</CloseButton>
    </Wrapper>
  );
};

export default ExcalidrawWrapper;
