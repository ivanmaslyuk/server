const mongoose = require('mongoose');

const state = {
    db: null
};

exports.connect = (url, done) => {
    if (state.db) {
        return done();
    }

    mongoose.connect(url, { useNewUrlParser: true }, (err) => {
        if (err) {
            return done(err);
        }
    });

    state.db = mongoose.connection;
    state.db.on('error', console.error.bind(console, 'MongoDB connection error:'));
    done();
}

exports.get = () => {
    return state.db;
}