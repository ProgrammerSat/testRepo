require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const app = express();
const port = process.env.PORT;
const MONGO_URI = process.env.MONGO_URI;
const usersRouter = require("./routes/users");
const subscriptionsRouter = require("./routes/subscriptions");
const couponsRouter = require("./routes/coupons");
var cors = require("cors");
const User = require("./models/User"); // Importing the schema

// MongoDB Connection
mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

//Establishing connection with Mongo DB via mongoose
const dbConn = mongoose.connection;

//Connection error message
dbConn.on("error", console.error.bind(console, "MongoDB connection error:"));

//Console print if monoDB connection established or not, plus syncing Indexes
dbConn.once("open", async () => {

  console.log("Connected to MongoDB");
  try {
    await User.syncIndexes(); // <-- Ensure indexes are in sync (unique constraints)
    console.log("Indexes synced");
  } catch (error) {
    console.error("Error syncing indexes:", error);
  }
});

// Middleware
app.use(bodyParser.json());

//Cors
app.use(cors());

//Invoke routes

app.use("/user", usersRouter);
app.use("/subscription", subscriptionsRouter);
app.use("/coupon", couponsRouter);

// Starting the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
