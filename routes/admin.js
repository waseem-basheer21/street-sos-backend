var express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
let dotenv = require("dotenv").config();

const uri = `mongodb+srv://waseem:${process.env.MONGO_PASSWORD}@cluster0.5zygy.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
var router = express.Router();
const Joi = require("joi");
const bcrypt = require("bcrypt");
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const adminLoginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});
const verifySchema = Joi.object({
  verify: Joi.bool().required(),
  message: Joi.string().required(),
  id: Joi.string().required(),
});

router.post("/login", async function (req, res, next) {
  const data = req.body;
  const { error } = adminLoginSchema.validate(data);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }
  const { password, email } = data;
  await client.connect();
  const database = client.db("streetSOS");
  const users = database.collection("admin");
  const findResult = await users.findOne({ email: email });
  if (!findResult) {
    return res.status(400).json({ error: "invalid admin credentials" });
  }
  if (findResult.email != email) {
    res.status(401).send({ error: "Invalid credentials" });
  }

  const passwordMatch = await bcrypt.compare(password, findResult.password);

  if (passwordMatch) {
    res
      .status(200)
      .send({ message: "Login successful", userId: findResult._id });
  } else {
    res.status(400).send({ error: "Invalid credentials" });
  }

  //res.status(200).send({'User found successfully':findResult});
});
router.get("/getAllcomplaints", async function (req, res, next) {
  try {
    await client.connect();
    const database = client.db("streetSOS");
    const grievance = database.collection("grievance");
    const result = await grievance.find({}).toArray();
    res
      .status(200)
      .send({ message: "complaints retrieved successfully", data: result });
  } catch (error) {
    console.error(error);
    res.status(500).send("An error occurred");
  } finally {
    await client.close();
  }
});

router.post("/create", async function (req, res, next) {
  const data = req.body;
  const { error } = adminLoginSchema.validate(data);

  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }
  const { name, password, email } = data;
  try {
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("streetSOS").command({ ping: 1 });
    const database = client.db("streetSOS");
    const admin = database.collection("admin");
    const findResult = await admin.findOne({ email: email });
    if (findResult) {
      return res.status(400).json({ error: "user already exist" });
    }

    const doc = {
      email: email,
      password: hashedPassword,
    };
    const result = await admin.insertOne(doc);

    res.status(201).send({ "User registered successfully": result });
  } catch (error) {
    console.error(error);
    res.status(500).send("An error occurred");
  } finally {
    await client.close();
  }
});
router.post("/verifyComplaint", async function (req, res, next) {
  try {
    const data = req.body;
    const { error } = verifySchema.validate(data);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }
    const { verify, message, id } = data;

    await client.connect();
    const database = client.db("streetSOS");
    const grievance = database.collection("grievance");
    const result = await grievance.updateOne(
      { _id: ObjectId.createFromHexString(id) },
      { $set: { verified: verify, message: message } }
    );

    res
      .status(200)
      .send({ message: "complaints changed successfully", data: result });
  } catch (error) {
    console.error(error);
    res.status(500).send("An error occurred");
  } finally {
    await client.close();
  }
});

module.exports = router;
