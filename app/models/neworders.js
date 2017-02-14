var mongoose = require('mongoose');
var Schema = mongoose.Schema;

// Thanks to http://blog.matoski.com/articles/jwt-express-node-mongoose/

// set up a mongoose model
var NewOrderSchema = new Schema({
  consumerID: {
        type: String,
        required: true
    },
  email: {
        type: String,
        required: true
    },
  NewOrderCount: Number,
  ordertotal: Number,
  created_at: Date
});

NewOrderSchema.pre('save', function(next){
  now = new Date();
  this.updated_at = now;
  if ( !this.created_at ) {
    this.created_at = now;
  }
  next();
});

module.exports = mongoose.model('NewOrders', NewOrderSchema);
