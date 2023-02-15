const Express = require("express");
const ExpressGraphQL = require("express-graphql").graphqlHTTP;
const path = require('path')
const {
    GraphQLID,
    GraphQLString,
    GraphQLList,
    GraphQLObjectType,
    GraphQLSchema,
} = require("graphql");
const { default: mongoose } = require("mongoose");
const User = require("./models/user");
const bodyParser = require('body-parser');
const bycript = require('bcryptjs');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const config = require('./config')
const tokenList = {}

var app = Express();

const corsOptions = {
    origin: 'http://localhost:3000',
    credentials: true,            //access-control-allow-credentials:true
    optionSuccessStatus: 200
}
app.use(cors(corsOptions));

mongoose.connect("mongodb://admin:admin@127.0.0.1:27017/cashback?retryWrites=true&w=majority", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
}).then((result) => app.listen(9000, () => console.log("Server listening at port:9000.... "))).catch((err) => console.log(err));

app.use(bodyParser.urlencoded({
    extended: true
}));

app.use(bodyParser.json());

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({
        'message':
            'Username and password are required.'
    });

    const foundUser = await User.findOne({ username: username }).exec();
    // console.log(foundUser.roles);
    if (!foundUser) return res.sendStatus(401); //Unauthorized 
    // evaluate password 
    const match = await bcrypt.compare(password, foundUser.password);
    if (match) {
        const roles = Object.values(foundUser?.roles).filter(Boolean);
        // create JWTs
        const accessToken = jwt.sign({ username: foundUser.username, password: foundUser.password }
            , config.secret,
            { expiresIn: '10s' }
        );
        const refreshToken = jwt.sign(
            { "username": foundUser.username },
            config.refreshTokenSecret,
            { expiresIn: '1d' }
        );
        // Saving refreshToken with current user
        foundUser.refreshToken = refreshToken;
        const result = await foundUser.save();

        // Creates Secure Cookie with refresh token
        res.cookie('jwt', refreshToken, { httpOnly: true, secure: true, sameSite: 'None', maxAge: 24 * 60 * 60 * 1000 });

        // Send authorization roles and access token to user
        res.json({ roles, accessToken });
    } else {
        res.sendStatus(401);
    }
})

app.post('/api/register', async (req, res) => {
    const { user, pwd } = req.body;
    if (!user || !pwd) return res.status(400).json({ 'message': 'Username and password are required.' });

    // check for duplicate usernames in the db
    const duplicate = await User.findOne({ username: user }).exec();
    if (duplicate) return res.sendStatus(409); //Conflict 

    try {
        //encrypt the password
        const hashedPwd = await bcrypt.hash(pwd, 10);

        //create and store the new user
        const result = await User.create({
            "username": user,
            "password": hashedPwd
        });

        console.log(result);

        res.status(201).json({ 'success': `New user ${user} created!` });
    } catch (err) {
        res.status(500).json({ 'message': err.message });
    }

})

app.post('/token', (req, res) => {
    const postData = req.body;
    // if refresh token exists
    if ((postData.refreshToken) && (postData.refreshToken in tokenList)) {
        const user = {
            "username": postData.username,
            "password": postData.password
            // "email": postData.email,
            // "name": postData.name
        }
        const token = jwt.sign(user, config.secret, { expiresIn: config.tokenLife })
        const response = {
            "token": token,
        }
        // update the token in the list
        tokenList[postData.refreshToken].token = token
        res.status(200).json(response);
    } else {
        res.status(404).send('Invalid request')
    }
})

app.post('/api/change-password', async (req, res) => {
    const { token, newpassword: plainTextPassword } = req.body;

    if (!plainTextPassword || typeof plainTextPassword !== 'string') {
        return res.json({ status: 'error', error: 'Invalid username' })
    }

    if (plainTextPassword.length < 5) {
        res.json({ status: 'error', status: 'password too small, should be atleast 6 characters long!' })
    }

    try {
        const user = jwt.verify(token, JWT_SECRET)

        const _id = user.id

        const password = bycript.hash(plainTextPassword, 20)
        await User.updateOne({ _id }, {
            $set: { password }
        })
        console.log(user);
        res.json({ status: 'ok' })
    } catch (error) {
        console.log();
        res.json({ status: 'error', error: 'someone is trying to mess around with your shit!' })

    }
})

app.use('/', Express.static(path.join(__dirname, 'static')));

app.use(require('./tokenChecker'))

app.get("/all-users", (req, res) => {
    User.find()
        .then((result) => {
            res.send(result);
        })
        .catch((err) => {
            console.log(err);
        })
})

app.get("/single-user", (req, res) => {
    User.findById("63663863f46cb259824003f8")
        .then((result) => {
            res.send(result);
        })
        .catch((err) => {
            console.log(err);
        })
})

const PersonModel = mongoose.model("person", {
    firstname: String,
    lastname: String
})

const PersonType = new GraphQLObjectType({
    name: "Person",
    fields: {
        id: { type: GraphQLID },
        firstname: { type: GraphQLString },
        lastname: { type: GraphQLString }
    }
})

const scheme = new GraphQLSchema({
    query: new GraphQLObjectType({
        name: "Query",
        fields: {
            people: {
                type: new GraphQLList(PersonType),
                resolve: (root, args, context, info) => {
                    return PersonModel.find().exec();
                }
            },
            person: {}
        }
    })
})

app.use("/graphql", ExpressGraphQL({
    scheme: scheme,
    graphiql: true
}))
