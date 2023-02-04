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
const jwt = require('jsonwebtoken');
const cors = require('cors');
const config = require('./config')
const tokenList = {}

var app = Express();

app.use(cors())

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

    const user = await User.findOne({ username }).lean();

    if (!user) {
        return res.json({ status: 'error', error: 'Invalid username here/ password' + user })
    }

    if (await bycript.compare(password, user.password)) {
        const token = jwt.sign({ username: user.username, password: user.password }, config.secret, { expiresIn: config.tokenLife });
        const refreshToken = jwt.sign(user, config.refreshTokenSecret, { expiresIn: config.refreshTokenLife })
        tokenList[refreshToken] = res;
        return res.send({
            status: 'Ok',
            accessToken: token,
            refreshToken: refreshToken
        })
    }
    res.json({ status: 'error', error: 'Invalid username/ password' })
})

app.post('/token', (req, res) => {
    // refresh the damn token
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

app.post('/api/register', async (req, res) => {
    const { username, password: plainTextPassword } = req.body;

    if (!username || typeof username !== 'string') {
        return res.json({ status: 'error', error: 'Invalid username' })
    }

    if (!plainTextPassword || typeof plainTextPassword !== 'string') {
        return res.json({ status: 'error', error: 'Invalid username' })
    }

    if (plainTextPassword.length < 5) {
        res.json({ status: 'error', status: 'password too small, should be atleast 6 characters long!' })
    }

    const password = await bycript.hash(plainTextPassword, 10);
    try {
        const response = await User.create({
            username, password
        })
        console.log("Username successfully created!!");
    } catch (error) {
        if (error.code === 11000) {
            return res.json({ error: 'error', error: 'Username already in use' })
        }
        console.log(error.message);
        throw error
    }
    res.json({ status: 'ok' });
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

//   app.get('/add-user',(req,res)=>{
//     const user = new User({
//         username: "keilo",
//         password: "not-secure",
//         firstname:"okello",
//         status:"active",
//         role: "normal-user"
//     })
//     user.save()
//     .then((result)=> {
//         res.send(result)
//     })
//     .catch((err)=>{
//         console.log(err);
//     })
//   })

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
