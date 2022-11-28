const express = require("express");
require("dotenv").config();
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const stripe = require("stripe")(process.env.STRIPE_SECRET);
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
    next();
  });
};

async function run() {
  try {
    // users collection
    const Users = client.db("laptopMart").collection("usersCollection");

    // product collection
    const Products = client.db("laptopMart").collection("productsCollection");

    // category collection
    const Category = client.db("laptopMart").collection("categoryCollection");

    // booking collection
    const Booking = client.db("laptopMart").collection("bookingsCollection");

    // booking collection
    const Payments = client.db("laptopMart").collection("paymentsCollection");

    // report collection
    const Reports = client.db("laptopMart").collection("reportsCollection");

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

    // verify admin
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded?.email;
      const query = { email: email };
      const user = await Users.findOne(query);
      if (!user?.role === "admin") {
        return res.status(401).send({ message: "unauthorized access" });
      }
      next();
    };

    // verify seller
    const verifySeller = async (req, res, next) => {
      const email = req.decoded?.email;
      const query = { email: email };
      const user = await Users.findOne(query);
      if (!user?.role === "seller") {
        return res.status(401).send({ message: "unauthorized access" });
      }
      next();
    };

    // admin verification
    app.get("/admin", verifyJWT, async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const user = await Users.findOne(query);
      res.send({ isAdmin: user?.role === "admin" ? true : false });
    });

    // get all sellers or buyers
    app.get("/users", verifyJWT, verifyAdmin, async (req, res) => {
      const role = req.query.role;
      const query = { role: role };
      const result = await Users.find(query).toArray();
      res.send({ result });
    });

    // seller verification
    app.get("/seller", verifyJWT, async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const user = await Users.findOne(query);
      res.send({ isSeller: user?.role === "seller" ? true : false });
    });

    // get all products
    app.get("/products", verifyJWT, verifySeller, async (req, res) => {
      const email = req.decoded.email;
      const query = { sellerEmail: email };
      const products = await Products.find(query).toArray();
      res.send({ products });
    });

    app.get("/products", verifyJWT, async (req, res) => {
      const query = {};
      const products = await Products.find(query).toArray();
      res.send({ products });
    });

    // get all categories
    app.get("/category", async (req, res) => {
      const query = {};
      const result = await Category.find(query).toArray();
      res.send({ result });
    });

    // get singe brand product
    app.get("/brand/:id", verifyJWT, async (req, res) => {
      const brandId = req.params.id;
      const query = { categoryId: brandId, sold: false };
      const products = await Products.find(query).toArray();
      const categoryQuery = { _id: ObjectId(brandId) };
      const category = await Category.findOne(categoryQuery);
      res.send({ category: category.category, products });
    });

    // get all booking by specific user
    app.get("/bookings", verifyJWT, async (req, res) => {
      const email = req.decoded.email;
      const query = { buyerEmail: email };
      const result = await Booking.find(query).toArray();
      res.send({ result });
    });

    // get single booking
    app.get("/bookings/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await Booking.findOne(query);
      res.send({ result });
    });

    // verify user
    app.get("/verify-user/:email", verifyJWT, verifyAdmin, async (req, res) => {
      const email = req.params.email;
      const filter = { email: email };
      const option = { upsert: true };
      const updateProperty = {
        $set: {
          userVerified: true,
        },
      };
      const result = await Users.updateOne(filter, updateProperty, option);
      const productQuery = { sellerEmail: email };
      const updateProduct = await Products.updateMany(
        productQuery,
        updateProperty,
        option
      );
      res.send({ result, updateProduct });
    });

    // get advertise product
    app.get("/product-add", async (req, res) => {
      const query = { advertise: true, sold: false };
      const result = await Products.find(query).toArray();
      res.send({ result });
    });

    // get reported product
    app.get("/reports", verifyJWT, verifyAdmin, async (req, res) => {
      const query = {};
      const result = await Reports.find({}).toArray();
      res.send({ result });
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
      const email = req.decoded?.email;
      const query = { email: email };
      const user = await Users.findOne(query);
      const product = req.body;
      product.userVerified = user.userVerified;
      product.sellerName = user.name;
      product.sellerEmail = email;
      const result = await Products.insertOne(product);
      res.send({ result });
    });

    // post category
    app.post("/category", verifyJWT, verifyAdmin, async (req, res) => {
      const category = req.body;
      const categoryName = category.category;
      const query = { category: categoryName };
      const alreadyExisted = await Category.findOne(query);
      if (alreadyExisted) {
        return res.status(409).send({ message: "conflict request" });
      }
      const result = await Category.insertOne(category);
      res.send({ result });
    });

    // post booking
    app.post("/bookings", verifyJWT, async (req, res) => {
      const booking = req.body;
      const buyerEmail = booking.buyerEmail;
      const productId = booking.productId;
      const query = { buyerEmail: buyerEmail, productId: productId };
      const alreadyExisted = await Booking.findOne(query);
      if (alreadyExisted) {
        return res.status(409).send({ message: "conflict request" });
      }
      const result = await Booking.insertOne(booking);
      res.send({ result });
    });

    // stripe
    app.post("/create-payment-intent", verifyJWT, async (req, res) => {
      const booking = req.body;
      const price = booking.price;
      const amount = price * 100;

      const paymentIntent = await stripe.paymentIntents.create({
        currency: "usd",
        amount: amount,
        payment_method_types: ["card"],
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    // post successful payment
    app.post("/payments/:id", verifyJWT, async (req, res) => {
      const payment = req.body;
      const result = await Payments.insertOne(payment);
      // update product
      const id = req.params.id;
      const productQuery = { _id: ObjectId(id) };
      const productUpdateProperty = {
        $set: {
          sold: true,
        },
      };
      const productUpdate = await Products.updateOne(
        productQuery,
        productUpdateProperty
      );
      result.productUpdate = productUpdate;
      // update booking
      const bookingQuery = { productId: id };
      const bookingUpdateProperty = {
        $set: {
          paid: true,
        },
      };
      const bookingUpdate = await Booking.updateMany(
        bookingQuery,
        bookingUpdateProperty
      );
      result.bookingUpdate = bookingUpdate;
      res.send({ result });
    });

    // post report
    app.post("/reports", verifyJWT, async (req, res) => {
      const report = req.body;
      const name = report.name;
      const query = { name: name };
      const alreadyExisted = await Reports.findOne(query);
      if (alreadyExisted) {
        return res.status(409).send({ message: "conflict access" });
      }
      const result = await Reports.insertOne(report);
      res.send({ result });
    });

    /* ------------------------------
    --------- All Update method -----
    --------------------------------- */

    // advertise product
    app.patch("/products/:id", verifyJWT, verifySeller, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: ObjectId(id) };
      const updateProperty = {
        $set: {
          advertise: true,
        },
      };
      const result = await Products.updateOne(filter, updateProperty);
      res.send({ result });
    });

    /* -------------------------------
    --------- All Delete Route -------
    ---------------------------------- */

    // delete product by seller
    app.delete("/products/:id", verifyJWT, verifySeller, async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await Products.deleteOne(query);
      res.send({ result });
    });

    // delete user by admin
    app.delete("/user/:id", verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await Users.deleteOne(query);
      res.send({ result });
    });

    // delete booking
    app.delete("/bookings/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await Booking.deleteOne(query);
      res.send({ result });
    });
  } finally {
  }
}

run().catch(console.log);

app.listen(port, () => {
  console.log(`Laptop server is running port ${port}`);
});
