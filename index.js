const express = require("express");
require("dotenv").config();
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion } = require("mongodb");
const cors = require("cors");
const app = express();
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

// default route
app.get("/", (req, res) => {
  res.send("Laptop Mart server is running");
});

// connect to database(mongoDb)

const uri = `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@cluster0.rgyxe1r.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

const verifyJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send({ message: "unauthorized access" });
  }

  const token = authHeader.split(" ")[1];
  jwt.verify(token, process.env.JWT_SECRET, function (err, decoded) {
    if (err) {
      return res.status(403).send({ message: "forbidden access" });
    }
    req.decoded = decoded;
  });
  next();
};

async function run() {
  try {
    // users collection
    const Users = client.db("laptopMart").collection("usersCollection");

    // product collection
    const Products = client.db("laptopMart").collection("productsCollection");

    /* ------------------------------
    --------- All get Route --------
    --------------------------------- */

    // give user access token
    app.get("/jwt", async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const user = await Users.findOne(query);
      if (!user) {
        return res.status(401).message({ message: "unauthorized access" });
      }
      const token = jwt.sign({ email }, process.env.JWT_SECRET, {
        expiresIn: "1h",
      });
      res.send({ token });
    });

    // verify seller
    const verifySeller = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await Users.findOne(query);
      if (!user?.role === "seller") {
        return res.status(401).send({ message: "unauthorized access" });
      }
      next();
    };

    // seller verification
    app.get("/seller", verifyJWT, async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const user = await Users.findOne(query);
      res.send({ isSeller: user?.role === "seller" ? true : false });
    });

    /* ------------------------------
    --------- All Post Route -------- 
    ---------------------------------*/

    // post new user
    app.post("/users", async (req, res) => {
      const user = req.body;
      const result = await Users.insertOne(user);
      res.send({ result });
    });

    // post a new product
    app.post("/products", verifyJWT, verifySeller, async (req, res) => {
      const product = req.body;
      const result = await Products.insertOne(product);
      res.send({ result });
    });

    /* -------------------------------
    --------- All Delete Route -------
    ---------------------------------- */
  } finally {
  }
}

run().catch(console.log);

app.listen(port, () => {
  console.log(`Laptop server is running port ${port}`);
});
