var User    = require('./app/models/user');
var config  = require('./config/database'); // get db config file
var NewOrders  = require('./app/models/neworders');
var api_key = 'key-9iqsdntu46hyam4x733l8fzctvl5gls3';
var domain = 'sandbox4b9aeb95096945bf9ea0f40ec1e12828.mailgun.org';
var mailgun = require('mailgun-js')({apiKey: api_key, domain: domain});
var cron = require('node-cron');
var moment = require ('moment');



var mongoose   = require('mongoose');
mongoose.connect(config.database);

// send new order update email
function sendmail(email,ordercount) {

var data = {
  from: 'Node Test User <me@sandbox4b9aeb95096945bf9ea0f40ec1e12828.mailgun.org>',
  to: email,
  subject: 'New order notification',
  text: 'You have ' + ordercount + ' new orders.'
};

if (ordercount == -1) {
  data.text = 'Walmart API authentication failed. Please verify your API credentials';
}

mailgun.messages().send(data, function (err, body) {
  if (err) {
            console.log("got an error: " + err);
        }
        //Else we can greet    and leave
        else {
            console.log(body);
        }
});
}

function getandsend(orderdata,interval) {
  var Now = new Date();
  var minutes = moment(Now).format("mm");
  var hours = moment(Now).format("hh");

  if (minutes == 0) { minutes = 60 };

  if (minutes/interval % 1 === 0) {
     console.log("time run:" + minutes + " Min schedule run:" + interval);
     sendmail(orderdata.email,orderdata.NewOrderCount);
   }
   else {
     if (hours/(interval/60) % 1 === 0 && minutes/interval % 1 === 0 ) {
       console.log("time run:" + minutes + " Hour schedule run:" + interval);
       sendmail(orderdata.email,orderdata.NewOrderCount);
     }
   }
  }


function lastrecord(user) {
  NewOrders.findOne({email:user.email}, {}, { sort: { 'created_at' : -1 } }, function(err, nworder) {
    getandsend(nworder,user.schedule);
 })
}

function sendtoall() {
// find all users then find latest new order record
User.find({}, function(err, allusers) {
      for (var i = 0, leni = allusers.length; i < leni; i++) {
       lastrecord(allusers[i]);
      } // for
    }); // find users
}

cron.schedule('*/15 * * * *', function(){
    console.log("Go!");
sendtoall();
});
