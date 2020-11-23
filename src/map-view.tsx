import * as React from "react";
import * as THREE from "three";
import {
  Canvas,
  PointerEvent,
  useThree,
  ViewportData,
} from "react-three-fiber";
import { animated, useSpring, SpringValue } from "@react-spring/three";
import { useGesture } from "react-use-gesture";
import styled from "@emotion/styled/macro";
import { darken, lighten } from "polished";
import { getOptimalDimensions } from "./util";
import { useStaticRef } from "./hooks/use-static-ref";
import { buildUrl } from "./public-url";
import { CanvasText } from "./canvas-text";
import type { MapTool, SharedMapToolState } from "./map-tools/map-tool";

// convert image relative to three.js
export const calculateX = (
  x: number,
  factor: number,
  dimensionsWidth: number
) => x * factor - dimensionsWidth / 2;

export const calculateY = (
  y: number,
  factor: number,
  dimensionsHeight: number
) => -y * factor + dimensionsHeight / 2;

// convert three.js to image relative
export const calculateRealX = (
  x: number,
  factor: number,
  dimensionsWidth: number
) => (x + dimensionsWidth / 2) / factor;

export const calculateRealY = (
  y: number,
  factor: number,
  dimensionsHeight: number
) => ((y - dimensionsHeight / 2) / factor) * -1;

export type Dimensions = { width: number; height: number; ratio: number };

type Token = {
  id: string;
  radius: number;
  color: string;
  label: string;
  x: number;
  y: number;
  isVisibleForPlayers: boolean;
  isMovableByPlayers: boolean;
  isLocked: boolean;
};

type MarkedArea = {
  id: string;
  x: number;
  y: number;
};

type Grid = {
  x: number;
  y: number;
  sideLength: number;
  color: string;
};

const Plane: React.FC<{
  position: SpringValue<[number, number, number]>;
  scale: SpringValue<[number, number, number]>;
}> = (props) => {
  return (
    <animated.group {...props}>
      <mesh>
        <planeBufferGeometry attach="geometry" args={[10000, 10000]} />
        <meshBasicMaterial attach="material" color="black" />
      </mesh>
      {props.children}
    </animated.group>
  );
};

const TokenRenderer: React.FC<{
  x: number;
  y: number;
  color: string;
  radius: number;
  textLabel: string;
  viewport: ViewportData;
  dimensions: Dimensions;
  factor: number;
  isLocked: boolean;
  isMovableByPlayers: boolean;
  updateTokenPosition: ({ x, y }: { x: number; y: number }) => void;
  mapScale: SpringValue<[number, number, number]>;
}> = (props) => {
  const initialRadius = useStaticRef(() => props.radius * props.factor);

  const isLocked = props.isMovableByPlayers === false || props.isLocked;

  const [isHover, setIsHover] = React.useState(false);

  const [animatedProps, set] = useSpring(() => ({
    position: [
      calculateX(props.x, props.factor, props.dimensions.width),
      calculateY(props.y, props.factor, props.dimensions.height),
      0.00001,
    ] as [number, number, number],
    circleScale: [1, 1, 1] as [number, number, number],
  }));

  React.useEffect(() => {
    const newRadius = props.factor * props.radius;
    set({
      position: [
        calculateX(props.x, props.factor, props.dimensions.width),
        calculateY(props.y, props.factor, props.dimensions.height),
        0.00001,
      ],
      circleScale: [newRadius / initialRadius, newRadius / initialRadius, 1],
    });
  }, [props.x, props.y, props.radius, props.factor, set, props.dimensions]);

  React.useEffect(() => {
    if (isLocked === false) {
      setIsHover(false);
    }
  }, [isLocked]);

  const isDraggingRef = React.useRef(false);

  const dragProps = useGesture(
    {
      onDrag: ({
        event,
        movement,
        last,
        memo = animatedProps.position.get(),
      }) => {
        event.stopPropagation();

        const mapScale = props.mapScale.get();
        const newX =
          memo[0] + movement[0] / props.viewport.factor / mapScale[0];
        const newY =
          memo[1] - movement[1] / props.viewport.factor / mapScale[1];

        set({
          position: [newX, newY, 0.00001],
          immediate: true,
        });

        if (last) {
          props.updateTokenPosition({
            x: calculateRealX(newX, props.factor, props.dimensions.width),
            y: calculateRealY(newY, props.factor, props.dimensions.height),
          });
          // isDraggingRef.current = false;
        }

        return memo;
      },
      onPointerDown: ({ event }) => {
        if (isLocked === false) {
          event.stopPropagation();
          setIsHover(true);
        }
      },
      onPointerMove: ({ event }) => {
        event.stopPropagation();
      },
      onPointerOver: () => {
        if (isLocked === false) {
          setIsHover(true);
        }
      },
      // onPointerUp: () => {
      //   if (isLocked === false) {
      //     // TODO: only on tablet
      //     setIsHover(false);
      //   }
      // },
      onPointerOut: () => {
        if (isLocked === false) {
          if (isDraggingRef.current === false) {
            setIsHover(false);
          }
        }
      },
      // onClick: () => {
      //   if (isLocked === false) {
      //     setIsHover(false);
      //   }
      // },
    },
    {
      enabled: isLocked === false,
    }
  );

  const color = isHover ? lighten(0.1, props.color) : props.color;

  return (
    <animated.group
      renderOrder={100}
      position={animatedProps.position}
      scale={animatedProps.circleScale}
      {...dragProps()}
    >
      <mesh>
        <circleBufferGeometry attach="geometry" args={[initialRadius, 128]} />
        <meshStandardMaterial attach="material" color={color} />
      </mesh>
      <mesh>
        <ringBufferGeometry
          attach="geometry"
          args={[initialRadius * (1 - 0.05), initialRadius, 128]}
        />
        <meshStandardMaterial attach="material" color={darken(0.1, color)} />
      </mesh>
      <CanvasText
        fontSize={0.8 * initialRadius}
        color="black"
        font={buildUrl("/fonts/Roboto-Bold.ttf")}
        anchorX="center"
        anchorY="middle"
      >
        {props.textLabel}
      </CanvasText>
    </animated.group>
  );
};

const MarkedAreaRenderer: React.FC<{
  x: number;
  y: number;
  factor: number;
  dimensions: Dimensions;
  remove: () => void;
}> = (props) => {
  const initialRadius = 10 * props.factor;

  const spring = useSpring({
    from: {
      scale: [1, 1, 1] as [number, number, number],
      opacity: 1,
    },
    to: {
      scale: [10, 10, 10] as [number, number, number],
      opacity: 0,
    },
    config: {
      duration: 1250,
    },
    onRest: () => {
      props.remove();
    },
  });

  return (
    <animated.mesh
      scale={spring.scale}
      position={[
        calculateX(props.x, props.factor, props.dimensions.width),
        calculateY(props.y, props.factor, props.dimensions.height),
        0,
      ]}
    >
      <ringBufferGeometry
        attach="geometry"
        args={[initialRadius * (1 - 0.1), initialRadius, 128]}
      />
      <animated.meshStandardMaterial attach="material" color={"red"} />
    </animated.mesh>
  );
};

const reduceOffsetToMinimum = (offset: number, sideLength: number): number => {
  const newOffset = offset - sideLength;
  if (newOffset > 0) {
    return reduceOffsetToMinimum(newOffset, sideLength);
  }
  return offset;
};

const drawGridToContext = (
  grid: Grid,
  ratio: number,
  canvas: HTMLCanvasElement
) => {
  const context = canvas.getContext("2d");
  if (!context) {
    console.error("Could not create canvas context.");
    return;
  }
  context.strokeStyle = grid.color || "rgba(0, 0, 0, .5)";
  context.lineWidth = 2;

  const gridX = grid.x * ratio;
  const gridY = grid.y * ratio;
  const sideLength = grid.sideLength * ratio;
  const offsetX = reduceOffsetToMinimum(gridX, sideLength);
  const offsetY = reduceOffsetToMinimum(gridY, sideLength);

  for (let i = 0; i < canvas.width / sideLength; i++) {
    context.beginPath();
    context.moveTo(offsetX + i * sideLength, 0);
    context.lineTo(offsetX + i * sideLength, canvas.height);
    context.stroke();
  }
  for (let i = 0; i < canvas.height / sideLength; i++) {
    context.beginPath();
    context.moveTo(0, offsetY + i * sideLength);
    context.lineTo(canvas.width, offsetY + i * sideLength);
    context.stroke();
  }
};

const GridRenderer = (props: {
  grid: Grid;
  dimensions: Dimensions;
  factor: number;
  imageHeight: number;
  imageWidth: number;
}): React.ReactElement => {
  const three = useThree();
  const maximumTextureSize = three.gl.capabilities.maxTextureSize;
  const [gridCanvas] = React.useState(() =>
    window.document.createElement("canvas")
  );
  const [gridTexture] = React.useState(
    () => new THREE.CanvasTexture(gridCanvas)
  );

  // maximumSideLength * maximumSideLength = MAXIMUM_TEXTURE_SIZE * 1024
  const maximumSideLength = React.useMemo(() => {
    return Math.sqrt(maximumTextureSize * 1024);
  }, [maximumTextureSize]);

  React.useEffect(() => {
    const { width, height, ratio } = getOptimalDimensions(
      props.imageWidth,
      props.imageHeight,
      maximumSideLength,
      maximumSideLength
    );
    gridCanvas.width = width;
    gridCanvas.height = height;
    drawGridToContext(props.grid, ratio, gridCanvas);
    gridTexture.needsUpdate = true;
  }, [
    gridCanvas,
    maximumSideLength,
    props.factor,
    props.imageWidth,
    props.imageHeight,
  ]);

  return (
    <mesh>
      <planeBufferGeometry
        attach="geometry"
        args={[props.dimensions.width, props.dimensions.height]}
      />
      <meshStandardMaterial
        attach="material"
        map={gridTexture}
        transparent={true}
      />
    </mesh>
  );
};

const MapRenderer: React.FC<{
  mapImage: HTMLImageElement;
  mapImageTexture: THREE.Texture;
  fogTexture: THREE.Texture;
  viewport: ViewportData;
  tokens: Token[];
  markedAreas: MarkedArea[];
  removeMarkedArea: (id: string) => void;
  grid: Grid | null;
  scale: SpringValue<[number, number, number]>;
  updateTokenPosition: (id: string, position: { x: number; y: number }) => void;
  factor: number;
  dimensions: Dimensions;
}> = (props) => {
  return (
    <>
      <group>
        <mesh>
          <planeBufferGeometry
            attach="geometry"
            args={[props.dimensions.width, props.dimensions.height]}
          />
          <meshStandardMaterial attach="material" map={props.mapImageTexture} />
        </mesh>
        {props.grid ? (
          <GridRenderer
            grid={props.grid}
            dimensions={props.dimensions}
            factor={props.factor}
            imageHeight={props.mapImage.naturalHeight}
            imageWidth={props.mapImage.naturalWidth}
          />
        ) : null}
        <mesh>
          <planeBufferGeometry
            attach="geometry"
            args={[props.dimensions.width, props.dimensions.height]}
          />
          <meshBasicMaterial
            attach="material"
            map={props.fogTexture}
            transparent={true}
          />
        </mesh>
      </group>
      <group renderOrder={1000}>
        {props.tokens
          .filter((token) => token.isVisibleForPlayers)
          .map((token) => (
            <TokenRenderer
              key={token.id}
              x={token.x}
              y={token.y}
              color={token.color}
              textLabel={token.label}
              isLocked={token.isLocked}
              isMovableByPlayers={token.isMovableByPlayers}
              factor={props.factor}
              radius={token.radius}
              dimensions={props.dimensions}
              viewport={props.viewport}
              updateTokenPosition={(position) =>
                props.updateTokenPosition(token.id, position)
              }
              mapScale={props.scale}
            />
          ))}
      </group>
      <group>
        {props.markedAreas.map((markedArea) => (
          <MarkedAreaRenderer
            key={markedArea.id}
            x={markedArea.x}
            y={markedArea.y}
            factor={props.factor}
            dimensions={props.dimensions}
            remove={() => props.removeMarkedArea(markedArea.id)}
          />
        ))}
      </group>
    </>
  );
};

export type MapControlInterface = {
  center: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
};

const MapViewRenderer = (props: {
  mapImage: HTMLImageElement;
  fogImage: HTMLImageElement | null;
  tokens: Token[];
  controlRef?: React.MutableRefObject<MapControlInterface | null>;
  updateTokenPosition: (id: string, props: { x: number; y: number }) => void;
  markedAreas: MarkedArea[];
  markArea: (coordinates: { x: number; y: number }) => void;
  removeMarkedArea: (id: string) => void;
  grid: Grid | null;
  activeTool: MapTool | null;
}): React.ReactElement => {
  const three = useThree();
  const viewport = three.viewport;
  const maximumTextureSize = three.gl.capabilities.maxTextureSize;
  const hoveredElementRef = React.useRef(null);

  const [spring, set] = useSpring(() => ({
    scale: [1, 1, 1] as [number, number, number],
    position: [0, 0, 0] as [number, number, number],
  }));

  const [mapCanvas] = React.useState(() =>
    window.document.createElement("canvas")
  );
  const [fogCanvas] = React.useState(() =>
    window.document.createElement("canvas")
  );

  const [mapTexture] = React.useState(() => new THREE.CanvasTexture(mapCanvas));
  const [fogTexture] = React.useState(() => new THREE.CanvasTexture(fogCanvas));

  // maximumSideLength * maximumSideLength = MAXIMUM_TEXTURE_SIZE * 1024
  const maximumSideLength = React.useMemo(() => {
    return Math.sqrt(maximumTextureSize * 1024);
  }, [maximumTextureSize]);

  React.useEffect(() => {
    set({
      scale: [1, 1, 1],
      position: [0, 0, 0],
    });
  }, [mapTexture, set]);

  React.useEffect(() => {
    if (!maximumSideLength) {
      return;
    }
    if (props.fogImage) {
      const { width, height } = getOptimalDimensions(
        props.mapImage.naturalWidth,
        props.mapImage.naturalHeight,
        maximumSideLength,
        maximumSideLength
      );

      fogCanvas.width = width;
      fogCanvas.height = height;
      const context = fogCanvas.getContext("2d");
      if (!context) {
        console.error("Could not create canvas context.");
        return;
      }
      context.clearRect(0, 0, fogCanvas.width, fogCanvas.height);
      context.drawImage(
        props.fogImage,
        0,
        0,
        fogCanvas.width,
        fogCanvas.height
      );
    } else {
      const context = fogCanvas.getContext("2d");
      if (!context) {
        console.error("Could not create canvas context.");
        return;
      }
      context.clearRect(0, 0, fogCanvas.width, fogCanvas.height);
    }
    fogTexture.needsUpdate = true;
  }, [props.fogImage, fogCanvas, maximumSideLength]);

  React.useEffect(() => {
    if (!maximumSideLength) {
      return;
    }

    const { width, height } = getOptimalDimensions(
      props.mapImage.naturalWidth,
      props.mapImage.naturalHeight,
      maximumSideLength,
      maximumSideLength
    );

    mapCanvas.width = width;
    mapCanvas.height = height;
    const context = mapCanvas.getContext("2d");
    if (!context) {
      return;
    }
    context.drawImage(props.mapImage, 0, 0, mapCanvas.width, mapCanvas.height);

    mapTexture.needsUpdate = true;
  }, [props.mapImage, mapCanvas, maximumSideLength]);

  const dimensions = React.useMemo(() => {
    return getOptimalDimensions(
      props.mapImage.naturalWidth,
      props.mapImage.naturalHeight,
      viewport.width * 0.95,
      viewport.height * 0.95
    );
  }, [props.mapImage, viewport]);

  React.useEffect(() => {
    if (props.controlRef) {
      props.controlRef.current = {
        center: () =>
          set({
            scale: [1, 1, 1] as [number, number, number],
            position: [0, 0, 0] as [number, number, number],
          }),
        zoomIn: () => {
          const scale = spring.scale.get();
          set({
            scale: [scale[0] * 1.1, scale[1] * 1.1, 1],
          });
        },
        zoomOut: () => {
          const scale = spring.scale.get();
          set({
            scale: [scale[0] / 1.1, scale[1] / 1.1, 1],
          });
        },
      };
    }
  });

  const pointerTimer = React.useRef<NodeJS.Timeout>();

  const toolContext = React.useMemo<SharedMapToolState>(() => {
    return {
      fogCanvas,
      fogTexture,
      mapState: spring,
      setMapState: set,
      dimensions,
      mapImage: props.mapImage,
      viewport,
    };
  }, [
    fogCanvas,
    fogTexture,
    spring,
    set,
    dimensions,
    props.mapImage,
    viewport,
  ]);

  const toolRef = React.useRef<{
    contextState: any;
    mutableState: any;
  } | null>(null);

  const bind = useGesture<{
    onPointerUp: PointerEvent;
    onPointerDown: PointerEvent;
    onPointerMove: PointerEvent;
  }>(
    {
      onPointerDown: ({ event }) => {
        if (!toolRef.current || !props.activeTool) {
          return;
        }
        props.activeTool.onPointerDown?.(
          event,
          toolContext,
          toolRef.current.mutableState,
          toolRef.current.contextState
        );
        return;
      },
      onPointerUp: ({ event }) => {
        if (!toolRef.current || !props.activeTool) {
          return;
        }
        props.activeTool.onPointerUp?.(
          event,
          toolContext,
          toolRef.current.mutableState,
          toolRef.current.contextState
        );
      },
      onPointerMove: ({ event }) => {
        if (!toolRef.current || !props.activeTool) {
          return;
        }
        return props.activeTool.onPointerMove?.(
          event,
          toolContext,
          toolRef.current.mutableState,
          toolRef.current.contextState
        );
      },
      onDrag: (args) => {
        if (!toolRef.current || !props.activeTool) {
          return;
        }
        return props.activeTool.onDrag?.(
          // @ts-ignore
          args,
          toolContext,
          toolRef.current.mutableState,
          toolRef.current.contextState
        );
      },
    },
    {}
  );

  return (
    <Plane position={spring.position} scale={spring.scale} {...bind()}>
      <MapRenderer
        mapImage={props.mapImage}
        mapImageTexture={mapTexture}
        fogTexture={fogTexture}
        viewport={viewport}
        tokens={props.tokens}
        markedAreas={props.markedAreas}
        removeMarkedArea={props.removeMarkedArea}
        grid={props.grid}
        updateTokenPosition={props.updateTokenPosition}
        scale={spring.scale}
        dimensions={dimensions}
        factor={dimensions.width / props.mapImage.width}
      />
      {props.activeTool ? (
        <MapToolRenderer
          tool={props.activeTool}
          toolRef={toolRef}
          handlerContext={toolContext}
        />
      ) : null}
    </Plane>
  );
};

const MapCanvasContainer = styled.div`
  height: 100%;
  touch-action: manipulation;
`;

export const MapView = (props: {
  mapImage: HTMLImageElement;
  fogImage: HTMLImageElement | null;
  tokens: Token[];
  controlRef?: React.MutableRefObject<MapControlInterface | null>;
  updateTokenPosition: (id: string, props: { x: number; y: number }) => void;
  markedAreas: MarkedArea[];
  markArea: (coordinates: { x: number; y: number }) => void;
  removeMarkedArea: (id: string) => void;
  grid: Grid | null;
  activeTool: MapTool | null;
}): React.ReactElement => {
  return (
    <MapCanvasContainer>
      <Canvas
        camera={{ position: [0, 0, 5] }}
        pixelRatio={window.devicePixelRatio}
      >
        <ambientLight intensity={1} />
        <MapViewRenderer
          activeTool={props.activeTool}
          mapImage={props.mapImage}
          fogImage={props.fogImage}
          tokens={props.tokens}
          controlRef={props.controlRef}
          updateTokenPosition={props.updateTokenPosition}
          markedAreas={props.markedAreas}
          markArea={props.markArea}
          removeMarkedArea={props.removeMarkedArea}
          grid={props.grid}
        />
      </Canvas>
    </MapCanvasContainer>
  );
};

const MapToolRenderer = <
  MutableState extends {} = {},
  ContextState extends {} = {}
>(props: {
  tool: MapTool<MutableState, ContextState>;
  toolRef: React.MutableRefObject<{
    contextState: ContextState;
    mutableState: MutableState;
  } | null>;
  handlerContext: SharedMapToolState;
}): React.ReactElement => {
  const contextState = React.useContext<ContextState>(props.tool.Context);
  const [mutableState] = React.useState<MutableState>(
    props.tool.createMutableState
  );
  React.useEffect(() => {
    props.toolRef.current = {
      contextState,
      mutableState,
    };

    return () => {
      props.toolRef.current = null;
    };
  });
  return (
    <props.tool.Component
      contextState={contextState}
      mutableState={mutableState}
      mapContext={props.handlerContext}
    />
  );
};
