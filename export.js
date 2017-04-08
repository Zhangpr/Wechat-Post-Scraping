var fs = require("fs");
var mongoose = require("mongoose");
mongoose.Promise = global.Promise;
var Message = require("./message-model");

// connect to mongoDB
mongoose.connect("mongodb://localhost/debug_wechat");
mongoose.connection.on('error', console.error.bind(console, 'connection error:'));
mongoose.connection.once("open", function () {
  exportData();
});

function exportData() {
  var page = 0, pageSize = 10, total = 0;
  Message.count().exec().then(function (result) {
    total = result;
    doExporting(page, pageSize, total);
  });
}

function doExporting(page, pageSize, total) {
  if (page * pageSize < total) {
    paginateData(page, pageSize).then(function (results) {
      var promises = [];
      for (var i in results) {
        promises.push(writeMsgFile(results[i]));
      }
      return Promise.all(promises);
    }).then(function () {
      ++page;
      doExporting(page, pageSize, total);
    });
  } else {
    console.log("Exporting data done!");
    mongoose.connection.close();
  }
}

function paginateData(page, pageSize) {
  return new Promise(function (resolve, reject) {
    Message.find().skip(page * pageSize).limit(pageSize)
      .exec().then(function (results) {
        resolve(results);
      }, function (err) {
        reject(err);
      });
  });
}

function writeMsgFile(message) {
  return new Promise(function (resolve, reject) {
    // prepare params
    var datetime = new Date(message.datetime);
    var year = datetime.getFullYear(),
      month = datetime.getMonth() + 1,
      date = datetime.getDate();
    year = year + "";
    month = ((month < 10) ? ("0" + month) : (month + ""));
    date = ((date < 10) ? ("0" + date) : (date + ""));
    var path = "./posts/" + year + "/" + month + "/"
      + [year, month, date].join("-") + " " + message.title + ".html";

    // make dir if dir did not exist
    if (!fs.existsSync("./posts/")) {
      fs.mkdirSync("./posts/");
    }
    if (!fs.existsSync("./posts/" + year + "/")) {
      fs.mkdirSync("./posts/" + year + "/");
    }
    if (!fs.existsSync("./posts/" + year + "/" + month + "/")) {
      fs.mkdirSync("./posts/" + year + "/" + month + "/");
    }

    // write file
    fs.writeFile(path, message.html, {
      encoding: "utf8"
    }, function (err) {
      if (err) {
        reject(err)
      } else {
        console.log('File was written:', message.title);
        resolve();
      }
    });
  });
}
