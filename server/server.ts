import express from "express";
import path from "path";
import favicon from "serve-favicon";
import logger from "morgan";
import bodyParser from "body-parser";
import fs from "fs-extra";
import http from "http";
import { Server as SocketIOServer } from "socket.io";
import busboy from "connect-busboy";
import createFilesRouter from "./routes/files";
import createMapRouter from "./routes/map";
import { Maps } from "./maps";
import { Settings } from "./settings";
import { FileStorage } from "./file-storage";
import { createResourceTaskProcessor } from "./util";
import { initialize } from "./database";
import { createSocketSessionStore } from "./socket-session-store";
import { EventEmitter } from "events";
import type { getEnv } from "./env";
import createGraphQLRouter from "./routes/graphql";
import createNotesRouter from "./routes/notes";
import type {
  ErrorRequestHandler,
  RequestHandler,
  Request,
} from "express-serve-static-core";
import zoomRoutes from "./routes/zoom";

let maps: Maps | null = null;

const fetchRoutes = require("./routes/fetch"); //Defines the route for api fetch
const previewRoutes = require("./routes/default_Preview"); //Defines the route for api default_Preview
const grabIterationDataRoutes = require("./routes/grabIterationData"); //Defines the route for api visualize
const selectMapRoutes = require("./routes/selectMap"); //Defines the route for api's in select_map_modal.tsx
//const { parse } = require("json2csv");
import archiver from "archiver";

type RequestWithRole = Request & { role: string | null };
type ErrorWithStatus = Error & { status: number };

export const bootstrapServer = async (env: ReturnType<typeof getEnv>) => {
  fs.mkdirpSync(env.DATA_DIRECTORY);

  const db = await initialize({
    dataPath: env.DATA_DIRECTORY,
    databasePath: path.join(env.DATA_DIRECTORY, `db.sqlite`),
  });

  const app = express();
  const apiRouter = express.Router();
  const httpServer = http.createServer(app);
  const io = new SocketIOServer(httpServer, {
    path: "/api/socket.io",
  });

  const processTask = createResourceTaskProcessor();

  maps = new Maps({ processTask, dataDirectory: env.DATA_DIRECTORY });
  const settings = new Settings({ dataDirectory: env.DATA_DIRECTORY });
  const researchPath = path.join(__dirname, "..", "public", "research");
  const notes_folder = path.join(researchPath, "notes");
  const fileStorage = new FileStorage({
    dataDirectory: env.DATA_DIRECTORY,
    db,
  });
  app.use(busboy());

  // Not sure if this is needed, Chrome seems to grab the favicon just fine anyway
  // Maybe for cross-browser support
  app.use(logger("dev"));
  app.use(
    favicon(path.resolve(env.PUBLIC_PATH, "images", "icons", "favicon.ico"))
  );

  // Needed to handle JSON posts, size limit of 50mb
  app.use(bodyParser.json({ limit: "50mb" }));
  app.use(bodyParser.urlencoded({ limit: "50mb", extended: true }));

  const getRole = (password: string) => {
    let role = null;
    if (env.PC_PASSWORD) {
      if (password === env.PC_PASSWORD) {
        role = "PC";
      }
    } else {
      role = "PC";
    }
    if (env.DM_PASSWORD) {
      if (password === env.DM_PASSWORD) {
        role = "DM";
      }
    } else {
      role = "DM";
    }
    return role;
  };

  const authorizationMiddleware: RequestHandler = (req, res, next) => {
    const authHeader = req.headers.authorization;
    const authParam = req.query.authorization;
    let token = null;

    if (authHeader) {
      token = req.headers.authorization!.split(" ")[1];
    } else if (authParam) {
      token = authParam;
    }

    (req as RequestWithRole).role = getRole(token as string);
    next();
  };

  const requiresPcRole: RequestHandler = (req, res, next) => {
    const { role } = req as RequestWithRole;
    if (role === "DM" || role === "PC") {
      next();
      return;
    }

    res.status(401).json({
      data: null,
      error: {
        message: "Unauthenticated Access",
        code: "ERR_UNAUTHENTICATED_ACCESS",
      },
    });
  };

  const requiresDmRole: RequestHandler = (req, res, next) => {
    if ((req as RequestWithRole).role === "DM") {
      next();
      return;
    }
    res.status(401).json({
      data: null,
      error: {
        message: "Unauthenticated Access",
        code: "ERR_UNAUTHENTICATED_ACCESS",
      },
    });
  };

  const roleMiddleware = {
    dm: requiresDmRole,
    pc: requiresPcRole,
  };

  app.use(authorizationMiddleware);

  const emitter = new EventEmitter();

  apiRouter.get("/auth", (req, res) => {
    return res.status(200).json({
      data: {
        role: (req as RequestWithRole).role,
      },
    });
  });

  apiRouter.use("/fetch", fetchRoutes); //api call for fetch
  apiRouter.use("/default_Preview", previewRoutes); //api call for default_Preview
  apiRouter.use("/grabIterationData", grabIterationDataRoutes); //api call for visualize
  apiRouter.use("/selectMap", selectMapRoutes); //api call for select_map_modal.tsx

  apiRouter.get("/active-map", requiresPcRole, (req, res) => {
    let activeMap = null;
    const activeMapId = settings.get("currentMapId");

    // Check if maps is initialized. Fixes an issue with exporting maps
    if (!maps) {
      console.error("Maps instance is not initialized");
      return res
        .status(500)
        .json({ error: "Maps instance is not initialized" });
    }

    if (activeMapId) {
      activeMap = maps.get(activeMapId);
    }

    res.status(200).json({
      error: null,
      data: {
        activeMap,
      },
    });
  });

  apiRouter.post("/active-map", requiresDmRole, (req, res) => {
    const mapId = req.body.mapId;
    if (mapId === undefined) {
      res.status(404).json({
        error: {
          message: "Missing param 'mapId' in body.",
          code: "ERR_MISSING_MAP_ID",
        },
      });
      return;
    }

    settings.set("currentMapId", mapId);
    emitter.emit("invalidate", "Query.activeMap");

    res.json({
      error: null,
      data: {
        activeMapId: mapId,
      },
    });
  });

  apiRouter.get("/list-sessions", async (req, res) => {
    const savedFolderPath = path.join(researchPath, "saved");

    try {
      if (!fs.existsSync(savedFolderPath)) {
        return res.status(404).json({ error: "Saved folder not found" });
      }

      const files = await fs.readdir(savedFolderPath);
      const sessionFolders = files.filter((file) =>
        fs.statSync(path.join(savedFolderPath, file)).isDirectory()
      );

      if (sessionFolders.length === 0) {
        return res.status(404).json({ error: "No sessions found" });
      }

      res.json({ sessions: sessionFolders });
    } catch (err) {
      return res.status(500).json({ error: "Failed to list sessions" });
    }
  });

  apiRouter.get("/list-iterations/:folder", async (req, res) => {
    const folderName = req.params.folder; // Dynamically get folder name
    const targetFolderPath = path.join(researchPath, "saved", folderName);

    try {
      if (!fs.existsSync(targetFolderPath)) {
        return res
          .status(404)
          .json({ error: `Folder "${folderName}" not found` });
      }

      const files = await fs.readdir(targetFolderPath);
      const iterationFolders = files.filter((file) =>
        fs.statSync(path.join(targetFolderPath, file)).isDirectory()
      );

      if (iterationFolders.length === 0) {
        return res.status(404).json({ error: "No sessions found" });
      }

      res.json({ iterations: iterationFolders });
    } catch (err) {
      return res.status(500).json({ error: "Failed to list iterations" });
    }
  });

  /*
  //retrieves map file for a specific iteration
  apiRouter.get(
    "/iteration/:sessionName/:iterationName/:map",
    async (req, res) => {
      const { sessionName, iterationName, map } = req.params;

      const mapFilePath = path.join(
        researchPath,
        "saved",
        sessionName,
        iterationName,
        map
      );

      if (!fs.existsSync(mapFilePath)) {
        console.error("File not found:", mapFilePath);
        return res.status(404).json({ error: "map.jpg not found" });
      }

      res.sendFile(mapFilePath);
    }
  );
  */

  //retrieves map file for a specific iteration
  apiRouter.get("/iteration/:sessionName/:iterationName", async (req, res) => {
    const { sessionName, iterationName } = req.params;

    const fileExtensions = ["jpg", "jpeg", "svg", "png"];
    let mapFilePath = null;

    for (const ext of fileExtensions) {
      const possibleMapPath = path.join(
        researchPath,
        "saved",
        sessionName,
        iterationName,
        `map.${ext}`
      );
      console.log("Checking:", possibleMapPath);
      if (fs.existsSync(possibleMapPath)) {
        mapFilePath = possibleMapPath;
        break;
      }
    }

    if (!mapFilePath) {
      console.error(
        "Map file not found for session:",
        sessionName,
        iterationName
      );
      return res.status(404).json({ error: "Map file not found " });
    }
    res.sendFile(mapFilePath);
  });

  //retrieves fog progress and fog live file for a specific iteration
  apiRouter.get(
    "/iteration/:sessionName/:iterationName/:fileName",
    async (req, res) => {
      const { sessionName, iterationName, fileName } = req.params;
      const filePath = path.join(
        researchPath,
        "saved",
        sessionName,
        iterationName,
        fileName
      );

      console.log("Checking fog file:", filePath);
      if (!fs.existsSync(filePath)) {
        console.error("File not found:", filePath);
        return res.status(404).json({ error: `${fileName} not found` });
      }
      res.sendFile(filePath);
    }
  );

  //retrieves settings.json for a specific iteration
  app.get(
    "/api/iteration/:sessionName/:iterationName/settings.json",
    (req, res) => {
      const { sessionName, iterationName } = req.params;

      const settingsPath = path.join(
        researchPath,
        "saved",
        sessionName,
        iterationName,
        "settings.json"
      );
      res.setHeader("Content-Type", "application/json");
      res.sendFile(settingsPath);
    }
  );

  app.post("/api/clear-session", (req, res) => {
    const sourceSessionFolder = path.join(researchPath, "downloads", "session");
    const sourceZoomFolder = path.join(researchPath, "downloads", "zoom");
    const sourceNotesFolder = path.join(researchPath, "notes");
    const sourceWhiteboardFolder = path.join(researchPath, "whiteboard");
    const selectedZoomFolder = path.join(researchPath, "zoom");

    try {
      deleteFolderContents(sourceSessionFolder);
      deleteFolderContents(sourceNotesFolder);
      deleteFolderContents(sourceWhiteboardFolder);
      deleteFolderContents(selectedZoomFolder);
      deleteFolderContents(sourceZoomFolder);

      res.status(200).json({ message: "Session cleared" });
    } catch (error) {
      console.error("Error clearing session:", error);
      res.status(500).json({ error: "Failed to clear session" });
    }
  });

  app.post("/api/recording", (req, res) => {
    const filePath = path.join(researchPath, "settings.json");

    fs.readFile(filePath, "utf8", (err, data) => {
      if (err) {
        return res.status(500).json({ message: "Error reading file" });
      }

      let jsonData;
      try {
        jsonData = JSON.parse(data);
      } catch (e) {
        return res.status(500).json({ message: "Error parsing JSON" });
      }

      const updatedState =
        jsonData.recording === "recording" ? "stopped" : "recording";
      jsonData.recording = updatedState;

      fs.writeFile(filePath, JSON.stringify(jsonData, null, 2), (err) => {
        if (err) {
          return res.status(500).json({ message: "Error updating file" });
        }
        res.json({ recording: updatedState });
      });
    });
  });

  app.post("/api/save-notes", async (req, res) => {
    const { userId, userName, content } = req.body;

    if (!userId || !userName || !content) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    try {
      const filePath = path.join(notes_folder, `${userId}_notes.txt`);

      await fs.ensureDir(notes_folder);

      await fs.ensureFile(filePath);

      const formattedContent = `User: ${userName}\n\n${content}`;

      await fs.writeFile(filePath, formattedContent, "utf8");
      console.log(`Notes saved: ${filePath}`);

      res.json({ success: true, message: "Notes saved successfully" });
    } catch (error) {
      console.error("Error saving notes:", error);
      res.status(500).json({ error: "Failed to save notes" });
    }
  });

  app.get("/api/get-notes/:userId", async (req, res) => {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ error: "Missing userId" });
    }

    try {
      const filePath = path.join(notes_folder, `${userId}_notes.txt`);

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: "Notes not found" });
      }

      const content = await fs.readFile(filePath, "utf8");
      res.json({ success: true, content });
    } catch (error) {
      console.error("Error reading notes:", error);
      res.status(500).json({ error: "Failed to fetch notes" });
    }
  });

  apiRouter.get("/download-folder/:folderName", requiresDmRole, (req, res) => {
    const { folderName } = req.params;
    const folderPath = path.join(researchPath, "saved", folderName);

    if (!fs.existsSync(folderPath)) {
      return res.status(404).json({ error: { message: "Folder not found" } });
    }

    const zipFileName = `${folderName}.zip`;
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename=${zipFileName}`);

    const archive = archiver("zip", { zlib: { level: 9 } });

    archive.on("error", (err) => {
      console.error("Error creating zip:", err);
      res.status(500).json({ error: { message: "Error creating ZIP file" } });
    });

    archive.pipe(res);
    archive.directory(folderPath, false);
    archive.finalize();
  });

  app.get("/api/grid/:mapId", (req, res) => {
    const { mapId } = req.params;
    const filePath = path.join(
      __dirname,
      "..",
      "data",
      "maps",
      mapId,
      "settings.json"
    );

    console.log("Looking for:", filePath);

    fs.readFile(filePath, "utf-8", (err, data) => {
      if (err) {
        return res.status(500).json({ error: "Failed to read settings file" });
      }

      try {
        const settings = JSON.parse(data);
        res.json({ grid: settings.grid }); // Assuming the grid data is under a 'grid' key
      } catch (jsonErr) {
        res.status(500).json({ error: "Failed to parse JSON" });
      }
    });
  });

  apiRouter.post("/save-session/:folderName", (req, res) => {
    const name = req.params.folderName;
    console.log(name);

    if (!name || name.trim() === "") {
      return res.status(400).json({ error: "Session name is required" });
    }

    const sanitizedFolderName = name.replace(/[^a-zA-Z0-9-_]/g, "_");
    const currentDate = new Date().toISOString().split("T")[0];

    let finalFolderName = `${sanitizedFolderName}_${currentDate}`;
    const savedPath = path.join(researchPath, "saved");

    function getUniqueFolderName(baseName: string) {
      let counter = 1;
      let uniqueName = baseName;

      while (fs.existsSync(path.join(savedPath, uniqueName))) {
        uniqueName = `${sanitizedFolderName}_${counter}_${currentDate}`;
        counter++;
      }
      return uniqueName;
    }

    finalFolderName = getUniqueFolderName(finalFolderName);

    const destinationFolder = path.join(savedPath, finalFolderName);
    const sourceSessionFolder = path.join(researchPath, "downloads", "session");
    const sourceZoomFolder = path.join(researchPath, "downloads", "zoom");
    const sourceNotesFolder = path.join(researchPath, "notes");
    const destinationNotesFolder = path.join(destinationFolder, "notes");
    const sourceWhiteboardFolder = path.join(researchPath, "whiteboard");
    const destinationWhiteboardFolder = path.join(
      destinationFolder,
      "whiteboard"
    );
    const selectedZoomFolder = path.join(researchPath, "zoom");
    const destinationZoomFolder = path.join(destinationFolder, "zoom_data");

    try {
      if (!fs.existsSync(sourceSessionFolder)) {
        return res.status(404).json({ error: "Session folder not found" });
      }

      if (!fs.existsSync(savedPath)) {
        fs.mkdirSync(savedPath, { recursive: true });
      }

      renameNotesFiles(sourceNotesFolder);

      copyFolderRecursive(sourceSessionFolder, destinationFolder);

      createSessionCSV(sourceSessionFolder, destinationFolder);

      copyFolderRecursive(sourceNotesFolder, destinationNotesFolder);
      copyFolderRecursive(sourceWhiteboardFolder, destinationWhiteboardFolder);
      copyFolderRecursive(selectedZoomFolder, destinationZoomFolder);

      deleteFolderContents(sourceSessionFolder);
      deleteFolderContents(sourceNotesFolder);
      deleteFolderContents(sourceWhiteboardFolder);
      deleteFolderContents(selectedZoomFolder);
      deleteFolderContents(sourceZoomFolder);

      console.log(`Session saved: ${finalFolderName}`);
      res
        .status(200)
        .json({ message: `Session saved as "${finalFolderName}"` });
    } catch (error) {
      console.error("Error saving session:", error);
      res.status(500).json({ error: "Failed to save session" });
    }
  });

  function createSessionCSV(
    sourceSessionFolder: string,
    destinationFolder: string
  ) {
    const csvFilePath = path.join(destinationFolder, "session_data.csv");
    let dataRows: {
      iteration_id: any;
      token_label: any;
      token_id: any;
      token_x: any;
      token_y: any;
      token_visible: any;
      player_movable: any;
    }[] = [];
    let scenarioTitle = "";

    const iterationFolders = fs
      .readdirSync(sourceSessionFolder)
      .filter((folder) => folder.startsWith("Iteration_"));

    iterationFolders.forEach((folder) => {
      const sessionFilePath = path.join(
        sourceSessionFolder,
        folder,
        "settings.json"
      );

      if (fs.existsSync(sessionFilePath)) {
        try {
          const sessionData = JSON.parse(
            fs.readFileSync(sessionFilePath, "utf8")
          );

          const { id, title, tokens } = sessionData;
          scenarioTitle = title || "Untitled Scenario";

          tokens.forEach(
            (token: {
              label: any;
              id: any;
              x: any;
              y: any;
              isVisibleForPlayers: any;
              isMovableByPlayers: any;
            }) => {
              dataRows.push({
                iteration_id: id,
                token_label: token.label || "Unknown",
                token_id: token.id,
                token_x: token.x,
                token_y: token.y,
                token_visible: token.isVisibleForPlayers,
                player_movable: token.isMovableByPlayers,
              });
            }
          );
        } catch (err) {
          console.error(`Error reading JSON from ${sessionFilePath}:`, err);
        }
      }
    });

    if (dataRows.length === 0) {
      console.warn("No valid session data found.");
      return;
    }

    formatAndWriteCSV(dataRows, csvFilePath, scenarioTitle);
  }

  function formatAndWriteCSV(
    dataRows: any[],
    filePath: number | fs.PathLike,
    title: string
  ) {
    let csvContent = [];

    csvContent.push(`Title,${title},,,,`);
    csvContent.push(`,,,,,`);

    csvContent.push(
      `Iteration,Token Label,Token Id,X,Y,Token Visible,Player Movable`
    );

    const groupedData = dataRows.reduce(
      (acc: { [x: string]: any[] }, row: { iteration_id: string | number }) => {
        if (!acc[row.iteration_id]) {
          acc[row.iteration_id] = [];
        }
        acc[row.iteration_id].push(row);
        return acc;
      },
      {}
    );

    for (const iteration in groupedData) {
      const tokens = groupedData[iteration];

      const timePart = iteration.replace("Iteration_", "").replace(/_/g, ":");

      csvContent.push(
        `${timePart},${tokens[0].token_label},${
          tokens[0].token_id
        },${tokens[0].token_x.toFixed(6)},${tokens[0].token_y.toFixed(
          6
        )},${tokens[0].token_visible
          .toString()
          .toUpperCase()},${tokens[0].player_movable.toString().toUpperCase()}`
      );

      for (let i = 1; i < tokens.length; i++) {
        const token = tokens[i];
        csvContent.push(
          `,${token.token_label},${token.token_id},${token.token_x.toFixed(
            6
          )},${token.token_y.toFixed(6)},${token.token_visible
            .toString()
            .toUpperCase()},${token.player_movable.toString().toUpperCase()}`
        );
      }

      csvContent.push(`,,,,,,`);
    }

    fs.writeFileSync(filePath, csvContent.join("\n"), "utf8");
  }

  function copyFolderRecursive(source: any, target: any) {
    if (!fs.existsSync(target)) {
      fs.mkdirSync(target, { recursive: true });
    }

    fs.readdirSync(source, { withFileTypes: true }).forEach((entry) => {
      const srcPath = path.join(source, entry.name);
      const destPath = path.join(target, entry.name);

      if (entry.isDirectory()) {
        copyFolderRecursive(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    });
  }

  function deleteFolderContents(folderPath: any) {
    if (fs.existsSync(folderPath)) {
      fs.readdirSync(folderPath).forEach((file) => {
        const curPath = path.join(folderPath, file);
        if (fs.lstatSync(curPath).isDirectory()) {
          fs.rmSync(curPath, { recursive: true, force: true });
        } else {
          fs.unlinkSync(curPath);
        }
      });
    }
  }

  function renameNotesFiles(notesFolderPath: string) {
    if (!fs.existsSync(notesFolderPath)) return;

    const files = fs.readdirSync(notesFolderPath);

    files.forEach((file) => {
      const filePath = path.join(notesFolderPath, file);
      if (fs.statSync(filePath).isFile() && file.endsWith(".txt")) {
        let content = fs.readFileSync(filePath, "utf8");

        // Extract userName
        const match = content.match(/^User:\s*(.+)$/m);
        if (match) {
          const userName = match[1].trim().replace(/[^a-zA-Z0-9-_]/g, "_");
          const newFileName = `${userName}_notes.txt`;
          const newFilePath = path.join(notesFolderPath, newFileName);

          content = content.replace(/^User:\s*.+\n?/, "").trimStart();

          // Rename and overwrite the file
          fs.writeFileSync(filePath, content, "utf8");

          // Rename file
          if (!fs.existsSync(newFilePath)) {
            fs.renameSync(filePath, newFilePath);
            console.log(`Renamed and cleaned: ${file} → ${newFileName}`);
          }
        }
      }
    });
  }

  const { router: mapsRouter } = createMapRouter({
    roleMiddleware,
    maps,
    settings,
    emitter,
  });
  const { router: fileRouter } = createFilesRouter({
    roleMiddleware,
    fileStorage,
  });

  const socketSessionStore = createSocketSessionStore();

  const { router: graphqlRouter, socketIOGraphQLServer } = createGraphQLRouter({
    socketServer: io,
    socketSessionStore,
    roleMiddleware,
    db,
    fileStoragePath: path.join(env.DATA_DIRECTORY, "files"),
    publicUrl: env.PUBLIC_URL,
    maps,
    settings,
    emitter,
  });
  const notesImportRouter = createNotesRouter({ db, roleMiddleware });

  apiRouter.use(mapsRouter);
  // apiRouter.use(notesRouter);
  apiRouter.use(fileRouter);
  app.use(graphqlRouter);
  apiRouter.use(notesImportRouter);

  apiRouter.use("/zoom", zoomRoutes);

  app.use("/api", apiRouter);

  const indexHtml = path.join(env.PUBLIC_PATH, "index.html");
  const indexHtmlContent = fs
    .readFileSync(indexHtml, "utf-8")
    .replace(/__PUBLIC_URL_PLACEHOLDER__/g, env.PUBLIC_URL)
    .replace(/<base href="\/" \/>/, `<base href="${env.PUBLIC_URL}/" />`);

  app.get("/", (_, res) => {
    res.send(indexHtmlContent);
  });

  app.get("/dm", (_, res) => {
    res.send(indexHtmlContent);
  });

  // Consider all URLs under /public/ as static files, and return them raw.
  app.use(
    express.static(path.join(env.PUBLIC_PATH), {
      maxAge: "1y",
    })
  );

  // catch 404 and forward to error handler
  app.use((req, res, next) => {
    const err = new Error("Not Found");
    (err as ErrorWithStatus).status = 404;
    next(err);
  });

  // error handlers

  // development error handler
  // will print stacktrace
  if (app.get("env") === "development") {
    app.use(((err, _, res) => {
      res.status(err.status || 500);
      res.render("error", {
        message: err.message,
        error: err,
      });
    }) as ErrorRequestHandler);
  }

  // production error handler
  // no stacktraces leaked to user
  app.use(((err, req, res) => {
    console.log(err);
    res.status(err.status || 500);
    res.render("error", {
      message: err.message,
      error: {},
    });
  }) as ErrorRequestHandler);

  const authenticatedSockets = new Set();

  let currentCollaborationLink: string | null = null;

  io.on("connection", (socket) => {
    console.log(`WS client ${socket.handshake.address} ${socket.id} connected`);

    socketSessionStore.set(socket, {
      id: socket.id,
      role: "unauthenticated",
    });

    socket.on("update-recording-status", (data) => {
      // Broadcast to everyone *except* the sender (DM)
      socket.broadcast.emit("update-recording-status", data);
    });

    socket.on("authenticate", ({ password, desiredRole }) => {
      socketIOGraphQLServer.disposeSocket(socket);
      // TODO: NEED TO MAKE SURE THIS DOESNT BREAK THINGS
      //socket.removeAllListeners();

      const role = getRole(password);
      if (role === null) {
        console.log(
          `WS ${socket.handshake.address} ${socket.id} client authenticate failed`
        );
        return;
      }

      console.log(
        `WS client ${socket.handshake.address} ${socket.id} authenticate ${role}`
      );

      authenticatedSockets.add(socket);
      socketSessionStore.set(socket, {
        id: socket.id,
        role: role === "DM" ? desiredRole : "user",
      });

      socketIOGraphQLServer.registerSocket(socket);

      socket.on("update-collaboration-link", (payload: { link: string }) => {
        // Update the server's current link
        currentCollaborationLink = payload.link;
        // Broadcast to all clients
        io.emit("collaboration-link-updated", { link: payload.link });
      });

      socket.emit("authenticated");
    });

    // Send the current collaboration link to the new client upon connection
    if (currentCollaborationLink) {
      socket.emit("collaboration-link-updated", {
        link: currentCollaborationLink,
      });
    }

    socket.once("disconnect", function () {
      authenticatedSockets.delete(socket);
    });
  });

  return { app, httpServer, io };
};

export { maps };
