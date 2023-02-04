const jwt = require('jsonwebtoken');
const config = require('./config');

module.exports = (req, res, next) => {
    const token = req.body.token || req.query.token || req.headers['authorization'];
    const token1 = token?.substr(7, token?.length);
    // decode token
    if (token1) {
        // verifies secret and checks exp
        jwt.verify(token1, config.secret, function (err, decoded) {
            if (err) {
                return res.status(401).json({ "error": true, "message": 'Unauthorized access.' });
            }
            req.decoded = decoded;
            next();
        });
    } else {
        // if there is no tokens
        // return an error
        return res.status(403).send({
            "error": true,
            "message": 'Access Forbidden fruit'
        });
    }
}