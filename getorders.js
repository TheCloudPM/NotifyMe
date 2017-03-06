var JFile=require('jfile');
var cron = require('node-cron');
var User    = require('./app/models/user');
var config  = require('./config/database'); // get db config file
var NewOrders  = require('./app/models/neworders');
var sleep = require('sleep');
var rest = require('restler');
var moment = require ('moment');
var Now = new Date();
var outputfilePath = './output.txt';
var AUTH_SIGNATUREarr = [];
var TIMESTAMParr = [];
var AUTH_SIGNATURE = '';
var TIMESTAMP = '';
var fs = require('fs'),
    xml2js = require('xml2js');
var parser = new xml2js.Parser();

var mongoose   = require('mongoose');
mongoose.connect(config.database);

// XML response cleanup - Stackoverflow comment
var cleanXML = function(xml){
    var keys = Object.keys(xml),
        o = 0, k = keys.length,
        node, value, singulars,
        l = -1, i = -1, s = -1, e = -1,
        isInt = /^-?\s*\d+$/,
        isDig = /^(-?\s*\d*\.?\d*)$/,
        radix = 10;

    for(; o < k; ++o){
        node = keys[o];

        if(xml[node] instanceof Array && xml[node].length === 1){
            xml[node] = xml[node][0];
        }

        if(xml[node] instanceof Object){
            value = Object.keys(xml[node]);

            if(value.length === 1){
                l = node.length;

                singulars = [
                    node.substring(0, l - 1),
                    node.substring(0, l - 3) + 'y'
                ];

                i = singulars.indexOf(value[0]);

                if(i !== -1){
                    xml[node] = xml[node][singulars[i]];
                }
            }
        }

        if(typeof(xml[node]) === 'object'){
            xml[node] = cleanXML(xml[node]);
        }

        if(typeof(xml[node]) === 'string'){
            value = xml[node].trim();

            if(value.match(isDig)){
                if(value.match(isInt)){
                    if(Math.abs(parseInt(value, radix)) <= Number.MAX_SAFE_INTEGER){
                        xml[node] = parseInt(value, radix);
                    }
                }else{
                    l = value.length;

                    if(l <= 15){
                        xml[node] = parseFloat(value);
                    }else{
                        for(i = 0, s = -1, e = -1; i < l && e - s <= 15; ++i){
                            if(value.charAt(i) > 0){
                                if(s === -1){
                                    s = i;
                                }else{
                                    e = i;
                                }
                            }
                        }

                        if(e - s <= 15){
                            xml[node] = parseFloat(value);
                        }
                    }
                }
            }
        }
    }

    return xml;
};

// save orders to order record
function saverecord(orderdata,user){

  var newOrderRec = new NewOrders({
    consumerID: '',
    email: '',
    NewOrderCount: 0,
    ordertotal: 0,
    created_at: ''
  });
  // write order record
  newOrderRec.NewOrderCount=orderdata.ordercount;
  newOrderRec.ordertotal=orderdata.ordertotal;
  newOrderRec.consumerID=user.consumerID;
  newOrderRec.email=user.email;

  console.log(newOrderRec);

  newOrderRec.save(function(error) {
  if (error) {
      console.log("saving record failed");
      return false;
    }
    console.log("record saved" + Now);
  });


}


function getorders(user){

    var javaresult = '';
    var strarr = [];
    var today = moment().format('YYYY-MM-DD');
    var todayUTC = today +"T08:00:00.000Z";
    var requestURL = 'https://marketplace.walmartapis.com/v3/orders?createdStartDate=' + todayUTC;
    //var requestURL = 'https://marketplace.walmartapis.com/v3/orders?createdStartDate=2017-01-01';
    var requestMethod = 'GET';
    var MPorders = [];


    const spawn = require('child_process').spawn;
    const ls = spawn('java', ['-jar', 'DigitalSignatureUtil-1.0.0.jar', 'DigitalSignatureUtil',requestURL,user.consumerID,user.pKey,requestMethod,outputfilePath]);

    sleep.msleep(500);
    ls.stdout.on('data', (data) => {
      if (!!data)
           javaresult += data;
//      console.dir(javaresult, { showHidden: true, depth: null });
      strarr = javaresult.toString().split("\n");
      AUTH_SIGNATUREarr=strarr[0].toString().split(":");
      TIMESTAMParr=strarr[1].toString().split(":");
      AUTH_SIGNATURE=AUTH_SIGNATUREarr[1];
      TIMESTAMP=TIMESTAMParr[1];
      console.log(AUTH_SIGNATURE);
      console.log(TIMESTAMP);
      console.log(user.consumerID);

    rest.get(requestURL, {
    headers : { "WM_SVC.NAME": "Walmart Marketplace",
     "WM_SEC.AUTH_SIGNATURE": AUTH_SIGNATURE,
     "WM_CONSUMER.ID": user.consumerID,
     "WM_SEC.TIMESTAMP": TIMESTAMP,
     "WM_QOS.CORRELATION_ID": "1234",
     "WM_CONSUMER.CHANNEL.TYPE": "0f3e4dd4-0514-4346-b39d-af0e00ea066d"}
   }).on('complete', function(result, response) {

     var orderdata = {
       ordercount: 0,
       ordertotal: 0
     }

     var sumofcharges = 0;

     if (result instanceof Error) {
       console.log('Error:', result.message);
     } else {
          result=cleanXML(result);
          // console.dir(result, { showHidden: true, depth: null });

          if (result["ns2:errors"]) {
            orderdata.ordercount = -1;
            orderdata.ordetotal = 0;
          };

          if (result["ns4:errors"]) {
            orderdata.ordercount = 0;
            orderdata.ordetotal = 0;
          }
          else {

          MPorders = result["ns3:list"]["ns3:elements"]["ns3:order"];
          // only 1 order
          if (!MPorders.length) {
            orderlines=MPorders["ns3:orderLines"];
            // console.log ("Orderlines:" + orderlines.length);
            for (var y = 0, leny = orderlines.length; y < leny; y++) {
              ordercharges=orderlines[y]["ns3:charges"];
              orderstatus=orderlines[y]["ns3:orderLineStatuses"]["ns3:orderLineStatus"]["ns3:status"];
              for (var z = 0, lenz = ordercharges.length; z < lenz; z++) {
                // console.dir(ordercharges[z], { showHidden: true, depth: null });
                productcharge=ordercharges[z]["ns3:chargeAmount"]["ns3:amount"];
                sumofcharges +=productcharge;
              }
              // console.log('orderstatus:' + orderstatus);
              if (orderstatus == 'Created') {
                orderdata.ordercount++;
                orderdata.ordertotal +=sumofcharges;
                sumofcharges=0;
              }
            }
          }
          else {
          for (var x = 0, lenx = MPorders.length; x < lenx; x++) {
            orderlines=MPorders[x]["ns3:orderLines"];
            // console.log ("Orderlines:" + orderlines.length);
            for (var y = 0, leny = orderlines.length; y < leny; y++) {
              ordercharges=orderlines[y]["ns3:charges"];
              orderstatus=orderlines[y]["ns3:orderLineStatuses"]["ns3:orderLineStatus"]["ns3:status"];
              for (var z = 0, lenz = ordercharges.length; z < lenz; z++) {
                // console.dir(ordercharges[z], { showHidden: true, depth: null });
                productcharge=ordercharges[z]["ns3:chargeAmount"]["ns3:amount"];
                sumofcharges +=productcharge;
              }
              // console.log('orderstatus:' + orderstatus);
              if (orderstatus == 'Created') {
                orderdata.ordercount++;
                orderdata.ordertotal +=sumofcharges;
                sumofcharges=0;
              }
            }
          }

        }
   }
 }
   saverecord(orderdata,user);
 }); // and of get function

});

ls.stderr.on('data', (data) => {
  console.log(`stderr: ${data}`);
});

ls.on('close', (code) => {
  // console.log(`child process exited with code ${code}`);
});

} // end getorders


// get all users and check for new orders for each user
function ordercheck(){
  User.find({}, function(err, allusers) {
  for (var i = 0, leni = allusers.length; i < leni; i++) {
    if (allusers[i].firstlogin === false) {
        getorders(allusers[i]);
    }
  }
  });
}
 // all users

// check for new orders every 5 min
cron.schedule('*/10 * * * *', function(){
   console.log("Go! " + Now);
   ordercheck();
});
