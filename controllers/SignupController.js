const UserModel = require('../models/user')

exports.handleSignupRequest = async (req, res) => {
    // check if all info was passed
    if (!req.body.email || !req.body.password) {
        return res.status(401).json({ message: 'Either email or password weren\'t passed' })
    }

    // TODO: check password validity

    // save
    try {
        const user = await UserModel.save({ email: req.body.email, password: req.body.password })
        return res.status(200).json(user)
    }
    catch (err) {
        return res.status(401).json({ message: 'This username is taken.' })
    }
}