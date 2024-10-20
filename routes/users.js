var express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
let dotenv = require('dotenv').config()
const path = require('path');
// local
const uri = `mongodb+srv://waseem:${process.env.MONGO_PASSWORD}@cluster0.5zygy.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
//server
//const uri = `mongodb+srv://waseem:${process.env.MONOGO_PASSWORD}@cluster0.5zygy.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
var router = express.Router();
const Joi = require("joi");
const bcrypt = require("bcrypt");
const saltRounds = 10;
const multer = require('multer');
const { bucket } = require('./firebase');
const { v4: uuidv4 } = require('uuid');
const upload = multer({ storage: multer.memoryStorage() });

const signUpSchema = Joi.object({
  name: Joi.string().required(),
  email: Joi.string().email().required(),
  password: Joi.string()
    .min(8) // Minimum length
    .max(30) // Maximum length
    .pattern(new RegExp("(?=.*[a-z])")) // At least one lowercase letter
    .pattern(new RegExp("(?=.*[A-Z])")) // At least one uppercase letter
    .pattern(new RegExp("(?=.*[0-9])")) // At least one digit
    .pattern(new RegExp("(?=.*[!@#$%^&*])")) // At least one special character
    .required()
    .messages({
      "string.min": "Password must be at least 8 characters long",
      "string.max": "Password must not be longer than 30 characters",
      "string.pattern.base":
        "Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character",
    }),
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),

})


const grievienceSchema = Joi.object({
  complaint: Joi.string().required(),
  description: Joi.string().required(),
  latitude: Joi.number().required(),
  longitude: Joi.number().required(),
  userId: Joi.string().required()

})

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

/* GET users listing. */
router.get("/", function (req, res, next) {
  res.send("respond with a resource");
});
router.post("/create", async function (req, res, next) {
  const data = req.body;
  const { error } = signUpSchema.validate(data);

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
    const users = database.collection("users");
    const findResult = await users.findOne({ email: email });
    if (findResult) {
      return res.status(400).json({ error: "user already exist" });
    }

    const doc = {
      "name": name,
      "email": email,
      "password": hashedPassword
    }
    const result = await users.insertOne(doc);

    res.status(201).send({ 'id': result.insertedId, messsage: "user Created SuccessFully" });
  } catch (error) {
    console.error(error);
    res.status(500).send('An error occurred');
  }
  finally {
    await client.close();
  }


});

router.post("/login", async function (req, res, next) {

  const data = req.body;
  const { error } = loginSchema.validate(data);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }
  const { password, email } = data;
  await client.connect();
  const database = client.db("streetSOS");
  const users = database.collection("users");
  const findResult = await users.findOne({ email: email });
  if (!findResult) {
    return res.status(400).json({ error: "user does'nt exist" });
  }
  if (findResult.email != email) {
    res.status(401).send({ error: 'Invalid credentials' });
  }


  const passwordMatch = await bcrypt.compare(password, findResult.password);

  if (passwordMatch) {
    res.status(200).send({ message: 'Login successful', userId: findResult._id });
  } else {
    res.status(400).send({ error: 'Invalid credentials' });
  }

  //res.status(200).send({'User found successfully':findResult});

})

router.post("/complaint", async function (req, res, next) {
  try {
    const data = req.body;
    const { error } = grievienceSchema.validate(data);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }
    const { complaint, description, latitude, longitude, userId } = data
    await client.connect();
    const database = client.db("streetSOS");
    const grievance = database.collection("grievance");
    const doc = {
      complaint: complaint,
      description: description,
      location: {
        type: "Point",
        coordinates: [longitude, latitude],
      },
      verified: false,
      userID: ObjectId.createFromHexString(userId),
    };
    const result = await grievance.insertOne(doc);
    res.status(201).send({ message: 'complaint registered successfully', id: result.insertedId });

  }
  catch (error) {
    console.error(error);
    res.status(500).send('An error occurred');
  }
  finally {
    await client.close();
  }

})

router.post('/upload', upload.single('photo'), async (req, res) => {
  try {
    console.log("hereeeee");
    // Get the file from the request
    const file = req.file;
    const { id } = req.body; // Assuming `id` is a field in the form-data

    if (!file || !id) {


      return res.status(400).json({ error: 'ID and file are required.' });
    }

    // Generate a unique filename
    const fileName = `${uuidv4()}${path.extname(file.originalname)}`;

    // Upload the file to Firebase storage
    const blob = bucket.file(fileName);
    const blobStream = blob.createWriteStream({
      metadata: {
        contentType: file.mimetype
      }
    });

    blobStream.on('error', (err) => {
      console.error(err);
      res.status(500).json({ error: "something went wrong" });
    });

    blobStream.on('finish', async () => {
      // Get the public URL of the file
      await blob.makePublic();
      const publicUrl = `https://storage.googleapis.com/${bucket.name}/${blob.name}`;

      // Save the URL to MongoDB
      await client.connect();
      const database = client.db("streetSOS");
      const grievance = database.collection("grievance");
      const result = await grievance.updateOne({ _id: ObjectId.createFromHexString(id) }, // Find the document with the matching id
        { $set: { url: publicUrl } });

      // Send the URL as a response
      res.status(200).json({ url: publicUrl });
    });

    blobStream.end(file.buffer);
  } catch (error) {
    console.log("hereeeee");
    console.error('Error during file upload:', error);
    res.status(500).json({ error: 'Error uploading file' });
  }

})
router.get("/getAllcomplaints", async function (req, res, next) {
  try {

    const id = req.query.id
    console.log(id)
    await client.connect();
    const database = client.db("streetSOS");
    const grievance = database.collection("grievance");
    const result = await grievance.find({ userID: ObjectId.createFromHexString(id) }).toArray();
    res.status(200).send({ message: "complaints retrieved successfully", data: result });

  }
  catch (error) {
    console.error(error);
    res.status(500).send('An error occurred');
  }
  finally {
    await client.close();
  }

})











module.exports = router;
