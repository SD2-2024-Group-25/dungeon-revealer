import * as React from "react";
import * as userSession from "../chat/user-session";
import styled from "@emotion/styled/macro";
import * as io from "io-ts";
import { pipe, identity } from "fp-ts/function";
import * as E from "fp-ts/Either";
import {
  Box,
  FormControl,
  FormLabel,
  Heading,
  Switch,
  VStack,
  HStack,
  Text,
  InputGroup,
  Stack,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  NumberIncrementStepper,
  NumberDecrementStepper,
  useToast,
} from "@chakra-ui/react";
import graphql from "babel-plugin-relay/macro";
import { ReactRelayContext, useFragment, useMutation } from "relay-hooks";
import * as Icon from "../feather-icons";
import { Toolbar } from "../toolbar";
import type { MapTool } from "../map-tools/map-tool";
import { DragPanZoomMapTool } from "../map-tools/drag-pan-zoom-map-tool";
import {
  BrushMapTool,
  BrushToolContext,
  BrushToolContextProvider,
} from "../map-tools/brush-map-tool";
import {
  MarkAreaMapTool,
  MarkAreaToolContext,
} from "../map-tools/mark-area-map-tool";
import {
  ConfigureGridMapTool,
  ConfigureGridMapToolContext,
  ConfigureMapToolState,
} from "../map-tools/configure-grid-map-tool";
import { MapControlInterface } from "../map-view";
import { ConditionalWrap } from "../util";
import { BrushShape, FogMode } from "../canvas-draw-utilities";
import {
  AreaSelectContext,
  AreaSelectContextProvider,
  AreaSelectMapTool,
} from "../map-tools/area-select-map-tool";
import { useOnClickOutside } from "../hooks/use-on-click-outside";
import { useAsyncClipboardApi } from "../hooks/use-async-clipboard-api";
import { MapTokenEntity } from "../map-typings";
import { useConfirmationDialog } from "../hooks/use-confirmation-dialog";
import { applyFogRectangle } from "../canvas-draw-utilities";
import { useResetState } from "../hooks/use-reset-state";
import * as Button from "../button";
import { useDebounceCallback } from "../hooks/use-debounce-callback";
import {
  FlatContextProvider,
  ComponentWithPropsTuple,
} from "../flat-context-provider";
import {
  PersistedStateModel,
  usePersistedState,
} from "../hooks/use-persisted-state";
import {
  TokenMarkerContext,
  TokenMarkerContextProvider,
  TokenMarkerMapTool,
} from "../map-tools/token-marker-map-tool";
import { NoteWindowActionsContext } from "./token-info-aside";
import { ColorPickerInput } from "../color-picker-input";
import { buttonGroup, useControls, useCreateStore, LevaInputs } from "leva";
import { levaPluginIconPicker } from "../leva-plugin/leva-plugin-icon-picker";
import { ThemedLevaPanel } from "../themed-leva-panel";
import {
  ContextMenuStoreProvider,
  ContextMenuStoreContext,
} from "../map-context-menu";
import { ContextMenuRenderer } from "../map-context-menu-renderer";
import {
  SharedTokenStateProvider,
  SharedTokenStateStoreContext,
} from "../shared-token-state";
import { SharedTokenMenu } from "../shared-token-menu";
import { dmMap_DMMapFragment$key } from "./__generated__/dmMap_DMMapFragment.graphql";
import { dmMap_ShowGridSettingsPopupMapFragment$key } from "./__generated__/dmMap_ShowGridSettingsPopupMapFragment.graphql";
import { dmMap_ShowGridSettingsPopupGridFragment$key } from "./__generated__/dmMap_ShowGridSettingsPopupGridFragment.graphql";
import { dmMap_GridSettingButton_MapFragment$key } from "./__generated__/dmMap_GridSettingButton_MapFragment.graphql";
import { dmMap_mapUpdateGridMutation } from "./__generated__/dmMap_mapUpdateGridMutation.graphql";
import { dmMap_GridConfigurator_MapFragment$key } from "./__generated__/dmMap_GridConfigurator_MapFragment.graphql";
import { dmMap_MapPingMutation } from "./__generated__/dmMap_MapPingMutation.graphql";
import { UpdateTokenContext } from "../update-token-context";
import { IsDungeonMasterContext } from "../is-dungeon-master-context";
import { LazyLoadedMapView } from "../lazy-loaded-map-view";
import { typeFromAST } from "graphql";
import { position } from "polished";
import { useSocket } from "../socket";
import * as d3 from "d3";

type ToolMapRecord = {
  name: string;
  icon: React.ReactElement;
  tool: MapTool;
  MenuComponent: null | (() => React.ReactElement);
};

const BrushSettings = (): React.ReactElement => {
  const { state, setState } = React.useContext(BrushToolContext);

  const store = useCreateStore();
  useControls(
    () => ({
      brushSize: {
        type: LevaInputs.NUMBER,
        label: "Brush Size",
        value: state.brushSize.get(),
        onChange: (value, _, { initial }) => {
          if (initial) {
            return;
          }
          state.brushSize.set(value);
        },
        min: 1,
        max: 300,
        step: 1,
      },
      brushShape: levaPluginIconPicker({
        label: "Brush Shape",
        value: state.brushShape,
        options: [
          {
            value: BrushShape.square,
            icon: <Icon.Square boxSize="20px" />,
            label: "Square",
          },
          {
            value: BrushShape.circle,
            icon: <Icon.Circle boxSize="20px" />,
            label: "Circle",
          },
        ],
        onChange: (brushShape, _, { initial }) => {
          if (initial) {
            return;
          }
          setState((state) => ({
            ...state,
            brushShape,
          }));
        },
      }),
    }),
    { store },
    [state.brushShape]
  );

  return (
    <div
      onKeyDown={(ev) => {
        ev.stopPropagation();
      }}
    >
      <ThemedLevaPanel
        fill={true}
        titleBar={false}
        store={store}
        oneLineLabels
        hideCopyButton
      />
    </div>
  );
};

const AreaSelectSettings = (): React.ReactElement => {
  const { state, setState } = React.useContext(AreaSelectContext);

  const store = useCreateStore();
  useControls(
    () => ({
      snapToGrid: {
        type: LevaInputs.BOOLEAN,
        label: "Snap to Grid",
        value: state.snapToGrid,
        onChange: (value) =>
          setState((state) => ({ ...state, snapToGrid: value })),
      },
    }),
    { store },
    [state.snapToGrid]
  );

  return (
    <div
      onKeyDown={(ev) => {
        ev.stopPropagation();
      }}
    >
      <ThemedLevaPanel
        fill={true}
        titleBar={false}
        store={store}
        oneLineLabels
        hideCopyButton
      />
    </div>
  );
};

const ShroudRevealSettings = (): React.ReactElement => {
  const { state, setState } = React.useContext(BrushToolContext);
  return (
    <>
      <Toolbar.Item isActive={state.fogMode === FogMode.clear}>
        <Toolbar.Button
          onClick={() =>
            setState((state) => ({ ...state, fogMode: FogMode.clear }))
          }
        >
          <Icon.Eye boxSize="20px" />
          <Icon.Label>Reveal</Icon.Label>
        </Toolbar.Button>
      </Toolbar.Item>
      <Toolbar.Item isActive={state.fogMode === FogMode.shroud}>
        <Toolbar.Button
          onClick={() =>
            setState((state) => ({ ...state, fogMode: FogMode.shroud }))
          }
        >
          <Icon.EyeOff boxSize="20px" />
          <Icon.Label>Shroud</Icon.Label>
        </Toolbar.Button>
      </Toolbar.Item>
    </>
  );
};

const ShowGridSettingsPopupMapFragment = graphql`
  fragment dmMap_ShowGridSettingsPopupMapFragment on Map {
    id
    showGrid
    showGridToPlayers
  }
`;

const ShowGridSettingsPopupGridFragment = graphql`
  fragment dmMap_ShowGridSettingsPopupGridFragment on MapGrid {
    offsetX
    offsetY
    columnWidth
    columnHeight
    color
  }
`;

const MapUpdateGridMutation = graphql`
  mutation dmMap_mapUpdateGridMutation($input: MapUpdateGridInput!) {
    mapUpdateGrid(input: $input) {
      __typename
    }
  }
`;

const ShowGridSettingsPopup = React.memo(
  (props: {
    map: dmMap_ShowGridSettingsPopupMapFragment$key;
    grid: dmMap_ShowGridSettingsPopupGridFragment$key;
    enterConfigureGridMode: () => void;
  }) => {
    const [mapUpdateGrid] = useMutation<dmMap_mapUpdateGridMutation>(
      MapUpdateGridMutation
    );
    const map = useFragment(ShowGridSettingsPopupMapFragment, props.map);
    const grid = useFragment(ShowGridSettingsPopupGridFragment, props.grid);

    const [gridColor, setGridColor] = useResetState(() => grid.color, []);
    const [showGrid, setShowGrid] = useResetState(map.showGrid, []);
    const [showGridToPlayers, setShowGridToPlayers] = useResetState(
      map.showGridToPlayers,
      []
    );

    const syncState = useDebounceCallback(() => {
      mapUpdateGrid({
        variables: {
          input: {
            mapId: map.id,
            grid: {
              ...grid,
              color: gridColor,
            },
            showGrid,
            showGridToPlayers,
          },
        },
      });
    }, 300);

    return (
      <Toolbar.Popup>
        <VStack minWidth="300px" padding="3">
          <HStack width="100%" justifyContent="space-between">
            <Box>
              <Heading size="xs">Grid Settings</Heading>
            </Box>

            <Box>
              <Button.Tertiary small onClick={props.enterConfigureGridMode}>
                <span>Edit Grid </span>
                <Icon.Settings boxSize="12px" />
              </Button.Tertiary>
            </Box>
          </HStack>

          <FormControl
            display="flex"
            alignItems="center"
            justifyContent="space-between"
          >
            <FormLabel htmlFor="show-grid-toggle">Show Grid</FormLabel>
            <Switch
              id="show-grid-toggle"
              size="lg"
              isChecked={showGrid}
              onChange={(ev) => {
                setShowGrid(ev.target.checked);
                syncState();
              }}
            />
          </FormControl>
          <FormControl
            display="flex"
            alignItems="center"
            justifyContent="space-between"
          >
            <FormLabel htmlFor="show-grid-to-players-toggle">
              Show Grid to players
            </FormLabel>
            <Switch
              id="show-grid-to-players-toggle"
              size="lg"
              isChecked={showGridToPlayers}
              onChange={(ev) => {
                setShowGridToPlayers(ev.target.checked);
                syncState();
              }}
            />
          </FormControl>
          <FormControl>
            <FormLabel>Color</FormLabel>
            <ColorPickerInput
              color={gridColor}
              onChange={(color) => {
                setGridColor(color);
                syncState();
              }}
            />
          </FormControl>
        </VStack>
      </Toolbar.Popup>
    );
  }
);

const GridSettingButtonMapFragment = graphql`
  fragment dmMap_GridSettingButton_MapFragment on Map {
    ...dmMap_ShowGridSettingsPopupMapFragment
    grid {
      ...dmMap_ShowGridSettingsPopupGridFragment
    }
  }
`;

const GridSettingButton = (props: {
  enterConfigureGridMode: () => void;
  map: dmMap_GridSettingButton_MapFragment$key;
}): React.ReactElement => {
  const map = useFragment(GridSettingButtonMapFragment, props.map);
  const [showMenu, setShowMenu] = React.useState(false);
  const ref = React.useRef<null | HTMLLIElement>(null);
  useOnClickOutside<HTMLLIElement>(ref, () => {
    setShowMenu(false);
  });

  const [dialogNode, showDialog] = useConfirmationDialog();

  return (
    <Toolbar.Item isActive={map.grid != null} ref={ref}>
      <Toolbar.Button
        onClick={() => {
          if (!map.grid) {
            showDialog({
              header: "Configure Grid",
              body: "This map currently has no grid data. Do you wanna add a new grid using the grid configurator?",
              onConfirm: props.enterConfigureGridMode,
              confirmButtonText: "Add Grid",
            });
          } else {
            setShowMenu((showMenu) => !showMenu);
          }
        }}
      >
        <Icon.Grid boxSize="20px" />
        <Icon.Label>Grid</Icon.Label>
      </Toolbar.Button>
      {showMenu && map.grid ? (
        <ShowGridSettingsPopup
          map={map}
          grid={map.grid}
          enterConfigureGridMode={props.enterConfigureGridMode}
        />
      ) : null}
      {dialogNode}
    </Toolbar.Item>
  );
};

const TokenMarkerSettings = (): React.ReactElement => {
  const tokenMarkerContext = React.useContext(TokenMarkerContext);
  const configureGridContext = React.useContext(ConfigureGridMapToolContext);

  const updateRadiusRef = React.useRef<null | ((radius: number) => void)>(null);

  const store = useCreateStore();
  const [, set] = useControls(
    () => ({
      radius: {
        type: LevaInputs.NUMBER,
        label: "Size",
        value: tokenMarkerContext.state.tokenRadius.get(),
        step: 1,
        onChange: (value) => {
          tokenMarkerContext.state.tokenRadius.set(value);
        },
      },
      radiusShortcuts: buttonGroup({
        label: null,
        opts: {
          "0.25x": () => updateRadiusRef.current?.(0.25),
          "0.5x": () => updateRadiusRef.current?.(0.5),
          "1x": () => updateRadiusRef.current?.(1),
          "2x": () => updateRadiusRef.current?.(2),
          "3x": () => updateRadiusRef.current?.(3),
        },
      }),
      color: {
        type: LevaInputs.COLOR,
        label: "Color",
        value: tokenMarkerContext.state.tokenColor ?? "rgb(255, 255, 255)",
        onChange: (color: string) => {
          tokenMarkerContext.setState((state) => ({
            ...state,
            tokenColor: color,
          }));
        },
      },
      label: {
        type: LevaInputs.STRING,
        label: "Label",
        value: tokenMarkerContext.state.tokenText,
        optional: true,
        disabled: !tokenMarkerContext.state.includeTokenText,
        onChange: (tokenText, _, { initial, disabled, fromPanel }) => {
          if (initial || !fromPanel) {
            return;
          }

          tokenMarkerContext.setState((state) => ({
            ...state,
            includeTokenText: !disabled,
            tokenText: tokenText ?? state.tokenText,
          }));
        },
      },
      counter: {
        type: LevaInputs.NUMBER,
        label: "Counter",
        step: 1,
        min: 0,
        value: tokenMarkerContext.state.tokenCounter,
        optional: true,
        disabled: !tokenMarkerContext.state.includeTokenCounter,
        onChange: (tokenCounter, _, { initial, disabled, fromPanel }) => {
          if (initial || !fromPanel) {
            return;
          }

          tokenMarkerContext.setState((state) => ({
            ...state,
            includeTokenCounter: !disabled,
            tokenCounter: tokenCounter ?? state.tokenCounter,
          }));
        },
      },
    }),
    { store },
    [tokenMarkerContext.state]
  );

  React.useEffect(() => {
    updateRadiusRef.current = (factor) => {
      tokenMarkerContext.state.tokenRadius.set(
        (configureGridContext.state.columnWidth / 2) * factor * 0.9
      );
      set({
        radius: tokenMarkerContext.state.tokenRadius.get(),
      });
    };
  });

  return (
    <div
      onKeyDown={(ev) => {
        ev.stopPropagation();
      }}
    >
      <ThemedLevaPanel
        fill={true}
        titleBar={false}
        store={store}
        oneLineLabels
        hideCopyButton
      />
    </div>
  );
};

const dmTools: Array<ToolMapRecord> = [
  {
    name: "Move",
    icon: <Icon.Move boxSize="20px" />,
    tool: DragPanZoomMapTool,
    MenuComponent: null,
  },
  {
    name: "Brush",
    icon: <Icon.Pen boxSize="20px" />,
    tool: BrushMapTool,
    MenuComponent: BrushSettings,
  },
  {
    name: "Area",
    icon: <Icon.Crop boxSize="20px" />,
    tool: AreaSelectMapTool,
    MenuComponent: AreaSelectSettings,
  },
  {
    name: "Mark",
    icon: <Icon.Crosshair boxSize="20px" />,
    tool: MarkAreaMapTool,
    MenuComponent: null,
  },
  {
    name: "Token",
    icon: <Icon.Target boxSize="20px" />,
    tool: TokenMarkerMapTool,
    MenuComponent: TokenMarkerSettings,
  },
];

const ActiveDmMapToolModel = io.union([
  io.literal(DragPanZoomMapTool.id),
  io.literal(MarkAreaMapTool.id),
  io.literal(BrushMapTool.id),
  io.literal(AreaSelectMapTool.id),
  io.literal(MarkAreaMapTool.id),
  io.literal(TokenMarkerMapTool.id),
]);

const activeDmMapToolIdModel: PersistedStateModel<
  io.TypeOf<typeof ActiveDmMapToolModel>
> = {
  encode: identity,
  decode: (value) =>
    pipe(
      ActiveDmMapToolModel.decode(value),
      E.fold((err) => {
        if (value !== null) {
          console.log(
            "Error occurred while trying to decode value.\n" +
              JSON.stringify(err, null, 2)
          );
        }
        return DragPanZoomMapTool.id;
      }, identity)
    ),
};

const MapPingMutation = graphql`
  mutation dmMap_MapPingMutation($input: MapPingInput!) {
    mapPing(input: $input)
  }
`;

const DMMapFragment = graphql`
  fragment dmMap_DMMapFragment on Map {
    id
    grid {
      offsetX
      offsetY
      columnWidth
      columnHeight
    }
    ...mapView_MapFragment
    ...mapContextMenuRenderer_MapFragment
    ...dmMap_GridSettingButton_MapFragment
    ...dmMap_GridConfigurator_MapFragment
  }
`;

interface ModalProps {
  show: boolean;
  onClose: () => void;
  onViewClick?: (sessionname: string) => void;
}

const DownloadModal: React.FC<ModalProps> = ({
  show,
  onClose,
  onViewClick,
}) => {
  const [sessions, setSessions] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);
  const [isZoomModalVisible, setZoomModalVisible] = React.useState(false);
  const [showZoomFileSelector, setShowZoomFileSelector] = React.useState(false);
  const [zoomSession, setSelectedSession] = React.useState<string>();
  const [zoomFiles, setZoomFiles] = React.useState<string[]>([]);

  const openZoomModal = (session: string) => {
    setSelectedSession(session);
    setZoomModalVisible(true);
  };
  const closeZoomModal = () => setZoomModalVisible(false);
  const handleZoomDownloadComplete = () => {
    setZoomModalVisible(false);
    setShowZoomFileSelector(true);
  };

  React.useEffect(() => {
    if (show) {
      //Fetch the list of session folders when the modal is shown
      const fetchSessions = async () => {
        try {
          setLoading(true);
          const response = await fetch("/api/list-sessions");
          if (!response.ok) {
            throw new Error("Failed to fetch session list");
          }
          const data = await response.json();
          setSessions(data.sessions); //Store the session folder names
        } catch (error) {
          setError("Failed to load sessions");
          console.error("Error fetching sessions:", error);
        } finally {
          setLoading(false);
        }
      };

      fetchSessions();
    }
  }, [show]);

  const handleDownloadClick = async (session: string) => {
    try {
      const response = await fetch(`/api/download-folder/${session}`);
      if (!response.ok) {
        throw new Error("Failed to download folder");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${session}.zip`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading folder:", error);
      alert("Failed to download the folder. Please try again.");
    }
  };

  const handleViewClick = async (session: string) => {
    //added 3/11
    onViewClick?.(session);
    onClose();
    console.log("DownloadModal: View clicked for", session);
    /* try {
      console.log("Open show modal for " + session); // Tabby
    } catch (error) {
      console.error("Error displaying show Modal for session " + session);
      alert("Error displaying show Modal for session " + session);
    }*/
  };

  if (!show) return null;

  return (
    <div style={modalOverlayStyle}>
      <div style={modalStyle}>
        <h2>View & Download Sessions</h2>
        {loading ? (
          <p>Loading sessions...</p>
        ) : error ? (
          <p>{error}</p>
        ) : sessions.length === 0 ? (
          <p>No sessions available to view or download</p>
        ) : (
          <>
            {/* Conditionally render the ZoomModal */}
            {showZoomFileSelector && (
              <ZoomFileSelectorModal
                onClose={() => setShowZoomFileSelector(false)}
                onFilesSelected={(files) => {
                  // Save the selected filenames in state
                  setZoomFiles(files);
                }}
                session={zoomSession as string}
              />
            )}
            {isZoomModalVisible && (
              <ZoomModal
                onClose={closeZoomModal}
                onDownloadComplete={handleZoomDownloadComplete}
              />
            )}
            <p>Select a session to download:</p>
            <div style={listContainerStyle}>
              <ul style={{ padding: 0, listStyle: "none" }}>
                {sessions.map((session) => (
                  <li key={session} style={sessionItemStyle}>
                    <span style={{ flexGrow: 1 }}>{session}</span>
                    <button
                      style={smallButtonStyle}
                      onClick={() => handleViewClick(session)}
                    >
                      View
                    </button>
                    {/* New button to open the ZoomModal */}
                    <button
                      onClick={() => openZoomModal(session)}
                      style={smallButtonStyle}
                    >
                      Zoom
                    </button>
                    <button
                      style={smallButtonStyle}
                      onClick={() => handleDownloadClick(session)}
                    >
                      Download
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
        <button onClick={onClose} style={closeButtonStyle}>
          Close
        </button>
      </div>
    </div>
  );
};

interface ViewModalProps {
  show: boolean;
  onClose: () => void;
  sessionName: string;
  //mapName: string;
  onSessionSelect: (session: string) => void;
}

const ViewModal: React.FC<ViewModalProps> = ({
  show,
  onClose,
  sessionName,
  //mapName,
  onSessionSelect,
}) => {
  const [sessions, setSessions] = React.useState<string[]>([]);
  const [iterations, setIterations] = React.useState<string[]>([]);
  const [selectedIteration, setSelectedIteration] = React.useState<
    string | null
  >(null);
  const [settingsFile, setSettingsFile] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);

  const [isSidebarOpen, setIsSidebarOpen] = React.useState<boolean>(true);
  const [showMovementModal, setShowMovementModal] = React.useState(false);
  const [showHerdModal, setShowHerdModal] = React.useState(false);
  const [showWhiteboardModal, setShowWhiteboardModal] = React.useState(false);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  // Fetch sessions if modal is shown and no session is selected
  React.useEffect(() => {
    if (show && !sessionName) {
      const fetchSessions = async () => {
        try {
          setLoading(true);
          const response = await fetch("/api/list-sessions");
          if (!response.ok) {
            throw new Error("Failed to fetch sessions");
          }
          const data = await response.json();
          setSessions(data.sessions);
        } catch (err) {
          console.error("Error fetching sessions:", err);
          setError("Failed to load sessions");
        } finally {
          setLoading(false);
        }
      };
      fetchSessions();
    }
  }, [show, sessionName]);

  // When a session is selected, fetch its iterations
  React.useEffect(() => {
    if (show && sessionName) {
      const fetchIterations = async () => {
        try {
          setLoading(true);
          const response = await fetch(`/api/list-iterations/${sessionName}`);
          if (!response.ok) {
            throw new Error(`Failed to fetch iterations for ${sessionName}`);
          }
          const data = await response.json();

          const filteredIterations = data.iterations.filter(
            (iteration: string) => iteration.toLowerCase() !== "notes"
          );
          setIterations(filteredIterations);

          if (filteredIterations.length > 0) {
            setSelectedIteration(filteredIterations[0]);
          }
        } catch (err) {
          console.error("Error fetching iterations:", err);
          setError("Failed to load iterations");
        } finally {
          setLoading(false);
        }
      };
      fetchIterations();
    }
  }, [show, sessionName]);

  //When the selected iteration changes, fetch settings.json and draw the map with tokens
  React.useEffect(() => {
    if (show && sessionName && selectedIteration) {
      const drawMapWithTokens = async () => {
        if (!selectedIteration || !sessionName) {
          console.log("Missing required props for drawing:", {
            selectedIteration,
            sessionName,
          });
          return;
        }
        try {
          const settingsUrl = `/api/iteration/${sessionName}/${selectedIteration}/settings.json`;
          console.log("Fetching settings from:", settingsUrl);
          const settingsResponse = await fetch(settingsUrl);
          if (!settingsResponse.ok) {
            throw new Error("Failed to fetch settings.json");
          }
          const settings = await settingsResponse.json();
          console.log("Fetched settings:", settings);

          const dynamicMapName = settings.mapPath || "map.jpg";
          const mapImageUrl = `/api/iteration/${sessionName}/${selectedIteration}/${dynamicMapName}`;
          console.log("Loading map image from:", mapImageUrl);

          const mapImage = new Image();
          mapImage.src = mapImageUrl;

          mapImage.onload = () => {
            const canvas = canvasRef.current;

            if (!canvas) {
              console.error("Canvas element is not available.");
              return;
            }
            //creating the canvas so the map can be drawn on
            const ctx = canvas.getContext("2d");

            if (!ctx) {
              console.error("Unable to get 2D context from canvas.");
              return;
            }

            //clears the canvas
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            const scale = Math.min(
              canvas.width / mapImage.naturalWidth,
              canvas.height / mapImage.naturalHeight
            );

            //calculate scale factor to maintain aspect ratio
            const drawWidth = mapImage.naturalWidth * scale;
            const drawHeight = mapImage.naturalHeight * scale;

            //calculate offsets to center the image in the canvas
            const offsetX = (canvas.width - drawWidth) / 2;
            const offsetY = (canvas.height - drawHeight) / 2;

            //save the current context state
            ctx.save();
            //translate and scale the canvas so that drawing operations use the iamges original coordinate system
            ctx.translate(offsetX, offsetY);
            ctx.scale(scale, scale);

            //drawing the image at its original dimensions
            ctx.drawImage(
              mapImage,
              0,
              0,
              mapImage.naturalWidth,
              mapImage.naturalHeight
            );
            console.log("Map image drawn to canvas with transformation.");

            //drawing a grid overlay using the original coordinates
            const gridSpacing = 50;
            ctx.strokeStyle = "rgba(0, 0, 0, 0.1)";
            ctx.lineWidth = 1;
            for (let x = 0; x <= mapImage.naturalWidth; x += gridSpacing) {
              ctx.beginPath();
              ctx.moveTo(x, 0);
              ctx.lineTo(x, mapImage.naturalHeight);
              ctx.stroke();
            }
            for (let y = 0; y <= mapImage.naturalHeight; y += gridSpacing) {
              ctx.beginPath();
              ctx.moveTo(0, y);
              ctx.lineTo(mapImage.naturalWidth, y);
              ctx.stroke();
            }

            if (settings.tokens && Array.isArray(settings.tokens)) {
              settings.tokens.forEach((token: any) => {
                //if the token contains an image
                if (token.tokenImageId) {
                  //if token with image has a label
                  if (token.label) {
                    const nonscaledFontSize = 14;
                    ctx.font = `Bold ${nonscaledFontSize / scale}px Roboto`;
                    ctx.textAlign = "center";
                    ctx.textBaseline = "bottom";

                    const textMetrics = ctx.measureText(token.label);
                    const textWidth = textMetrics.width;
                    const textHeight = nonscaledFontSize / scale;

                    ctx.fillStyle = "white";
                    ctx.fillRect(
                      token.x - textWidth / 2 - (textWidth * 0.05) / 2,
                      token.y + (token.radius - textHeight * 0.1),
                      textWidth + textWidth * 0.05,
                      textHeight + textHeight * 0.05
                    );

                    ctx.fillStyle = "#000";
                    ctx.textAlign = "center";
                    ctx.fillText(
                      token.label,
                      token.x,
                      token.y +
                        token.radius +
                        (token.radius / 2 - textHeight * 0.05)
                    );
                  }

                  const tokenImage = new Image();
                  //tokenImage.src =
                  //circle for token is created
                  ctx.beginPath();
                  ctx.arc(token.x, token.y, token.radius, 0, Math.PI * 2);
                  ctx.fillStyle = token.color;
                  ctx.fill();
                  ctx.closePath();
                }
                //if the token doesnt contain an image draw circle only
                else {
                  ctx.beginPath();
                  ctx.arc(token.x, token.y, token.radius, 0, Math.PI * 2);
                  ctx.fillStyle = token.color;
                  ctx.fill();
                  ctx.closePath();

                  if (token.label) {
                    const nonscaledFontSize = 14;
                    ctx.font = `Bold ${nonscaledFontSize / scale}px Roboto`;
                    ctx.fillStyle = "#000";
                    ctx.textAlign = "center";
                    ctx.textBaseline = "middle";
                    ctx.fillText(token.label, token.x, token.y);
                  }
                }
              });
              console.log("Tokens drawn on canvas.");
            } else {
              console.log("No tokens found in settings.");
            }

            ctx.restore();
          };

          mapImage.onerror = (error) => {
            console.error("Error loading map image:", error);
          };
        } catch (error) {
          console.error("Error in drawMapWithTokens:", error);
        }
      };
      drawMapWithTokens();
    }
  }, [show, selectedIteration, sessionName]);

  if (!show) return null;

  return (
    <div style={viewModalOverlayStyle}>
      <div style={viewModalStyle}>
        {/* Button that opens the movement graph */}
        <button
          onClick={() => setShowMovementModal(true)}
          style={{
            position: "absolute",
            left: "85%",
            top: "10px",
            cursor: "pointer",
            border: "2px solid #ccc",
            padding: "5px",
          }}
        >
          Open Movement Graph
        </button>

        {/* Button that opens herd graph */}
        <button
          onClick={() => setShowHerdModal(true)}
          style={{
            position: "absolute",
            left: "85%",
            top: "50px",
            cursor: "pointer",
            border: "2px solid #ccc",
            padding: "5px",
          }}
        >
          Open Herd Graph
        </button>

        {/* Button that opens the whiteboard iterations */}
        <button
          onClick={() => setShowWhiteboardModal(true)}
          style={{
            position: "absolute",
            left: "85%",
            top: "90px",
            cursor: "pointer",
            border: "2px solid #ccc",
            padding: "5px",
          }}
        >
          Open Whiteboard Iterations
        </button>

        {/* A button to toggle the sidebar */}
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          style={{
            position: "absolute",
            left: isSidebarOpen ? "225px" : "10px",
            cursor: "pointer",
            overflow: "hidden",
            transition: "width 0.3s ease",
          }}
        >
          {isSidebarOpen ? "Close" : "Open"}
        </button>

        <div style={{ display: "flex", height: "calc(100% - 40px)" }}>
          {/* Left Sidebar */}
          {isSidebarOpen && (
            <div
              style={{
                width: "200px",
                borderRight: "1px solid #ccc",
                overflowY: "auto",
                padding: "10px",
              }}
            >
              {loading ? (
                <p>Loading...</p>
              ) : error ? (
                <p>{error}</p>
              ) : !sessionName ? (
                sessions.length === 0 ? (
                  <p>No sessions available</p>
                ) : (
                  <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                    {sessions.map((session) => (
                      <li key={session} style={sessionItemStyle}>
                        <span style={{ flexGrow: 1 }}>{session}</span>
                        <button
                          style={smallButtonStyle}
                          onClick={() => onSessionSelect(session)}
                        >
                          Select
                        </button>
                      </li>
                    ))}
                  </ul>
                )
              ) : iterations.length === 0 ? (
                <p>No iterations available</p>
              ) : (
                <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                  {iterations.map((iteration) => (
                    <li key={iteration} style={sessionItemStyle}>
                      <button
                        style={smallButtonStyle}
                        onClick={() => setSelectedIteration(iteration)}
                      >
                        {iteration}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          {/* Right Panel */}
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              padding: "10px",
            }}
          >
            {sessionName ? (
              <>
                <h2>{sessionName}</h2>
                {selectedIteration ? (
                  <>
                    <h3>{selectedIteration}</h3>
                    <canvas
                      ref={canvasRef}
                      width={800}
                      height={600}
                      style={{
                        maxWidth: "100%",
                        height: "calc(100% - 40px)",
                        objectFit: "contain",
                      }}
                    />
                  </>
                ) : (
                  <p>Please select an iteration</p>
                )}
              </>
            ) : (
              <p>Please select a session</p>
            )}
          </div>
        </div>
        <button onClick={onClose} style={viewCloseButtonStyle}>
          Close
        </button>
      </div>
      {showMovementModal && (
        <MovementGraphModal
          show={showMovementModal}
          onClose={() => setShowMovementModal(false)}
          sessionName={sessionName}
        />
      )}
      {showHerdModal && (
        <HerdGraphModal
          show={showHerdModal}
          onClose={() => setShowHerdModal(false)}
          sessionName={sessionName}
        />
      )}
      {showWhiteboardModal && (
        <WhiteboardModal
          show={showWhiteboardModal}
          onClose={() => setShowWhiteboardModal(false)}
          sessionName={sessionName}
        />
      )}
    </div>
  );
};

interface ClearModalProps {
  show: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

const ClearModal: React.FC<ClearModalProps> = ({
  show,
  onClose,
  onConfirm,
}) => {
  const [input, setInput] = React.useState("");

  const requiredPhrase = "CLEAR SESSION";
  const isConfirmed = input.trim().toUpperCase() === requiredPhrase;

  if (!show) return null;

  const modalBackdropStyle: React.CSSProperties = {
    position: "fixed",
    top: 0,
    left: 0,
    width: "100vw",
    height: "100vh",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  };

  const modalStyle: React.CSSProperties = {
    backgroundColor: "white",
    padding: "30px",
    borderRadius: "10px",
    maxWidth: "400px",
    width: "90%",
    textAlign: "center",
  };

  const buttonStyle: React.CSSProperties = {
    margin: "0 10px",
    padding: "10px 15px",
    borderRadius: "6px",
    border: "none",
    cursor: "pointer",
  };

  const inputStyle: React.CSSProperties = {
    marginTop: "20px",
    padding: "10px",
    width: "100%",
    borderRadius: "4px",
    border: "1px solid #ccc",
    textAlign: "center",
  };

  const handleConfirm = async () => {
    await onConfirm(); // Triggers the API call in the parent
    setInput(""); // reset the input after it finishes
  };

  return (
    <div style={modalBackdropStyle}>
      <div style={modalStyle}>
        <p>
          Type <strong>{requiredPhrase}</strong> to confirm:
        </p>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          style={inputStyle}
          placeholder="Enter confirmation phrase"
        />
        <div style={{ marginTop: "20px" }}>
          <button
            style={{ ...buttonStyle, opacity: isConfirmed ? 1 : 0.5 }}
            onClick={handleConfirm}
            disabled={!isConfirmed}
          >
            Yes, clear it
          </button>
          <button style={buttonStyle} onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

interface MovementGraphModalProps {
  show: boolean;
  onClose: () => void;
  sessionName: string;
}

const MovementGraphModal: React.FC<MovementGraphModalProps> = ({
  show,
  onClose,
  sessionName,
}) => {
  const svgRef = React.useRef<HTMLDivElement>(null);
  const [tokenData, setTokenData] = React.useState<any>(null);
  const [backgroundImage, setBackgroundImage] = React.useState<string | null>(
    null
  );
  const [bgDimensions, setBgDimensions] = React.useState<{
    width: number;
    height: number;
  } | null>(null);
  const [currentIteration, setCurrentIteration] = React.useState<number>(1);
  const [iterationNames, setIterationNames] = React.useState<string[]>([]);

  // Grab the token data from all iterations
  React.useEffect(() => {
    if (show && sessionName) {
      const fetchVisualizationData = async () => {
        try {
          const response = await fetch(`/api/grabIterationData/visualData`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionName }),
          });

          if (!response.ok) {
            throw new Error("Failed to fetch visualization data");
          }

          const json = await response.json();
          setTokenData(json.data);
        } catch (error) {
          console.error("Error fetching visualization data:", error);
        }
      };
      fetchVisualizationData();
    }
  }, [show, sessionName]);

  // Used to have iteration name displayed and clicked through
  React.useEffect(() => {
    if (tokenData && Object.keys(tokenData).length > 0) {
      const tokenKey = Object.keys(tokenData)[0];
      const movements = tokenData[tokenKey].movements;

      if (movements && movements.length > 0) {
        const iterationDisplayNames = movements.map((m: any) => m.iteration);
        setIterationNames(iterationDisplayNames);
        setCurrentIteration(1);
      }
    }
  }, [tokenData]);

  // Grab the background image
  React.useEffect(() => {
    if (show && sessionName) {
      const fetchImage = async () => {
        try {
          const response = await fetch(
            `/api/fetch/iterationMap?sessionName=${encodeURIComponent(
              sessionName
            )}`
          );

          if (!response.ok) {
            throw new Error("Failed to fetch background image");
          }

          const json = await response.json();
          setBackgroundImage(json.url);
        } catch (error) {
          console.error("Error fetching background image:", error);
        }
      };
      fetchImage();
    }
  }, [show, sessionName]);

  // Manipulate the image dimensions to align with tokens
  React.useEffect(() => {
    if (!backgroundImage) return;
    const img = new Image();
    img.src = backgroundImage;
    img.onload = () => {
      setBgDimensions({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = (err) => {
      console.error("Error loading background image", err);
    };
  }, [backgroundImage]);

  // Create the graph
  React.useEffect(() => {
    if (
      !show ||
      !tokenData ||
      Object.keys(tokenData).length === 0 ||
      !svgRef.current ||
      !backgroundImage ||
      !bgDimensions
    )
      return;

    // Graph dimensions
    const svgWidth = 800;
    const svgHeight = 800;
    const margin = { top: 40, right: 40, bottom: 40, left: 40 };
    const width = svgWidth - margin.left - margin.right;
    const height = svgHeight - margin.top - margin.bottom;

    d3.select(svgRef.current).select("svg").remove();

    // Make SVG element
    const svg = d3
      .select(svgRef.current)
      .append("svg")
      .attr("width", svgWidth)
      .attr("height", svgHeight)
      .attr("viewBox", `0 0 ${svgWidth} ${svgHeight}`)
      .append("g")
      .attr("transform", `translate(${margin.left}, ${margin.top})`);

    // The scale of graph uses image dimensions
    const xScale = d3
      .scaleLinear()
      .domain([0, bgDimensions.width])
      .range([0, width]);
    const yScale = d3
      .scaleLinear()
      .domain([0, bgDimensions.height])
      .range([0, height]);

    // image
    svg
      .append("image")
      .attr("xlink:href", backgroundImage)
      .attr("x", 0)
      .attr("y", 0)
      .attr("width", width)
      .attr("height", height)
      .attr("preserveAspectRatio", "xMidYMid slice")
      .attr("opacity", 0.7);

    // Create gridlines using ticks at every 100 intervals (relative to image dimensions)
    const xTicks = d3.range(0, bgDimensions.width + 1, 100);
    const yTicks = d3.range(0, bgDimensions.height + 1, 100);

    const xGrid = d3
      .axisBottom(xScale)
      .tickValues(xTicks)
      .tickSize(-height)
      .tickFormat(() => "");
    svg
      .append("g")
      .attr("transform", `translate(0, ${height})`)
      .call(xGrid)
      .selectAll("line")
      .attr("stroke", "#ddd");

    const yGrid = d3
      .axisLeft(yScale)
      .tickValues(yTicks)
      .tickSize(-width)
      .tickFormat(() => "");
    svg.append("g").call(yGrid).selectAll("line").attr("stroke", "#ddd");

    // Create axes
    const xAxis = d3.axisBottom(xScale).tickValues(xTicks);
    const yAxis = d3.axisLeft(yScale).tickValues(yTicks);

    svg.append("g").attr("transform", `translate(0, ${height})`).call(xAxis);
    svg.append("g").call(yAxis);

    // Draw the token movements, based on currentIteration
    Object.values(tokenData).forEach((token: any) => {
      const visiblePoints = token.movements.slice(0, currentIteration);
      if (!visiblePoints || visiblePoints.length === 0) return;

      const lineGenerator = d3
        .line()
        .x((d: any) => xScale(+d.x))
        .y((d: any) => yScale(+d.y));

      svg
        .append("path")
        .datum(visiblePoints)
        .attr("d", lineGenerator)
        .attr("stroke", token.color)
        .attr("fill", "none")
        .attr("stroke-width", 2);

      svg
        .selectAll(`.token-${token.id}`)
        .data(visiblePoints)
        .enter()
        .append("circle")
        .attr("cx", (d: any) => xScale(+d.x))
        .attr("cy", (d: any) => yScale(+d.y))
        .attr("r", 4)
        .attr("fill", token.color);
    });

    // Creates a legend in top-left
    const legend = svg.append("g").attr("transform", "translate(10,10)");
    Object.values(tokenData).forEach((token: any, i: number) => {
      legend
        .append("rect")
        .attr("x", 0)
        .attr("y", i * 25)
        .attr("width", 20)
        .attr("height", 20)
        .attr("fill", token.color);
      legend
        .append("text")
        .attr("x", 25)
        .attr("y", i * 25 + 15)
        .text(token.label)
        .attr("font-size", "12px");
    });
  }, [show, tokenData, backgroundImage, bgDimensions, currentIteration]);

  if (!show) return null;

  return (
    <div style={movementModalOverlayStyle}>
      <div style={movementModalStyle}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            padding: "10px",
          }}
        >
          <h2>Movement Graph for {sessionName}</h2>
          <div>
            <button onClick={onClose}>Close</button>
            <div
              style={{
                position: "absolute",
                top: 60,
                left: "50%",
                transform: "translateX(-50%)",
                display: "flex",
                gap: "10px",
              }}
            >
              <button
                onClick={() =>
                  setCurrentIteration((prev) => Math.max(prev - 1, 1))
                }
                style={{
                  marginRight: "5px",
                  border: "2px solid #ccc",
                  padding: "3px",
                }}
              >
                Prev
              </button>
              <span style={{ fontSize: "14px", fontWeight: "bold" }}>
                Iteration: {iterationNames[currentIteration - 1] || "N/A"}
              </span>
              <button
                onClick={() => {
                  if (iterationNames.length > 0) {
                    setCurrentIteration((prev) =>
                      Math.min(prev + 1, iterationNames.length)
                    );
                  }
                }}
                style={{
                  marginLeft: "5px",
                  border: "2px solid #ccc",
                  padding: "3px",
                }}
              >
                Next
              </button>
            </div>
          </div>
        </div>
        <div ref={svgRef} style={{ width: "800px", height: "800px" }} />{" "}
        {/* Graph */}
      </div>
    </div>
  );
};

const HerdGraphModal: React.FC<MovementGraphModalProps> = ({
  show,
  onClose,
  sessionName,
}) => {
  const svgRef = React.useRef<HTMLDivElement>(null);
  const [tokenData, setTokenData] = React.useState<any>(null);
  const [backgroundImage, setBackgroundImage] = React.useState<string | null>(
    null
  );
  const [bgDimensions, setBgDimensions] = React.useState<{
    width: number;
    height: number;
  } | null>(null);
  const [currentIteration, setCurrentIteration] = React.useState<number>(1);
  const [iterationNames, setIterationNames] = React.useState<string[]>([]);
  const [selectedTokens, setSelectedTokens] = React.useState<string[]>([]);
  const [showCenter, setShowCenter] = React.useState<boolean>(true);

  // Grab the token data from all iterations
  React.useEffect(() => {
    if (show && sessionName) {
      const fetchVisualizationData = async () => {
        try {
          const response = await fetch(`/api/grabIterationData/visualData`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionName }),
          });

          if (!response.ok) {
            throw new Error("Failed to fetch visualization data");
          }

          const json = await response.json();
          setTokenData(json.data);
          setSelectedTokens(Object.keys(json.data));
        } catch (error) {
          console.error("Error fetching visualization data:", error);
        }
      };
      fetchVisualizationData();
    }
  }, [show, sessionName]);

  // Sets up iteration names for display
  React.useEffect(() => {
    if (tokenData && Object.keys(tokenData).length > 0) {
      const tokenKey = Object.keys(tokenData)[0];
      const movements = tokenData[tokenKey].movements;

      if (movements && movements.length > 0) {
        const iterationDisplayNames = movements.map((m: any) => m.iteration);
        setIterationNames(iterationDisplayNames);
        setCurrentIteration(1);
      }
    }
  }, [tokenData]);

  // Grab the background image
  React.useEffect(() => {
    if (show && sessionName) {
      const fetchImage = async () => {
        try {
          const response = await fetch(
            `/api/fetch/iterationMap?sessionName=${encodeURIComponent(
              sessionName
            )}`
          );

          if (!response.ok) {
            throw new Error("Failed to fetch background image");
          }

          const json = await response.json();
          setBackgroundImage(json.url);
        } catch (error) {
          console.error("Error fetching background image:", error);
        }
      };
      fetchImage();
    }
  }, [show, sessionName]);

  // Manipulate the image dimensions to align with tokens
  React.useEffect(() => {
    if (!backgroundImage) return;
    const img = new Image();
    img.src = backgroundImage;
    img.onload = () => {
      setBgDimensions({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = (err) => {
      console.error("Error loading background image", err);
    };
  }, [backgroundImage]);

  // Gets the information of tokens that are selected
  const selectedPositions = React.useMemo(() => {
    if (!tokenData) return [];
    return selectedTokens
      .map((tokenId) => {
        const token = tokenData[tokenId];
        if (!token || !token.movements || token.movements.length === 0)
          return null;
        return (
          token.movements[currentIteration - 1] ||
          token.movements[token.movements.length - 1]
        );
      })
      .filter((pt) => pt !== null)
      .map((pt: any) => ({ x: +pt.x, y: +pt.y }));
  }, [tokenData, selectedTokens, currentIteration]);

  const center = React.useMemo(() => {
    // Averages the x and y to find center coords
    if (selectedPositions.length === 0) {
      return null;
    }

    const average = selectedPositions.reduce(
      (acc, pt) => ({
        x: acc.x + pt.x,
        y: acc.y + pt.y,
      }),
      { x: 0, y: 0 }
    );
    return {
      x: average.x / selectedPositions.length,
      y: average.y / selectedPositions.length,
    };
  }, [selectedPositions]);

  // Create the graph
  React.useEffect(() => {
    if (
      !show ||
      !tokenData ||
      Object.keys(tokenData).length === 0 ||
      !svgRef.current ||
      !backgroundImage ||
      !bgDimensions
    )
      return;

    // Graph dimensions
    const svgWidth = 800;
    const svgHeight = 800;
    const margin = { top: 40, right: 40, bottom: 40, left: 40 };
    const width = svgWidth - margin.left - margin.right;
    const height = svgHeight - margin.top - margin.bottom;

    d3.select(svgRef.current).select("svg").remove();

    // Make SVG element
    const svg = d3
      .select(svgRef.current)
      .append("svg")
      .attr("width", svgWidth)
      .attr("height", svgHeight)
      .attr("viewBox", `0 0 ${svgWidth} ${svgHeight}`)
      .append("g")
      .attr("transform", `translate(${margin.left}, ${margin.top})`);

    // The scale of graph uses image dimensions
    const xScale = d3
      .scaleLinear()
      .domain([0, bgDimensions.width])
      .range([0, width]);
    const yScale = d3
      .scaleLinear()
      .domain([0, bgDimensions.height])
      .range([0, height]);

    // image
    svg
      .append("image")
      .attr("xlink:href", backgroundImage)
      .attr("x", 0)
      .attr("y", 0)
      .attr("width", width)
      .attr("height", height)
      .attr("preserveAspectRatio", "xMidYMid slice")
      .attr("opacity", 0.7);

    // Create gridlines using ticks at every 100 intervals (relative to image dimensions)
    const xTicks = d3.range(0, bgDimensions.width + 1, 100);
    const yTicks = d3.range(0, bgDimensions.height + 1, 100);

    const xGrid = d3
      .axisBottom(xScale)
      .tickValues(xTicks)
      .tickSize(-height)
      .tickFormat(() => "");
    svg
      .append("g")
      .attr("transform", `translate(0, ${height})`)
      .call(xGrid)
      .selectAll("line")
      .attr("stroke", "#ddd");

    const yGrid = d3
      .axisLeft(yScale)
      .tickValues(yTicks)
      .tickSize(-width)
      .tickFormat(() => "");
    svg.append("g").call(yGrid).selectAll("line").attr("stroke", "#ddd");

    // Create axes
    const xAxis = d3.axisBottom(xScale).tickValues(xTicks);
    const yAxis = d3.axisLeft(yScale).tickValues(yTicks);
    svg.append("g").attr("transform", `translate(0, ${height})`).call(xAxis);
    svg.append("g").call(yAxis);

    // Draw lines between selected tokens
    if (selectedPositions.length > 1) {
      for (let i = 0; i < selectedPositions.length - 1; i++) {
        // Ensures points connected to all other points
        for (let j = i + 1; j < selectedPositions.length; j++) {
          svg
            .append("line")
            .attr("x1", xScale(selectedPositions[i].x))
            .attr("y1", yScale(selectedPositions[i].y))
            .attr("x2", xScale(selectedPositions[j].x))
            .attr("y2", yScale(selectedPositions[j].y))
            .attr("stroke", "blue")
            .attr("stroke-width", 2)
            .attr("opacity", 0.8);
        }
      }
    }

    // Only the selected tokens get showed
    selectedPositions.forEach((pt, index) => {
      const token = tokenData[selectedTokens[index]];
      svg
        .append("circle")
        .attr("cx", xScale(pt.x))
        .attr("cy", yScale(pt.y))
        .attr("r", 8)
        .attr("fill", token.color);
    });

    // Centerpoint
    if (showCenter && center) {
      svg
        .append("circle")
        .attr("cx", xScale(center.x))
        .attr("cy", yScale(center.y))
        .attr("r", 10)
        .attr("fill", "yellow")
        .attr("stroke", "black")
        .attr("stroke-width", 2);

      svg
        .append("text")
        .attr("x", xScale(center.x))
        .attr("y", yScale(center.y) - 15)
        .attr("text-anchor", "middle")
        .attr("font-size", "12px")
        .attr("fill", "black")
        .text("Center");
    }
    // Creates a legend in top-left
    const legend = svg.append("g").attr("transform", "translate(10,10)");
    selectedTokens.forEach((tokenId, i) => {
      const token = tokenData[tokenId];
      if (!token) return;
      legend
        .append("rect")
        .attr("x", 0)
        .attr("y", i * 25)
        .attr("width", 20)
        .attr("height", 20)
        .attr("fill", token.color);
      legend
        .append("text")
        .attr("x", 25)
        .attr("y", i * 25 + 15)
        .text(token.label)
        .attr("font-size", "12px");
    });
  }, [
    show,
    tokenData,
    backgroundImage,
    bgDimensions,
    currentIteration,
    selectedTokens,
    center,
    showCenter,
  ]);

  // togglable selection of tokens
  const toggleTokenSelection = (tokenId: string) => {
    setSelectedTokens((prev) =>
      prev.includes(tokenId)
        ? prev.filter((id) => id !== tokenId)
        : [...prev, tokenId]
    );
  };

  // Left sidebar
  const leftSidebar = () => {
    if (!tokenData) return null;
    const tokenIds = Object.keys(tokenData);

    return (
      <div
        style={{
          flex: "0 0 150px",
          borderRight: "1px solid #ccc",
          padding: "10px",
          overflowY: "auto",
          height: "100%",
        }}
      >
        <label
          style={{
            display: "flex",
            alignItems: "center",
            marginBottom: "10px",
          }}
        >
          <input
            type="checkbox"
            checked={showCenter}
            onChange={() => setShowCenter((prev) => !prev)}
            style={{ marginRight: "5px" }}
          />
          Center
        </label>

        <h3 style={{ marginTop: 0 }}>Tokens</h3>
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {tokenIds.map((tokenId) => (
            <li
              key={tokenId}
              style={{ marginBottom: "8px", cursor: "pointer" }}
            >
              <label style={{ display: "flex", alignItems: "center" }}>
                <input // Checkbox to allow selection of tokens that are to be displayed
                  type="checkbox"
                  checked={selectedTokens.includes(tokenId)}
                  onChange={() => toggleTokenSelection(tokenId)}
                  style={{ marginRight: "5px" }}
                />
                {tokenData[tokenId].label}
              </label>
            </li>
          ))}
        </ul>
      </div>
    );
  };

  // Right sidebar
  const rightSidebar = () => {
    const pairDistances = React.useMemo(() => {
      const distances: { key: string; label: string; distance: number }[] = []; // Calculates the hypotenuse between 2 points and displays it
      for (let i = 0; i < selectedTokens.length - 1; i++) {
        for (let j = i + 1; j < selectedTokens.length; j++) {
          const token1 = tokenData[selectedTokens[i]];
          const token2 = tokenData[selectedTokens[j]];

          if (!token1 || !token2 || !token1.movements || !token2.movements)
            continue;

          const point1 =
            token1.movements[currentIteration - 1] ||
            token1.movements[token1.movements.length - 1];
          const point2 =
            token2.movements[currentIteration - 1] ||
            token2.movements[token2.movements.length - 1];
          const dx = +point2.x - +point1.x;
          const dy = +point2.y - +point1.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          distances.push({
            key: `${selectedTokens[i]} - ${selectedTokens[j]}`,
            label: `${token1.label} to ${token2.label}`,
            distance,
          });
        }
      }
      return distances;
    }, [selectedTokens, tokenData, currentIteration]);

    return (
      <div
        style={{
          flex: "0 0 275px",
          borderLeft: "1px solid #ccc",
          padding: "10px",
          overflowY: "auto",
          height: "100%",
        }}
      >
        <h3 style={{ marginTop: 0 }}>Center Point</h3>
        {showCenter && center ? (
          <div style={{ marginBottom: "15px" }}>
            <p>
              X: {center.x.toFixed(2)} <strong>|</strong> Y:{" "}
              {center.y.toFixed(2)}
            </p>
          </div>
        ) : (
          <p style={{ marginBottom: "15px" }}>N/A</p>
        )}
        <h3 style={{ marginTop: 0 }}>Distances</h3>
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {pairDistances.map((pd) => (
            <li key={pd.key} style={{ marginBottom: "6px" }}>
              {pd.label}: {pd.distance.toFixed(2)}
            </li>
          ))}
        </ul>
      </div>
    );
  };

  if (!show) return null;

  return (
    <div style={herdModalOverlayStyle}>
      <div style={herdModalStyle}>
        <div
          style={{ display: "flex", flexDirection: "column", height: "100%" }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "10px",
            }}
          >
            <h2>Herd Graph for {sessionName}</h2>
            <button onClick={onClose}>Close</button>
          </div>
          <div
            style={{
              display: "flex",
              flex: 1,
              width: "1225px",
              height: "800px",
            }}
          >
            {leftSidebar()}
            <div style={{ flex: 1, position: "relative" }}>
              <div
                style={{
                  position: "absolute",
                  top: -5,
                  left: "50%",
                  transform: "translateX(-50%)",
                  display: "flex",
                  gap: "10px",
                }}
              >
                <button
                  onClick={() =>
                    setCurrentIteration((prev) => Math.max(prev - 1, 1))
                  }
                  style={{
                    marginRight: "5px",
                    border: "2px solid #ccc",
                    padding: "3px",
                  }}
                >
                  Prev
                </button>
                <span style={{ fontSize: "14px", fontWeight: "bold" }}>
                  Iteration: {iterationNames[currentIteration - 1] || "N/A"}
                </span>
                <button
                  onClick={() => {
                    if (iterationNames.length > 0) {
                      setCurrentIteration((prev) =>
                        Math.min(prev + 1, iterationNames.length)
                      );
                    }
                  }}
                  style={{
                    marginLeft: "5px",
                    border: "2px solid #ccc",
                    padding: "3px",
                  }}
                >
                  Next
                </button>
              </div>
              <div ref={svgRef} style={{ width: "800px", height: "800px" }} />{" "}
              {/* Graph */}
            </div>
            {rightSidebar()}
          </div>
        </div>
      </div>
    </div>
  );
};

const WhiteboardModal: React.FC<MovementGraphModalProps> = ({
  show,
  onClose,
  sessionName,
}) => {
  const [images, setImages] = React.useState<string[]>([]);
  const [selectedImage, setSelectedImage] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);

  // Gets the whiteboard images from the session
  React.useEffect(() => {
    if (sessionName) {
      setLoading(true);
      const fetchImages = async () => {
        try {
          const response = await fetch(
            `/api/fetch/whiteboardIterations?sessionName=${encodeURIComponent(
              sessionName
            )}`
          );
          if (!response.ok) {
            throw new Error("Failed to fetch whiteboard images");
          }

          const data = await response.json();
          setImages(data.images || []);

          if (data.images && data.images.length > 0) {
            setSelectedImage(data.images[0]);
          } else {
            setSelectedImage("");
          }
        } catch (error) {
          console.error("Error fetching whiteboard images:", error);
          setError("Error fetching images");
        } finally {
          setLoading(false);
        }
      };
      fetchImages();
    }
  }, [sessionName]);

  if (!show) return null;

  const imageUrl =
    sessionName && selectedImage
      ? `/research/saved/${sessionName}/whiteboard/${selectedImage}`
      : "";

  return (
    <div style={whiteboardModalOverlayStyle}>
      <div style={whiteboardModalStyle}>
        <div style={{ display: "flex", height: "calc(100% - 40px)" }}>
          {/* Left Sidebar */}
          <div
            style={{
              width: "225px",
              borderRight: "1px solid #ccc",
              overflowY: "auto",
              padding: "10px",
            }}
          >
            {loading ? (
              <p>Loading...</p>
            ) : error ? (
              <p>{error}</p>
            ) : (
              <ul style={{ listStyle: "none", padding: 10, margin: 0 }}>
                {images.map((img) => (
                  <li
                    key={img}
                    style={{ ...whiteboardImgStyle, cursor: "pointer" }}
                    onClick={() => {
                      setSelectedImage(img);
                    }}
                  >
                    {img}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Right Panel */}
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              padding: "10px",
            }}
          >
            {sessionName ? (
              <>
                <h2>{sessionName}</h2>
                {selectedImage ? (
                  <>
                    <h3>{selectedImage}</h3>
                    <img src={imageUrl} alt={selectedImage} style={imgStyle} />
                  </>
                ) : (
                  <p>Please select a whiteboard image</p>
                )}
              </>
            ) : (
              <p>Please select a session</p>
            )}
          </div>
        </div>
        <button onClick={onClose} style={whiteboardCloseButtonStyle}>
          Close
        </button>
      </div>
    </div>
  );
};

interface ZoomModalProps {
  onClose: () => void;
  onDownloadComplete: () => void;
}

const ZoomModal: React.FC<ZoomModalProps> = ({
  onClose,
  onDownloadComplete,
}) => {
  const [accountId, setAccountId] = React.useState("");
  const [clientId, setClientId] = React.useState("");
  const [clientSecret, setClientSecret] = React.useState("");
  const [recordingYear, setRecordingYear] = React.useState("");
  const [monthFrom, setMonthFrom] = React.useState("");
  const [monthTo, setMonthTo] = React.useState("");
  const [userEmail, setUserEmail] = React.useState("");

  const handleZoomDownload = async () => {
    alert("Your Zoom download is starting. This may take a moment...");

    const payload = {
      accountId,
      clientId,
      clientSecret,
      recordingYear,
      monthFrom,
      monthTo,
      userEmail,
    };

    if (!userEmail.trim()) {
      alert("Please enter your Zoom email.");
      return;
    }

    const response = await fetch("/api/zoom/download", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      onDownloadComplete();
    } else {
      // handle error
      const errorData = await response.json();
      alert("Zoom download failed: " + errorData.error);
      return;
    }
    onClose();
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0,0,0,0.5)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 1001,
      }}
    >
      <div
        style={{
          background: "white",
          padding: "20px",
          borderRadius: "8px",
          width: "400px",
        }}
      >
        <h2 style={smallButtonStyle}>Retrieve Zoom Meeting Files</h2>

        {/* Wrap your labels+inputs in a container with spacing */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div>
            <label
              style={{
                display: "block",
                marginBottom: "4px",
                fontWeight: "bold",
              }}
            >
              Zoom Email:
            </label>
            <input
              type="email"
              value={userEmail}
              onChange={(e) => setUserEmail(e.target.value)}
              style={{
                width: "100%",
                border: "1px solid #ccc",
                borderRadius: "4px",
                padding: "6px",
              }}
            />
          </div>

          <div>
            <label
              style={{
                display: "block",
                marginBottom: "4px",
                fontWeight: "bold",
              }}
            >
              Account ID:
            </label>
            <input
              type="text"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              style={{
                width: "100%",
                border: "1px solid #ccc",
                borderRadius: "4px",
                padding: "6px",
              }}
            />
          </div>

          <div>
            <label
              style={{
                display: "block",
                marginBottom: "4px",
                fontWeight: "bold",
              }}
            >
              Client ID:
            </label>
            <input
              type="text"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              style={{
                width: "100%",
                border: "1px solid #ccc",
                borderRadius: "4px",
                padding: "6px",
              }}
            />
          </div>

          <div>
            <label
              style={{
                display: "block",
                marginBottom: "4px",
                fontWeight: "bold",
              }}
            >
              Client Secret:
            </label>
            <input
              type="password"
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
              style={{
                width: "100%",
                border: "1px solid #ccc",
                borderRadius: "4px",
                padding: "6px",
              }}
            />
          </div>

          <div>
            <label
              style={{
                display: "block",
                marginBottom: "4px",
                fontWeight: "bold",
              }}
            >
              Recording Year:
            </label>
            <input
              type="number"
              value={recordingYear}
              onChange={(e) => setRecordingYear(e.target.value)}
              style={{
                width: "100%",
                border: "1px solid #ccc",
                borderRadius: "4px",
                padding: "6px",
              }}
            />
          </div>

          <div>
            <label
              style={{
                display: "block",
                marginBottom: "4px",
                fontWeight: "bold",
              }}
            >
              Month From:
            </label>
            <input
              type="number"
              value={monthFrom}
              onChange={(e) => setMonthFrom(e.target.value)}
              style={{
                width: "100%",
                border: "1px solid #ccc",
                borderRadius: "4px",
                padding: "6px",
              }}
            />
          </div>

          <div>
            <label
              style={{
                display: "block",
                marginBottom: "4px",
                fontWeight: "bold",
              }}
            >
              Month To:
            </label>
            <input
              type="number"
              value={monthTo}
              onChange={(e) => setMonthTo(e.target.value)}
              style={{
                width: "100%",
                border: "1px solid #ccc",
                borderRadius: "4px",
                padding: "6px",
              }}
            />
          </div>
        </div>

        {/* Buttons at the bottom */}
        <div style={{ marginTop: "20px", textAlign: "right" }}>
          <button onClick={handleZoomDownload} style={smallButtonStyle}>
            Retrieve
          </button>
          <button onClick={onClose} style={smallButtonStyle}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

interface ZoomFileSelectorModalProps {
  onClose: () => void;
  onFilesSelected: (files: string[]) => void;
  session: string;
}

const ZoomFileSelectorModal: React.FC<ZoomFileSelectorModalProps> = ({
  onClose,
  onFilesSelected,
  session,
}) => {
  const [files, setFiles] = React.useState<string[]>([]);
  const [selected, setSelected] = React.useState<string[]>([]);
  console.log(session);

  React.useEffect(() => {
    // Fetch the list of downloaded Zoom files
    fetch("/api/zoom/list-files")
      .then((res) => res.json())
      .then((data) => {
        if (data.files) {
          setFiles(data.files);
        }
      })
      .catch((err) => {
        console.error("Error listing zoom files:", err);
      });
  }, []);

  // Toggle a file in/out of the "selected" array
  const handleCheckboxChange = (file: string) => {
    setSelected((prev) =>
      prev.includes(file) ? prev.filter((f) => f !== file) : [...prev, file]
    );
  };

  // Copy the selected files
  const handleCopySelected = async () => {
    if (selected.length === 0) {
      alert("Please select at least one file to save.");
      return;
    }
    const response = await fetch("/api/zoom/copy-files", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ selectedFiles: selected, session }),
    });
    const result = await response.json();
    if (!response.ok) {
      alert("Error copying files: " + result.error);
    }
    onFilesSelected(selected);
    alert("Files copied successfully!");
    onClose(); // close the modal
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0,0,0,0.5)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 9999,
      }}
    >
      <div
        style={{
          background: "white",
          padding: "20px",
          borderRadius: "8px",
          width: "600px",
        }}
      >
        <h2 style={{ marginBottom: "16px" }}>
          Select Retrieved Zoom Files to Save
        </h2>
        {files.length === 0 ? (
          <p>No Zoom files found.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0 }}>
            {files.map((file) => {
              // If it ends with .vtt, append a label
              const isTranscript = file.toLowerCase().endsWith(".vtt");
              const displayName = isTranscript
                ? `${file} (Audio transcript)`
                : file;

              return (
                <li
                  key={file}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    marginBottom: "12px",
                    padding: "8px",
                    borderBottom: "1px solid #ddd",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(file)}
                    onChange={() => handleCheckboxChange(file)}
                    style={{ marginRight: "8px" }}
                  />
                  <span
                    style={{
                      marginLeft: "6px",
                      whiteSpace: "nowrap", // Force file name on one line
                      overflow: "hidden",
                      textOverflow: "ellipsis", // Optionally truncate if too long
                    }}
                  >
                    {displayName}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        <div style={{ marginTop: "20px", textAlign: "right" }}>
          <button onClick={handleCopySelected} style={smallButtonStyle}>
            Save Selected
          </button>
          <button onClick={onClose} style={smallButtonStyle}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

interface SaveModalProps {
  show: boolean;
  onClose: () => void;
  // you might already have others here
}

const SaveModal: React.FC<SaveModalProps> = ({ show, onClose }) => {
  const [sessionName, setSessionName] = React.useState("");
  const [zoomFiles, setZoomFiles] = React.useState<string[]>([]);

  const handleSaveClick = async () => {
    if (!sessionName.trim()) {
      alert("Please enter a session name.");
      return;
    }
    try {
      const response = await fetch(`/api/save-session/${sessionName}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ zoomFiles }),
      });
      if (response.ok) {
        console.log("Session saved successfully.");
        onClose();
      } else {
        console.error("Failed to save session.");
      }
    } catch (err) {
      console.error("Error saving session:", err);
    }
  };

  if (!show) return null;

  return (
    <div style={modalOverlayStyle}>
      <div style={modalStyle}>
        <h2>Save Session</h2>
        <p>Do you want to save the session before exiting?</p>
        <label htmlFor="session-name">Session Name:</label>
        <input
          id="session-name"
          type="text"
          placeholder="Enter session name..."
          value={sessionName}
          onChange={(e) => setSessionName(e.target.value)}
          style={{
            width: "100%",
            padding: "8px",
            marginTop: "8px",
            border: "1px solid #ccc",
            borderRadius: "4px",
          }}
        />
        <button onClick={handleSaveClick} style={buttonStyle}>
          Save
        </button>
        <button onClick={onClose} style={closeButtonStyle}>
          Close
        </button>
      </div>
    </div>
  );
};

const imgStyle: React.CSSProperties = {
  maxWidth: "100%",
  height: "auto",
  objectFit: "contain",
};

const whiteboardImgStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "8px 0",
  marginBottom: "10px",
};

const whiteboardCloseButtonStyle: React.CSSProperties = {
  position: "absolute",
  top: "20px",
  right: "20px",
  cursor: "pointer",
};

const whiteboardModalOverlayStyle: React.CSSProperties = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: "rgba(0,0,0,0.5)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  zIndex: 10000000001,
};

const whiteboardModalStyle: React.CSSProperties = {
  position: "relative",
  background: "white",
  padding: "20px",
  borderRadius: "8px",
  textAlign: "center",
  width: "60vw",
  height: "80vh",
  zIndex: 1000000001,
};

const herdModalOverlayStyle: React.CSSProperties = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: "rgba(0,0,0,0.5)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  zIndex: 1000000001,
};

const herdModalStyle: React.CSSProperties = {
  position: "relative",
  background: "white",
  padding: "20px",
  borderRadius: "8px",
  textAlign: "center",
  width: "1225px",
  height: "850px",
  zIndex: 1000000001,
};

const movementModalOverlayStyle: React.CSSProperties = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: "rgba(0,0,0,0.5)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  zIndex: 1000000001,
};

const movementModalStyle: React.CSSProperties = {
  position: "relative",
  background: "white",
  padding: "20px",
  borderRadius: "8px",
  textAlign: "center",
  width: "850px",
  height: "850px",
  zIndex: 1000000001,
};

const viewModalOverlayStyle: React.CSSProperties = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: "rgba(0,0,0,0.5)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  zIndex: 1001,
};

const viewModalStyle: React.CSSProperties = {
  position: "relative",
  background: "white",
  padding: "20px",
  borderRadius: "8px",
  textAlign: "center",
  width: "80vw",
  height: "80vh",
  zIndex: 1000000000,
};

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
  width: "80%", // Set the width to 80% of the viewport width
  maxWidth: "800px", // Maximum width to avoid going beyond the screen
  overflowY: "auto", // Allow scrolling if content is too long
  wordWrap: "break-word", // Allow long words to break and wrap to the next line
  whiteSpace: "normal", // Ensure text does not overflow on a single line
};

const listContainerStyle: React.CSSProperties = {
  maxHeight: "400px", // Set a max height for the list container
  overflowY: "auto", // Enable scrolling within the list container
  marginBottom: "10px",
};

const buttonStyle: React.CSSProperties = {
  margin: "5px 0",
  padding: "10px 15px",
  width: "100%",
  textAlign: "center",
  cursor: "pointer",
};

const sessionItemStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between", // Space between item text and buttons
  marginBottom: "12px",
  padding: "8px",
  borderBottom: "1px solid #ddd",
  wordWrap: "break-word", // Allow text to wrap
  whiteSpace: "normal", // Allow text to wrap to the next line
};

const smallButtonStyle: React.CSSProperties = {
  marginLeft: "5px",
  padding: "5px 10px",
  cursor: "pointer",
};

const closeButtonStyle: React.CSSProperties = {
  marginTop: "20px",
  padding: "10px 15px",
  cursor: "pointer",
};

const viewCloseButtonStyle: React.CSSProperties = {
  position: "absolute",
  bottom: "20px",
  left: "50%",
  transform: "translateX(-50%)",
  //right: "10px",
  //padding: "5px 10px",
  //marginTop: "20px",
  //padding: "10px 15px",
  cursor: "pointer",
};

const modalBackdropStyle: React.CSSProperties = {
  position: "fixed",
  top: 0,
  left: 0,
  width: "100vw",
  height: "100vh",
  backgroundColor: "rgba(0, 0, 0, 0.5)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
};

export const DmMap = (props: {
  map: dmMap_DMMapFragment$key;
  password: string;
  liveMapId: string | null;
  hideMap: () => void;
  showMapModal: () => void;
  openNotes: () => void;
  openMediaLibrary: () => void;
  sendLiveMap: (image: HTMLCanvasElement) => void;
  saveFogProgress: (image: HTMLCanvasElement) => void;
  updateToken: (
    id: string,
    changes: Omit<Partial<MapTokenEntity>, "id">
  ) => void;
  controlRef: React.MutableRefObject<MapControlInterface | null>;
}): React.ReactElement => {
  const map = useFragment(DMMapFragment, props.map);
  const [mapPing] = useMutation<dmMap_MapPingMutation>(MapPingMutation);
  const controlRef = props.controlRef;

  const [activeToolId, setActiveToolId] = usePersistedState(
    "activeDmTool",
    activeDmMapToolIdModel
  );

  const userSelectedTool = React.useMemo(() => {
    return (dmTools.find((tool) => tool.tool.id === activeToolId) ?? dmTools[0])
      .tool;
  }, [activeToolId]);

  const [toolOverride, setToolOverride] = React.useState<null | MapTool>(null);
  const activeTool = toolOverride ?? userSelectedTool;

  const isCurrentMapLive = map.id !== null && map.id === props.liveMapId;
  const isOtherMapLive = props.liveMapId !== null;

  const showToast = useToast();
  const asyncClipBoardApi = useAsyncClipboardApi();

  const copyMapToClipboard = () => {
    if (!controlRef.current || !asyncClipBoardApi) {
      return;
    }
    const { mapCanvas, fogCanvas } = controlRef.current.getContext();
    const canvas = new OffscreenCanvas(mapCanvas.width, mapCanvas.height);
    const context = canvas.getContext("2d")!;
    context.drawImage(mapCanvas, 0, 0);
    context.drawImage(fogCanvas, 0, 0);

    const { clipboard, ClipboardItem } = asyncClipBoardApi;
    canvas.convertToBlob().then((blob) => {
      clipboard
        .write([
          new ClipboardItem({
            [blob.type]: blob,
          }),
        ])
        .then(() => {
          showToast({
            title: `Copied map image to clipboard.`,
            status: "success",
            duration: 3000,
            isClosable: true,
            position: "top",
          });
        })
        .catch(console.error);
    });
  };

  const isConfiguringGrid = userSelectedTool === ConfigureGridMapTool;
  const isConfiguringGridRef = React.useRef(isConfiguringGrid);
  React.useEffect(() => {
    isConfiguringGridRef.current = isConfiguringGrid;
  });

  React.useEffect(() => {
    const listener = (ev: KeyboardEvent) => {
      if (isConfiguringGridRef.current) {
        return;
      }
      switch (ev.key) {
        case "1":
        case "2":
        case "3":
        case "4":
        case "5": {
          const toolIndex = parseInt(ev.key, 10) - 1;
          setActiveToolId(dmTools[toolIndex].tool.id);
          break;
        }
        case "s": {
          /**
           * overwrite CMD + S
           * @source: https://michilehr.de/overwrite-cmds-and-ctrls-in-javascript/
           */
          if (
            window.navigator.platform.match("Mac") ? ev.metaKey : ev.ctrlKey
          ) {
            ev.preventDefault();
            const context = controlRef.current?.getContext();
            if (!context) {
              return;
            }
            props.sendLiveMap(context.fogCanvas);
          }
          break;
        }
      }
    };
    window.document.addEventListener("keydown", listener);

    return () => window.document.removeEventListener("keydown", listener);
  }, []);

  const [confirmDialogNode, showDialog] = useConfirmationDialog();

  const [configureGridMapToolState, setConfigureGridMapToolState] =
    useResetState<ConfigureMapToolState>(
      () => ({
        offsetX: map.grid?.offsetX ?? 0,
        offsetY: map.grid?.offsetY ?? 0,
        columnWidth: map.grid?.columnWidth ?? 50,
        columnHeight: map.grid?.columnHeight ?? 50,
      }),
      [map.grid]
    );

  const [isRecording, setIsRecording] = React.useState(false);
  const handleClick = async () => {
    console.log("recording clicked");
    try {
      const response = await fetch("/api/recording", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        const data = await response.json();

        // Update the local state based on the response
        setIsRecording(data.recording === "recording");
      } else {
        console.error("Failed to update recording state");
      }
    } catch (err) {
      console.error("Error making API request:", err);
    }
  };

  const [isModalOpen, setIsModalOpen] = React.useState(false);

  const handleClearClick = () => {
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

  const confirmClearSession = async () => {
    try {
      const response = await fetch("/api/clear-session", {
        method: "POST",
      });

      if (response.ok) {
        console.log("Session cleared!");
      } else {
        console.error("Failed to clear session");
      }
    } catch (err) {
      console.error("Error making API request:", err);
    } finally {
      setIsModalOpen(false);
    }
  };

  const cancelClearSession = () => {
    setIsModalOpen(false);
  };

  // const [isZoomModalVisible, setZoomModalVisible] = React.useState(false);

  // const openZoomModal = () => setZoomModalVisible(true);
  // const closeZoomModal = () => setZoomModalVisible(false);

  const [showZoomFileSelector, setShowZoomFileSelector] = React.useState(false);

  const [isDownloadModalVisible, setDownloadModalVisible] =
    React.useState(false);
  const [isSaveModalVisible, setSaveModalVisible] = React.useState(false);

  const openDownloadModal = async () => {
    setDownloadModalVisible(true);
  };

  const closeDownloadModal = () => {
    setDownloadModalVisible(false);
  };

  const openSaveModal = async () => {
    setSaveModalVisible(true);
  };

  const closeSaveModal = () => {
    setSaveModalVisible(false);
  };

  const [isViewModalOpen, setViewModalOpen] = React.useState(false);
  const [selectedSessionName, setSelectedSessionName] = React.useState("");

  const handleViewClick = (sessionName: string) => {
    console.log(
      "in handleViewClick in [DmMap] handleViewClick triggered with:",
      sessionName
    );
    setSelectedSessionName(sessionName);
    setViewModalOpen(true);
  };

  const [isIframeOpen, setIsIframeOpen] = React.useState(false);
  const [iframeUrl, setIframeUrl] = React.useState<string | null>(null);

  const socket = useSocket();

  React.useEffect(() => {
    // authenticate:
    socket.emit("authenticate", {
      password: "SUPER_SECRET_DM_PASSWORD",
      desiredRole: "dm",
    });

    // Optionally listen for "authenticated"
    socket.on("authenticated", () => {
      console.log(
        "Socket is authenticated. Now can send events like update-collaboration-link"
      );
    });

    return () => {
      socket.off("authenticated");
    };
  }, [socket]);
  //const [collabLink, setCollabLink] = React.useState<string | null>(null);
  const [collabLink, setCollabLink] = React.useState<string>(
    import.meta.env.VITE_EXCALIDRAW_URL
  );
  // Optionally, on mount load initial value from localStorage:
  React.useEffect(() => {
    setCollabLink(localStorage.getItem("collaborationLink"));
  }, []);

  React.useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "UPDATE_COLLABORATION_LINK") {
        const { link } = event.data.payload;
        setCollabLink(link);
        localStorage.setItem("collaborationLink", link);
        // also broadcast to server
        socket.emit("update-collaboration-link", { link });
      }
      // handle "OPEN_EXCALIDRAW" if you want here
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [socket]);

  React.useEffect(() => {
    const handleSocketEvent = ({ link }: { link: string }) => {
      setCollabLink(link);
      localStorage.setItem("collaborationLink", link);
    };

    socket.on("collaboration-link-updated", handleSocketEvent);
    return () => socket.off("collaboration-link-updated", handleSocketEvent);
  }, [socket]);

  const openExcalidraw = () => {
    try {
      const user = userSession.getUser();
      if (!user) throw new Error("User data not available");

      // Use the saved collaboration link if available, or the default URL
      const baseUrl = collabLink || import.meta.env.VITE_EXCALIDRAW_URL;
      const url = new URL(baseUrl);

      // Append user info as query parameters
      url.searchParams.set("username", user.name);
      url.searchParams.set("userID", user.id);

      // If a saved collaboration link exists, preserve its hash
      if (collabLink) {
        const collabUrl = new URL(collabLink);
        url.hash = collabUrl.hash;
      }

      console.log("Opening Excalidraw URL:", url.toString());
      setIframeUrl(url.toString());
      setIsIframeOpen(true);
    } catch (error) {
      console.error("Error opening drawing:", error);
    }
  };

  return (
    <FlatContextProvider
      value={[
        [ContextMenuStoreProvider, {}] as ComponentWithPropsTuple<
          React.ComponentProps<typeof ContextMenuStoreProvider>
        >,
        [SharedTokenStateProvider, {}] as ComponentWithPropsTuple<
          React.ComponentProps<typeof SharedTokenStateProvider>
        >,
        [
          MarkAreaToolContext.Provider,
          {
            value: {
              onMarkArea: ([x, y]) => {
                mapPing({
                  variables: {
                    input: {
                      mapId: map.id,
                      x,
                      y,
                    },
                  },
                });
              },
            },
          },
        ] as ComponentWithPropsTuple<
          React.ComponentProps<typeof MarkAreaToolContext.Provider>
        >,
        [
          BrushToolContextProvider,
          {
            onDrawEnd: (canvas) => {
              // TODO: toggle between instant send and incremental send
              props.saveFogProgress(canvas);
            },
          },
        ] as ComponentWithPropsTuple<
          React.ComponentProps<typeof BrushToolContextProvider>
        >,
        [
          ConfigureGridMapToolContext.Provider,
          {
            value: {
              state: configureGridMapToolState,
              setState: setConfigureGridMapToolState,
            },
          },
        ] as ComponentWithPropsTuple<
          React.ComponentProps<typeof ConfigureGridMapToolContext.Provider>
        >,
        [AreaSelectContextProvider, {}],
        [
          TokenMarkerContextProvider,
          { currentMapId: map.id },
        ] as ComponentWithPropsTuple<
          React.ComponentProps<typeof TokenMarkerContextProvider>
        >,
        [
          UpdateTokenContext.Provider,
          { value: props.updateToken },
        ] as ComponentWithPropsTuple<
          React.ComponentProps<typeof UpdateTokenContext["Provider"]>
        >,
        [
          IsDungeonMasterContext.Provider,
          { value: true },
        ] as ComponentWithPropsTuple<
          React.ComponentProps<typeof IsDungeonMasterContext["Provider"]>
        >,
      ]}
    >
      <React.Suspense fallback={null}>
        <LazyLoadedMapView
          map={map}
          activeTool={activeTool}
          controlRef={controlRef}
          sharedContexts={[
            MarkAreaToolContext,
            BrushToolContext,
            ConfigureGridMapToolContext,
            AreaSelectContext,
            TokenMarkerContext,
            NoteWindowActionsContext,
            ReactRelayContext,
            UpdateTokenContext,
            IsDungeonMasterContext,
            ContextMenuStoreContext,
            SharedTokenStateStoreContext,
          ]}
          fogOpacity={0.5}
        />
      </React.Suspense>

      {toolOverride !== ConfigureGridMapTool ? (
        <>
          <LeftToolbarContainer>
            <Toolbar>
              <Toolbar.Logo />
              <Toolbar.Group divider>
                {dmTools.map((record) => (
                  <MenuItemRenderer
                    key={record.tool.id}
                    record={record}
                    isActive={record.tool === userSelectedTool}
                    setActiveTool={() => {
                      setActiveToolId(record.tool.id);
                    }}
                  />
                ))}
              </Toolbar.Group>
              <Toolbar.Group divider>
                <ShroudRevealSettings />
              </Toolbar.Group>
              <Toolbar.Group divider>
                <Toolbar.Item isActive>
                  <Toolbar.Button
                    onClick={() =>
                      showDialog({
                        header: "Shroud All",
                        body: "Do you really want to shroud the whole map?",
                        onConfirm: () => {
                          // TODO: this should be less verbose
                          const context = controlRef.current?.getContext();
                          if (!context) {
                            return;
                          }
                          const canvasContext =
                            context.fogCanvas.getContext("2d")!;
                          applyFogRectangle(
                            FogMode.shroud,
                            [0, 0],
                            [context.fogCanvas.width, context.fogCanvas.height],
                            canvasContext
                          );
                          context.fogTexture.needsUpdate = true;
                          props.saveFogProgress(context.fogCanvas);
                        },
                      })
                    }
                  >
                    <Icon.Droplet fill="currentColor" boxSize="20px" />
                    <Icon.Label>Shroud All</Icon.Label>
                  </Toolbar.Button>
                </Toolbar.Item>
                <Toolbar.Item isActive>
                  <Toolbar.Button
                    onClick={() =>
                      showDialog({
                        header: "Clear All",
                        body: "Do you really want to clear the whole map?",
                        onConfirm: () => {
                          // TODO: this should be less verbose
                          const context = controlRef.current?.getContext();
                          if (!context) {
                            return;
                          }
                          const canvasContext =
                            context.fogCanvas.getContext("2d")!;
                          applyFogRectangle(
                            FogMode.clear,
                            [0, 0],
                            [context.fogCanvas.width, context.fogCanvas.height],
                            canvasContext
                          );
                          context.fogTexture.needsUpdate = true;
                          props.saveFogProgress(context.fogCanvas);
                        },
                      })
                    }
                  >
                    <Icon.Droplet boxSize="20px" />
                    <Icon.Label>Clear All</Icon.Label>
                  </Toolbar.Button>
                </Toolbar.Item>
              </Toolbar.Group>
            </Toolbar>
          </LeftToolbarContainer>
          <BottomToolbarContainer>
            <Toolbar horizontal>
              <Toolbar.Group>
                <GridSettingButton
                  map={map}
                  enterConfigureGridMode={() => {
                    setToolOverride(ConfigureGridMapTool);
                  }}
                />
                <Toolbar.Item isActive>
                  <Toolbar.Button
                    onClick={() => {
                      props.showMapModal();
                    }}
                  >
                    <Icon.Map boxSize="20px" />
                    <Icon.Label>Map Library</Icon.Label>
                  </Toolbar.Button>
                </Toolbar.Item>
                <Toolbar.Item isActive>
                  <Toolbar.Button onClick={openDownloadModal}>
                    <Icon.Download boxSize="20px" />
                    <Icon.Label>View & Download Session</Icon.Label>
                  </Toolbar.Button>
                </Toolbar.Item>
                {/* DownloadModal Component */}
                <DownloadModal
                  show={isDownloadModalVisible}
                  onClose={closeDownloadModal}
                  onViewClick={handleViewClick}
                />
                {/* ViewModal Component- added 3/11*/}
                <ViewModal
                  show={isViewModalOpen}
                  onClose={() => setViewModalOpen(false)}
                  sessionName={selectedSessionName}
                />
                {showZoomFileSelector && (
                  <ZoomFileSelectorModal
                    onClose={() => setShowZoomFileSelector(false)}
                  />
                )}
                <Toolbar.Item isActive>
                  <Toolbar.Button onClick={openSaveModal}>
                    <Icon.Save boxSize="20px" />
                    <Icon.Label>Save Session</Icon.Label>
                  </Toolbar.Button>
                </Toolbar.Item>
                {/* SaveModal Component */}
                <SaveModal show={isSaveModalVisible} onClose={closeSaveModal} />
                {/* <Toolbar.Item isActive>
                  <Toolbar.Button
                    onClick={() => {
                      props.openMediaLibrary();
                    }}
                  >
                    <Icon.Image boxSize="20px" />
                    <Icon.Label>Media Library</Icon.Label>
                  </Toolbar.Button>
                </Toolbar.Item> */}
                <Toolbar.Item isActive>
                  <Toolbar.Button onClick={openExcalidraw}>
                    <Icon.Drawing boxSize="20px" />
                    <Icon.Label>Drawing</Icon.Label>
                  </Toolbar.Button>
                </Toolbar.Item>
                <Toolbar.Item isActive>
                  <Toolbar.Button
                    onClick={() => {
                      props.openNotes();
                    }}
                  >
                    <Icon.BookOpen boxSize="20px" />
                    <Icon.Label>Notes</Icon.Label>
                  </Toolbar.Button>
                </Toolbar.Item>
              </Toolbar.Group>
            </Toolbar>
            <MarginLeftDiv />
            <Toolbar horizontal>
              <Toolbar.Group>
                <Toolbar.Item>
                  <ConditionalWrap
                    condition={props.liveMapId !== null}
                    wrap={(children) => (
                      <Toolbar.Button onClick={props.hideMap}>
                        {children}
                      </Toolbar.Button>
                    )}
                  >
                    <Icon.Pause
                      stroke={
                        props.liveMapId !== null
                          ? "hsl(360, 83%, 62%)"
                          : "hsl(211, 27%, 70%)"
                      }
                      boxSize="20px"
                    />
                    <Icon.Label
                      color={
                        props.liveMapId !== null
                          ? "hsl(360, 83%, 62%)"
                          : "hsl(211, 27%, 70%)"
                      }
                    >
                      Stop Sharing
                    </Icon.Label>
                  </ConditionalWrap>
                </Toolbar.Item>
                {isCurrentMapLive ? (
                  <Toolbar.Item>
                    <Icon.Radio stroke="hsl(160, 51%, 49%)" boxSize="20px" />
                    <Icon.Label color="hsl(160, 51%, 49%)">Live</Icon.Label>
                  </Toolbar.Item>
                ) : isOtherMapLive ? (
                  <Toolbar.Item>
                    <Icon.Radio stroke="hsl(48, 94%, 68%)" boxSize="20px" />
                    <Icon.Label color="hsl(48, 94%, 68%)">Live</Icon.Label>
                  </Toolbar.Item>
                ) : (
                  <Toolbar.Item>
                    <Icon.Radio stroke="hsl(211, 27%, 70%)" boxSize="20px" />
                    <Icon.Label color="hsl(211, 27%, 70%)">Not Live</Icon.Label>
                  </Toolbar.Item>
                )}
                {/* {asyncClipBoardApi ? (
                  <Toolbar.Item isActive>
                    <Toolbar.Button onClick={copyMapToClipboard}>
                      <Icon.Clipboard boxSize="20px" />
                      <Icon.Label>Clipboard</Icon.Label>
                    </Toolbar.Button>
                  </Toolbar.Item>
                ) : null} */}
                <Toolbar.Item isActive>
                  <Toolbar.Button
                    onClick={() => {
                      const context = controlRef.current?.getContext();
                      if (!context) {
                        return;
                      }
                      props.sendLiveMap(context.fogCanvas);
                    }}
                  >
                    <Icon.Send boxSize="20px" />
                    <Icon.Label>Send</Icon.Label>
                  </Toolbar.Button>
                </Toolbar.Item>
                <Toolbar.Item isActive>
                  <Toolbar.Button onClick={handleClick}>
                    <Icon.Camera boxSize="20px" />
                    <Icon.Label>
                      {isRecording ? "Stop" : "Start"} Recording
                    </Icon.Label>
                  </Toolbar.Button>
                </Toolbar.Item>
                <Toolbar.Item isActive>
                  <Toolbar.Button onClick={handleClearClick}>
                    <Icon.Trash boxSize="20px" />
                    <Icon.Label>Clear session</Icon.Label>
                  </Toolbar.Button>
                </Toolbar.Item>

                <ClearModal
                  show={isModalOpen}
                  onClose={cancelClearSession}
                  onConfirm={confirmClearSession}
                />
              </Toolbar.Group>
            </Toolbar>
          </BottomToolbarContainer>
        </>
      ) : (
        <GridConfigurator
          map={map}
          onAbort={() => {
            setToolOverride(null);
          }}
          onConfirm={() => {
            setToolOverride(null);
          }}
        />
      )}
      {confirmDialogNode}
      {isIframeOpen && iframeUrl && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              backgroundColor: "white",
              padding: "20px",
              borderRadius: "8px",
              width: "90%",
              height: "90%",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <button
              onClick={() => setIsIframeOpen(false)}
              style={{ alignSelf: "flex-end", marginBottom: "10px" }}
            >
              Close
            </button>
            <iframe
              src={iframeUrl}
              style={{ flex: 1, border: "none", borderRadius: "4px" }}
              title="Embedded Content"
            />
          </div>
        </div>
      )}
      <SharedTokenMenu currentMapId={map.id} />
      <ContextMenuRenderer map={map} />
    </FlatContextProvider>
  );
};

const LeftToolbarContainer = styled.div`
  display: flex;
  align-items: center;
  position: absolute;
  height: 100%;
  top: 0;
  left: 12px;
  pointer-events: none;
  @media (max-width: 580px) {
    top: 1em;
    align-items: start;
  }
`;

const BottomToolbarContainer = styled.div`
  display: flex;
  justify-content: center;
  width: 100%;
  position: absolute;
  bottom: 12px;
  pointer-events: none;
  flex-wrap: wrap;
`;

const MarginLeftDiv = styled.div`
  margin-left: 24px;
  @media (max-width: 580px) {
    margin-left: 0px;
  }
`;

const MenuItemRenderer = (props: {
  record: ToolMapRecord;
  setActiveTool: () => void;
  isActive: boolean;
}): React.ReactElement => {
  const [showMenu, setShowMenu] = React.useState(false);
  const ref = React.useRef<null | HTMLLIElement>(null);
  useOnClickOutside<HTMLLIElement>(ref, () => {
    setShowMenu(false);
  });

  return (
    <Toolbar.Item isActive={props.isActive} ref={ref}>
      <Toolbar.Button
        onClick={() => {
          props.setActiveTool();
          setShowMenu((showMenu) => !showMenu);
        }}
      >
        {props.record.icon}
        <Icon.Label>{props.record.name} </Icon.Label>
      </Toolbar.Button>
      {props.record.MenuComponent && props.isActive && showMenu ? (
        <Toolbar.Popup>
          <props.record.MenuComponent />
        </Toolbar.Popup>
      ) : null}
    </Toolbar.Item>
  );
};

const GridConfigurator_MapFragment = graphql`
  fragment dmMap_GridConfigurator_MapFragment on Map {
    id
    showGrid
    showGridToPlayers
  }
`;

const GridConfigurator = (props: {
  map: dmMap_GridConfigurator_MapFragment$key;
  onAbort: () => void;
  onConfirm: () => void;
}): React.ReactElement => {
  const map = useFragment(GridConfigurator_MapFragment, props.map);
  const [mapUpdateGrid] = useMutation<dmMap_mapUpdateGridMutation>(
    MapUpdateGridMutation
  );

  const { state, setState } = React.useContext(ConfigureGridMapToolContext);

  return (
    <Stack
      position="absolute"
      bottom="12px"
      right="12px"
      width="100%"
      maxWidth="500px"
      borderRadius="12px"
      padding="2"
      backgroundColor="white"
      zIndex="1"
    >
      <Heading size="lg">Grid Configurator</Heading>
      <Text>
        Press and hold <strong>Alt</strong> for dragging the grid with your
        mouse.
      </Text>
      <HStack>
        <FormControl>
          <FormLabel>X-Coordinate</FormLabel>
          <InputGroup size="sm">
            <NumberInput
              value={state.offsetX}
              onChange={(valueString) => {
                let offsetX = parseFloat(valueString);
                if (Number.isNaN(offsetX)) {
                  offsetX = 0;
                }
                setState((state) => ({
                  ...state,
                  offsetX,
                }));
              }}
            >
              <NumberInputField />
              <NumberInputStepper>
                <NumberIncrementStepper />
                <NumberDecrementStepper />
              </NumberInputStepper>
            </NumberInput>
          </InputGroup>
        </FormControl>
        <FormControl>
          <FormLabel>Y-Coordinate</FormLabel>
          <InputGroup size="sm">
            <NumberInput
              value={state.offsetY}
              onChange={(valueString) => {
                let offsetY = parseFloat(valueString);
                if (Number.isNaN(offsetY)) {
                  offsetY = 0;
                }
                setState((state) => ({
                  ...state,
                  offsetY,
                }));
              }}
            >
              <NumberInputField />
              <NumberInputStepper>
                <NumberIncrementStepper />
                <NumberDecrementStepper />
              </NumberInputStepper>
            </NumberInput>
          </InputGroup>
        </FormControl>
      </HStack>
      <HStack>
        <FormControl>
          <FormLabel>Column Width</FormLabel>
          <InputGroup size="sm">
            <NumberInput
              value={state.columnWidth}
              onChange={(valueString) => {
                let columnWidth = parseFloat(valueString);
                if (Number.isNaN(columnWidth)) {
                  columnWidth = 0;
                }
                setState((state) => ({
                  ...state,
                  columnWidth,
                }));
              }}
            >
              <NumberInputField />
              <NumberInputStepper>
                <NumberIncrementStepper />
                <NumberDecrementStepper />
              </NumberInputStepper>
            </NumberInput>
          </InputGroup>
        </FormControl>
        <FormControl>
          <FormLabel>Column Height</FormLabel>
          <InputGroup size="sm">
            <NumberInput
              value={state.columnHeight}
              onChange={(valueString) => {
                let columnHeight = parseFloat(valueString);
                if (Number.isNaN(columnHeight)) {
                  columnHeight = 0;
                }
                setState((state) => ({
                  ...state,
                  columnHeight,
                }));
              }}
            >
              <NumberInputField />
              <NumberInputStepper>
                <NumberIncrementStepper />
                <NumberDecrementStepper />
              </NumberInputStepper>
            </NumberInput>
          </InputGroup>
        </FormControl>
      </HStack>

      <div
        style={{ display: "flex", marginTop: 16, justifyContent: "flex-end" }}
      >
        <div>
          <Button.Tertiary
            small
            style={{ marginRight: 16 }}
            onClick={props.onAbort}
            danger
          >
            <Icon.X boxSize="20px" /> <span>Abort</span>
          </Button.Tertiary>
        </div>
        <div>
          <Button.Primary
            small
            onClick={() => {
              mapUpdateGrid({
                variables: {
                  input: {
                    mapId: map.id,
                    grid: {
                      color: "rgba(0, 0, 0, 0.08)",
                      columnWidth: state.columnWidth,
                      columnHeight: state.columnHeight,
                      offsetX: state.offsetX,
                      offsetY: state.offsetY,
                    },
                    showGrid: map.showGrid,
                    showGridToPlayers: map.showGridToPlayers,
                  },
                },
              }).finally(() => {
                props.onConfirm();
              });
            }}
          >
            <span>Confirm</span> <Icon.ChevronRight boxSize="20px" />
          </Button.Primary>
        </div>
      </div>
    </Stack>
  );
};
