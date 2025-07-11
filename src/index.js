const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const mongoose = require("mongoose");
const axios = require("axios");

//Routes
const adminRoute = require("../routes/adminRoute")
const authRoute = require("../routes/authRoute")
const orderRoute = require("../routes/orderRoute")
const productRoute = require("../routes/productRoute")
const customRoute = require("../routes/customerRoute");
const cartRoute = require("../routes/cartRoute");
const variantRoute = require("../routes/variantRoute")


//.env
const dotenv = require("dotenv");
const { custom } = require("joi");
dotenv.config();

// app and constants
const PORT = process.env.PORT || 8000;
const MONGO_LOCAL_URI = "mongodb://localhost:27017/oglepeek"
const MONGO_PROD_URI = process.env.PROD_URI || "mongodb://localhost:27017/oglepeek"

const app = express();
const allowedOrigins = [
    "http://localhost:3000",
    "https://oglepeek-frontend-web.vercel.app"
];

app.use(
    cors({
        origin: function (origin, callback) {
            // Allow requests with no origin (like mobile apps or curl)
            if (!origin) return callback(null, true);
            if (allowedOrigins.includes(origin)) {
                return callback(null, true);
            } else {
                return callback(new Error("Not allowed by CORS"));
            }
        },
        credentials: true
    })
);

app.use(express.json());
app.use(cookieParser());

//Connect to Database
async function connectToMongo() {
    mongoose.set("strictQuery", false);
    try {
        await mongoose.connect(MONGO_PROD_URI);
        console.log("Successfully connected to MongoDB database");
        console.log("Connected to database:", mongoose.connection.name); // Logs the database name
    } catch (err) {
        console.error("Error connecting to MongoDB:", err);
    }
}



connectToMongo().catch(err => console.log("Some error"));


//Using the routes
app.use("/api/orders", orderRoute);
app.use("/api/auth", authRoute);
app.use("/api/product", productRoute);
app.use("/api/admin", adminRoute);
app.use("/api/customers", customRoute);
app.use("/api/cart", cartRoute);
app.use("/api/variant", variantRoute)


app.get("/", (req, res) => {
    res.send("I am OglePeek Server");
})

app.listen(PORT, (req, res) => {
    console.log(`Server started at PORT ${PORT}`)
})


const backendURL = process.env.Backend_URL;

setInterval(() => {
    axios.get(`${backendURL}`)
        .then(response => {
            console.log('Pinged backend to keep it alive.');
        })
        .catch(error => {
            console.error('Error pinging backend:', error);
        });
}, 10 * 60 * 1000);

app.listen(PORT, (req, res) => {
    console.log(`Server listening on PORT ${PORT}`)
})
