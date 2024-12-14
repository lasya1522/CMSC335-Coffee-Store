const express = require("express"); /* Accessing express module */
const path = require("path"); /* Module for path */
const app = express(); /* app is a request handler function */
const dbUtils = require("./dbUtils");
const bcryptjs = require('bcryptjs');
const session = require('express-session');
const cookieParser = require("cookie-parser");
const bodyParser = require("body-parser");
require("dotenv").config({ path: path.resolve(__dirname, '.env') });
const sessionSecret = process.env.SESSION_SECRET;
/* Port Number */
const portNum = process.env.PORT;
/* Application makes API call to fake-coffee-api.vercel.app */
const url = "https://fake-coffee-api.vercel.app/api";
let products = [];

app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
/* read style sheets and images from public folder */
app.use(express.static("public"));
/* set the template path */
app.set("views", path.resolve(__dirname, "templates"));
/* set view engine as ejs */
app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: true })); // Parse form data
process.stdin.setEncoding("utf8");

/* session middleware */
app.use(session({
    secret: sessionSecret, // A secret key used to sign the session ID cookie
    resave: true, // Forces the session to be saved back to the session store
    saveUninitialized: false, // Forces a session that is "uninitialized" 
    cookie: {
      maxAge: 1200000, // Sets the expiration time in milliseconds (20 mins)
    }
}));

/* Application makes API call to products endpoint of fake-coffee-api service */
fetch(url)
    .then(response => response.json())
    .then(json => products = json)
    .catch(error => console.log("External API call error: " + error));

// Route to render login page
app.get('/', (request, response) => {
    response.render('login', { failed : false, logout : false });
});

/* post login */
app.post("/login", async(request, response) => {
    let { username, password } =  request.body;
    /* get username is lower case */
    username = username.toLowerCase();
    let filter = { username: username };
    let dbUserInfo = await dbUtils.findByUserName(filter);
    if (dbUserInfo){
        const passwordMatch = await bcryptjs.compare(
                password, dbUserInfo.password);
        if (passwordMatch){
            /* store username in session variable*/
            request.session.user = username;
            request.session.save();
            response.render('home', { username: username });
        } else {
            response.render('login', { failed : true, logout : false });
        }
    } else {
        response.render('login', { failed : true , logout : false });
    }
});

// Route to render signup page
app.get('/signup', (req, res) => {
    res.render('signup', { failed : false });
});

/* post sign in page */
app.post("/signup", async(request, response) => {
    let { username, password } =  request.body;
    /* get username is lower case */
    username = username.toLowerCase();
    let filter = { username: username };
    let dbUserInfo = await dbUtils.findByUserName(filter);
    /* if a user is found */ 
    if (dbUserInfo){
        response.render('signup', { failed : true });
    } else {
        const saltRounds = 5;
        const hashedPassword = await bcryptjs.hash(password, saltRounds);
        let userInfo = {username: username, password: hashedPassword};
        /*  insert user document into collection */
        dbUtils.createUser(userInfo).catch(console.error);
        /* store username in session variable*/
        request.session.user = username;
        request.session.save();
        response.render("home", { username: username });
    }
});

/* This endpoint renders the home.ejs template file. */
app.get("/home", (request, response) => {
    /* check username is in session, if not redirect to login */
    if (!request.session.user){
        response.render("login", { failed : false , logout : false });
    }else{
        response.render("home"); 
    }
});

app.get("/form", (req, res) => {
    
    res.render("form");
});

app.post("/filter", async (req, res) => {
    try {
        const apiUrl = "https://fake-coffee-api.vercel.app/api";
        const response = await fetch(apiUrl);
        const data = await response.json();

        const { roast, price, flavor } = req.body;
        userPreferences = { roast, price, flavor }; // Save preferences

        // Filtering logic
        let filtered = data.filter((product) => parseInt(product.roast_level) === parseInt(roast));

        if (price) {
            filtered = filtered.filter((product) => {
                const productPrice = parseFloat(product.price);
                if (price === "$") return productPrice < 10.0;
                if (price === "$$") return productPrice >= 10.0 && productPrice <= 13.0;
                return productPrice > 13.0;
            });
        }

        const flavorCategories = {
            Chocolate: ["Chocolate", "Cocoa"],
            Nutty: ["Hazelnut", "Nutty", "Coconut", "Almond"],
            Fruity: ["Citrusy", "Black Cherry", "Citrus", "Blackcurrant", "Fruit", "Tropical Fruit"],
            Rich: ["Caramel", "Smoke", "Espresso", "Cinnamon"],
        };

        if (flavor && flavorCategories[flavor]) {
            const keywords = flavorCategories[flavor];
            filtered = filtered.filter((product) =>
                product.flavor_profile.some((profile) =>
                    keywords.some((keyword) => profile.includes(keyword))
                )
            );
        }

        res.render("order", { coffees: filtered });
    } catch (error) {
        console.error("Error during filtering:", error);
        res.status(500).send("Error during filtering.");
    }
});

/* Get the order page */
app.get('/order', (req, res) => {
    // Check if user is in session, if not redirect to login
    if (!req.session.user) {
        res.render('login', { failed: false, logout: false });
    } else {
        // Prepare filtered coffees or other dynamic content as needed
        const filteredCoffees = []; // Replace with actual logic to fetch available coffees
        res.render('order', { currentPage: 'order', coffees: filteredCoffees });
    }
});

/* Post the order */
app.post('/order', async (req, res) => {
    if (!req.session.user) {
        res.render('login', { failed: false, logout: false });
    } else {
        try {
            const coffeeIds = req.body.selected_coffees;
            if (!coffeeIds) {
                return res.render('summary', { selectedCoffees: [], totalCost: 0 });
            }

            const selectedCoffeeIds = Array.isArray(coffeeIds) ? coffeeIds : [coffeeIds];
            const apiUrl = "https://fake-coffee-api.vercel.app/api";
            const apiResponse = await fetch(apiUrl);
            const allCoffees = await apiResponse.json();

            const selectedCoffees = allCoffees.filter(coffee =>
                selectedCoffeeIds.includes(coffee.id.toString())
            );

            const totalCost = selectedCoffees.reduce((sum, coffee) => sum + parseFloat(coffee.price), 0).toFixed(2);

            const order = {
                username: req.session.user,
                coffees: selectedCoffees,
                totalCost: totalCost,
                createdAt: new Date().toLocaleString()
            };

            await dbUtils.createOrder(order);

            res.render('summary', { selectedCoffees, totalCost });
        } catch (error) {
            console.error("Error placing order:", error);
            res.status(500).send("Error placing order.");
        }
    }
});

// /* Get the summary page */
// app.get("/summary", async (req, res) => {
//     try {
//         const apiUrl = "https://fake-coffee-api.vercel.app/api";
//         const response = await fetch(apiUrl);
//         const data = await response.json();
//         const selectedCoffees = req.body.selected_coffees || []; // Check if this is defined
//         const orderedCoffees = data.filter(coffee => selectedCoffees.includes(coffee.id.toString()));
//         const totalCost = orderedCoffees.reduce((sum, coffee) => sum + parseFloat(coffee.price), 0).toFixed(2);

//         res.render("summary", { orderedCoffees, totalCost });
//     } catch (error) {
//         console.error("Error generating summary:", error);
//         res.status(500).send("Error generating summary.");
//     }
// });



/* logout */
app.get("/logout", (request, response) => {
    /* check username is in session , if not redirect to login */
    if (request.session.user != undefined) {
        request.session.destroy();
    }
    response.render('login', { failed : false, logout : true });
});

/* listen for requests */
app.listen(portNum);
console.log(`Web server started and running at http://localhost:${portNum}`);


/* Command Line Interpreter */
const prompt = "Stop to shutdown the server: ";
process.stdout.write(prompt);
process.stdin.on("readable", function () {
    const dataInput = process.stdin.read();
    if (dataInput !== null) {
        const command = dataInput.trim();
        if (command === "stop") {
            console.log("Shutting down the server");
            process.exit(0);  /* exiting */
        } else { /* Invalid command */
            console.log(`Invalid command: ${command}`);
        }
        process.stdout.write(prompt);
        process.stdin.resume();
    }
});
  