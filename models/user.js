const User = require('../schemas/user')

exports.findByEmail = async (email) => {
    return await User.findOne({ email })
}

exports.findById = async (id) => {
    return await User.findById(id)
}

exports.save = (user) => {
    return new Promise((resolve, reject) => {
        const newUser = new User(user);
        newUser.save((err, user) => {
            if (err) {
                return reject(err);
            }
            resolve({ id: user.id, email: user.email })
        })
    })
}