const jwt = require('jsonwebtoken');

const tokenKey = "djghhhhuuwiwuefgdsgfsdguriwu"; // СЕКРЕТНЫЙ КЛЮЧ

exports.getAccessTokenPayload = (token) => {
    return jwt.verify(token, tokenKey);
}

exports.sign = (payload) => {
    return jwt.sign(payload, tokenKey);
}