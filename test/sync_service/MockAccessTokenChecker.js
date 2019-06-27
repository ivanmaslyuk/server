function JsonWebTokenError() {
    this.name = 'JsonWebTokenError'
    this.message = 'JsonWebTokenError Mock Error'
}

exports.getAccessTokenPayload = (token) => {
    if (token === 'INVALID.ACCESS.TOKEN') {
        throw new JsonWebTokenError()
    }
    else {
        return {
            userId: token
        }
    }
}