// const jwt = require('jsonwebtoken')
//const key = require('../key')
const sign = require('../AccessTokenHelper').sign
const UserModel = require('../models/user')

exports.handleAuthRequest = async (req, res) => {
    // check if all info was passed
    if (!req.body.email || !req.body.password) {
        return res.status(401).json({ message: 'Either email or password weren\'t passed' })
    }

    try {
        const user = await UserModel.findByEmail(req.body.email)
        user.comparePassword(req.body.password, (err, isMatch) => {
            if (isMatch) {
                var token = sign({ userId: user.id })
                res.status(200).json({
                    userId: user.id,
                    email: user.email,
                    token
                })
            }
            else {
                res.status(401).json({ message: 'Invalid Password/Username' })
            }
        })
    }
    catch (err) {
        res.status(401).json({ message: 'Invalid Password/Username' })
    }
}