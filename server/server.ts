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

  const maps = new Maps({ processTask, dataDirectory: env.DATA_DIRECTORY });
  const settings = new Settings({ dataDirectory: env.DATA_DIRECTORY });
  const researchPath = path.join(__dirname, "..", "public", "research");
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

  apiRouter.get("/active-map", requiresPcRole, (req, res) => {
    let activeMap = null;
    const activeMapId = settings.get("currentMapId");
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

  apiRouter.get("/list-folders", requiresDmRole, async (req, res) => {
    try {
      // Query the sessions table for all session names
      const sessions = await db.all("SELECT name FROM sessions");

      // If there are no sessions found, return a 404 response
      if (sessions.length === 0) {
        return res.status(404).json({
          error: { message: "No folders found in database" },
        });
      }

      // Send back the folder names as a JSON response
      res.json({ folders: sessions.map((session) => session.name) });
    } catch (error) {
      console.error("Error fetching sessions from the database:", error);
      return res.status(500).json({
        error: { message: "Failed to fetch sessions from the database" },
      });
    }
  });

  app.post("/api/recording", (req, res) => {
    console.log("Recording API route hit"); // Check if the route is being triggered
    const filePath = path.join(researchPath, "settings.json");
    console.log("File path to write:", filePath); // Debug the file path

    fs.readFile(filePath, "utf8", (err, data) => {
      if (err) {
        console.error("Error reading file:", err);
        return res.status(500).json({ message: "Error reading file" });
      }

      let jsonData;
      try {
        jsonData = JSON.parse(data); // Parse the JSON content
      } catch (e) {
        console.error("Error parsing JSON:", e);
        return res.status(500).json({ message: "Error parsing JSON" });
      }

      const updatedState =
        jsonData.recording === "recording" ? "stopped" : "recording";
      jsonData.recording = updatedState;
      console.log("Updated recording state:", updatedState); // Check updated state

      fs.writeFile(filePath, JSON.stringify(jsonData, null, 2), (err) => {
        if (err) {
          console.error("Error writing file:", err);
          return res.status(500).json({ message: "Error updating file" });
        }
        console.log("File written successfully"); // Confirm file was written
        res.json({ recording: updatedState });
      });
    });
  });

  apiRouter.get("/download-folder/:folderName", requiresDmRole, (req, res) => {
    const { folderName } = req.params;
    const folderPath = path.join(researchPath, "downloads", folderName);

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

  io.on("connection", (socket) => {
    console.log(`WS client ${socket.handshake.address} ${socket.id} connected`);

    socketSessionStore.set(socket, {
      id: socket.id,
      role: "unauthenticated",
    });

    socket.on("authenticate", ({ password, desiredRole }) => {
      socketIOGraphQLServer.disposeSocket(socket);
      socket.removeAllListeners();

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

      socket.emit("authenticated");
    });

    socket.once("disconnect", function () {
      authenticatedSockets.delete(socket);
    });
  });

  return { app, httpServer, io };
};
