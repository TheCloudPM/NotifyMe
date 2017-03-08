// server.js

// BASE SETUP
// =============================================================================


// call the packages we need
var express    = require('express');        // call express
var app        = express();

// var express = require('express')
//  , cors = require('cors')
//  , app = express();                 // define our app using express

var bodyParser = require('body-parser');
var morgan      = require('morgan');
var passport	= require('passport');
var config      = require('./config/database'); // get db config file
var User        = require('./app/models/user'); // get the mongoose model
var NewOrders   = require('./app/models/neworders');
var jwt         = require('jwt-simple');
var moment      = require ('moment');

var WMTapi = require ('./wmtapivalidator.js');
var WMTorders = require ('./wmtgetorders.js');

var mongoose   = require('mongoose');
mongoose.connect(config.database);


// pass passport for configuration
require('./config/passport')(passport);

// configure app to use bodyParser()
// this will let us get the data from a POST
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

var port = process.env.PORT || 8080;        // set our port

// ROUTES FOR OUR API
// =============================================================================
var router = express.Router();              // get an instance of the express Router

// middleware to use for all requests
router.use(function(req, res, next) {
    // do logging
    console.log('Something is happening.');
    console.log(req.method, req.url);
    // prevent CORS as per blog
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");

    next(); // make sure we go to the next routes and don't stop here
});

// test route to make sure everything is working (accessed at GET http://localhost:8080/api)
router.get('/', function(req, res) {
    res.json({ message: 'hooray! welcome to our api!' });
});

// USER MANAGEMENT

router.post('/users/signup', function(req, res) {
  if (!req.body.name || !req.body.password) {
    res.json({success: false, msg: 'Please pass name and password.'});
  } else {
    var newUser = new User({
      name: req.body.name,
      password: req.body.password,
      firstlogin: true
    });
    // save the user
    newUser.save(function(err) {
      if (err) {
        return res.json({success: false, msg: 'Username already exists.'});
      }
      res.json({success: true, msg: 'Successful created new user.'});
    });
  }
});

router.post('/users/authenticate', function(req, res) {
  User.findOne({
    name: req.body.name
  }, function(err, user) {
    if (err) throw err;

    if (!user) {
      res.send({success: false, msg: 'Authentication failed. User not found.'});
    } else {
      // check if password matches
      user.comparePassword(req.body.password, function (err, isMatch) {
        if (isMatch && !err) {
          // if user is found and password is right create a token
          var token = jwt.encode(user, config.secret);
          // return the information including token as JSON
          res.json({success: true, token: 'JWT ' + token});
        } else {
          res.send({success: false, msg: 'Authentication failed. Wrong password.'});
        }
      });
    }
  });
});

// route to a restricted info (GET http://localhost:8080/api/memberinfo)
router.get('/users/memberinfo', passport.authenticate('jwt', { session: false}), function(req, res) {
  var token = getToken(req.headers);
  if (token) {
    var decoded = jwt.decode(token, config.secret);
    User.findOne({
      name: decoded.name
    }, function(err, user) {
        if (err) throw err;

        if (!user) {
          return res.status(403).send({success: false, msg: 'Authentication failed. User not found.'});
        } else {
          res.json({success: true,
                    msg: user.name,
                    user: user.name,
                    email: user.email,
                    consumerID: user.consumerID,
                    pKey: user.pKey,
                    schedule: user.schedule,
                    notify: user.notify,
                    notifyzero: user.notifyzero,
                    firstlogin: user.firstlogin });
        }
    });
  } else {
    return res.status(403).send({success: false, msg: 'No token provided.'});
  }
});


router.post('/users/update/nokeys', passport.authenticate('jwt', { session: false}), function(req, res) {
  var token = getToken(req.headers);
  if (token) {
    var decoded = jwt.decode(token, config.secret);
    User.findOne({
      name: decoded.name
    }, function(err, user) {
        if (err) throw err;

        if (!user) {
          return res.status(403).send({success: false, msg: 'Authentication failed. User not found.'});
        } else {
          user.email = req.body.email;
          user.schedule = req.body.schedule;
          user.notify = req.body.notify;
          user.notifyzero = req.body.notifyzero;
          user.save();
          res.json({success: true, msg: 'Record updated!' + req.body.consumerID });
        }
    });
  } else {
    return res.status(403).send({success: false, msg: 'No token provided.'});
  }
});

router.post('/users/update', passport.authenticate('jwt', { session: false}), function(req, res) {
  var token = getToken(req.headers);
  if (token) {
    var decoded = jwt.decode(token, config.secret);
    User.findOne({
      name: decoded.name
    }, function(err, user) {
        if (err) throw err;

        if (!user) {
          return res.status(403).send({success: false, msg: 'Authentication failed. User not found.'});
        } else {
          user.consumerID = req.body.consumerID;
          user.pKey = req.body.pKey;
          user.email = req.body.email;
          user.schedule = req.body.schedule;
          user.notify = req.body.notify;
          user.notifyzero = req.body.notifyzero;
          user.firstlogin = req.body.firstlogin;
          user.save();
          res.json({success: true, msg: 'Record updated!' + req.body.consumerID });
        }
    });
  } else {
    return res.status(403).send({success: false, msg: 'No token provided.'});
  }
});

router.get('/orders', passport.authenticate('jwt', { session: false}), function(req, res) {
  var token = getToken(req.headers);
  if (token) {
    var decoded = jwt.decode(token, config.secret);
    User.findOne({
      name: decoded.name
    }, function(err, user) {
        if (err) throw err;

        if (!user) {
          return res.status(403).send({success: false, msg: 'Authentication failed. User not found.'});
        } else {
            NewOrders.findOne({email:user.email}, {}, { sort: { 'created_at' : -1 } }, function(error, nworder) {
             var PTdate = moment(nworder.created_at).format("MM-DD-YY hh:mm:ss a");
             res.json({success: true, orders: nworder.NewOrderCount, ordertotal:nworder.ordertotal, createdate: PTdate });
            });
          }
          });
  } else {
    return res.status(403).send({success: false, msg: 'No token provided.'});
  }
});

router.post('/orders/live', passport.authenticate('jwt', { session: false}), function(req, res) {
  var token = getToken(req.headers);
  var apicreds = { consumerID: req.body.consumerID,
                   pKey: req.body.pKey };
  if (token) {
    var decoded = jwt.decode(token, config.secret);
    User.findOne({
      name: decoded.name
    }, function(err, user) {
        if (err) throw err;

        if (!user) {
          return res.status(403).send({success: false, msg: 'Authentication failed. User not found.'});
        } else {
             WMTorders.orderdata(apicreds,function(response) {
               var PTdate = moment().utcOffset("-08:00").format("MM-DD-YY hh:mm:ss a");
               res.json({success: true, orders: response.ordercount, ordertotal:response.ordertotal, createdate: PTdate });
             })
           }
          }
        ); // findone
  } else {
    return res.status(403).send({success: false, msg: 'No token provided.'});
  }
});

router.post('/orders/keys/validate', passport.authenticate('jwt', { session: false}), function(req, res) {
  var token = getToken(req.headers);
  var apicreds = { consumerID: req.body.consumerID,
                   pKey: req.body.pKey };

  if (token) {
    var decoded = jwt.decode(token, config.secret);
    User.findOne({
      name: decoded.name
    }, function(err, user) {
        if (err) throw err;
        if (!user) {
          return res.status(403).send({success: false, msg: 'Credentials invalid'});
        } else {
             WMTapi.responsecode(apicreds,function(response){
               if (response != '401') {
                 res.json({success: true, msg: 'Credentials valid' });
               } else {
                 res.json({success: false, msg: 'Credentials invalid' });
               }
             });
              }
            } //callback
          );
  } else {
    return res.status(403).send({success: false, msg: 'No token provided.'});
  }
});

getToken = function (headers) {
  if (headers && headers.authorization) {
    var parted = headers.authorization.split(' ');
    if (parted.length === 2) {
      return parted[1];
    } else {
      return null;
    }
  } else {
    return null;
  }
};

// REGISTER OUR ROUTES -------------------------------
// all of our routes will be prefixed with /api
app.use('/api', router);

// START THE SERVER
// =============================================================================
app.listen(port);
console.log('Magic happens on port ' + port);
