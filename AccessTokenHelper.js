const jwt = require('jsonwebtoken')
const UserModel = require('./models/user')

const tokenKey = "djghhhhuuwiwuefgdsgfsdguriwu" // СЕКРЕТНЫЙ КЛЮЧ

/*function verifyToken(token) {
    return new Promise((resolve, reject) => {
        try {
            jwt.verify(token, tokenKey, (err, payload) => {
                if (err) {
                    return reject(err)
                }

                resolve(payload)
            })
        }
        catch (err) {
            reject(err)
        }
    })
}*/

// exports.getUserCredentialsFromAccessToken = async (token, secretKey) => {
//     const payload = await verifyToken(token, secretKey)
//     return await UserModel.findById(payload.userId)
// }

exports.getAccessTokenPayload = (token) => {
    //return await verifyToken(token)
    return jwt.verify(token, tokenKey)
}

exports.sign = (payload) => {
    return jwt.sign(payload, tokenKey)
}