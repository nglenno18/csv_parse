'use strict';

require('./config/config.js');

const path = require('path');
const http = require('http');
const socketIO = require('socket.io');
const publicPath = path.join(__dirname, '../public');
const port = process.env.PORT || 8080;
var express = require('express');
const mysql = require('mysql');

var app = express();
var server = http.createServer(app);
var io = socketIO(server);
var request = require('request');
var schedule = require("node-schedule");
var rule = new schedule.RecurrenceRule();
rule.hour = 3;

var trig = schedule.scheduleJob(rule, function(){
  var date = new Date();
  var stamp = new Date().toString("hh:mm tt");

  console.log('TRIGGERED RETRIEVAL', stamp);
  updateDB();
});

app.use(express.static(publicPath));

var config = {
    host: process.env.HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,

}

if (process.env.INSTANCE_CONNECTION_NAME) {
  // config.socketPath = `/cloudsql/${process.env.INSTANCE_CONNECTION_NAME}`;
}

const connection = mysql.createConnection(config);
connection.connect(function(err){
if(!err) {
    console.log("\n\nDatabase is connected ... \n\n");

    app.get('/csv', function(req,res){
      updateDB();
    });
} else {
    console.log("Error connecting database ... \n\n", err);
}
});

app.get('/', function(req,res){
  res.status(200).send('Hello from the Google Cloud');
});


var server = app.listen(process.env.PORT || '8080', function(){
  console.log('App listening on port %s', server.address().port);
  console.log('Press Ctrl+C to quit');

});

var updateDB = function(){

  request.get(process.env.PARSE, function (error, response, body) {
    //WorkID
    //FILEname
    //FolderName
    //URL
    var string = "";
    var array = [];
    var row= [];
    if (!error && response.statusCode == 200) {
      var b = body.replace(/'/g, "");
      var b = b.replace(/"/g, "");

        var str = b.split('\n');
        console.log('Retrieved data length: ', str.length);
        var entry = 1;
        var i = 1;
        var x = 0;
        for(x = 0; x <=str.length +4; x++){
        // for(x = 0; x <=5000; x++){
          if(i == 5){
            i = 1;
            entry ++;
          }
          if(i == 1 && x!= str.length-1){
            if(string != ""){
              // console.log('\n\n');
              array.push(row);
              row = [];
              string = "";
            }
          }
          if(str[x]){
            row.push(str[x]);
            string+= str[x];
          }
          i++;
        }
        connection.query('SELECT * FROM image_files;', function(er, res){
          if(er) console.log('ERROR selecting from image temp Table');
          console.log('\n Number of current SQL Entries: ', res.length);
          console.log('\n Number of URL csv Entries: ', array.length);
          for(x = 0; x < array.length; x++){
              //if the csv contains the row?
              //if not, delete from SQL
            // console.log('\n\n\n\n');
            var y = 0;
            var already = false;
            if(res.length!=0){
              for(y = 0; y <= res.length-1; y++){
                // console.log(`\n\nArray: ${array[x][1]}`);
                // console.log('Res: ', res[y].url);
                if(already == false && array[x][1] == res[y].url) already = true;
              }
            }

            if(!already){//add to SQL
              connection.query(
                'INSERT INTO image_files (work_order, url, description, file) VALUES(' + '"' +array[x][0] + '", "' + array[x][1] + '", "' + array[x][2] + '", "' + array[x][3] + '");',
              function(err,result){
                if(err) throw err;
                console.log('Insert successfull', x);
              });
            }
          }
        })
        // res.status(200).send(JSON.stringify(array, 2, undefined));
    }
    else{
      console.log(error);
    }
    console.log('\n\nDATABASE UPDATing');
});
}
