import * as userSession from "./chat/user-session";
import * as React from "react";
import useAsyncEffect from "@n1ru4l/use-async-effect";
import { ReactRelayContext, useMutation, useQuery } from "relay-hooks";
import graphql from "babel-plugin-relay/macro";
import styled from "@emotion/styled/macro";
import { Toolbar } from "./toolbar";
import * as Icon from "./feather-icons";
import { SplashScreen } from "./splash-screen";
import { AuthenticationScreen } from "./authentication-screen";
import { buildApiUrl } from "./public-url";
import { AuthenticatedAppShell } from "./authenticated-app-shell";
import { useSocket } from "./socket";
import { animated, useSpring, to } from "react-spring";
import { MapView, MapControlInterface } from "./map-view";
import { useGesture } from "react-use-gesture";
import { randomHash } from "./utilities/random-hash";
import { useWindowDimensions } from "./hooks/use-window-dimensions";
import { usePersistedState } from "./hooks/use-persisted-state";
import { PlayerMapTool } from "./map-tools/player-map-tool";
import {
  ComponentWithPropsTuple,
  FlatContextProvider,
} from "./flat-context-provider";
import { MarkAreaToolContext } from "./map-tools/mark-area-map-tool";
import {
  NoteWindowActionsContext,
  useNoteWindowActions,
} from "./dm-area/token-info-aside";
import { playerArea_PlayerMap_ActiveMapQuery } from "./__generated__/playerArea_PlayerMap_ActiveMapQuery.graphql";
import { playerArea_MapPingMutation } from "./__generated__/playerArea_MapPingMutation.graphql";
import { UpdateTokenContext } from "./update-token-context";
import { LazyLoadedMapView } from "./lazy-loaded-map-view";

const ToolbarContainer = styled(animated.div)`
  position: absolute;
  display: flex;
  justify-content: center;
  pointer-events: none;
  user-select: none;
  top: 0;
  left: 0;
`;

const AbsoluteFullscreenContainer = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
`;

type MarkedArea = {
  id: string;
  x: number;
  y: number;
};

const createCacheBusterString = () =>
  encodeURIComponent(`${Date.now()}_${randomHash()}`);

const PlayerMap_ActiveMapQuery = graphql`
  query playerArea_PlayerMap_ActiveMapQuery @live {
    activeMap {
      id
      ...mapView_MapFragment
    }
  }
`;

const MapPingMutation = graphql`
  mutation playerArea_MapPingMutation($input: MapPingInput!) {
    mapPing(input: $input)
  }
`;

const PlayerMap = ({
  fetch,
  socket,
  isMapOnly,
}: {
  fetch: typeof window.fetch;
  socket: ReturnType<typeof useSocket>;
  isMapOnly: boolean;
}) => {
  const currentMap = useQuery<playerArea_PlayerMap_ActiveMapQuery>(
    PlayerMap_ActiveMapQuery
  );
  const [mapPing] = useMutation<playerArea_MapPingMutation>(MapPingMutation);

  const mapId = currentMap?.data?.activeMap?.id ?? null;
  const showSplashScreen = mapId === null;

  const controlRef = React.useRef<MapControlInterface | null>(null);
  const [markedAreas, setMarkedAreas] = React.useState<MarkedArea[]>(() => []);

  // Save collaboration link to local storage
  const saveCollaborationLink = (link: string) => {
    localStorage.setItem("collaborationLink", link);
  };

  // Retrieve collaboration link from local storage
  const getCollaborationLink = (): string | null => {
    return localStorage.getItem("collaborationLink");
  };

  // Clear collaboration link from local storage
  const clearCollaborationLink = () => {
    localStorage.removeItem("collaborationLink");
  };
  React.useEffect(
    () => {
      function handleMessage(event: MessageEvent) {
        if (event.data?.type === "UPDATE_COLLABORATION_LINK") {
          const { link } = event.data.payload;
          if (link) {
            saveCollaborationLink(link);
          } else {
            clearCollaborationLink();
          }
        }

        if (event.data?.type === "OPEN_EXCALIDRAW") {
          try {
            const user = userSession.getUser();
            if (!user) {
              throw new Error("User data not available");
            }

            // 1) Base Excalidraw server URL
            const excalidrawUrl = import.meta.env.VITE_EXCALIDRAW_URL;
            const url = new URL(excalidrawUrl);

            // 2) Add user-specific query params
            url.searchParams.append("username", user.name);
            url.searchParams.append("userID", user.id);

            // 3) Grab the clicked link from the chat
            const clickedLink = event.data.payload?.href;
            if (clickedLink) {
              // Parse the full URL so we can get the entire "#room=..."
              const parsedLink = new URL(clickedLink, window.location.origin);
              // Copy the entire hash (including the comma + encryption key)
              url.hash = parsedLink.hash;
            } else {
              // Fallback if no link was supplied (use your saved link)
              const savedCollabLink = getCollaborationLink();
              if (savedCollabLink) {
                const collabUrl = new URL(savedCollabLink);
                url.hash = collabUrl.hash;
              }
            }

            // 4) Open the final URL in your iframe
            setIframeUrl(url.toString());
            setIsIframeOpen(true);
          } catch (error) {
            console.error("Error opening drawing:", error);
          }
        }
      }

      window.addEventListener("message", handleMessage);
      return () => window.removeEventListener("message", handleMessage);
    },
    [
      /*setIframeUrl, userSession  etc. */
    ]
  );

  React.useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === "UPDATE_COLLABORATION_LINK") {
        const { link } = event.data.payload;
        if (link) {
          saveCollaborationLink(link);
        } else {
          clearCollaborationLink();
        }
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  React.useEffect(() => {
    const contextmenuListener = (ev: Event) => {
      ev.preventDefault();
    };
    return () => {
      window.addEventListener("contextmenu", contextmenuListener);
      window.removeEventListener("contextmenu", contextmenuListener);
    };
  }, []);

  React.useEffect(() => {
    const listener = () => {
      if (document.hidden === false) {
        currentMap.retry();
      }
    };

    window.document.addEventListener("visibilitychange", listener, false);

    return () =>
      window.document.removeEventListener("visibilitychange", listener, false);
  }, []);

  const updateToken = React.useCallback(
    ({ id, ...updates }) => {
      if (currentMap.data?.activeMap) {
        fetch(`/map/${currentMap.data.activeMap.id}/token/${id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ...updates,
            socketId: socket.id,
          }),
        });
      }
    },
    [currentMap, fetch]
  );

  const [toolbarPosition, setToolbarPosition] = useSpring(() => ({
    position: [12, window.innerHeight - 50 - 12] as [number, number],
    snapped: true,
  }));

  // excalidraw iframe
  const [isIframeOpen, setIsIframeOpen] = React.useState(false);
  const [iframeUrl, setIframeUrl] = React.useState<string | null>(null);

  const [showItems, setShowItems] = React.useState(true);

  const isDraggingRef = React.useRef(false);

  const windowDimensions = useWindowDimensions();
  React.useEffect(() => {
    const position = toolbarPosition.position.get();
    const snapped = toolbarPosition.snapped.get();
    const y = position[1] + 50 + 12;
    if (y > windowDimensions.height || snapped) {
      setToolbarPosition({
        position: [position[0], windowDimensions.height - 50 - 12],
        snapped: true,
      });
    }
  }, [windowDimensions]);

  const handler = useGesture(
    {
      onDrag: (state) => {
        setToolbarPosition({
          position: state.movement,
          snapped: state.movement[1] === windowDimensions.height - 50 - 10,
          immediate: true,
        });
      },
      onClick: () => {
        if (isDraggingRef.current) {
          isDraggingRef.current = false;
          return;
        }
        setShowItems((showItems) => !showItems);
      },
    },
    {
      drag: {
        initial: () => toolbarPosition.position.get(),
        bounds: {
          left: 10,
          right: windowDimensions.width - 70 - 10,
          top: 10,
          bottom: windowDimensions.height - 50 - 10,
        },
        threshold: 5,
      },
    }
  );
  const noteWindowActions = useNoteWindowActions();
  return (
    <>
      <div
        style={{
          cursor: "grab",
          background: "black",
          height: "100vh",
        }}
      >
        <FlatContextProvider
          value={[
            [
              MarkAreaToolContext.Provider,
              {
                value: {
                  onMarkArea: ([x, y]) => {
                    if (currentMap.data?.activeMap) {
                      mapPing({
                        variables: {
                          input: {
                            mapId: currentMap.data.activeMap.id,
                            x,
                            y,
                          },
                        },
                      });
                    }
                  },
                },
              },
            ] as ComponentWithPropsTuple<
              React.ComponentProps<typeof MarkAreaToolContext.Provider>
            >,
            [
              UpdateTokenContext.Provider,
              {
                value: (id, { x, y }) => updateToken({ id, x, y }),
              },
            ] as ComponentWithPropsTuple<
              React.ComponentProps<typeof UpdateTokenContext.Provider>
            >,
          ]}
        >
          {currentMap.data?.activeMap ? (
            <React.Suspense fallback={null}>
              <LazyLoadedMapView
                map={currentMap.data.activeMap}
                activeTool={PlayerMapTool}
                controlRef={controlRef}
                sharedContexts={[
                  MarkAreaToolContext,
                  NoteWindowActionsContext,
                  ReactRelayContext,
                  UpdateTokenContext,
                ]}
                fogOpacity={1}
              />
            </React.Suspense>
          ) : null}
        </FlatContextProvider>
      </div>
      {!showSplashScreen ? (
        isMapOnly ? null : (
          <>
            <ToolbarContainer
              style={{
                transform: to(
                  [toolbarPosition.position],
                  ([x, y]) => `translate(${x}px, ${y}px)`
                ),
              }}
            >
              <Toolbar horizontal>
                <Toolbar.Logo {...handler()} cursor="grab" />
                {showItems ? (
                  <React.Fragment>
                    <Toolbar.Group>
                      <Toolbar.Item isActive>
                        <Toolbar.Button
                          onClick={() => {
                            controlRef.current?.controls.center();
                          }}
                          onTouchStart={(ev) => {
                            ev.preventDefault();
                            controlRef.current?.controls.center();
                          }}
                        >
                          <Icon.Compass boxSize="20px" />
                          <Icon.Label>Center Map</Icon.Label>
                        </Toolbar.Button>
                      </Toolbar.Item>
                      <Toolbar.Item isActive>
                        <Toolbar.LongPressButton
                          onClick={() => {
                            controlRef.current?.controls.zoomIn();
                          }}
                          onLongPress={() => {
                            const interval = setInterval(() => {
                              controlRef.current?.controls.zoomIn();
                            }, 100);

                            return () => clearInterval(interval);
                          }}
                        >
                          <Icon.ZoomIn boxSize="20px" />
                          <Icon.Label>Zoom In</Icon.Label>
                        </Toolbar.LongPressButton>
                      </Toolbar.Item>
                      <Toolbar.Item isActive>
                        <Toolbar.LongPressButton
                          onClick={() => {
                            controlRef.current?.controls.zoomOut();
                          }}
                          onLongPress={() => {
                            const interval = setInterval(() => {
                              controlRef.current?.controls.zoomOut();
                            }, 100);

                            return () => clearInterval(interval);
                          }}
                        >
                          <Icon.ZoomOut boxSize="20px" />
                          <Icon.Label>Zoom Out</Icon.Label>
                        </Toolbar.LongPressButton>
                      </Toolbar.Item>
                      <Toolbar.Item isActive>
                        <Toolbar.LongPressButton
                          onClick={() => {
                            noteWindowActions.showNoteInWindow(
                              null,
                              "note-editor",
                              true
                            );
                          }}
                        >
                          <Icon.BookOpen boxSize="20px" />
                          <Icon.Label>Notes</Icon.Label>
                        </Toolbar.LongPressButton>
                      </Toolbar.Item>
                      <Toolbar.Item isActive>
                        <Toolbar.Button
                          onClick={() => {
                            try {
                              const user = userSession.getUser();
                              if (!user) {
                                throw new Error("User data not available");
                              }

                              const excalidrawUrl = import.meta.env
                                .VITE_EXCALIDRAW_URL;
                              const url = new URL(excalidrawUrl);

                              // Add username/userID as query params
                              url.searchParams.append("username", user.name);
                              url.searchParams.append("userID", user.id);

                              // Add collaboration room from hash
                              const savedCollabLink = getCollaborationLink();
                              if (savedCollabLink) {
                                const collabUrl = new URL(savedCollabLink);
                                // Copy hash fragment from saved collaboration link
                                url.hash = collabUrl.hash;
                              }

                              setIframeUrl(url.toString());
                              setIsIframeOpen(true);
                            } catch (error) {
                              console.error("Error opening drawing:", error);
                            }
                          }}
                        >
                          <Icon.Drawing boxSize="20px" />
                          <Icon.Label>Drawing</Icon.Label>
                        </Toolbar.Button>
                      </Toolbar.Item>
                    </Toolbar.Group>
                  </React.Fragment>
                ) : null}
              </Toolbar>
            </ToolbarContainer>
          </>
        )
      ) : (
        <AbsoluteFullscreenContainer>
          <SplashScreen text="Ready." />
        </AbsoluteFullscreenContainer>
      )}

      {/* Render the iframe/modal */}
      {isIframeOpen && iframeUrl && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)", // Semi-transparent background
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000, // Ensure it's on top of other elements
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
              onClick={() => setIsIframeOpen(false)} // Close the iframe/modal
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
    </>
  );
};

const usePcPassword = () =>
  usePersistedState<string>("pcPassword", {
    encode: (value) => JSON.stringify(value),
    decode: (rawValue) => {
      if (typeof rawValue === "string") {
        try {
          const parsedValue = JSON.parse(rawValue);
          if (typeof parsedValue === "string") {
            return parsedValue;
          }
        } catch (e) {}
      }
      return "";
    },
  });

const AuthenticatedContent: React.FC<{
  pcPassword: string;
  localFetch: typeof fetch;
  isMapOnly: boolean;
}> = (props) => {
  const socket = useSocket();

  return (
    <AuthenticatedAppShell
      password={props.pcPassword}
      socket={socket}
      isMapOnly={props.isMapOnly}
      role="Player"
    >
      <PlayerMap
        fetch={props.localFetch}
        socket={socket}
        isMapOnly={props.isMapOnly}
      />
    </AuthenticatedAppShell>
  );
};

export const PlayerArea: React.FC<{
  password: string | null;
  isMapOnly: boolean;
}> = (props) => {
  const [pcPassword, setPcPassword] = usePcPassword();
  const initialPcPassword = React.useRef(pcPassword);
  let usedPassword = pcPassword;
  // the password in the query parameters has priority.
  if (pcPassword === initialPcPassword.current && props.password) {
    usedPassword = props.password;
  }

  const [mode, setMode] = React.useState("LOADING");

  const localFetch = React.useCallback(
    (input, init = {}) => {
      return fetch(buildApiUrl(input), {
        ...init,
        headers: {
          Authorization: usedPassword ? `Bearer ${usedPassword}` : undefined,
          ...init.headers,
        },
      }).then((res) => {
        if (res.status === 401) {
          console.error("Unauthenticated access.");
          setMode("AUTHENTICATE");
        }
        return res;
      });
    },
    [usedPassword]
  );

  useAsyncEffect(
    function* () {
      const result: any = yield localFetch("/auth").then((res) => res.json());
      if (!result.data.role) {
        setMode("AUTHENTICATE");
        return;
      }
      setMode("READY");
    },
    [localFetch]
  );

  if (mode === "LOADING") {
    return <SplashScreen text="Loading..." />;
  }

  if (mode === "AUTHENTICATE") {
    return (
      <AuthenticationScreen
        requiredRole="PC"
        fetch={localFetch}
        onAuthenticate={(password) => {
          setPcPassword(password);
        }}
      />
    );
  }

  if (mode === "READY") {
    return (
      <AuthenticatedContent
        localFetch={localFetch}
        pcPassword={usedPassword}
        isMapOnly={props.isMapOnly}
      />
    );
  }

  throw new Error("Invalid mode.");
};
