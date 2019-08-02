const AppModel = require('../schemas/app');

module.exports.get = async (req, res) => {
    const apps = await AppModel.find();
    res.status(200).json(apps);
}

module.exports.post = async (req, res) => {
    // TODO: check if systemName already exists
    const app = AppModel({
        humanName: req.body['humanName'],
        systemName: req.body['systemName'],
    })
    try {
        await app.save();
    } catch (error) {
        res.status(400).send('An app with this systemName already exists.');
    }
    res.status(201).send();
}