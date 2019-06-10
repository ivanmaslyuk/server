const jwt = require('jsonwebtoken')
const UserModel = require('./models/user')

function verifyToken(token, secretKey) {
    return new Promise((resolve, reject) => {
        try {
            jwt.verify(token, secretKey, (err, payload) => {
                if (err) {
                    return reject(err)
                }
    
                resolve(payload)
            })
        }
        catch(err) {
            reject(err)
        }
    })
} 

exports.getUserCredentialsFromAccessToken = async (token, secretKey) => {
    const payload = await verifyToken(token, secretKey)
    return await UserModel.findById(payload.userId)
}

exports.getAccessTokenPayload = async (token, secretKey) => {
    return await verifyToken(token, secretKey)
}