import express from "express";
import session from "express-session";
const app = express();
import { createServer } from "http";
const httpServer = createServer(app);
import { Server } from "socket.io";
import { engine } from "express-handlebars";
const io = new Server(httpServer);
import path from "path";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import cookieParser from "cookie-parser"
import MongoStore from "connect-mongo";
const advancedOptions = {useNewUrlParser: true, useUnifiedTopology: true}

import { normalizarMensajes } from "./utils/utils.js";
import ProductosRouter from "./routers/productos.js";
const PORT = process.env.PORT || 8080;
import MensajesDaoArchivo from "./daos/mensajes/MensajesDaoArchivo.js";
const mensajesApi = new MensajesDaoArchivo();
import MockApi from "./daos/productos/MockApi.js";
const apiProductos = new MockApi();

const mensajes = [];
const users = [];
let userName = "";
let loggedIn = false;
let loggedOut = false;

// Handlebars config
app.engine(
  "hbs",
  engine({
    extname: "hbs",
    defaultLayout: "main.hbs",
    layoutsDir: path.resolve(__dirname, "./views/layouts"),
    partialsDir: path.resolve(__dirname, "./views/partials"),
  })
);
app.set("views", "./views");
app.set("view engine", "hbs");

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.resolve(__dirname, "./views")));
app.use(cookieParser())
app.use(
  session({
    store: MongoStore.create({
      mongoUrl: "mongodb+srv://user:ecommerce@cluster0.ak3vl.mongodb.net/sesiones",
      mongoOptions: advancedOptions
    }),
    // It holds the secret key for session
    secret: "I am girl",
 
    // Forces the session to be saved
    // back to the session store
    resave: true,

    // Forces a session that is "uninitialized"
    // to be saved to the store
    saveUninitialized: false,
    cookie: {
      // Session expires after 1 min of inactivity.
      expires: 60000,
      maxAge: 600000,
    },
  })
);

// Routes
app.use("/productos-test", new ProductosRouter());

// Listen
httpServer.listen(PORT, () => {
  console.log(`Server is up and running on port: `, PORT);
});

// Sockets events
io.on("connection", (socket) => {
  console.log(`New client connection! socket_id: ${socket.id}`);
  // send mesages
  const normalizedMessages = normalizarMensajes(mensajes);
  socket.emit("messages", normalizedMessages);

  // Join chat
  socket.on("join-chat", ({ email }) => {
    const newUser = {
      id: socket.id,
      email,
    };
    users.push(newUser);

    // Welcome current user
    // socket.emit('chat-message', normalizedMessages);

    // Broadcast user connection
    // socket.broadcast.emit('chat-message', normalizedMessages);
  });

  socket.on("new-message", (msg) => {
    mensajesApi.save(msg);
    mensajes.push(msg);
    const normalizedMessages = normalizarMensajes({ id: "mensajes", mensajes });

    io.emit("chat-message", normalizedMessages);
  });
});

function auth(req, res, next) {
  if (req.session?.user !== ' ') {
    return next();
  }
  return res.status(401).send('Error de autorizacion');
}

app.post("/login", auth, (req, res) => {
  userName = req.body.username;
  if (userName === '' && userName === ' ') {
    return res.send('Login failed')
  }
  loggedIn = true;
  req.session.user = userName;
  res.render("index", { loggedIn, userName, productos: apiProductos.getAll() });
});

app.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (!err) {
      loggedIn = false;
      loggedOut = true;
      res.render("index", { loggedOut, userName });
    } else {
      res.status(401).send({ status: "Logout error", body: err });
    }
  });
});

