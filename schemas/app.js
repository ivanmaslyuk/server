var mongoose = require('mongoose');

var appSchema = new mongoose.Schema({
    humanName: String,
    systemName: { type: String, unique: true },
}, { timestamps: true });

module.exports = mongoose.model('app', appSchema);