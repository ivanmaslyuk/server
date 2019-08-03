const AppModel = require('../schemas/app');

const projection = ['_id', 'humanName', 'systemName'];

module.exports.get = async (req, res) => {
    const apps = await AppModel.find({}, projection);
    res.status(200).json(apps);
}

module.exports.post = async (req, res) => {
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

module.exports.getOne = async (req, res) => {
    const app = await AppModel.findOne({ _id: req.params.id }, projection);
    if (app) {
        res.status(200).json(app);
    } else {
        res.status(404).send();
    }
}