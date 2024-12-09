const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const bcrypt = require("bcrypt");
const nodemailer = require('nodemailer');
const bodyParser = require('body-parser');
const crypto = require('crypto'); // To generate random OTPs
const jwt = require("jsonwebtoken");
const path = require('path');
const multer = require('multer');
const fs = require('fs');

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

// Middleware to serve static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(bodyParser.json());

const PORT = process.env.PORT || 7760;
const MONGO_URI = process.env.MONGO_URI;

// Ensure the uploads directory exists
const uploadsPath = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsPath)) {
    fs.mkdirSync(uploadsPath, { recursive: true });
}

// Multer storage configuration
const upload = multer({
    storage: multer.diskStorage({
        destination: (req, file, cb) => {
            cb(null, uploadsPath); // Save files to the 'uploads' folder
        },
        filename: (req, file, cb) => {
            cb(null, Date.now() + path.extname(file.originalname));
        },
    }),
    fileFilter: (req, file, cb) => {
        const filetypes = /jpeg|jpg|png|gif|bmp|webp|tiff|svg|mp4|mov|avi|mkv|flv|wmv|webm|mpg|mpeg|3gp/; // Common formats
        const mimetype = filetypes.test(file.mimetype);
        const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

        if (mimetype && extname) {
            return cb(null, true);
        }
        cb(new Error('Invalid file type. Only images and videos are allowed.'));
    },
});

// Connect to MongoDB
mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log("MongoDB connected"))
    .catch((err) => console.error(err));

// CORS Configuration
app.use(cors({
    origin: ['https://sign-frontend.vercel.app', 'https://your-backend.onrender.com'],
    methods: ['GET', 'POST', 'DELETE'],
}));

// Define User Schema
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phoneNumber: { type: String },
});

const User = mongoose.model("User", userSchema);

// Setup Nodemailer Transporter
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

// OTP Route
app.post('/send-otp', (req, res) => {
    const { email } = req.body;
    if (!email) {
        return res.status(400).send('Email is required');
    }

    const otp = crypto.randomInt(100000, 999999);
    const mailOptions = {
        from: 'cheluvaraj1011@gmail.com',
        to: email,
        subject: 'Your OTP Code',
        text: `Your OTP code is ${otp}`,
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.log(error);
            return res.status(500).send('Error sending OTP');
        } else {
            console.log('OTP sent: ' + info.response);
            return res.status(200).send({ otp, message: 'OTP sent successfully' });
        }
    });
});

// OTP Verification
app.post('/verify-otp', (req, res) => {
    const { enteredOtp, generatedOtp } = req.body;

    if (String(enteredOtp) === String(generatedOtp)) {
        return res.status(200).send('OTP verified successfully');
    } else {
        return res.status(400).send('Invalid OTP');
    }
});

// Create New User
app.post('/Newuser', async (req, res) => {
    const { username, password, email, phoneNumber } = req.body;

    if (!username || !password || !email) {
        return res.status(400).json({ message: 'Username, password, and email are required.' });
    }

    try {
        const existingUser = await User.findOne({ $or: [{ username }, { email }] });
        if (existingUser) {
            return res.status(400).json({ message: 'User with this username or email already exists.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({ username, password: hashedPassword, email, phoneNumber });
        await newUser.save();

        res.status(201).json({ message: 'User created successfully!', user: newUser });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error, please try again later.' });
    }
});

// Login
app.post("/login", async (req, res) => {
    const { email, password } = req.body;

    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ status: "Failed", msg: "User Does Not Exist ❌" });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(400).json({ status: "Failed", msg: "Invalid Password ❌" });
        }

        res.status(200).json({ status: "Success", msg: "Login Successfully ✅", data: { email: user.email, username: user.username } });
    } catch (error) {
        console.error(error);
        res.status(500).json({ status: "Failed", msg: "Server error ❌" });
    }
});

// Items Schema
const ItemsSchema = new mongoose.Schema({
    text: { type: String, required: true },
    category: { type: String, required: true },
    file: { type: String, required: true },
});

const Item = mongoose.model("Item", ItemsSchema);

// Add New Item
app.post("/NewItem", upload.array("file"), async (req, res) => {
    try {
        const { text, category } = req.body;
        const files = req.files;

        if (!text || !category || !files || files.length === 0) {
            return res.status(400).json({ status: "Failed", msg: "Missing required fields" });
        }

        const existingItem = await Item.findOne({ text });
        if (existingItem) {
            return res.status(400).json({ status: "Failed", msg: "Text already exists ❌" });
        }

        const newItem = new Item({
            text,
            category,
            file: files[0].path,
        });

        await newItem.save();
        res.status(201).json({ status: "Success", msg: "Item added successfully ✅" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ status: "Failed", error, msg: "Server error ❌" });
    }
});

// Start the server
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
