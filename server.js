const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const bcrypt = require("bcrypt");
const nodemailer = require('nodemailer');
const bodyParser = require('body-parser');
const crypto = require('crypto');  // To generate random OTPs

const jwt = require("jsonwebtoken");
const { Server } = require("socket.io");
const { type } = require("os");
const path = require('path');
const multer = require('multer');

dotenv.config();

const app = express();
app.use(express.json());
// Middleware to serve static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(cors());
app.use(bodyParser.json());

const PORT = process.env.PORT || 7760;
const MONGO_URI = process.env.MONGO_URI;

// Allow requests from your frontend domain
app.use(cors({
  origin: 'https://chat-frontend-sepia.vercel.app/', // Change this to your frontend URL
  methods: 'GET,POST,PUT,DELETE',
  allowedHeaders: 'Content-Type,Authorization'
})); 




// Connect to MongoDB
mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log("MongoDB connected"))
    .catch((err) => console.error(err));

    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

    // To Store Uploads


    const upload = multer({
        storage: multer.diskStorage({
            destination: (req, file, cb) => {
                cb(null, 'uploads/');
            },
            filename: (req, file, cb) => {
                cb(null, Date.now() + path.extname(file.originalname));
            }
        }),
        fileFilter: (req, file, cb) => {
            const filetypes = /jpeg|jpg|png|gif|bmp|webp|tiff|svg|mp4|mov|avi|mkv|flv|wmv|webm|mpg|mpeg|3gp/;  // All common image and video formats
            const mimetype = filetypes.test(file.mimetype);
            const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    
            if (mimetype && extname) {
                return cb(null, true);
            }
            cb(new Error('Invalid file type. Only images and videos are allowed.'));
        }
    });

// User Schema
const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    email:{type:String,required:true,unique: true},
    phoneNumber:{type:String}
});

const User = mongoose.model("User", userSchema);


// Setup Nodemailer Transporter
const transporter = nodemailer.createTransport({
    service: 'gmail', // You can change this to another email service (e.g., Outlook, Yahoo)
    auth: {
        user: 'santhan.machavarapu@gmail.com', // Replace with your email
        pass: 'ahyb taar sdzo sgay',   // Replace with your email password or app-specific password
    },
});

// Route to send OTP
app.post('/send-otp', (req, res) => {
    const { email } = req.body; // Get email from client
    if (!email) {
        return res.status(400).send('Email is required');
    }

    // Generate a random 6-digit OTP
    const otp = crypto.randomInt(100000, 999999);

    // Send OTP via email
    const mailOptions = {
        from: 'santhan.machavarapu@gmail.com',  // Replace with your email
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
            return res.status(200).send({ otp, message: 'OTP sent successfully' });  // Send OTP back to verify
        }
    });
});

app.post('/verify-otp', (req, res) => {
    const { enteredOtp, generatedOtp } = req.body;
  
    console.log('Received OTP:', req.body); // Log the entire request body
    if (String(enteredOtp) === String(generatedOtp)) {
      return res.status(200).send('OTP verified successfully');
    } else {
      return res.status(400).send('Invalid OTP');
    }
  });

  // POST API to create a new user
app.post('/Newuser', async (req, res) => {
    const { username, password, email, phoneNumber } = req.body;
  console.log(req.body)
    // Validate required fields
    if (!username || !password || !email) {
      return res.status(400).json({ message: 'Username, password, and email are required.' });
    }
  
    try {
      // Check if the user already exists
      const existingUser = await User.findOne({ $or: [{ username }, { email }] });
      if (existingUser) {
        return res.status(400).json({ message: 'User with this username or email already exists.' });
      }
  
      // Hash password before saving
      const hashedPassword = await bcrypt.hash(password, 10);
  
      // Create a new user
      const newUser = new User({
        username,
        password: hashedPassword,
        email,
        phoneNumber,
      });
  
      // Save the user to the database
      await newUser.save();
  
      // Send response
      res.status(201).json({ message: 'User created successfully!', user: newUser });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: 'Server error, please try again later.' });
    }
  });

// Login in to the Account

// app.post("/login", async (req, res) => {
//     console.log(req.body);

//     // Fetch user data based on the email provided
//     let fetchedData = await User.find({ email: req.body.email });
//     console.log(fetchedData);

//     // Check if the user exists
//     if (fetchedData.length > 0) {
//         // Validate the password
//         if (fetchedData[0].password === req.body.password) {
//             // // Prepare data to send back
//             // let dataToSend = {
               
//             // };
//             res.json({ status: "Success", msg: "Login Successfully ✅", data: dataToSend });
//         } else {
//             res.json({ status: "Failed", msg: "Invalid Password ❌" });
//         }
//     } else {
//         res.json({ status: "Failed", msg: "User Does Not Exist ❌" });
//     }
// });

let ItemsSchema = {
    text:{
        type:String,
        required:true
    },
    category:{
        type:String,
        required:true
    },
    file:{
        type:String,
        required:true
    }
}

let Item = mongoose.model("Item",ItemsSchema);

app.post("/NewItem",upload.array("file"),async(req,res)=>{

    let ItemArr=await Item.find().and({text:req.body.text});
    if (ItemArr.length>0) {
        res.json({status:"failure",msg:"Text already Exist❌"});
    }else{
    try{
        let newItem = new Item({          
            
            file:req.files[0].path,
            text:req.body.text,
            category:req.body.category,
            

        });
        await newItem.save();
        res.json({status:"Success",msg:" Item Added Successfully✅"});
    }catch(error){
        res.json({status:"Failed",error:error,msg:"Invalid Details ❌"});
        console.log(error)
    }
    }
}
);

app.get('/ItemData/:category', async (req, res) => {
    const category = req.params.category;
    const searchText = req.query.search || ''; // Get search text from query parameters
    try {
      const items = await Item.find({
        category: category,
        text: { $regex: searchText, $options: 'i' }, // case-insensitive search
      });
  
      if (items.length === 0) {
        return res.status(404).json({ message: "No items found for this category and search text" });
      }
  
      res.status(200).json({ items });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Server Error", error });
    }
  });
  





