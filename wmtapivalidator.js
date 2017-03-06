var sleep = require('sleep');
var rest = require('restler');
var moment = require ('moment');
var Now = new Date();
var AUTH_SIGNATUREarr = [];
var TIMESTAMParr = [];
var AUTH_SIGNATURE = '';
var TIMESTAMP = '';
var outputfilePath = './output.txt';

var responsecode = function validateKeys(user,callback){

    var javaresult = '';
    var strarr = [];
    var today = moment().format('YYYY-MM-DD');
    var todayUTC = today +"T08:00:00.000Z";
    var requestURL = 'https://marketplace.walmartapis.com/v3/orders?createdStartDate=' + todayUTC;
    //var requestURL = 'https://marketplace.walmartapis.com/v3/orders?createdStartDate=2017-01-01';
    var requestMethod = 'GET';
    var rescode ='';

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
      // console.log(AUTH_SIGNATURE);
      // console.log(TIMESTAMP);

    rest.get(requestURL, {
    headers : { "WM_SVC.NAME": "Walmart Marketplace",
     "WM_SEC.AUTH_SIGNATURE": AUTH_SIGNATURE,
     "WM_CONSUMER.ID": user.consumerID,
     "WM_SEC.TIMESTAMP": TIMESTAMP,
     "WM_QOS.CORRELATION_ID": "1234",
     "WM_CONSUMER.CHANNEL.TYPE": "0f3e4dd4-0514-4346-b39d-af0e00ea066d"}
   }).on('complete', function(result, response) {
     if (result instanceof Error) {
       console.log('Error:', result.message);
     } else {
        return callback(response.statusCode);
      }
      });

     }); // stdout

    ls.stderr.on('data', (data) => {
      console.log(`stderr: ${data}`);
    });

    ls.on('close', (code) => {
      // console.log(`child process exited with code ${code}`);
    });

  };  // and of validate keys function

module.exports.responsecode = responsecode;
