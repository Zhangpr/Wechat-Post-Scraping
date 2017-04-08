var mongoose = require("mongoose");
mongoose.Promise = global.Promise;
var scrapeUtils = require("./scrape-utils");
var Message = require("./message-model");

var params = {
  __biz: "MjM5NTAyODc2MA==",
  uin: "MjM1NTkyMzc2NA==",
  key: "df6f5d5fe2a5520426ab4191b1d08a6a4d2c56253ffeab5e7258033f7573189a370563f672b0f3ffdf3344e6d41e4b156bbb5821834ae206d3101bec85007ef4108358274dbdbb0cfa418de42cb06af4",
  frommsgid: 1000000290,
  count: 10,
  f: "json"
};
var cookie = "wap_sid2=CLSWsuMIElx3ZFBUel9Gbk44MmFSZ0lnUTh4OGIxTktTSld1RElpbmd4NWxMWC1iQnhyWTVEMG14ZHJhMjZPNEpfX0tkMFhmdEtQdUZmYzM3YTdwOEdCZXhpakRRSU1EQUFBfjDg0qLHBQ==";
var keyword = "七言";

// connect to mongoDB
mongoose.connect("mongodb://localhost/wechat_post_scraping");
mongoose.connection.on('error', console.error.bind(console, 'connection error:'));
mongoose.connection.once("open", function () {
  doScraping();
});

function doScraping() {
  var isContinue, lastMsgId;
  scrapeUtils.getMsgList(params, cookie, keyword).then(function (result) {
    var msgList = result.msgList;
    isContinue = result.isContinue;
    lastMsgId = msgList[msgList.length - 1].msgId;
    var promises = [];
    for (var i = 0; i < msgList.length - 1; ++i) {
      promises.push(scrapeUtils.saveMsg(msgList[i]));
    }
    return Promise.all(promises);
  }).then(function () {
    if (isContinue === 1) {
      params.frommsgid = lastMsgId;
      setTimeout(doScraping, 10000);
      // setImmediate(doScraping);
    } else {
      console.log("Scraping done!");
      mongoose.connection.close();
    }
  }, function (err) {
    console.log("Error occurs, scraping stop!", err);
    mongoose.connection.close();
  });
}

