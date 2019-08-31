const { getAccessTokenPayload } = require('./AccessTokenHelper')
const User = require('./schemas/user')

module.exports.AccessTokenMiddleware = (req, res, next) => {
    try {
        const payload = getAccessTokenPayload(req.headers.authorization)
        if (payload) {
            User.findById(payload.userId).then(
                (doc) => {
                    req.user = doc
                    next()
                }
            )
        } else {
            next()
        }
    } catch (e) {
        next()
    }
}