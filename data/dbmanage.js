
var Datastore = require('nedb');


exports.db = db = {};
exports.user = db.user = new Datastore('./data/users.db');
exports.book = db.book = new Datastore('./data/books.db');
exports.review = db.review = new Datastore('./data/reviews.db')
